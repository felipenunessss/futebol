/** Em qual liga nacional (de qual país) e em que nível dela um clube joga. Nível é relativo ao país (1 = elite, 2 = segunda divisão, ...). */
export interface DivisaoNacional {
  pais: string; // ISO 3166-1 alpha-2, ex: "BR", "AR", "CL"
  nivel: number;
}

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
  estadio?: string;
  divisao_nacional?: DivisaoNacional;
  /** Ausente quando o clube não tem dados financeiros conhecidos ainda (comum em clubes menores). */
  forca_financeira?: ForcaFinanceira;
}
