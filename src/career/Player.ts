import type { DesempenhoPartida } from "../progression/xp.js";
import { aplicarXpPartidaAoJogador, calcularXpPartida } from "../progression/xp.js";
import type { ImpactoCarreira } from "../progression/scenarios.js";
import { aplicarImpacto, type EstadoJogadorParaImpacto } from "../progression/scenarios.js";
import { ATRIBUTOS_POR_POSICAO, buscarArquetipo, calcularOverall, type Jogador, type Posicao } from "../schemas/player.js";
import type { ChanceJogador } from "../simulation/match.js";

/**
 * Estado de carreira do jogador — o "save" da carreira. Junta o `Jogador`
 * (atributos/posição/arquétipo, `schemas/player.ts`) com o que só existe em
 * nível de carreira: clube atual, temporada, moral e reputação (que não
 * tinham lar antes desta peça — ver `docs/motor-de-partida.md` seção 4,
 * onde `progression/scenarios.ts` só operava num par solto de campos).
 *
 * Sem perks/nível como recurso separado (decisão já registrada em
 * `docs/motor-de-partida.md`) — o overall é sempre derivado dos atributos
 * via `overallAtual`, nunca guardado aqui.
 */
export interface EstadoDeCarreira {
  jogador: Jogador;
  clubeAtualId: string;
  temporada: number;
  /** 0-100. */
  moral: number;
  /** 0-100. */
  reputacao: number;
}

export interface OpcoesEstadoInicial {
  id: string;
  nome: string;
  posicao: Posicao;
  arquetipoId: string;
  clubeInicialId: string;
  temporadaInicial: number;
  idadeInicial?: number;
}

const IDADE_INICIAL_PADRAO = 18;
const ATRIBUTO_PRIORITARIO_INICIAL = 45;
const ATRIBUTO_NAO_PRIORITARIO_INICIAL = 35;
const MORAL_INICIAL = 50;
/** Jogador estreante começa desconhecido, não com reputação neutra. */
const REPUTACAO_INICIAL = 10;

/**
 * Cria o estado de carreira de um jogador novo — promessa jovem, não
 * craque pronto: atributos prioritários do arquétipo começam um pouco
 * acima dos demais, mas todos baixos/médios pra dar espaço de progressão.
 */
export function criarEstadoInicial(opcoes: OpcoesEstadoInicial): EstadoDeCarreira {
  const arquetipo = buscarArquetipo(opcoes.arquetipoId);
  if (arquetipo.posicao !== opcoes.posicao) {
    throw new Error(
      `criarEstadoInicial: arquétipo "${opcoes.arquetipoId}" é da posição "${arquetipo.posicao}", não "${opcoes.posicao}"`,
    );
  }

  const atributos = Object.fromEntries(
    ATRIBUTOS_POR_POSICAO[opcoes.posicao].map((atributo) => [
      atributo,
      arquetipo.atributos_prioritarios.includes(atributo) ? ATRIBUTO_PRIORITARIO_INICIAL : ATRIBUTO_NAO_PRIORITARIO_INICIAL,
    ]),
  );

  return {
    jogador: {
      id: opcoes.id,
      nome: opcoes.nome,
      posicao: opcoes.posicao,
      arquetipo_id: opcoes.arquetipoId,
      idade: opcoes.idadeInicial ?? IDADE_INICIAL_PADRAO,
      atributos,
    },
    clubeAtualId: opcoes.clubeInicialId,
    temporada: opcoes.temporadaInicial,
    moral: MORAL_INICIAL,
    reputacao: REPUTACAO_INICIAL,
  };
}

/** Overall atual (derivado dos atributos + arquétipo, nunca guardado). */
export function overallAtual(estado: EstadoDeCarreira): number {
  const arquetipo = buscarArquetipo(estado.jogador.arquetipo_id);
  return calcularOverall(estado.jogador, arquetipo);
}

/**
 * Aplica o desempenho de uma partida (via `chancesJogador` de
 * `simularPartida` convertidas em `DesempenhoPartida` por
 * `converterChancesEmDesempenho`) ao estado — XP total da partida
 * (`calcularXpPartida`) distribuído pelos atributos usados nas chances +
 * crescimento geral (`aplicarXpPartidaAoJogador`).
 */
export function aplicarDesempenhoPartida(
  estado: EstadoDeCarreira,
  chances: ChanceJogador[],
  desempenho: DesempenhoPartida,
): EstadoDeCarreira {
  const arquetipo = buscarArquetipo(estado.jogador.arquetipo_id);
  const xpTotal = calcularXpPartida(desempenho);
  const atributos = aplicarXpPartidaAoJogador(estado.jogador, arquetipo, chances, xpTotal);

  return { ...estado, jogador: { ...estado.jogador, atributos } };
}

/** Aplica o impacto de um resultado de cenário de carreira (`progression/scenarios.ts`) ao estado. */
export function aplicarImpactoDeCenario(estado: EstadoDeCarreira, impacto: ImpactoCarreira): EstadoDeCarreira {
  const parcial: EstadoJogadorParaImpacto = { atributos: estado.jogador.atributos, moral: estado.moral, reputacao: estado.reputacao };
  const atualizado = aplicarImpacto(parcial, impacto);

  return {
    ...estado,
    jogador: { ...estado.jogador, atributos: atualizado.atributos },
    moral: atualizado.moral,
    reputacao: atualizado.reputacao,
  };
}

export function transferirParaClube(estado: EstadoDeCarreira, novoClubeId: string): EstadoDeCarreira {
  return { ...estado, clubeAtualId: novoClubeId };
}

/**
 * Avança pra próxima temporada — idade e temporada +1. **Não aplica curva
 * de pico/declínio por idade nos atributos ainda** (pendência documentada
 * em `docs/motor-de-partida.md` seção 5) — só o incremento de idade.
 */
export function avancarTemporada(estado: EstadoDeCarreira): EstadoDeCarreira {
  return {
    ...estado,
    temporada: estado.temporada + 1,
    jogador: { ...estado.jogador, idade: estado.jogador.idade + 1 },
  };
}
