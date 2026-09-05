import type { Club } from "../schemas/club.js";
import { construirCalendarioPadrao } from "../data/loaders/calendario.js";
import { simularTemporada, type CampeonatoSimulavel, type ResultadoTemporada } from "../simulation/engine.js";
import type { ParticipacaoJogadorClube } from "../simulation/match.js";
import type { EstiloTecnico } from "../simulation/tactics.js";
import { converterChancesEmDesempenho } from "../progression/xp.js";
import {
  CENARIOS,
  filtrarCenariosElegiveis,
  momentoDoPeriodo,
  resolverEscolha,
  sortearCenario,
  type Cenario,
  type ContextoSorteio,
  type EscolhaResolvida,
  type Opcao,
} from "../progression/scenarios.js";
import { aplicarDesempenhoPartida, aplicarImpactoDeCenario, avancarTemporada, type EstadoDeCarreira } from "./Player.js";

/**
 * Game loop de carreira — junta as peças já implementadas (`simulation/
 * engine.ts` pro calendário de competições, `progression/scenarios.ts` pro
 * catálogo de cenários com gatilho, `career/Player.ts` pro estado do
 * jogador) numa única passagem de temporada, sem precisar orquestrar cada
 * partida/cenário na mão como a demo de `src/cli/index.ts` fazia.
 */

/** Minutos jogados assumidos em toda partida do jogador — não existe sistema de minutagem/banco ainda (pendência, docs/motor-de-partida.md). */
const MINUTOS_POR_PARTIDA_PADRAO = 90;
/** Importância uniforme pra toda partida — o motor ainda não distingue fase (final de mata-mata vs. fase de grupos) dentro de `partidasDoJogador` (pendência). */
const IMPORTANCIA_PADRAO = 1;

export interface CenarioResolvidoNaTemporada {
  periodo: string;
  momento: NonNullable<ContextoSorteio["momento"]>;
  cenario: Cenario;
  escolha: EscolhaResolvida;
}

export interface ResultadoTemporadaDeCarreira {
  /** Estado do jogador ao final da temporada — já com a idade/temporada avançadas (ver `avancarTemporada`). */
  estado: EstadoDeCarreira;
  /** Resultado bruto do calendário de competições da temporada (`simulation/engine.ts`). */
  resultadoTemporada: ResultadoTemporada;
  /** Um cenário resolvido por período do calendário, na ordem em que aconteceram. */
  cenariosResolvidos: CenarioResolvidoNaTemporada[];
}

export interface OpcoesJogarTemporada {
  estiloTecnico?: EstiloTecnico;
  /** UF/região do clube atual — decide onde deltas de reputação regional caem (ver `progression/scenarios.ts` `aplicarImpacto`) e filtra cenários por reputação regional. Sem ela, reputação regional fica sempre 0 no contexto e nenhum delta regional é aplicado. */
  regiaoAtual?: string;
  /** Como decidir qual opção de um cenário é escolhida — por padrão, sempre a primeira (mesmo comportamento das demos de CLI). Injete pra plugar uma interface real (jogador humano, IA, sempre a opção mais segura, etc). */
  escolherOpcao?: (cenario: Cenario) => Opcao;
  random?: () => number;
}

/**
 * Joga uma temporada inteira da carreira: simula todas as competições
 * ativas do calendário padrão (`simulation/engine.ts` `simularTemporada`),
 * aplica o XP de cada partida do jogador em ordem (`aplicarDesempenhoPartida`),
 * sorteia e resolve um cenário elegível por período do calendário
 * (`momentoDoPeriodo` decide o momento de cada período), e por fim avança
 * pra próxima temporada (`avancarTemporada`: idade+1, declínio por idade,
 * renda de patrocínio). Não muta o `estado` recebido.
 *
 * **Simplificações documentadas** (não são bugs escondidos, ver pendências
 * em `docs/motor-de-partida.md`): toda partida é tratada como 90 minutos
 * jogados e importância 1 — não existe sistema de minutagem/banco nem
 * diferenciação de fase (final vs. fase de grupos) dentro de
 * `partidasDoJogador` ainda.
 */
export function jogarTemporada(
  estado: EstadoDeCarreira,
  campeonatos: CampeonatoSimulavel[],
  clubes: Club[],
  opcoes: OpcoesJogarTemporada = {},
): ResultadoTemporadaDeCarreira {
  const { estiloTecnico = "equilibrado", regiaoAtual, escolherOpcao = (cenario: Cenario) => cenario.opcoes[0], random = Math.random } = opcoes;

  const participacaoJogador: ParticipacaoJogadorClube = { clubeId: estado.clubeAtualId, jogador: estado.jogador, estiloTecnico };
  const resultadoTemporada = simularTemporada(estado.temporada, campeonatos, clubes, participacaoJogador, random);

  let estadoAtual = estado;
  for (const competicao of resultadoTemporada.competicoes) {
    if (!competicao.resultado) continue;
    for (const partida of competicao.resultado.partidasDoJogador) {
      const desempenho = converterChancesEmDesempenho(partida.chancesJogador, MINUTOS_POR_PARTIDA_PADRAO, IMPORTANCIA_PADRAO);
      estadoAtual = aplicarDesempenhoPartida(estadoAtual, partida.chancesJogador, desempenho);
    }
  }

  const cenariosResolvidos: CenarioResolvidoNaTemporada[] = [];
  for (const periodo of construirCalendarioPadrao(estadoAtual.temporada).calendario) {
    const momento = momentoDoPeriodo(periodo.periodo);
    const contexto: ContextoSorteio = {
      idadeJogador: estadoAtual.jogador.idade,
      reputacaoNacional: estadoAtual.reputacao.nacional,
      reputacaoRegional: regiaoAtual !== undefined ? (estadoAtual.reputacao.porRegiao[regiaoAtual] ?? 0) : 0,
      moral: estadoAtual.moral,
      relacoesInternas: estadoAtual.relacoesInternas,
      momento,
    };

    const cenario = sortearCenario(filtrarCenariosElegiveis(CENARIOS, contexto), random);
    const opcaoEscolhida = escolherOpcao(cenario);
    const escolha = resolverEscolha(opcaoEscolhida, random);
    estadoAtual = aplicarImpactoDeCenario(estadoAtual, escolha.resultado.impacto, regiaoAtual);

    cenariosResolvidos.push({ periodo: periodo.periodo, momento, cenario, escolha });
  }

  estadoAtual = avancarTemporada(estadoAtual, regiaoAtual);

  return { estado: estadoAtual, resultadoTemporada, cenariosResolvidos };
}

export interface ResultadoCarreiraDeVariasTemporadas {
  estadoFinal: EstadoDeCarreira;
  /** Uma entrada por temporada jogada, na ordem. */
  temporadas: ResultadoTemporadaDeCarreira[];
}

/** Encadeia `jogarTemporada` por várias temporadas seguidas, alimentando o estado final de uma na próxima — o "save" indo de temporada em temporada sozinho. */
export function jogarCarreira(
  estadoInicial: EstadoDeCarreira,
  quantidadeDeTemporadas: number,
  campeonatos: CampeonatoSimulavel[],
  clubes: Club[],
  opcoes: OpcoesJogarTemporada = {},
): ResultadoCarreiraDeVariasTemporadas {
  let estado = estadoInicial;
  const temporadas: ResultadoTemporadaDeCarreira[] = [];

  for (let i = 0; i < quantidadeDeTemporadas; i++) {
    const resultado = jogarTemporada(estado, campeonatos, clubes, opcoes);
    temporadas.push(resultado);
    estado = resultado.estado;
  }

  return { estadoFinal: estado, temporadas };
}
