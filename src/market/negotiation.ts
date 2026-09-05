import type { Contrato } from "../schemas/contract.js";
import type { PropostaTransferencia, TermosDeContrato } from "./transfers.js";

/**
 * Negociação ativa — ver `docs/game-design.md` seção 4 ("barra de
 * confiança do clube", não apenas aceitar/recusar). Sem perks (o fator
 * original "perks relevantes pro esquema tático" não existe mais nesse
 * design): confiança vem do gap salarial pedido, do overall/reputação do
 * jogador, e de quantos outros clubes concorrem pela mesma contratação.
 */

const AUMENTO_SALARIAL_PADRAO = 1.25;
const AUMENTO_LUVAS_PADRAO = 1.15;

/** Estratégia padrão de contraproposta do jogador: pede mais salário e luvas que a oferta inicial, mesmo número de anos. Injetável — quem chama `negociarTransferencia`/o game loop pode plugar outra estratégia (ver `career/career-loop.ts` `OpcoesJogarTemporada.responderProposta`). */
export function contrapropostaPadrao(proposta: PropostaTransferencia): TermosDeContrato {
  const { salarioMensal, luvas, anos } = proposta.propostaInicial;
  return {
    salarioMensal: Math.round(salarioMensal * AUMENTO_SALARIAL_PADRAO),
    luvas: Math.round(luvas * AUMENTO_LUVAS_PADRAO),
    anos,
  };
}

export interface FatoresConfianca {
  /** Overall atual do jogador (0-99, derivado — `career/Player.ts` `overallAtual`). */
  overall: number;
  /** Reputação nacional do jogador (0-100). */
  reputacaoNacional: number;
  /** Quantos OUTROS clubes também demonstraram interesse na mesma janela (não conta o próprio ofertante) — mais concorrência reduz o poder do clube de segurar a proposta original. */
  concorrentes: number;
}

const CONFIANCA_BASE = 55;
const PESO_PENALIDADE_POR_GAP_SALARIAL = 60;
const PESO_BONUS_POR_OVERALL = 0.5;
const OVERALL_NEUTRO = 50;
const PESO_BONUS_POR_REPUTACAO = 0.15;
const PESO_PENALIDADE_POR_CONCORRENTE = 8;

/**
 * Confiança (0-100) de que o clube aceita a contraproposta do jogador.
 * **Estimativa de design, não fórmula validada** (mesma ressalva de
 * `market/valuation.ts`): cada 100% acima da proposta inicial custa 60
 * pontos de confiança; overall acima/abaixo de 50 soma/desconta; cada
 * concorrente a mais desconta 8 pontos (menos poder de barganha do clube
 * ofertante, mais opções pro jogador).
 */
export function calcularConfiancaDoClube(propostaClube: TermosDeContrato, contrapropostaJogador: TermosDeContrato, fatores: FatoresConfianca): number {
  const gapSalarial = (contrapropostaJogador.salarioMensal - propostaClube.salarioMensal) / Math.max(1, propostaClube.salarioMensal);
  const penalidadeGap = gapSalarial * PESO_PENALIDADE_POR_GAP_SALARIAL;

  const bonusOverall = (fatores.overall - OVERALL_NEUTRO) * PESO_BONUS_POR_OVERALL;
  const bonusReputacao = fatores.reputacaoNacional * PESO_BONUS_POR_REPUTACAO;
  const penalidadeConcorrencia = fatores.concorrentes * PESO_PENALIDADE_POR_CONCORRENTE;

  const confianca = CONFIANCA_BASE - penalidadeGap + bonusOverall + bonusReputacao - penalidadeConcorrencia;
  return Math.max(0, Math.min(100, Math.round(confianca)));
}

export interface ResultadoNegociacao {
  aceito: boolean;
  /** Confiança calculada nessa rodada de negociação (0-100), útil pra depurar/mostrar ao jogador mesmo quando recusado. */
  confianca: number;
  /** Só presente quando `aceito` é `true`. */
  contrato?: Contrato;
}

const MESES_POR_ANO = 12;
const ANOS_DE_SALARIO_NA_CLAUSULA = 1;

/**
 * Resolve uma negociação: sorteia se o clube aceita a contraproposta,
 * ponderado pela confiança (`calcularConfiancaDoClube`) — probabilístico,
 * não determinístico, mesma filosofia de risco/retorno dos cenários de
 * carreira (`progression/scenarios.ts`). Se aceito, monta o `Contrato`
 * com os termos da contraproposta e uma cláusula de rescisão estimada
 * (salário anual × (anos de contrato + 1), estimativa simples de design).
 */
export function negociarTransferencia(
  proposta: PropostaTransferencia,
  contrapropostaJogador: TermosDeContrato,
  fatores: FatoresConfianca,
  temporadaAtual: number,
  random: () => number = Math.random,
): ResultadoNegociacao {
  const confianca = calcularConfiancaDoClube(proposta.propostaInicial, contrapropostaJogador, fatores);
  const aceito = random() * 100 < confianca;

  if (!aceito) return { aceito, confianca };

  return {
    aceito,
    confianca,
    contrato: {
      clubeId: proposta.clubeOfertanteId,
      salarioMensal: contrapropostaJogador.salarioMensal,
      luvas: contrapropostaJogador.luvas,
      clausulaRescisao: Math.round(contrapropostaJogador.salarioMensal * MESES_POR_ANO * (contrapropostaJogador.anos + ANOS_DE_SALARIO_NA_CLAUSULA)),
      anos: contrapropostaJogador.anos,
      temporadaAssinatura: temporadaAtual,
    },
  };
}
