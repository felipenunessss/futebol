import { construirCalendarioPadrao } from "../data/loaders/calendario.js";
import { loadCampeonatosNacionais, loadClubes, loadEstaduais } from "../data/loaders/index.js";
import { simularTemporada } from "../simulation/engine.js";
import { simularMataMataDoFormato, type ResultadoMataMata } from "../simulation/knockout.js";
import { obterRating } from "../simulation/rating.js";
import { simularFaseUnicaDoFormato, somarTabelas, type LinhaTabela } from "../simulation/season.js";
import {
  CENARIOS,
  aplicarImpacto,
  filtrarCenariosElegiveis,
  momentoDoPeriodo,
  resolverEscolha,
  sortearCenario,
  type ContextoSorteio,
  type EstadoJogadorParaImpacto,
} from "../progression/scenarios.js";
import { converterChancesEmDesempenho } from "../progression/xp.js";
import { ATRIBUTOS_POR_POSICAO } from "../schemas/player.js";
import { gerarPerfilTime, simularPartida, type ParticipacaoJogador } from "../simulation/match.js";
import { aplicarDesempenhoPartida, aplicarImpactoDeCenario, avancarTemporada, criarEstadoInicial, overallAtual } from "../career/Player.js";
import { jogarCarreira } from "../career/career-loop.js";

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

function formatarImpacto(impacto: {
  atributos?: Partial<Record<string, number>>;
  moral?: number;
  reputacao?: number;
  reputacaoRegional?: number;
  relacoesInternas?: number;
}): string {
  const partes: string[] = [];
  for (const [atributo, delta] of Object.entries(impacto.atributos ?? {})) {
    partes.push(`${atributo} ${delta! > 0 ? "+" : ""}${delta}`);
  }
  if (impacto.moral) partes.push(`moral ${impacto.moral > 0 ? "+" : ""}${impacto.moral}`);
  if (impacto.reputacao) partes.push(`reputação nacional ${impacto.reputacao > 0 ? "+" : ""}${impacto.reputacao}`);
  if (impacto.reputacaoRegional) partes.push(`reputação regional ${impacto.reputacaoRegional > 0 ? "+" : ""}${impacto.reputacaoRegional}`);
  if (impacto.relacoesInternas) partes.push(`relações internas ${impacto.relacoesInternas > 0 ? "+" : ""}${impacto.relacoesInternas}`);
  return partes.length > 0 ? partes.join(", ") : "sem impacto numérico";
}

/**
 * Demonstra um cenário de carreira sorteado: mostra as opções, "escolhe" uma
 * (a primeira, pra fins de demo) e resolve o resultado probabilístico. O
 * momento do calendário (`pre_temporada`, `temporada_regular`, `reta_final`,
 * `pos_temporada`) pode ser passado como segundo argumento da CLI — sem ele,
 * usa `temporada_regular` — e é usado por `filtrarCenariosElegiveis` pra só
 * sortear entre cenários que fazem sentido nesse momento (ver `gatilho` em
 * `progression/scenarios.ts`).
 */
