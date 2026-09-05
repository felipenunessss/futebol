import type { Club, ForcaFinanceira } from "../schemas/club.js";
import { obterRating } from "../simulation/rating.js";
import type { MomentoDeCarreira } from "../progression/scenarios.js";

/**
 * Janelas de transferência e teto salarial por clube — ver
 * `docs/game-design.md` seção 4. Reaproveita `MomentoDeCarreira`
 * (`progression/scenarios.ts`) em vez de inventar um conceito de "janela"
 * separado — hoje só `pre_temporada` conta como janela aberta, mesma
 * simplificação documentada em `momentoDoPeriodo` (o calendário padrão
 * não tem uma janela de meio de ano separada ainda).
 */
export function estaNaJanelaDeTransferencia(momento: MomentoDeCarreira): boolean {
  return momento === "pre_temporada";
}

const TETO_SALARIAL_MENSAL_POR_FORCA: Record<ForcaFinanceira, number> = {
  muito_alta: 500_000,
  alta: 150_000,
  media: 50_000,
  baixa: 15_000,
  muito_baixa: 5_000,
};

const TETO_SALARIAL_MENSAL_NIVEL_1 = 80_000;
const QUEDA_POR_NIVEL = 0.6;
const NIVEL_PADRAO_SEM_COMPETICAO_NACIONAL = 5;

/**
 * Teto salarial mensal do clube — vem de `forca_financeira` quando
 * disponível; sem isso, fallback por `divisao_nacional.nivel` (mesmo
 * padrão de `simulation/rating.ts` `calcularRatingFallback`). Estimativa
 * de design, não fórmula validada.
 */
export function tetoSalarialMensal(club: Club): number {
  if (club.forca_financeira) return TETO_SALARIAL_MENSAL_POR_FORCA[club.forca_financeira];

  const nivel = club.divisao_nacional?.nivel ?? NIVEL_PADRAO_SEM_COMPETICAO_NACIONAL;
  return Math.round(TETO_SALARIAL_MENSAL_NIVEL_1 * Math.pow(QUEDA_POR_NIVEL, nivel - 1));
}

export interface TermosDeContrato {
  salarioMensal: number;
  luvas: number;
  anos: number;
}

export interface PropostaTransferencia {
  clubeOfertanteId: string;
  propostaInicial: TermosDeContrato;
}

const MESES_DE_VALOR_DE_MERCADO_COMO_REFERENCIA_SALARIAL = 24;
const FATOR_DE_ABERTURA_MINIMO = 0.7;
const FATOR_DE_ABERTURA_VARIACAO = 0.2;
const LUVAS_MINIMO_EM_SALARIOS = 2;
const LUVAS_VARIACAO_EM_SALARIOS = 4;
const ANOS_MINIMO = 2;
const ANOS_VARIACAO = 3;

/**
 * Gera a proposta inicial de um clube — parte de uma referência salarial
 * simples (valor de mercado ~ 2 anos de salário), respeita o teto salarial
 * do clube, e abre abaixo do próprio teto/referência (70-90%) pra deixar
 * espaço de negociação (`market/negotiation.ts`). Estimativa de design.
 */
export function gerarProposta(clube: Club, valorDeMercado: number, random: () => number = Math.random): PropostaTransferencia {
  const tetoMensal = tetoSalarialMensal(clube);
  const salarioReferencia = Math.min(tetoMensal, Math.round(valorDeMercado / MESES_DE_VALOR_DE_MERCADO_COMO_REFERENCIA_SALARIAL));
  const fatorDeAbertura = FATOR_DE_ABERTURA_MINIMO + random() * FATOR_DE_ABERTURA_VARIACAO;
  const salarioMensal = Math.max(1, Math.round(salarioReferencia * fatorDeAbertura));
  const luvas = Math.round(salarioMensal * (LUVAS_MINIMO_EM_SALARIOS + random() * LUVAS_VARIACAO_EM_SALARIOS));
  const anos = ANOS_MINIMO + Math.floor(random() * ANOS_VARIACAO);

  return { clubeOfertanteId: clube.id, propostaInicial: { salarioMensal, luvas, anos } };
}

export interface OpcoesSelecaoDeInteressados {
  quantidadeMaxima?: number;
  random?: () => number;
}

const QUANTIDADE_MAXIMA_PADRAO_DE_INTERESSADOS = 3;
/** Só considera clube cujo teto salarial (em 2 anos, mesma referência de `gerarProposta`) cubra ao menos essa fração do valor de mercado do jogador. */
const FRACAO_MINIMA_DE_VALOR_DE_MERCADO_COBERTA = 0.5;

/**
 * Seleciona quais clubes demonstram interesse no jogador nesta janela —
 * só considera clube com rating esportivo (`simulation/rating.ts`) igual
 * ou maior que o clube atual (não faz sentido um clube pior tentar
 * "comprar" o jogador nesse modelo simplificado) e que consiga bancar
 * pelo menos uma fração do valor de mercado dele. Embaralha (Fisher-Yates
 * com `random` injetado, pra ficar determinístico em teste) e recorta em
 * `quantidadeMaxima`.
 */
export function selecionarClubesInteressados(
  clubes: Club[],
  clubeAtualId: string,
  valorDeMercado: number,
  opcoes: OpcoesSelecaoDeInteressados = {},
): Club[] {
  const { quantidadeMaxima = QUANTIDADE_MAXIMA_PADRAO_DE_INTERESSADOS, random = Math.random } = opcoes;

  const clubeAtual = clubes.find((c) => c.id === clubeAtualId);
  const ratingAtual = clubeAtual ? obterRating(clubeAtual) : 0;

  const candidatos = clubes.filter(
    (c) =>
      c.id !== clubeAtualId &&
      obterRating(c) >= ratingAtual &&
      tetoSalarialMensal(c) * MESES_DE_VALOR_DE_MERCADO_COMO_REFERENCIA_SALARIAL >= valorDeMercado * FRACAO_MINIMA_DE_VALOR_DE_MERCADO_COBERTA,
  );

  const embaralhados = [...candidatos];
  for (let i = embaralhados.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [embaralhados[i], embaralhados[j]] = [embaralhados[j], embaralhados[i]];
  }

  return embaralhados.slice(0, quantidadeMaxima);
}
