import type { Classico, FormatoEstadual, Premiacao } from "./championship.js";

/**
 * Competição nacional (Brasileirão Séries A, B, C, D) — mesma forma de
 * CampeonatoEstadual, mas sem `estado` (é nacional) e reaproveitando os
 * mesmos blocos de formato/premiação/clássico.
 */
export interface CampeonatoNacional {
  id: string;
  nome: string;
  nivel: number; // 1 = Série A, 2 = Série B, 3 = Série C, 4 = Série D
  ano_referencia: number;
  formato: FormatoEstadual;
  premiacao: Premiacao;
  classicos: Classico[];
  times: string[]; // Club.id[]
}