function simularCenario(): void {
  const momento = (process.argv[3] as ContextoSorteio["momento"]) ?? "temporada_regular";
  const contexto: ContextoSorteio = { idadeJogador: 25, reputacaoNacional: 30, reputacaoRegional: 20, moral: 50, relacoesInternas: 50, momento };
  const elegiveis = filtrarCenariosElegiveis(CENARIOS, contexto);
  const cenario = sortearCenario(elegiveis);

  console.log(`\n=== ${cenario.titulo} (momento: ${momento}, ${elegiveis.length}/${CENARIOS.length} cenários elegíveis) ===`);
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
    reputacao: { nacional: 50, porRegiao: { SP: 20 } },
    relacoesInternas: 50,
  };
  const escolha = resolverEscolha(opcaoEscolhida);
  const estadoDepois = aplicarImpacto(estadoAntes, escolha.resultado.impacto, "SP");

  console.log(`Resultado: ${escolha.resultado.impacto.narrativa}`);
  console.log(`Moral: ${estadoAntes.moral} -> ${estadoDepois.moral} | Reputação nacional: ${estadoAntes.reputacao.nacional} -> ${estadoDepois.reputacao.nacional} | Reputação SP: ${estadoAntes.reputacao.porRegiao.SP} -> ${estadoDepois.reputacao.porRegiao.SP ?? estadoAntes.reputacao.porRegiao.SP} | Relações internas: ${estadoAntes.relacoesInternas} -> ${estadoDepois.relacoesInternas}`);

  const atributosAlterados = Object.keys(escolha.resultado.impacto.atributos ?? {});
  if (atributosAlterados.length > 0) {
    const antesDepois = atributosAlterados.map((a) => `${a} ${estadoAntes.atributos[a as keyof typeof estadoAntes.atributos]} -> ${estadoDepois.atributos[a as keyof typeof estadoDepois.atributos]}`);
    console.log(`Atributos: ${antesDepois.join(", ")}`);
  }
}

/**
 * Demonstra o ciclo de carreira de ponta a ponta: cria um jogador, simula
 * uma partida real dele (clube vs. rival, com ParticipacaoJogador), aplica
 * o XP ganho, e percorre os **períodos reais do calendário da temporada**
 * (`data/loaders/calendario.ts`) sorteando um cenário elegível em cada um —
 * o momento (`pre_temporada`/`temporada_regular`/etc) vem de
 * `momentoDoPeriodo(periodo.periodo)`, não de um valor fixo, então o
 * catálogo elegível muda de período pra período (ex: propostas de clube
 * grande só aparecem no período `jan-1a_quinz`, mapeado pra
 * `pre_temporada`) — o mesmo ciclo descrito em game-design.md seção 6.
 */
function simularCarreira(): void {
  const clubeId = "corinthians";
  const rivalId = "palmeiras";

  let estado = criarEstadoInicial({
    id: "jogador_carreira",
    nome: "Jogador da Carreira",
    posicao: "atacante",
    arquetipoId: "finalizador",
    clubeInicialId: clubeId,
    temporadaInicial: 2027,
  });

  const regiaoAtual = "SP"; // corinthians e palmeiras são de SP

  console.log(`\n=== Carreira de ${estado.jogador.nome} ===`);
  console.log(`Clube: ${nomeDoClube(estado.clubeAtualId)} | Temporada: ${estado.temporada} | Idade: ${estado.jogador.idade}`);
  console.log(`Overall inicial: ${overallAtual(estado)} | Moral: ${estado.moral} | Reputação nacional: ${estado.reputacao.nacional} | Relações internas: ${estado.relacoesInternas} | Patrimônio: ${estado.patrimonio}\n`);

  const ratingClube = obterRating(clubePorId.get(clubeId)!);
  const ratingRival = obterRating(clubePorId.get(rivalId)!);
  const participacao: ParticipacaoJogador = { lado: "casa", jogador: estado.jogador, estiloTecnico: "equilibrado" };

  const resultado = simularPartida(gerarPerfilTime(ratingClube), gerarPerfilTime(ratingRival), Math.random, participacao);
  console.log(`--- Partida: ${nomeDoClube(clubeId)} ${resultado.golsCasa} x ${resultado.golsFora} ${nomeDoClube(rivalId)} ---`);
  console.log(`Chances do jogador: ${resultado.chancesJogador.length} (${resultado.chancesJogador.filter((c) => c.sucesso).length} bem-sucedidas)\n`);

  const desempenho = converterChancesEmDesempenho(resultado.chancesJogador, 90, 1.5); // clássico, importância maior
  estado = aplicarDesempenhoPartida(estado, resultado.chancesJogador, desempenho);
  console.log(`Gols: ${desempenho.gols} | Assistências: ${desempenho.assistencias} | Chances perdidas: ${desempenho.chancesPerdidas}`);
  console.log(`Overall após a partida: ${overallAtual(estado)}\n`);

  console.log(`--- Cenários da temporada (um sorteio por período do calendário) ---`);
  for (const periodo of construirCalendarioPadrao(estado.temporada).calendario) {
    const momento = momentoDoPeriodo(periodo.periodo);
    const contextoCenario: ContextoSorteio = {
      idadeJogador: estado.jogador.idade,
      reputacaoNacional: estado.reputacao.nacional,
      reputacaoRegional: estado.reputacao.porRegiao[regiaoAtual] ?? 0,
      moral: estado.moral,
      relacoesInternas: estado.relacoesInternas,
      momento,
    };
    const elegiveis = filtrarCenariosElegiveis(CENARIOS, contextoCenario);
    const cenario = sortearCenario(elegiveis);
    const opcaoEscolhida = cenario.opcoes[0];
    const escolha = resolverEscolha(opcaoEscolhida);
    estado = aplicarImpactoDeCenario(estado, escolha.resultado.impacto, regiaoAtual);

    console.log(`[${periodo.periodo} / ${momento}, ${elegiveis.length}/${CENARIOS.length} elegíveis] ${cenario.titulo} -> "${opcaoEscolhida.texto}" -> ${escolha.resultado.impacto.narrativa}`);
  }
  console.log();

  estado = avancarTemporada(estado, regiaoAtual);

  console.log(`\n=== Fim da temporada ===`);
  console.log(`Temporada: ${estado.temporada} | Idade: ${estado.jogador.idade}`);
  console.log(
    `Overall: ${overallAtual(estado)} | Moral: ${estado.moral} | Reputação nacional: ${estado.reputacao.nacional} | Reputação SP: ${estado.reputacao.porRegiao.SP ?? 0} | Relações internas: ${estado.relacoesInternas} | Patrimônio: ${estado.patrimonio}`,
  );
}

