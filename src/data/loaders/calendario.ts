import type { CalendarioMestre, PeriodoCalendario } from "../../schemas/calendar.js";

const PERIODOS_PADRAO: PeriodoCalendario[] = [
  {
    periodo: "jan-1a_quinz",
    competicoes_ativas: ["paulistao_a1", "carioca_a", "mineiro_modulo_1", "gauchao_a", "brasileirao_serie_a", "brasileirao_serie_b"],
  },
  {
    periodo: "fev",
    competicoes_ativas: ["paulistao_a1", "carioca_a", "mineiro_modulo_1", "gauchao_a", "copa_do_brasil", "brasileirao_serie_a", "brasileirao_serie_b"],
  },
  {
    periodo: "mar",
    competicoes_ativas: ["paulistao_a1", "carioca_a", "mineiro_modulo_1", "gauchao_a", "copa_do_brasil", "libertadores", "sulamericana"],
  },
  {
    periodo: "abr",
    competicoes_ativas: ["paulistao_a1", "carioca_a", "mineiro_modulo_1", "gauchao_a", "copa_do_brasil", "libertadores", "sulamericana"],
  },
  {
    periodo: "mai-nov",
    competicoes_ativas: ["brasileirao_serie_a", "brasileirao_serie_b", "brasileirao_serie_c", "brasileirao_serie_d", "copa_do_brasil", "libertadores", "sulamericana"],
  },
];

export function construirCalendarioPadrao(temporada: number): CalendarioMestre {
  return {
    temporada,
    calendario: PERIODOS_PADRAO.map((periodo) => ({
      ...periodo,
      competicoes_ativas: [...periodo.competicoes_ativas],
    })),
  };
}

export function loadCalendarioPadrao(temporada: number): CalendarioMestre {
  return construirCalendarioPadrao(temporada);
}
