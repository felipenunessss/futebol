export type DivisaoNacional = "serie_a" | "serie_b" | "serie_c" | "serie_d";

/**
 * Tier relativo de força financeira do clube. Usado pela camada de mercado
 * (Fase 4) para derivar teto salarial e orçamento — os valores monetários
 * em si ainda não são modelados aqui.
 */
export type ForcaFinanceira = "muito_alta" | "alta" | "media" | "baixa" | "muito_baixa";

export interface Club {
  id: string;
  nome: string;
  nome_popular?: string;
  pais: string; // ISO 3166-1 alpha-2, ex: "BR"
  estado?: string; // UF, para clubes brasileiros
  cidade: string;
  fundacao?: number;
  estadio?: string;
  divisao_nacional?: DivisaoNacional;
  /** Ausente quando o clube não tem dados financeiros conhecidos ainda (comum em clubes menores). */
  forca_financeira?: ForcaFinanceira;
}
