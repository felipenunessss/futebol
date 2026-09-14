import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CampeonatoEstadual } from "../src/schemas/championship.js";
import type { CampeonatoNacional } from "../src/schemas/national-championship.js";

/**
 * Busca CANDIDATOS de imagem de taça/troféu no Wikimedia Commons (API
 * pública, sem chave) pra competições que `scripts/buscar-tacas.ts`
 * (TheSportsDB, só ligas de destaque) não cobre — a maioria dos estaduais
 * brasileiros, que o TheSportsDB não tem cadastrado. Diferente dos outros
 * scripts de escudo/taça: **este NÃO grava `taca_url` sozinho**. São fotos
 * reais de objetos físicos (não ícones padronizados de uma API curada),
 * então o risco de pegar a taça errada (ano errado, campeonato homônimo,
 * até taça de outro esporte) é bem maior — só busca e lista candidatos com
 * imagem + página de descrição + licença, pra confirmação manual visual
 * antes de qualquer gravação (mesmo padrão de conservadorismo usado nas
 * correções de escudo em `docs/dados-a-verificar.md`).
 *
 * Uso: `npx tsx scripts/buscar-tacas-wikimedia.ts [campeonatoId]` — sem
 * argumento, roda pra toda competição (estadual + nacional) ainda sem
 * `taca_url`; com argumento, roda só pra essa (pra testar/validar 1 de
 * cada vez antes de rodar pra todas, como pedido).
 *
 * Depois de confirmado visualmente que um candidato é a taça certa, quem
 * chama aplica a gravação manualmente (não por este script) — `taca_url`
 * + `taca_atribuicao_url` (a `descriptionurl` do arquivo, exigida pela
 * licença Creative Commons pra manter a atribuição correta).
 */

const ESTADUAIS_DIR = join(import.meta.dirname, "../src/data/estaduais");
const NACIONAIS_DIR = join(import.meta.dirname, "../src/data/campeonatos-nacionais");

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const DELAY_ENTRE_REQUISICOES_MS = 300;
const MAX_CANDIDATOS_POR_TERMO = 5;

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ResultadoBusca {
  title: string;
  pageid: number;
}

async function buscarArquivos(termo: string): Promise<ResultadoBusca[]> {
  const url = `${COMMONS_API}?action=query&list=search&srnamespace=6&srlimit=${MAX_CANDIDATOS_POR_TERMO}&format=json&srsearch=${encodeURIComponent(termo)}`;
  const resposta = await fetch(url);
  if (!resposta.ok) return [];
  const dado = (await resposta.json()) as { query?: { search?: ResultadoBusca[] } };
  return dado.query?.search ?? [];
}

interface InfoImagem {
  url: string;
  descriptionurl: string;
  licenca?: string;
  licencaUrl?: string;
  autor?: string;
  descricao?: string;
}

/** Remove tags HTML simples que a API às vezes traz em `Artist`/`ImageDescription` (ex: link do autor). */
function semHtml(s: string | undefined): string | undefined {
  return s?.replace(/<[^>]+>/g, "").trim() || undefined;
}

async function buscarImageInfo(title: string): Promise<InfoImagem | undefined> {
  const url = `${COMMONS_API}?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|extmetadata&format=json`;
  const resposta = await fetch(url);
  if (!resposta.ok) return undefined;
  const dado = (await resposta.json()) as {
    query?: { pages?: Record<string, { imageinfo?: { url: string; descriptionurl: string; extmetadata?: Record<string, { value?: string }> }[] }> };
  };
  const paginas = Object.values(dado.query?.pages ?? {});
  const info = paginas[0]?.imageinfo?.[0];
  if (!info) return undefined;
  const meta = info.extmetadata ?? {};
  return {
    url: info.url,
    descriptionurl: info.descriptionurl,
    licenca: meta.LicenseShortName?.value,
    licencaUrl: meta.LicenseUrl?.value,
    autor: semHtml(meta.Artist?.value),
    descricao: semHtml(meta.ImageDescription?.value),
  };
}

