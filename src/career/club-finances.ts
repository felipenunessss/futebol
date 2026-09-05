import type { Club, ForcaFinanceira } from "../schemas/club.js";

/**
 * Situação financeira do clube atual do jogador — usada só pra decidir se
 * o clube precisa vender jogador pra fazer caixa (ver
 * `progression/scenarios.ts` `venda_forcada_por_necessidade_financeira`,
 * `career/career-loop.ts`). **Não é uma simulação de fluxo de caixa de
 * verdade** (isso seria uma peça bem maior de Fase 4, orçamento/despesas
 * do clube) — é só uma probabilidade por temporada, calibrada por
 * `forca_financeira`: clube mais pobre, mais chance de precisar vender.
 * Estimativa de design, não fórmula validada — mesma ressalva de
 * `market/valuation.ts`.
 */
const PROBABILIDADE_NECESSIDADE_DE_VENDA_POR_FORCA: Record<ForcaFinanceira, number> = {
  muito_alta: 0.02,
  alta: 0.05,
  media: 0.12,
  baixa: 0.25,
  muito_baixa: 0.4,
};

/** Clube sem `forca_financeira` conhecida — nem muito seguro nem muito precisado, fica no meio da tabela. */
const PROBABILIDADE_PADRAO_SEM_DADO_FINANCEIRO = 0.15;

/** Sorteia se o clube precisa vender o jogador pra equilibrar as contas nesta janela — probabilístico, não determinístico (mesma filosofia de risco/retorno do resto do jogo). */
export function precisaVender(club: Club, random: () => number = Math.random): boolean {
  const probabilidade = club.forca_financeira ? PROBABILIDADE_NECESSIDADE_DE_VENDA_POR_FORCA[club.forca_financeira] : PROBABILIDADE_PADRAO_SEM_DADO_FINANCEIRO;

  return random() < probabilidade;
}
