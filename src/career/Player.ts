import type { DesempenhoPartida } from "../progression/xp.js";
import { aplicarXpPartidaAoJogador, calcularXpPartida } from "../progression/xp.js";
import { aplicarDeclinioPorIdade } from "../progression/aging.js";
import type { ImpactoCarreira, Reputacao } from "../progression/scenarios.js";
import { aplicarImpacto, criarReputacaoInicial, type EstadoJogadorParaImpacto } from "../progression/scenarios.js";
import { patrociniosDisponiveis } from "./patrocinios.js";
import { ATRIBUTOS_POR_POSICAO, buscarArquetipo, calcularOverall, type Jogador, type Posicao } from "../schemas/player.js";
import type { ChanceJogador } from "../simulation/match.js";

/**
 * Estado de carreira do jogador — o "save" da carreira. Junta o `Jogador`
 * (atributos/posição/arquétipo, `schemas/player.ts`) com o que só existe em
 * nível de carreira: clube atual, temporada, moral, reputação, relações
 * internas e patrimônio (que não tinham lar antes desta peça — ver
 * `docs/motor-de-partida.md` seção 4, onde `progression/scenarios.ts` só
 * operava num par solto de campos).
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
  reputacao: Reputacao;
  /** 0-100 — elenco/comissão técnica/diretoria agregados num número só (ver docs/motor-de-partida.md). Puramente conceitual até existir sistema de minutagem/renovação. */
  relacoesInternas: number;
  /** Renda simples acumulada de patrocínios (`career/patrocinios.ts`) — não é a economia completa da Fase 4 (mercado de transferências), só um contador. */
  patrimonio: number;
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
const RELACOES_INTERNAS_INICIAL = 50;
const PATRIMONIO_INICIAL = 0;

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
    reputacao: criarReputacaoInicial(),
    relacoesInternas: RELACOES_INTERNAS_INICIAL,
    patrimonio: PATRIMONIO_INICIAL,
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

/**
 * Aplica o impacto de um resultado de cenário de carreira
 * (`progression/scenarios.ts`) ao estado. `regiaoAtual` (normalmente a UF
 * do clube atual) decide onde eventuais deltas de reputação regional
 * caem — sem ela, esses deltas ficam sem efeito (ver `aplicarImpacto`).
 */
export function aplicarImpactoDeCenario(
  estado: EstadoDeCarreira,
  impacto: ImpactoCarreira,
  regiaoAtual?: string,
): EstadoDeCarreira {
  const parcial: EstadoJogadorParaImpacto = {
    atributos: estado.jogador.atributos,
    moral: estado.moral,
    reputacao: estado.reputacao,
    relacoesInternas: estado.relacoesInternas,
  };
  const atualizado = aplicarImpacto(parcial, impacto, regiaoAtual);

  return {
    ...estado,
    jogador: { ...estado.jogador, atributos: atualizado.atributos },
    moral: atualizado.moral,
    reputacao: atualizado.reputacao,
    relacoesInternas: atualizado.relacoesInternas,
  };
}

export function transferirParaClube(estado: EstadoDeCarreira, novoClubeId: string): EstadoDeCarreira {
  return { ...estado, clubeAtualId: novoClubeId };
}

/**
 * Avança pra próxima temporada — idade e temporada +1, aplica a curva de
 * pico/declínio por idade (`progression/aging.ts`: atributo físico decai
 * cedo e rápido depois do pico, mental decai tarde e devagar, liderança
 * nunca decai — não afeta quem ainda não passou da idade de pico da
 * categoria) e soma ao patrimônio a renda de todos os patrocínios
 * disponíveis pra reputação/região atuais (`career/patrocinios.ts`) — não
 * é negociação de contrato, só uma renda simples por temporada.
 */
export function avancarTemporada(estado: EstadoDeCarreira, regiaoAtual?: string): EstadoDeCarreira {
  const novaIdade = estado.jogador.idade + 1;
  const atributos = aplicarDeclinioPorIdade(estado.jogador.atributos, novaIdade);
  const rendaPatrocinios = patrociniosDisponiveis(estado.reputacao, regiaoAtual).reduce(
    (soma, patrocinio) => soma + patrocinio.valorPorTemporada,
    0,
  );

  return {
    ...estado,
    temporada: estado.temporada + 1,
    jogador: { ...estado.jogador, idade: novaIdade, atributos },
    patrimonio: estado.patrimonio + rendaPatrocinios,
  };
}
