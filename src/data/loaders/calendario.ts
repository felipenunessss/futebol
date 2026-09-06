import type { CalendarioMestre, PeriodoCalendario } from "../../schemas/calendar.js";

/**
 * Faixas de semana (1-52) de cada período — estimativa de design (o jogo
 * não tem datas de partida reais pra nenhuma competição): jan-1a_quinz
 * cobre as 2 primeiras semanas do ano, fev/mar/abr dividem o resto do 1º
 * quadrimestre, mai-nov ocupa o resto até a semana 48 (49-52 ficam de
 * entressafra, sem competição ativa). Usada só pelo motor incremental
 * (`simulation/incremental.ts`) pra saber a janela de semanas de cada
 * competição — não muda nada do motor "em lote" existente.
 */
const PERIODOS_PADRAO: PeriodoCalendario[] = [
  {
    periodo: "jan-1a_quinz",
    competicoes_ativas: ["paulistao_a1", "carioca_a", "mineiro_modulo_1", "gauchao_a", "brasileirao_serie_a", "brasileirao_serie_b"],
    semanaInicio: 1,
    semanaFim: 2,
  },
  {
    periodo: "fev",
    competicoes_ativas: ["paulistao_a1", "carioca_a", "mineiro_modulo_1", "gauchao_a", "copa_do_brasil", "brasileirao_serie_a", "brasileirao_serie_b"],
    semanaInicio: 3,
    semanaFim: 8,
  },
  {
    periodo: "mar",
    competicoes_ativas: ["paulistao_a1", "carioca_a", "mineiro_modulo_1", "gauchao_a", "copa_do_brasil", "libertadores", "sulamericana"],
    semanaInicio: 9,
    semanaFim: 13,
  },
  {
    periodo: "abr",
    competicoes_ativas: ["paulistao_a1", "carioca_a", "mineiro_modulo_1", "gauchao_a", "copa_do_brasil", "libertadores", "sulamericana"],
    semanaInicio: 14,
    semanaFim: 17,
  },
  {
    periodo: "mai-nov",
    competicoes_ativas: ["brasileirao_serie_a", "brasileirao_serie_b", "brasileirao_serie_c", "brasileirao_serie_d", "copa_do_brasil", "libertadores", "sulamericana"],
    semanaInicio: 18,
    semanaFim: 48,
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

export interface JanelaDeSemanas {
  semanaInicio: number;
  semanaFim: number;
}

/**
 * União das faixas de semana de todo período em que `campeonatoId` aparece
 * em `competicoes_ativas` — a janela de tempo que `simulation/incremental.ts`
 * usa pra espalhar as rodadas/etapas dessa competição ao longo da
 * temporada. `undefined` se a competição não estiver ativa em nenhum
 * período (não deveria acontecer pra quem já filtrou por `idsAtivos`).
 */
export function janelaDeSemanasPorCompeticao(campeonatoId: string, calendario: CalendarioMestre): JanelaDeSemanas | undefined {
  const periodosAtivos = calendario.calendario.filter((p) => p.competicoes_ativas.includes(campeonatoId));
  if (periodosAtivos.length === 0) return undefined;

  return {
    semanaInicio: Math.min(...periodosAtivos.map((p) => p.semanaInicio)),
    semanaFim: Math.max(...periodosAtivos.map((p) => p.semanaFim)),
  };
}
