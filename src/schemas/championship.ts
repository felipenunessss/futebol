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
 * Blocos de formato opcionais — cada estado ativa só os que usa de verdade,
 * conforme doc seção 2.2.
 */
export interface FormatoEstadual {
  turno?: FaseUnica;
  returno?: FaseUnica;
  fase_grupos?: FaseGrupos;
  fase_quadrangular?: FaseQuadrangular;
  mata_mata?: MataMata;
  final_estadual?: FinalEstadual;
}

export interface Premiacao {
  vaga_copa_do_brasil?: number;
  vaga_libertadores?: number;
  vaga_sulamericana?: number;
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
