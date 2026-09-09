import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Club } from "../src/schemas/club.js";
import type { CampeonatoEstadual } from "../src/schemas/championship.js";
import type { CampeonatoNacional } from "../src/schemas/national-championship.js";

/**
 * Popula `escudo_url` de clubes e competições buscando na API pública do
 * TheSportsDB (chave de teste "3", sem custo, ver
 * https://www.thesportsdb.com/free_sports_api) — só grava a URL externa
 * retornada, nunca baixa/guarda a imagem em si (ver decisão registrada em
 * docs/dados-a-verificar.md). Roda uma vez, sob demanda (não é parte do
 * pipeline normal) — reexecutar é seguro, só sobrescreve `escudo_url` dos
 * registros que o script tocar (não apaga o que já existe se a nova busca
 * não achar nada, ver `undefined` vs "não achou" abaixo).
 */

const CLUBES_DIR = join(import.meta.dirname, "../src/data/clubes");
const ESTADUAIS_DIR = join(import.meta.dirname, "../src/data/estaduais");
const NACIONAIS_DIR = join(import.meta.dirname, "../src/data/campeonatos-nacionais");

const PAIS_PARA_NOME_THESPORTSDB: Record<string, string> = {
  BR: "Brazil",
  AR: "Argentina",
  BO: "Bolivia",
  CL: "Chile",
  CO: "Colombia",
  EC: "Ecuador",
  PY: "Paraguay",
  PE: "Peru",
  UY: "Uruguay",
  VE: "Venezuela",
};

interface ResultadoBusca {
  encontrado: boolean;
  url?: string;
  corPrimaria?: string;
  corSecundaria?: string;
  motivo?: string;
}

const DELAY_ENTRE_REQUISICOES_MS = 250;
const MAX_TENTATIVAS = 3;

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buscarJson(url: string): Promise<unknown> {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const resposta = await fetch(url);
      if (resposta.status === 429 || resposta.status >= 500) {
        await dormir(1000 * tentativa);
        continue;
      }
      if (!resposta.ok) return null;
      return await resposta.json();
    } catch {
      await dormir(1000 * tentativa);
    }
  }
  return null;
}

interface TimeTheSportsDb {
  strTeam?: string;
  strSport?: string;
  strCountry?: string;
  strBadge?: string;
  strColour1?: string;
  strColour2?: string;
}

async function buscarEscudoDeClube(nomeBusca: string, paisEsperado: string): Promise<ResultadoBusca> {
  const dado = (await buscarJson(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(nomeBusca)}`)) as { teams?: TimeTheSportsDb[] } | null;
  const times = dado?.teams ?? [];
  const candidatos = times.filter((t) => t.strSport === "Soccer" && t.strBadge);
  if (candidatos.length === 0) return { encontrado: false, motivo: "sem candidato de futebol com badge" };

  const doPaisCerto = candidatos.filter((t) => t.strCountry === paisEsperado);
  const escolhido = doPaisCerto[0] ?? (candidatos.length === 1 ? candidatos[0] : undefined);
  if (!escolhido) return { encontrado: false, motivo: `${candidatos.length} candidatos, nenhum do país esperado (${paisEsperado}) e mais de 1 no total` };

  return { encontrado: true, url: escolhido.strBadge, corPrimaria: escolhido.strColour1 || undefined, corSecundaria: escolhido.strColour2 || undefined };
}

interface LigaTheSportsDb {
  strLeague?: string;
  strLeagueAlternate?: string;
  strSport?: string;
  strCountry?: string;
  strBadge?: string;
}

async function buscarEscudoDeLiga(nomeBusca: string, paisEsperado: string): Promise<ResultadoBusca> {
  const dado = (await buscarJson(`https://www.thesportsdb.com/api/v1/json/3/search_all_leagues.php?s=Soccer&c=${encodeURIComponent(paisEsperado)}`)) as { countries?: LigaTheSportsDb[] } | null;
  const ligas = dado?.countries ?? [];
  const normalizado = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const alvo = normalizado(nomeBusca);
  const candidato = ligas.find((l) => {
    const nomes = [l.strLeague, l.strLeagueAlternate].filter((v): v is string => !!v);
    return nomes.some((n) => normalizado(n).includes(alvo) || alvo.includes(normalizado(n)));
  });
  if (!candidato?.strBadge) return { encontrado: false, motivo: "sem correspondência na listagem de ligas do país (endpoint limitado a poucos resultados por país na chave de teste)" };
  return { encontrado: true, url: candidato.strBadge };
}

function carregarClubes(): { arquivo: string; clubes: Club[] }[] {
  return readdirSync(CLUBES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ arquivo: join(CLUBES_DIR, f), clubes: JSON.parse(readFileSync(join(CLUBES_DIR, f), "utf-8")) as Club[] }));
}

