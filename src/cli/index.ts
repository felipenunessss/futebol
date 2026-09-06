import { createInterface } from "node:readline/promises";
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
  type Cenario,
  type ContextoSorteio,
  type EstadoJogadorParaImpacto,
  type Opcao,
} from "../progression/scenarios.js";
import { converterChancesEmDesempenho, type FocoDeTreino } from "../progression/xp.js";
import { ARQUETIPOS, ATRIBUTOS_POR_POSICAO, type Posicao } from "../schemas/player.js";
import { gerarPerfilTime, simularPartida, type ParticipacaoJogador } from "../simulation/match.js";
import type { ContextoDecisaoChance, EventoAoVivo, ResultadoDecisaoChance } from "../simulation/live-match.js";
import type { SubtipoChance } from "../simulation/tactics.js";
import { aplicarDesempenhoPartida, aplicarImpactoDeCenario, assinarContrato, avancarTemporada, criarEstadoInicial, overallAtual } from "../career/Player.js";
import {
  jogarTemporada,
  type CenarioResolvidoNaTemporada,
  type ContextoPartidaDoJogador,
  type ModoDePartida,
  type NegociacaoResolvidaNaTemporada,
  type PartidaDoJogadorMataMata,
  type PartidaDoJogadorPontosCorridos,
  type ResultadoTemporadaDeCarreira,
  type ResumoPartidasDaTemporada,
  type StatusAtualizadoNaTemporada,
  type TreinoResolvidoNaTemporada,
} from "../career/career-loop.js";
import { multiplicadorDeValorizacaoPorStatus } from "../career/status.js";
import { gerarPropostasIniciais } from "../market/transfers.js";
import type { Contrato } from "../schemas/contract.js";

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

function posicaoNaTabela(tabela: LinhaTabela[], clubeId: string): { posicao: number; linha: LinhaTabela } {
  const posicao = tabela.findIndex((l) => l.clubeId === clubeId) + 1;
  return { posicao, linha: tabela[posicao - 1] };
}

function resumoDaLinha(tabela: LinhaTabela[], clubeId: string): string {
  const { posicao, linha } = posicaoNaTabela(tabela, clubeId);
  return `${posicao}º ${nomeDoClube(clubeId)} (${linha.pontos} pts, SG ${linha.saldoDeGols})`;
}

/**
 * Mostra uma partida de pontos corridos do clube do jogador jogo a jogo:
 * "preparação" (classificação dos dois times antes, vinda de
 * `evento.tabelaAntes`), o placar, as chances individuais do jogador
 * (se ele participou) e a classificação atualizada depois
 * (`evento.tabelaDepois`). Usado tanto na carreira interativa quanto na
 * demo `carreira-loop`.
 */
function exibirPartidaPontosCorridos(info: PartidaDoJogadorPontosCorridos, clubeId: string): void {
  const { campeonatoId, evento } = info;
  const { confronto, resultado, tabelaAntes, tabelaDepois } = evento;
  const adversario = confronto.mandante === clubeId ? confronto.visitante : confronto.mandante;

  console.log(`\n  [${campeonatoId}] Rodada ${confronto.rodada} — ${resumoDaLinha(tabelaAntes, clubeId)} x ${resumoDaLinha(tabelaAntes, adversario)}`);
  console.log(`    ${nomeDoClube(confronto.mandante)} ${resultado.golsCasa} x ${resultado.golsFora} ${nomeDoClube(confronto.visitante)}`);
  if (resultado.chancesJogador.length > 0) {
    const sucessos = resultado.chancesJogador.filter((c) => c.sucesso).length;
    console.log(`    Suas chances na partida: ${resultado.chancesJogador.length} (${sucessos} bem-sucedidas)`);
  }
  console.log(`    Depois da rodada: ${resumoDaLinha(tabelaDepois, clubeId)} x ${resumoDaLinha(tabelaDepois, adversario)}`);
}

