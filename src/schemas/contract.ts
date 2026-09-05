/**
 * Contrato de trabalho do jogador com o clube atual — ver
 * `docs/motor-de-partida.md` seção sobre mercado/negociação. Valores
 * monetários em reais fictícios, mesma escala usada em
 * `career/patrocinios.ts` e no exemplo original de `docs/game-design.md`
 * seção 4 (salário mensal na casa das dezenas/centenas de milhares, luvas
 * em centenas de milhares, cláusula em milhões).
 */
export interface Contrato {
  clubeId: string;
  salarioMensal: number;
  luvas: number;
  clausulaRescisao: number;
  anos: number;
  /** Temporada em que o contrato foi assinado — soma `anos` pra saber quando vence. */
  temporadaAssinatura: number;
}

/** Temporada em que o contrato vence (o clube pode tentar renovar antes disso — sistema de renovação ainda não existe, ver pendências). */
export function temporadaDeVencimento(contrato: Contrato): number {
  return contrato.temporadaAssinatura + contrato.anos;
}
