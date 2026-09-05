import { loadCampeonatosNacionais, loadClubes } from "../data/loaders/index.js";
import { simularMataMataDoFormato, type ResultadoMataMata } from "../simulation/knockout.js";
import { obterRating } from "../simulation/rating.js";
import { simularFaseUnicaDoFormato, somarTabelas, type LinhaTabela } from "../simulation/season.js";
import { CENARIOS, aplicarImpacto, resolverEscolha, sortearCenario, type EstadoJogadorParaImpacto } from "../progression/scenarios.js";
import { ATRIBUTOS_POR_POSICAO } from "../schemas/player.js";

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

function formatarImpacto(impacto: { atributos?: Partial<Record<string, number>>; moral?: number; reputacao?: number }): string {
  const partes: string[] = [];
  for (const [atributo, delta] of Object.entries(impacto.atributos ?? {})) {
    partes.push(`${atributo} ${delta! > 0 ? "+" : ""}${delta}`);
  }
  if (impacto.moral) partes.push(`moral ${impacto.moral > 0 ? "+" : ""}${impacto.moral}`);
  if (impacto.reputacao) partes.push(`reputação ${impacto.reputacao > 0 ? "+" : ""}${impacto.reputacao}`);
  return partes.length > 0 ? partes.join(", ") : "sem impacto numérico";
}

/** Demonstra um cenário de carreira sorteado: mostra as opções, "escolhe" uma (a primeira, pra fins de demo) e resolve o resultado probabilístico. */
function simularCenario(): void {
  const cenario = sortearCenario(CENARIOS);

  console.log(`\n=== ${cenario.titulo} ===`);
  console.log(cenario.descricao);
  console.log();

  cenario.opcoes.forEach((opcao, indice) => {
    console.log(`${indice + 1}. ${opcao.texto}`);
    for (const resultado of opcao.resultados) {
      const chance = `${Math.round(resultado.probabilidade * 100)}%`;
      console.log(`   [${chance}] ${resultado.impacto.narrativa} (${formatarImpacto(resultado.impacto)})`);
    }
  });

  const opcaoEscolhida = cenario.opcoes[0];
  console.log(`\n-> Jogador escolhe: "${opcaoEscolhida.texto}"\n`);

  const estadoAntes: EstadoJogadorParaImpacto = {
    atributos: Object.fromEntries(ATRIBUTOS_POR_POSICAO.atacante.map((atributo) => [atributo, 55])),
    moral: 50,
    reputacao: 50,
  };
  const escolha = resolverEscolha(opcaoEscolhida);
  const estadoDepois = aplicarImpacto(estadoAntes, escolha.resultado.impacto);

  console.log(`Resultado: ${escolha.resultado.impacto.narrativa}`);
  console.log(`Moral: ${estadoAntes.moral} -> ${estadoDepois.moral} | Reputação: ${estadoAntes.reputacao} -> ${estadoDepois.reputacao}`);

  const atributosAlterados = Object.keys(escolha.resultado.impacto.atributos ?? {});
  if (atributosAlterados.length > 0) {
    const antesDepois = atributosAlterados.map((a) => `${a} ${estadoAntes.atributos[a as keyof typeof estadoAntes.atributos]} -> ${estadoDepois.atributos[a as keyof typeof estadoDepois.atributos]}`);
    console.log(`Atributos: ${antesDepois.join(", ")}`);
  }
}

const comando = process.argv[2] ?? "copa-do-brasil";

switch (comando) {
  case "copa-do-brasil":
    simularCopaDoBrasil();
    break;
  case "argentina":
    simularArgentina();
    break;
  case "cenario":
    simularCenario();
    break;
  default:
    console.error(`Comando desconhecido: "${comando}". Use "copa-do-brasil", "argentina" ou "cenario".`);
    process.exit(1);
}
