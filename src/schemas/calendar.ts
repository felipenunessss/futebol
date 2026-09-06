export interface PeriodoCalendario {
  periodo: string;
  competicoes_ativas: string[];
  /**
   * Faixa de semanas do ano (1-52, inclusive) que esse período cobre —
   * estimativa de design (o jogo não tem datas de partida reais pra
   * nenhuma competição, ver `data/loaders/calendario.ts`), usada só pra
   * distribuir rodadas/etapas ao longo do tempo no loop semanal de
   * carreira (`career/career-loop.ts` `jogarTemporadaSemanal`).
   */
  semanaInicio: number;
  semanaFim: number;
}

export interface CalendarioMestre {
  temporada: number;
  calendario: PeriodoCalendario[];
}