/**
 * Demonstra o loop de calendário: simula todas as competições ativas de
 * uma temporada (ver `simulation/engine.ts`) com o jogador jogando pelo
 * clube informado, mostrando quais competições rodaram automaticamente e
 * quais ainda não têm receita (combinação de blocos de formato bespoke).
 */
function simularTemporadaCli(): void {
  const campeonatos = [...loadCampeonatosNacionais(), ...loadEstaduais()];
  const jogador = {
    id: "jogador_temporada",
    nome: "Jogador da Temporada",
    posicao: "atacante" as const,
    arquetipo_id: "finalizador",
    idade: 22,
    atributos: Object.fromEntries(ATRIBUTOS_POR_POSICAO.atacante.map((a) => [a, 60])),
  };

  const resultado = simularTemporada(2027, campeonatos, clubes, { clubeId: "corinthians", jogador, estiloTecnico: "equilibrado" });

  console.log(`\n=== Temporada ${resultado.temporada} — ${resultado.competicoes.length} competições ativas no calendário ===\n`);
  for (const c of resultado.competicoes) {
    if (c.erro) {
      console.log(`✗ ${c.campeonatoId}: ${c.erro}`);
    } else {
      console.log(`✓ ${c.campeonatoId}: campeão ${nomeDoClube(c.resultado!.campeao)} | partidas do Corinthians: ${c.resultado!.partidasDoJogador.length}`);
    }
  }
}

/**
 * Demonstra o game loop persistente de carreira (`career/career-loop.ts`
 * `jogarCarreira`): joga N temporadas seguidas com dados reais (calendário
 * completo, clube de verdade), aplicando XP de cada partida e resolvendo
 * cenários por período do calendário automaticamente, sem orquestrar cada
 * passo na mão como `carreira` faz. `N` vem do 2º argumento da CLI
 * (padrão 3).
 */
