import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CampeonatoNacional } from "../src/schemas/national-championship.js";

/**
 * Popula `taca_url` (imagem da TAÇA/troféu, distinta do `escudo_url`) das
 * competições nacionais mais conhecidas, buscando na API pública do
 * TheSportsDB (chave de teste "3", mesma usada por `buscar-escudos.ts`) —
 * só grava a URL externa retornada, nunca baixa/guarda a imagem em si.
 *
 * **Diferente de `buscar-escudos.ts`**: aqui não dá pra usar busca por
 * nome (`search_all_leagues.php`) — sob a chave de teste esse endpoint
 * devolve só uma amostra pequena e fixa de ligas por país (nem sempre
 * inclui as competições mais conhecidas), e o campo `strTrophy` some
 * nessa listagem mesmo quando existe (só aparece no lookup individual por
 * id, `lookupleague.php?id=`). Por isso este script usa um mapa curado de
 * `campeonatoId -> idLeague do TheSportsDB`, confirmado manualmente
 * batendo o nome retornado (`strLeague`) contra o nosso — ver
 * `docs/dados-a-verificar.md` pra escopo/pendências.
 */

const NACIONAIS_DIR = join(import.meta.dirname, "../src/data/campeonatos-nacionais");

/** campeonatoId (nosso) -> idLeague do TheSportsDB — só entradas CONFIRMADAS (nome batido manualmente
 * contra `strLeague` da resposta da API). Ainda não cobre os estaduais — competições regionais
 * provavelmente sem cobertura no TheSportsDB, e não dá pra adivinhar o id sem confirmar (ver decisão
 * registrada em `docs/dados-a-verificar.md`). */
const ID_LEAGUE_POR_CAMPEONATO: Record<string, number> = {
  brasileirao_serie_a: 4351,
  brasileirao_serie_b: 4404,
  brasileirao_serie_c: 4625,
  brasileirao_serie_d: 5079,
  copa_do_brasil: 4725,
  libertadores: 4501,
  sulamericana: 4724,
};

const DELAY_ENTRE_REQUISICOES_MS = 300;

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface LigaTheSportsDb {
  strLeague?: string;
  strTrophy?: string | null;
}

async function buscarTacaPorId(idLeague: number): Promise<{ nome?: string; trofeu?: string }> {
  const resposta = await fetch(`https://www.thesportsdb.com/api/v1/json/3/lookupleague.php?id=${idLeague}`);
  if (!resposta.ok) return {};
  const texto = await resposta.text();
  const dado = JSON.parse(texto.replace(/[\x00-\x1f\x7f]/g, "")) as { leagues?: LigaTheSportsDb[] } | null; // remove controle invalido (descricoes da API as vezes tem)
  const liga = dado?.leagues?.[0];
  return { nome: liga?.strLeague, trofeu: liga?.strTrophy ?? undefined };
}

function carregar(campeonatoId: string): { arquivo: string; competicao: CampeonatoNacional } {
  const arquivo = join(NACIONAIS_DIR, `${campeonatoId}.json`);
  return { arquivo, competicao: JSON.parse(readFileSync(arquivo, "utf-8")) as CampeonatoNacional };
}

function salvar(arquivo: string, dado: unknown): void {
  writeFileSync(arquivo, `${JSON.stringify(dado, null, 2)}\n`, "utf-8");
}

async function main(): Promise<void> {
  const relatorio: string[] = [];
  let achados = 0;

  for (const [campeonatoId, idLeague] of Object.entries(ID_LEAGUE_POR_CAMPEONATO)) {
    const { arquivo, competicao } = carregar(campeonatoId);
    const { nome, trofeu } = await buscarTacaPorId(idLeague);
    await dormir(DELAY_ENTRE_REQUISICOES_MS);

    if (!trofeu) {
      relatorio.push(`MISS ${campeonatoId} (idLeague ${idLeague}, "${nome ?? "?"}"): sem strTrophy`);
      continue;
    }
    competicao.taca_url = trofeu;
    salvar(arquivo, competicao);
    achados++;
    relatorio.push(`OK   ${campeonatoId} (idLeague ${idLeague}, "${nome}"): ${trofeu}`);
  }

  relatorio.push("");
  relatorio.push(`${achados}/${Object.keys(ID_LEAGUE_POR_CAMPEONATO).length} taças encontradas`);
  writeFileSync(join(import.meta.dirname, "../relatorio-tacas.txt"), relatorio.join("\n"), "utf-8");
  console.log(relatorio.join("\n"));
}

main();
