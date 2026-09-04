import { loadCampeonatosNacionais, loadClubes } from "../data/loaders/index.js";
import { simularMataMataDoFormato, type ResultadoMataMata } from "../simulation/knockout.js";
import { obterRating } from "../simulation/rating.js";
import { simularFaseUnicaDoFormato, somarTabelas, type LinhaTabela } from "../simulation/season.js";

const clubes = loadClubes();
const clubePorId = new Map(clubes.map((c) => [c.id, c]));

function nomeDoClube(id: string): string {
  const clube = clubePorId.get(id);
  return clube?.nome_popular ?? clube?.nome ?? id;
}

function buscarCampeonato(id: string) {
  const campeonato = loadCampeonatosNacionais().find((n) => n.id === id);
  if (!campeonato) throw new Error(`Campeonato "${id}" não encontrado em loadCampeonatosNacionais()`);
  return campeonato;
}

function imprimirTabela(tabela: LinhaTabela[]): void {
  console.log("Pos  Clube                          Pts   J   V   E   D   GP  GC  SG");
  tabela.forEach((linha, indice) => {
    const pos = String(indice + 1).padStart(3);
    const nome = nomeDoClube(linha.clubeId).padEnd(30);
    const pts = String(linha.pontos).padStart(3);
    const j = String(linha.jogos).padStart(3);
    const v = String(linha.vitorias).padStart(3);
    const e = String(linha.empates).padStart(3);
    const dd = String(linha.derrotas).padStart(3);
    const gp = String(linha.golsPro).padStart(3);
    const gc = String(linha.golsContra).padStart(3);
    const sg = String(linha.saldoDeGols).padStart(3);
    console.log(`${pos}  ${nome} ${pts} ${j} ${v} ${e} ${dd} ${gp} ${gc} ${sg}`);
  });
}

function simularCopaDoBrasil(): void {
  const copaDoBrasil = buscarCampeonato("copa_do_brasil");
  const ratings = Object.fromEntries(copaDoBrasil.times.map((id) => [id, obterRating(clubePorId.get(id)!)]));

  const resultado: ResultadoMataMata = simularMataMataDoFormato(copaDoBrasil.formato.mata_mata!, ratings, copaDoBrasil.times);

  console.log(`\n=== ${copaDoBrasil.nome} ${copaDoBrasil.ano_referencia} — simulação ===`);
  console.log(`${copaDoBrasil.times.length} clubes reais na disputa\n`);

  for (const etapa of resultado.etapas) {
    if (etapa.confrontos.length === 0) continue;

    console.log(`--- ${etapa.nome} (${etapa.confrontos.length} confronto${etapa.confrontos.length > 1 ? "s" : ""}) ---`);
    for (const confronto of etapa.confrontos) {
      const decisao = confronto.decididoNosPenaltis ? " (pênaltis)" : "";
      console.log(
        `  ${nomeDoClube(confronto.timeA)} ${confronto.golsA} x ${confronto.golsB} ${nomeDoClube(confronto.timeB)}${decisao} — vence ${nomeDoClube(confronto.vencedor)}`,
      );
    }
    console.log();
  }

  console.log(`Campeão: ${nomeDoClube(resultado.campeao)}`);
}

/**
 * Argentina não tem `mata_mata` modelado (as 2 zonas internas de cada
 * torneio e o chaveamento do playoff são pendência, ver
 * docs/dados-a-verificar.md) — o `final_estadual` do formato é reaproveitado
 * pra representar a Tabla Anual (soma dos pontos de Apertura+Clausura), não
 * uma final de jogo real. Por isso aqui simulamos os dois torneios como
 * `FaseUnica` e somamos as tabelas em vez de chamar `simularFinalEstadualDoFormato`.
 */
function simularArgentina(): void {
  const liga = buscarCampeonato("argentina_primera");
  const ratings = Object.fromEntries(liga.times.map((id) => [id, obterRating(clubePorId.get(id)!)]));

  const apertura = simularFaseUnicaDoFormato(liga.formato.turno!, liga.times, ratings);
  const clausura = simularFaseUnicaDoFormato(liga.formato.returno!, liga.times, ratings);
  const tabelaAnual = somarTabelas([apertura.tabela, clausura.tabela]);

  console.log(`\n=== ${liga.nome} ${liga.ano_referencia} — simulação ===`);
  console.log(`${liga.times.length} clubes reais na disputa\n`);

  console.log(`--- ${liga.formato.turno!.nome} — campeão: ${nomeDoClube(apertura.tabela[0].clubeId)} ---`);
  imprimirTabela(apertura.tabela.slice(0, 5));

  console.log(`\n--- ${liga.formato.returno!.nome} — campeão: ${nomeDoClube(clausura.tabela[0].clubeId)} ---`);
  imprimirTabela(clausura.tabela.slice(0, 5));

  console.log("\n--- Tabla Anual (Apertura + Clausura) — define Campeón de Liga e vagas CONMEBOL ---");
  imprimirTabela(tabelaAnual);

  console.log(`\nCampeão de Liga: ${nomeDoClube(tabelaAnual[0].clubeId)}`);
  console.log(`Rebaixados (${liga.premiacao.rebaixamento_proxima_divisao}): ${tabelaAnual.slice(-liga.premiacao.rebaixamento_proxima_divisao!).map((l) => nomeDoClube(l.clubeId)).reverse().join(", ")}`);
}

const comando = process.argv[2] ?? "copa-do-brasil";

switch (comando) {
  case "copa-do-brasil":
    simularCopaDoBrasil();
    break;
  case "argentina":
    simularArgentina();
    break;
  default:
    console.error(`Comando desconhecido: "${comando}". Use "copa-do-brasil" ou "argentina".`);
    process.exit(1);
}