/** Mostra um confronto de mata-mata do clube do jogador jogo a jogo — não tem "tabela" (é chaveamento), só o placar agregado e se avançou/foi eliminado. */
function exibirPartidaMataMata(info: PartidaDoJogadorMataMata, clubeId: string): void {
  const { campeonatoId, evento } = info;
  const { etapa, confronto } = evento;
  const decisao = confronto.decididoNosPenaltis ? " (nos pênaltis)" : "";
  const desfecho = confronto.vencedor === clubeId ? "Classificado!" : "Eliminado.";

  console.log(`\n  [${campeonatoId}] ${etapa}: ${nomeDoClube(confronto.timeA)} ${confronto.golsA} x ${confronto.golsB} ${nomeDoClube(confronto.timeB)}${decisao} — ${desfecho}`);
}

async function simularCopaDoBrasil(): Promise<void> {
  const copaDoBrasil = buscarCampeonato("copa_do_brasil");
  const ratings = Object.fromEntries(copaDoBrasil.times.map((id) => [id, obterRating(clubePorId.get(id)!)]));

  const resultado: ResultadoMataMata = await simularMataMataDoFormato(copaDoBrasil.formato.mata_mata!, ratings, copaDoBrasil.times);

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
async function simularArgentina(): Promise<void> {
  const liga = buscarCampeonato("argentina_primera");
  const ratings = Object.fromEntries(liga.times.map((id) => [id, obterRating(clubePorId.get(id)!)]));

  const apertura = await simularFaseUnicaDoFormato(liga.formato.turno!, liga.times, ratings);
  const clausura = await simularFaseUnicaDoFormato(liga.formato.returno!, liga.times, ratings);
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
async function simularTemporadaCli(): Promise<void> {
  const campeonatos = [...loadCampeonatosNacionais(), ...loadEstaduais()];
  const jogador = {
    id: "jogador_temporada",
    nome: "Jogador da Temporada",
    posicao: "atacante" as const,
    arquetipo_id: "finalizador",
    idade: 22,
    atributos: Object.fromEntries(ATRIBUTOS_POR_POSICAO.atacante.map((a) => [a, 60])),
  };

  const resultado = await simularTemporada(2027, campeonatos, clubes, { clubeId: "corinthians", jogador, estiloTecnico: "equilibrado" });

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
 * `jogarTemporada`, chamado uma vez por temporada num laço aqui mesmo —
 * não `jogarCarreira` — pra poder plugar os hooks de jogo a jogo com o
 * clube certo a cada temporada): joga N temporadas seguidas com dados
 * reais (calendário completo, clube de verdade), aplicando XP de cada
 * partida e resolvendo cenários por período do calendário
 * automaticamente, sem orquestrar cada passo na mão como `carreira` faz.
 * `N` vem do 2º argumento da CLI (padrão 3). Passe `--jogo-a-jogo` pra
 * ver cada partida do clube do jogador (preparação, placar, tabela
 * antes/depois — ver `exibirPartidaPontosCorridos`/`exibirPartidaMataMata`).
 */
async function simularCarreiraLoopCli(): Promise<void> {
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
  console.log(`Início: temporada ${estado.temporada} | idade ${estado.jogador.idade} | overall ${overallAtual(estado)} | status ${estado.statusNoClube}\n`);

  const mostrarJogoAJogo = process.argv.includes("--jogo-a-jogo");

  for (let i = 0; i < quantidadeDeTemporadas; i++) {
    const temporada = await jogarTemporada(estado, campeonatos, clubes, {
      onPartidaPontosCorridos: mostrarJogoAJogo ? (info) => exibirPartidaPontosCorridos(info, estado.clubeAtualId) : undefined,
      onPartidaMataMata: mostrarJogoAJogo ? (info) => exibirPartidaMataMata(info, estado.clubeAtualId) : undefined,
    });

    const competicoesOk = temporada.resultadoTemporada.competicoes.filter((c) => !c.erro);
    console.log(
      `\n--- Temporada ${temporada.resultadoTemporada.temporada} → ${temporada.estado.temporada} | clube ${nomeDoClube(temporada.estado.clubeAtualId)} | idade ${temporada.estado.jogador.idade} | overall ${overallAtual(temporada.estado)} | status ${temporada.estado.statusNoClube} ---`,
    );
    console.log(
      `  ${competicoesOk.length}/${temporada.resultadoTemporada.competicoes.length} competições simuladas | ${temporada.cenariosResolvidos.length} cenários resolvidos`,
    );

    if (temporada.statusAtualizado && temporada.statusAtualizado.statusAnterior !== temporada.statusAtualizado.statusNovo) {
      console.log(
        `  Status: ${temporada.statusAtualizado.statusAnterior} -> ${temporada.statusAtualizado.statusNovo} (nota média ${temporada.statusAtualizado.notaMedia.toFixed(1)} em ${temporada.statusAtualizado.partidasJogadas} partida(s))`,
      );
    }

    for (const negociacao of temporada.negociacoesResolvidas) {
      const termos = negociacao.contrapropostaJogador;
      const desfecho = negociacao.resultado.aceito ? "ACEITA" : "recusada";
      const rotulo = negociacao.tipo === "venda_forcada" ? "venda forçada" : "transferência";
      console.log(
        `  [${rotulo}] ${nomeDoClube(negociacao.clubeOfertanteId)}: status oferecido ${negociacao.proposta.statusOferecido} | contraproposta R$${termos.salarioMensal}/mês + R$${termos.luvas} luvas, ${termos.anos} anos → ${desfecho} (confiança ${negociacao.resultado.confianca})`,
      );
    }

    console.log(
      `  Moral ${temporada.estado.moral} | Reputação nacional ${temporada.estado.reputacao.nacional} | Relações internas ${temporada.estado.relacoesInternas} | Patrimônio ${temporada.estado.patrimonio}`,
    );

    estado = temporada.estado;
  }

  console.log(
    `\n=== Fim: temporada ${estado.temporada} | clube ${nomeDoClube(estado.clubeAtualId)} | idade ${estado.jogador.idade} | overall ${overallAtual(estado)} | status ${estado.statusNoClube} ===`,
  );
}

/**
 * Carreira **interativa**: você cria o jogador (nome, posição, arquétipo,
 * clube inicial) e joga temporada por temporada, escolhendo de verdade
 * cada cenário que aparece (via `career/career-loop.ts` `jogarTemporada`
 * `escolherOpcao`) — ao contrário de `carreira`/`carreira-loop`, que
 * sempre escolhem a primeira opção sozinhas. As opções são mostradas sem
 * revelar probabilidade/resultado de antemão (você só descobre o desfecho
 * depois de escolher, via os hooks `onCenarioResolvido`/
 * `onNegociacaoResolvida`) — mais parecido com realmente jogar. A
 * contraproposta numa negociação de transferência continua automática
 * (`contrapropostaPadrao`) nesta versão — negociar os termos na mão fica
 * pra uma próxima rodada.
 */
async function jogarCarreiraInterativaCli(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const perguntar = (texto: string) => rl.question(texto);

  console.log("\n=== Criação de carreira ===");
  const nome = (await perguntar("Nome do jogador: ")).trim() || "Jogador Sem Nome";

  const posicoes: Posicao[] = ["goleiro", "zagueiro", "lateral", "volante", "meia", "atacante"];
  console.log("\nPosições:");
  posicoes.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
  let posicao: Posicao;
  while (true) {
    const escolha = Number((await perguntar("Escolha a posição (número): ")).trim());
    if (escolha >= 1 && escolha <= posicoes.length) {
      posicao = posicoes[escolha - 1];
      break;
    }
    console.log("Opção inválida, tente de novo.");
  }

  const arquetiposDaPosicao = ARQUETIPOS.filter((a) => a.posicao === posicao);
  console.log(`\nArquétipos de ${posicao}:`);
  arquetiposDaPosicao.forEach((a, i) => console.log(`  ${i + 1}. ${a.nome} (prioriza: ${a.atributos_prioritarios.join(", ")})`));
  let arquetipoId: string;
  while (true) {
    const escolha = Number((await perguntar("Escolha o arquétipo (número): ")).trim());
    if (escolha >= 1 && escolha <= arquetiposDaPosicao.length) {
      arquetipoId = arquetiposDaPosicao[escolha - 1].id;
      break;
    }
    console.log("Opção inválida, tente de novo.");
  }

  const TEMPORADA_INICIAL = 2027;
  // clubeInicialId provisório só pra poder calcular overall/perfil antes de existir um clube de verdade —
  // nunca é mostrado nem usado além disso: `assinarContrato`, logo abaixo, substitui pelo clube escolhido.
  let estado = criarEstadoInicial({ id: "jogador_interativo", nome, posicao, arquetipoId, clubeInicialId: "", temporadaInicial: TEMPORADA_INICIAL });

  const perfilDeNovato = {
    overall: overallAtual(estado),
    idade: estado.jogador.idade,
    reputacaoNacional: estado.reputacao.nacional,
    multiplicadorStatus: multiplicadorDeValorizacaoPorStatus(estado.statusNoClube),
  };
  const propostasIniciais = gerarPropostasIniciais(clubes, perfilDeNovato, 3);

  let clubeInicialId: string;
  if (propostasIniciais.length === 0) {
    // fallback raro (nenhum clube demonstrou interesse) — escolha manual, mesmo fluxo de antes.
    console.log("\nNenhuma proposta chegou pra você ainda — escolha um clube pra tentar a sorte.");
    let escolhaManual: string | undefined;
    while (!escolhaManual) {
      const resposta = (await perguntar("Clube inicial (digite o id, ex: corinthians — ou 'listar BR' pra ver ids de um país): ")).trim();
      if (resposta.toLowerCase().startsWith("listar")) {
        const filtroPais = resposta.split(/\s+/)[1];
        const listados = filtroPais ? clubes.filter((c) => c.pais.toLowerCase() === filtroPais.toLowerCase()) : clubes;
        console.log(`\n${listados.length} clube(s)${filtroPais ? ` (país: ${filtroPais})` : ""}:`);
        for (const c of [...listados].sort((a, b) => a.id.localeCompare(b.id)).slice(0, 60)) {
          console.log(`  ${c.id} — ${c.nome_popular ?? c.nome}`);
        }
        if (listados.length > 60) console.log(`  ... e mais ${listados.length - 60} (filtre por país pra uma lista menor)`);
        continue;
      }
      if (clubePorId.has(resposta)) {
        escolhaManual = resposta;
      } else {
        console.log(`Clube "${resposta}" não encontrado.`);
      }
    }
    clubeInicialId = escolhaManual;
    estado = { ...estado, clubeAtualId: clubeInicialId };
  } else {
    console.log("\n=== Propostas iniciais ===");
    propostasIniciais.forEach((p, i) => {
      const termos = p.propostaInicial;
      console.log(
        `  ${i + 1}. ${nomeDoClube(p.clubeOfertanteId)} — status: ${p.statusOferecido} | R$${termos.salarioMensal}/mês + R$${termos.luvas} luvas, ${termos.anos} anos`,
      );
    });

    let escolhaIndice: number | undefined;
    while (escolhaIndice === undefined) {
      const resposta = Number((await perguntar("Escolha uma proposta (número): ")).trim());
      if (resposta >= 1 && resposta <= propostasIniciais.length) escolhaIndice = resposta - 1;
      else console.log("Opção inválida, tente de novo.");
    }

    const propostaEscolhida = propostasIniciais[escolhaIndice];
    const termos = propostaEscolhida.propostaInicial;
    const contratoInicial: Contrato = {
      clubeId: propostaEscolhida.clubeOfertanteId,
      salarioMensal: termos.salarioMensal,
      luvas: termos.luvas,
      clausulaRescisao: termos.salarioMensal * 12 * (termos.anos + 1), // mesma estimativa simples de market/negotiation.ts
      anos: termos.anos,
      temporadaAssinatura: TEMPORADA_INICIAL,
    };
    estado = assinarContrato(estado, contratoInicial, propostaEscolhida.statusOferecido);
    clubeInicialId = propostaEscolhida.clubeOfertanteId;
  }

  const campeonatos = [...loadCampeonatosNacionais(), ...loadEstaduais()];

  console.log(`\n=== ${estado.jogador.nome} (${posicao}) — ${nomeDoClube(clubeInicialId)}, temporada ${estado.temporada} ===`);
  console.log(`Idade ${estado.jogador.idade} | Overall ${overallAtual(estado)} | Status: ${estado.statusNoClube}\n`);

  const escolherOpcaoInterativa = async (cenario: Cenario): Promise<Opcao> => {
    console.log(`\n--- ${cenario.titulo} ---`);
    console.log(cenario.descricao);
    cenario.opcoes.forEach((o, i) => console.log(`  ${i + 1}. ${o.texto}`));
    while (true) {
      const escolha = Number((await perguntar("Sua escolha (número): ")).trim());
      if (escolha >= 1 && escolha <= cenario.opcoes.length) return cenario.opcoes[escolha - 1];
      console.log("Opção inválida, tente de novo.");
    }
  };

  /**
   * Quantas partidas o modo "simular até a metade da temporada" fica sem
   * perguntar de novo depois de escolhido — no ponto em que
   * `escolherModoDePartida` é chamado (`career/career-loop.ts`) não dá pra
   * saber de antemão quantas partidas o clube do jogador vai ter na
   * temporada inteira (múltiplas competições, cada uma só sabendo seu
   * próprio calendário, ver `simulation/engine.ts`), então isso é uma
   * estimativa fixa de design (não uma conta exata de "metade"), calibrada
   * pra cobrir uma janela razoavelmente longa sem perguntar. Depois dela,
   * volta a perguntar normalmente.
   */
  const PARTIDAS_ATE_METADE_DA_TEMPORADA_HEURISTICA = 25;
  let modoAutoAtePartida: number | undefined;
  let ultimoContextoDePartida: ContextoPartidaDoJogador | undefined;

  const escolherModoDePartidaInterativo = async (contexto: ContextoPartidaDoJogador): Promise<ModoDePartida> => {
    ultimoContextoDePartida = contexto;

    if (modoAutoAtePartida !== undefined) {
      if (contexto.numeroDaPartida <= modoAutoAtePartida) return "rapida";
      modoAutoAtePartida = undefined; // passou da janela automática, volta a perguntar
    }

    console.log(
      `\n--- Partida ${contexto.numeroDaPartida}: ${nomeDoClube(contexto.mandanteId)} x ${nomeDoClube(contexto.visitanteId)} (você joga ${contexto.lado === "casa" ? "em casa" : "fora"}) ---`,
    );
    console.log("  1. Simulação rápida (direto pro resultado)");
    console.log("  2. Simular até a metade da temporada (não pergunta de novo por um tempo)");
    console.log("  3. Simular o jogo (ao vivo — pausa em lances importantes)");

    while (true) {
      const escolha = (await perguntar("Escolha (número): ")).trim();
      if (escolha === "1") return "rapida";
      if (escolha === "2") {
        modoAutoAtePartida = contexto.numeroDaPartida + PARTIDAS_ATE_METADE_DA_TEMPORADA_HEURISTICA;
        return "rapida";
      }
      if (escolha === "3") return "ao_vivo";
      console.log("Opção inválida, tente de novo.");
    }
  };

  const LABEL_SUBTIPO: Record<SubtipoChance, string> = {
    voleio: "voleio",
    cabeceio: "cabeceio",
    chute_de_fora: "chute de fora da área",
    jogada_individual: "jogada individual",
    passe_decisivo: "passe decisivo",
    desarme_decisivo: "desarme decisivo",
  };

  const decidirChanceAoVivoInterativo = async (contexto: ContextoDecisaoChance): Promise<ResultadoDecisaoChance> => {
    console.log(`\n  ${contexto.minuto}' — chance sua! (${LABEL_SUBTIPO[contexto.subtipo]})`);
    console.log("    1. Arriscar, ir com tudo");
    console.log("    2. Ajeitar antes de bater, com mais categoria");
    while (true) {
      const escolha = (await perguntar("  Sua decisão (número): ")).trim();
      if (escolha === "1") return { ajusteForcaJogador: 150, ajusteForcaDefensiva: 0 };
      if (escolha === "2") return { ajusteForcaJogador: 60, ajusteForcaDefensiva: -60 };
      console.log("  Opção inválida, tente de novo.");
    }
  };

  const onEventoAoVivoInterativo = (evento: EventoAoVivo): void => {
    const mandanteNome = ultimoContextoDePartida ? nomeDoClube(ultimoContextoDePartida.mandanteId) : "Mandante";
    const visitanteNome = ultimoContextoDePartida ? nomeDoClube(ultimoContextoDePartida.visitanteId) : "Visitante";

    switch (evento.tipo) {
      case "chance_generica": {
        const time = evento.lado === "casa" ? mandanteNome : visitanteNome;
        console.log(`  ${evento.minuto}' ${evento.gol ? `GOL do ${time}!` : `Chance perdida do ${time}.`}`);
        break;
      }
      case "chance_jogador": {
        console.log(`  ${evento.minuto}' ${evento.chance.sucesso ? "GOL SEU!" : "Você não conseguiu marcar dessa vez."}`);
        break;
      }
      case "evento_de_contexto": {
        console.log(`  ${evento.minuto}' ${evento.escolha.resultado.impacto.narrativa}`);
        break;
      }
      case "apito_final": {
        console.log(`  Apito final: ${mandanteNome} ${evento.golsCasa} x ${evento.golsFora} ${visitanteNome}`);
        break;
      }
    }
  };

  const FOCOS_DE_TREINO: { foco: FocoDeTreino; rotulo: string }[] = [
    { foco: "fisico", rotulo: "Físico (velocidade, força, resistência, jogo aéreo, reflexos)" },
    { foco: "tecnico", rotulo: "Técnico (finalização, drible, passe, marcação, etc — depende da posição)" },
    { foco: "tatico", rotulo: "Tático (visão de jogo, frieza, posicionamento, liderança)" },
    { foco: "descanso", rotulo: "Descanso (recupera moral, não treina atributo)" },
  ];

  const escolherFocoDeTreinoInterativo = async (): Promise<FocoDeTreino> => {
    console.log(`\n--- Sessão de treino ---`);
    FOCOS_DE_TREINO.forEach((f, i) => console.log(`  ${i + 1}. ${f.rotulo}`));
    while (true) {
      const escolha = Number((await perguntar("Foco desta sessão (número): ")).trim());
      if (escolha >= 1 && escolha <= FOCOS_DE_TREINO.length) return FOCOS_DE_TREINO[escolha - 1].foco;
      console.log("Opção inválida, tente de novo.");
    }
  };

  const onTreinoResolvido = (treino: TreinoResolvidoNaTemporada): void => {
    if (treino.foco === "descanso") {
      console.log(`  -> Moral: ${treino.moralAntes} -> ${treino.moralDepois}`);
    } else {
      console.log(`  -> Overall: ${treino.overallAntes} -> ${treino.overallDepois}`);
    }
  };

  const onNegociacaoResolvida = (negociacao: NegociacaoResolvidaNaTemporada): void => {
    const termos = negociacao.contrapropostaJogador;
    const desfecho = negociacao.resultado.aceito ? "ACEITA!" : "recusada.";
    const rotulo = negociacao.tipo === "venda_forcada" ? "Venda forçada" : "Proposta de transferência";
    console.log(
      `  [${rotulo}] ${nomeDoClube(negociacao.clubeOfertanteId)} — status oferecido: ${negociacao.proposta.statusOferecido} | contraproposta automática: R$${termos.salarioMensal}/mês + R$${termos.luvas} luvas, ${termos.anos} anos -> ${desfecho}`,
    );
  };

  const onStatusAtualizado = (info: StatusAtualizadoNaTemporada): void => {
    const seta = info.statusAnterior === info.statusNovo ? "mantido" : `${info.statusAnterior} -> ${info.statusNovo}`;
    console.log(`\n--- Avaliação de status (${info.partidasJogadas} partida(s), nota média ${info.notaMedia.toFixed(1)}) ---`);
    console.log(`  Status no elenco: ${seta}`);
  };

  const onCenarioResolvido = (resolvido: CenarioResolvidoNaTemporada): void => {
    console.log(`  -> ${resolvido.escolha.resultado.impacto.narrativa} (${formatarImpacto(resolvido.escolha.resultado.impacto)})`);
  };

  const onPartidaPontosCorridos = (info: PartidaDoJogadorPontosCorridos): void => {
    exibirPartidaPontosCorridos(info, estado.clubeAtualId);
  };

  const onPartidaMataMata = (info: PartidaDoJogadorMataMata): void => {
    exibirPartidaMataMata(info, estado.clubeAtualId);
  };

  const onPartidasResumidas = (resumo: ResumoPartidasDaTemporada): void => {
    console.log(`\n--- Partidas da temporada ---`);
    for (const c of resumo.competicoes) {
      if (c.erro) {
        console.log(`  ✗ ${c.campeonatoId}: não simulada (${c.erro})`);
      } else if (c.partidasDoJogador > 0) {
        console.log(`  ✓ ${c.campeonatoId}: campeão ${nomeDoClube(c.campeao!)} | você jogou ${c.partidasDoJogador} partida(s) — ${c.golsDoJogador} gol(s), ${c.assistenciasDoJogador} assistência(s)`);
      } else {
        console.log(`  ✓ ${c.campeonatoId}: campeão ${nomeDoClube(c.campeao!)} (seu clube não disputou, ou você não jogou)`);
      }
    }
    console.log(`  Overall: ${resumo.overallAntes} -> ${resumo.overallDepois}`);
  };

  let continuar = true;
  while (continuar) {
    const resultado: ResultadoTemporadaDeCarreira = await jogarTemporada(estado, campeonatos, clubes, {
      escolherOpcao: escolherOpcaoInterativa,
      escolherFocoDeTreino: escolherFocoDeTreinoInterativo,
      onNegociacaoResolvida,
      onCenarioResolvido,
      onPartidasResumidas,
      onStatusAtualizado,
      onTreinoResolvido,
      onPartidaPontosCorridos,
      onPartidaMataMata,
      escolherModoDePartida: escolherModoDePartidaInterativo,
      decidirChanceAoVivo: decidirChanceAoVivoInterativo,
      decidirEventoDePartida: escolherOpcaoInterativa,
      onEventoAoVivo: onEventoAoVivoInterativo,
    });
    estado = resultado.estado;

    const competicoesOk = resultado.resultadoTemporada.competicoes.filter((c) => !c.erro);
    console.log(`\n=== Fim da temporada ${resultado.resultadoTemporada.temporada} — agora ${estado.temporada} ===`);
    console.log(`Clube: ${nomeDoClube(estado.clubeAtualId)} | Idade: ${estado.jogador.idade} | Overall: ${overallAtual(estado)} | Status: ${estado.statusNoClube}`);
    console.log(`${competicoesOk.length}/${resultado.resultadoTemporada.competicoes.length} competições simuladas`);
    console.log(
      `Moral ${estado.moral} | Reputação nacional ${estado.reputacao.nacional} | Relações internas ${estado.relacoesInternas} | Patrimônio R$${estado.patrimonio}`,
    );

    const resposta = (await perguntar("\nEnter pra jogar a próxima temporada, ou 'sair' pra encerrar: ")).trim().toLowerCase();
    if (resposta === "sair" || resposta === "s" || resposta === "parar") continuar = false;
  }

  console.log(
    `\n=== Carreira encerrada em ${estado.temporada}, aos ${estado.jogador.idade} anos, overall ${overallAtual(estado)}, status ${estado.statusNoClube} no ${nomeDoClube(estado.clubeAtualId)} ===`,
  );
  rl.close();
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
    await simularCopaDoBrasil();
    break;
  case "argentina":
    await simularArgentina();
    break;
  case "cenario":
    simularCenario();
    break;
  case "carreira":
    simularCarreira();
    break;
  case "temporada":
    await simularTemporadaCli();
    break;
  case "carreira-loop":
    await simularCarreiraLoopCli();
    break;
  case "clubes":
    listarClubesCli();
    break;
  case "jogar":
    await jogarCarreiraInterativaCli();
    break;
  default:
    console.error(
      `Comando desconhecido: "${comando}". Use "copa-do-brasil", "argentina", "cenario", "carreira", "temporada", "carreira-loop", "clubes" ou "jogar".`,
    );
    process.exit(1);
}
