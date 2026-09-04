import type { Club, ForcaFinanceira } from "../schemas/club.js";

/**
 * Rating de força esportiva — ver docs/motor-de-partida.md seção 1.
 * Escala tipo Elo (~1000-2000). `rating_inicial` real (semeado por fonte
 * histórica) ainda não foi populado pra nenhum clube — enquanto isso,
 * `obterRating` usa o fallback calculado abaixo.
 */

const RATING_BASE_NIVEL_1 = 1700;
const QUEDA_POR_NIVEL = 150;
/** Clube sem `divisao_nacional` só disputa estadual — tratado como um nível "5" pra fins de fallback. */
const NIVEL_PADRAO_SEM_COMPETICAO_NACIONAL = 5;

const BONUS_FORCA_FINANCEIRA: Record<ForcaFinanceira, number> = {
  muito_alta: 100,
  alta: 50,
  media: 0,
  baixa: -50,
  muito_baixa: -100,
};

/**
 * Fallback calibrado pra clubes sem `rating_inicial` real: parte de um
 * rating base por nível de divisão (queda de `QUEDA_POR_NIVEL` por nível
 * abaixo do topo) e ajusta por `forca_financeira` como desempate. Não
 * substitui um rating histórico de verdade — é só pra não deixar clube sem
 * competição nacional/força financeira conhecida sem número nenhum.
 */
export function calcularRatingFallback(club: Club): number {
  const nivel = club.divisao_nacional?.nivel ?? NIVEL_PADRAO_SEM_COMPETICAO_NACIONAL;
  const base = RATING_BASE_NIVEL_1 - (nivel - 1) * QUEDA_POR_NIVEL;
  const bonusFinanceiro = club.forca_financeira ? BONUS_FORCA_FINANCEIRA[club.forca_financeira] : 0;
  return base + bonusFinanceiro;
}

export function obterRating(club: Club): number {
  return club.rating_inicial ?? calcularRatingFallback(club);
}

/** Probabilidade de A vencer B, fórmula logística padrão de Elo. */
export function calcularResultadoEsperado(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export type ResultadoPartidaElo = "casa" | "empate" | "fora";

export interface RatingsAtualizados {
  ratingCasa: number;
  ratingFora: number;
}

/**
 * Atualiza os dois ratings depois de uma partida real (simulada). `k` sobe
 * o peso do resultado — usar valor maior em final/clássico, menor em fase
 * de grupos (ver docs/motor-de-partida.md seção 1).
 */
export function atualizarElo(
  ratingCasa: number,
  ratingFora: number,
  resultado: ResultadoPartidaElo,
  k = 20,
): RatingsAtualizados {
  const esperadoCasa = calcularResultadoEsperado(ratingCasa, ratingFora);
  const realCasa = resultado === "casa" ? 1 : resultado === "empate" ? 0.5 : 0;
  const delta = k * (realCasa - esperadoCasa);

  return {
    ratingCasa: ratingCasa + delta,
    ratingFora: ratingFora - delta,
  };
}
