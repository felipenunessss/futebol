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
  /**
   * Rating de força esportiva numa escala tipo Elo (ex: 1000-2000), semeado
   * a partir de desempenho histórico real — ver docs/motor-de-partida.md
   * seção 1. Ausente pra quase todo clube ainda (dado não populado); nesse
   * caso `simulation/rating.ts` calcula um fallback a partir de
   * `divisao_nacional`/`forca_financeira`. Depois de semeado, evolui
   * sozinho pelos resultados simulados (não é um valor estático).
   */
  rating_inicial?: number;
  /**
   * URL externa do escudo do clube (populado via `scripts/buscar-escudos.ts`,
   * fonte TheSportsDB) — puramente visual, não afeta nenhuma mecânica do
   * motor. Ausente quando não foi encontrado um escudo confiável pra esse
   * clube (ver `docs/dados-a-verificar.md`); a UI web precisa tratar esse
   * caso (sem imagem/fallback), nunca assumir que está presente.
   */
  escudo_url?: string;
  /**
   * Cores do clube em hex (ex: "#CC001A"), mesma fonte/script que
   * `escudo_url` — `cor_primaria` é a 1ª cor reportada pelo TheSportsDB,
   * `cor_secundaria` a 2ª (quando existe). Puramente visual (ex: fundo da
   * tela ao assinar contrato); como não há garantia de contraste nem de
   * qual das duas é "a cor de fundo" vs "a cor de detalhe" pro clube real,
   * quem for usar isso pra fundo de tela precisa calcular o contraste do
   * texto em runtime (luminância), nunca assumir texto claro ou escuro.
   */
  cor_primaria?: string;
  cor_secundaria?: string;
}
