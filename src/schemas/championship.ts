export interface FaseGrupos {
  num_grupos: number;
  times_por_grupo: number;
  ida_e_volta: boolean;
  classificam_por_grupo: number;
}

/** Fase de grupo único (ex: Taça Guanabara/Taça Rio do Carioca). */
export interface FaseUnica {
  nome?: string;
  ida_e_volta: boolean;
  classificam_proxima_fase: number;
  rodadas?: number;
}

export interface TabelaAcumulada {
  criterio: string;
}

export interface FaseQuadrangular {
  ativa: boolean;
  num_grupos: number;
  times_por_grupo: number;
  classificam_por_grupo: number;
}

export interface MataMata {
  fases: string[]; // ex: ["quartas", "semifinal", "final"]
  ida_e_volta: boolean;
}

/** Final de estaduais com duas fases prévias (ex: Carioca: turno x returno). */
export interface FinalEstadual {
  criterio: string; // ex: "campeoes_turno_returno_ou_melhor_campanha"
  ida_e_volta: boolean;
}

/**
 * Fase "suíça" por potes, adotada pelo Paulistão A1 a partir de 2026:
 * turno único, cada time joga um subconjunto dos outros times (não todos-contra-todos).
 */
export interface FaseSuica {
  num_potes: number;
  times_por_pote: number;
  jogos_por_time: number;
  classificam_mata_mata: number;
}

/** Liga de pontos corridos sem fase de mata-mata (Brasileirão Séries A e B). */
export interface PontosCorridos {
  ida_e_volta: boolean;
  rodadas: number;
}

/**
 * Duas chaves regionais independentes que só se cruzam na final (ex: Copa
 * Verde = Copa Norte + Copa Centro-Oeste, cada uma rodando sua própria
 * fase_suica; os dois campeões de chave decidem o título).
 */
export interface DuplaChaveRegional {
  nome_chave_a: string;
  nome_chave_b: string;
  fase_suica: FaseSuica;
}

/**
 * Blocos de formato opcionais — cada estado ativa só os que usa de verdade,
 * conforme doc seção 2.2.
 */
export interface FormatoEstadual {
  turno?: FaseUnica;
  returno?: FaseUnica;
  fase_grupos?: FaseGrupos;
  fase_quadrangular?: FaseQuadrangular;
  fase_suica?: FaseSuica;
  pontos_corridos?: PontosCorridos;
  tabela_acumulada?: TabelaAcumulada;
  dupla_chave_regional?: DuplaChaveRegional;
  mata_mata?: MataMata;
  final_estadual?: FinalEstadual;
}

export interface Premiacao {
  vaga_copa_do_brasil?: number;
  /** Como as vagas de vaga_copa_do_brasil são distribuídas (texto livre, ex: "campeão e vice da 1ª divisão"). */
  vaga_copa_do_brasil_criterio?: string;
  vaga_libertadores?: number;
  /** Como as vagas de Libertadores são distribuídas (texto livre; critério varia muito por país/ano). */
  vaga_libertadores_criterio?: string;
  vaga_sulamericana?: number;
  /** Como as vagas de Sul-Americana são distribuídas (texto livre). */
  vaga_sulamericana_criterio?: string;
  /** Vagas na Série D nacional concedidas via resultado do estadual (critério varia por federação). */
  vaga_serie_d?: number;
  /** Como as vagas de vaga_serie_d são distribuídas (texto livre; regra padrão quando não pesquisado: melhor(es) colocado(s) sem competição nacional). */
  vaga_serie_d_criterio?: string;
  acesso_proxima_divisao?: number;
  rebaixamento_proxima_divisao?: number;
}

export interface Classico {
  time_a: string; // Club.id
  time_b: string; // Club.id
  nome: string;
  peso_midia: number; // 1-5
}

export interface CampeonatoEstadual {
  id: string;
  nome: string;
  estado: string;
  nivel: number;
  ano_referencia: number;
  formato: FormatoEstadual;
  premiacao: Premiacao;
  classicos: Classico[];
  times: string[]; // Club.id[]
}