/** "Campeonato Carioca - Série A" -> "Campeonato Carioca" (tira sufixo de divisão/série, que não ajuda a busca e pode até atrapalhar). */
function nomeBase(nome: string): string {
  return nome.replace(/\s*[-–]\s*(Série|Módulo|Divisão).*/i, "").trim();
}

function termosDeBusca(nome: string): string[] {
  const base = nomeBase(nome);
  return [`Taça ${base}`, `Taça do ${base}`, `Copa ${base}`];
}

interface CandidatoRelatorio {
  title: string;
  imagemUrl: string;
  descricaoUrl: string;
  licenca?: string;
  licencaUrl?: string;
  autor?: string;
  descricao?: string;
}

interface RelatorioCompeticao {
  campeonatoId: string;
  nome: string;
  termosTentados: string[];
  candidatos: CandidatoRelatorio[];
}

function carregarCompeticoes(dir: string): { id: string; nome: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as CampeonatoEstadual | CampeonatoNacional)
    .filter((c) => !c.taca_url)
    .map((c) => ({ id: c.id, nome: c.nome }));
}

async function buscarCandidatosDaCompeticao(id: string, nome: string): Promise<RelatorioCompeticao> {
  const termos = termosDeBusca(nome);
  const vistos = new Set<string>();
  const candidatos: CandidatoRelatorio[] = [];

  for (const termo of termos) {
    const resultados = await buscarArquivos(termo);
    await dormir(DELAY_ENTRE_REQUISICOES_MS);
    for (const resultado of resultados) {
      if (vistos.has(resultado.title)) continue;
      vistos.add(resultado.title);
      const info = await buscarImageInfo(resultado.title);
      await dormir(DELAY_ENTRE_REQUISICOES_MS);
      if (!info) continue;
      candidatos.push({
        title: resultado.title,
        imagemUrl: info.url,
        descricaoUrl: info.descriptionurl,
        licenca: info.licenca,
        licencaUrl: info.licencaUrl,
        autor: info.autor,
        descricao: info.descricao,
      });
    }
  }

  return { campeonatoId: id, nome, termosTentados: termos, candidatos };
}

async function main(): Promise<void> {
  const filtroId = process.argv[2];

  const todas = [...carregarCompeticoes(ESTADUAIS_DIR), ...carregarCompeticoes(NACIONAIS_DIR)];
  const alvo = filtroId ? todas.filter((c) => c.id === filtroId) : todas;

  if (filtroId && alvo.length === 0) {
    console.error(`Nenhuma competição sem taca_url com id "${filtroId}" encontrada (ou ela já tem taca_url).`);
    process.exit(1);
  }

  const relatorios: RelatorioCompeticao[] = [];
  for (const { id, nome } of alvo) {
    console.log(`Buscando candidatos pra ${id} (${nome})...`);
    relatorios.push(await buscarCandidatosDaCompeticao(id, nome));
  }

  writeFileSync(join(import.meta.dirname, "../relatorio-tacas-wikimedia.json"), JSON.stringify(relatorios, null, 2), "utf-8");

  for (const relatorio of relatorios) {
    console.log(`\n=== ${relatorio.campeonatoId} (${relatorio.nome}) ===`);
    console.log(`Termos tentados: ${relatorio.termosTentados.join(" | ")}`);
    if (relatorio.candidatos.length === 0) {
      console.log("  Nenhum candidato encontrado.");
      continue;
    }
    for (const c of relatorio.candidatos) {
      console.log(`  - ${c.title}`);
      console.log(`    imagem: ${c.imagemUrl}`);
      console.log(`    página: ${c.descricaoUrl}`);
      console.log(`    licença: ${c.licenca ?? "?"} (${c.licencaUrl ?? "sem url"}) — autor: ${c.autor ?? "?"}`);
      if (c.descricao) console.log(`    descrição: ${c.descricao}`);
    }
  }

  console.log(`\nRelatório completo em relatorio-tacas-wikimedia.json — NENHUM dado foi gravado ainda, confirme visualmente antes de aplicar.`);
}

main();