function simularCarreiraLoopCli(): void {
  const clubeInicialId = process.argv[3] ?? "corinthians";
  const quantidadeDeTemporadas = Number(process.argv[4] ?? 3);
  const campeonatos = [...loadCampeonatosNacionais(), ...loadEstaduais()];

  if (!clubePorId.has(clubeInicialId)) {
    console.error(`Clube "${clubeInicialId}" não encontrado. Use "npx tsx src/cli/index.ts clubes [pais]" pra listar ids válidos.`);
    process.exit(1);
  }

  let estado = criarEstadoInicial({
    id: "jogador_loop",
    nome: "Jogador do Loop",
    posicao: "atacante",
    arquetipoId: "finalizador",
    clubeInicialId,
    temporadaInicial: 2027,
  });

  console.log(`\n=== Carreira de ${estado.jogador.nome} (${quantidadeDeTemporadas} temporadas, clube inicial: ${nomeDoClube(clubeInicialId)}) ===`);
  console.log(`Início: temporada ${estado.temporada} | idade ${estado.jogador.idade} | overall ${overallAtual(estado)}\n`);

  const resultado = jogarCarreira(estado, quantidadeDeTemporadas, campeonatos, clubes);

  for (const temporada of resultado.temporadas) {
    const competicoesOk = temporada.resultadoTemporada.competicoes.filter((c) => !c.erro);
    console.log(
      `--- Temporada ${temporada.resultadoTemporada.temporada} → ${temporada.estado.temporada} | clube ${nomeDoClube(temporada.estado.clubeAtualId)} | idade ${temporada.estado.jogador.idade} | overall ${overallAtual(temporada.estado)} ---`,
    );
    console.log(
      `  ${competicoesOk.length}/${temporada.resultadoTemporada.competicoes.length} competições simuladas | ${temporada.cenariosResolvidos.length} cenários resolvidos`,
    );

    for (const negociacao of temporada.negociacoesResolvidas) {
      const termos = negociacao.contrapropostaJogador;
      const desfecho = negociacao.resultado.aceito ? "ACEITA" : "recusada";
      console.log(
        `  [transferência] ${nomeDoClube(negociacao.clubeOfertanteId)}: contraproposta R$${termos.salarioMensal}/mês + R$${termos.luvas} luvas, ${termos.anos} anos → ${desfecho} (confiança ${negociacao.resultado.confianca})`,
      );
    }

    console.log(
      `  Moral ${temporada.estado.moral} | Reputação nacional ${temporada.estado.reputacao.nacional} | Relações internas ${temporada.estado.relacoesInternas} | Patrimônio ${temporada.estado.patrimonio}`,
    );
  }

  console.log(
    `\n=== Fim: temporada ${resultado.estadoFinal.temporada} | clube ${nomeDoClube(resultado.estadoFinal.clubeAtualId)} | idade ${resultado.estadoFinal.jogador.idade} | overall ${overallAtual(resultado.estadoFinal)} ===`,
  );
}

/** Lista clubes disponíveis pra escolher como clube inicial de uma carreira (`criarEstadoInicial` `clubeInicialId`) — filtra por país via 2º argumento da CLI (ex: "BR"), sem filtro nenhum lista tudo. */
function listarClubesCli(): void {
  const filtroPais = process.argv[3];
  const listados = filtroPais ? clubes.filter((c) => c.pais === filtroPais) : clubes;

  console.log(`\n=== ${listados.length} clube(s)${filtroPais ? ` (país: ${filtroPais})` : ""} ===`);
  for (const clube of [...listados].sort((a, b) => a.id.localeCompare(b.id))) {
    const divisao = clube.divisao_nacional ? `${clube.pais} nível ${clube.divisao_nacional.nivel}` : "sem competição nacional";
    console.log(`  ${clube.id} — ${clube.nome_popular ?? clube.nome} (${divisao})`);
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
  case "carreira":
    simularCarreira();
    break;
  case "temporada":
    simularTemporadaCli();
    break;
  case "carreira-loop":
    simularCarreiraLoopCli();
    break;
  case "clubes":
    listarClubesCli();
    break;
  default:
    console.error(`Comando desconhecido: "${comando}". Use "copa-do-brasil", "argentina", "cenario", "carreira", "temporada", "carreira-loop" ou "clubes".`);
    process.exit(1);
}
