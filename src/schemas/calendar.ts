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
  /**
   * Se `false`, este período NÃO dispara uma sessão de treino/cenário na
   * carreira (`career/career-loop.ts` `jogarTemporada`/`jogarTemporadaSemanal`,
   * que resolvem 1 treino+cenário por período do calendário) — só serve
   * pra dar uma janela de semanas pra competições ativas nele
   * (`data/loaders/calendario.ts` `janelaDeSemanasPorCompeticao`). Ausente
   * (ou `true`) = dispara normalmente, mesmo comportamento de antes desse
   * campo existir. Existe pra permitir adicionar competições novas ao
   * calendário (ex: ligas de outros países) sem mudar quantas sessões de
   * treino uma temporada tem.
   */
  pontoDeTreino?: boolean;
}

export interface CalendarioMestre {
  temporada: number;
  calendario: PeriodoCalendario[];
}
