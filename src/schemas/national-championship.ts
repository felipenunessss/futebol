import type { Classico, FormatoEstadual, Premiacao } from "./championship.js";

/**
 * Competição nacional (Brasileirão Séries A-D, Copa do Brasil) — mesma
 * forma de CampeonatoEstadual, mas sem `estado` (é nacional) e
 * reaproveitando os mesmos blocos de formato/premiação/clássico.
 */
export interface CampeonatoNacional {
  id: string;
  nome: string;
  /** 1 = Série A, 2 = Série B, 3 = Série C, 4 = Série D, 0 = copa de mata-mata fora da hierarquia vertical (Copa do Brasil). */
  nivel: number;
  ano_referencia: number;
  formato: FormatoEstadual;
  premiacao: Premiacao;
  classicos: Classico[];
  times: string[]; // Club.id[]
}