function carregarCompeticoes<T extends { id: string; escudo_url?: string }>(dir: string): { arquivo: string; competicao: T }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ arquivo: join(dir, f), competicao: JSON.parse(readFileSync(join(dir, f), "utf-8")) as T }));
}

function salvar(arquivo: string, dado: unknown): void {
  writeFileSync(arquivo, `${JSON.stringify(dado, null, 2)}\n`, "utf-8");
}

async function main(): Promise<void> {
  const relatorio: string[] = [];
  let clubesAchados = 0;
  let clubesTotal = 0;

  for (const { arquivo, clubes } of carregarClubes()) {
    let mudou = false;
    for (const clube of clubes) {
      clubesTotal++;
      const paisEsperado = PAIS_PARA_NOME_THESPORTSDB[clube.pais];
      if (!paisEsperado) {
        relatorio.push(`SKIP clube ${clube.id}: país "${clube.pais}" sem mapeamento pro TheSportsDB`);
        continue;
      }
      const nomeBusca = clube.nome_popular ?? clube.nome;
      const resultado = await buscarEscudoDeClube(nomeBusca, paisEsperado);
      await dormir(DELAY_ENTRE_REQUISICOES_MS);
      if (resultado.encontrado && resultado.url) {
        if (clube.escudo_url !== resultado.url) {
          clube.escudo_url = resultado.url;
          mudou = true;
        }
        if (resultado.corPrimaria && clube.cor_primaria !== resultado.corPrimaria) {
          clube.cor_primaria = resultado.corPrimaria;
          mudou = true;
        }
        if (resultado.corSecundaria && clube.cor_secundaria !== resultado.corSecundaria) {
          clube.cor_secundaria = resultado.corSecundaria;
          mudou = true;
        }
        clubesAchados++;
        relatorio.push(`OK   clube ${clube.id} (${nomeBusca}): ${resultado.url} cores=${resultado.corPrimaria ?? "-"}/${resultado.corSecundaria ?? "-"}`);
      } else {
        relatorio.push(`MISS clube ${clube.id} (${nomeBusca}): ${resultado.motivo}`);
      }
      if (clubesTotal % 50 === 0) console.log(`... ${clubesTotal} clubes processados (${clubesAchados} achados até agora)`);
    }
    if (mudou) salvar(arquivo, clubes);
  }

  let competicoesAchadas = 0;
  let competicoesTotal = 0;

  for (const dir of [ESTADUAIS_DIR, NACIONAIS_DIR]) {
    for (const { arquivo, competicao } of carregarCompeticoes<CampeonatoEstadual | CampeonatoNacional>(dir)) {
      competicoesTotal++;
      const paisCodigo = "pais" in competicao ? competicao.pais : "BR"; // CampeonatoEstadual não tem `pais` (é sempre Brasil)
      const paisEsperado = PAIS_PARA_NOME_THESPORTSDB[paisCodigo] ?? "Brazil";
      const resultado = await buscarEscudoDeLiga(competicao.nome, paisEsperado);
      await dormir(DELAY_ENTRE_REQUISICOES_MS);
      if (resultado.encontrado && resultado.url) {
        competicao.escudo_url = resultado.url;
        competicoesAchadas++;
        relatorio.push(`OK   competição ${competicao.id} (${competicao.nome}): ${resultado.url}`);
        salvar(arquivo, competicao);
      } else {
        relatorio.push(`MISS competição ${competicao.id} (${competicao.nome}): ${resultado.motivo}`);
      }
    }
  }

  relatorio.push("");
  relatorio.push(`Clubes: ${clubesAchados}/${clubesTotal} encontrados`);
  relatorio.push(`Competições: ${competicoesAchadas}/${competicoesTotal} encontradas`);

  writeFileSync(join(import.meta.dirname, "../relatorio-escudos.txt"), relatorio.join("\n"), "utf-8");
  console.log(`Clubes: ${clubesAchados}/${clubesTotal} encontrados`);
  console.log(`Competições: ${competicoesAchadas}/${competicoesTotal} encontradas`);
  console.log("Relatório completo em relatorio-escudos.txt");
}

main();
