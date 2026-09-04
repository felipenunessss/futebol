export interface PeriodoCalendario {
  periodo: string;
  competicoes_ativas: string[];
}

export interface CalendarioMestre {
  temporada: number;
  calendario: PeriodoCalendario[];
}
