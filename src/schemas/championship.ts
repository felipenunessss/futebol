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

/**
 * Uma fase de um mata-mata com entrada escalonada (ex: Copa do Brasil,
 * Libertadores, Sul-Americana): times que já vinham vencendo fases
 * anteriores se juntam a times que só entram fresh nesta fase específica.
 */
export interface EtapaMataMata {
  nome: string; // ex: "primeira_fase", "oitavas", "final"
  ida_e_volta: boolean;
  /**
   * Club.id[] dos times que entram nesta fase sem ter jogado nenhuma
   * anterior (bye direto até aqui). Times que não aparecem em `entrantes`
   * de nenhuma etapa entram todos já na primeira etapa da lista (mesmo
   * comportamento do `mata_mata` simples, sem entrada escalonada).
   */
  entrantes?: string[];
}

export interface MataMata {
  fases: string[]; // ex: ["quartas", "semifinal", "final"]
  ida_e_volta: boolean;
  /**
   * Representação detalhada opcional de um mata-mata com entrada
   * escalonada por fase e/ou jogo único vs. ida-e-volta variável por fase
   * (ex: Copa do Brasil e as copas continentais têm 1ª-4ª fase eliminatória
   * em jogo único, fases seguintes em ida e volta, final em jogo único de
   * novo). Quando presente, é a fonte de verdade mais precisa; `fases` e
   * `ida_e_volta` continuam preenchidos como resumo rápido e por
   * compatibilidade com competições que só usam o formato simples.
   */
  etapas?: EtapaMataMata[];
}

/** Final de estaduais com duas fases prévias (ex: Carioca: turno x returno). */
export interface FinalEstadual {
  criterio: string; // ex: "campeoes_turno_returno_ou_melhor_campanha"
  ida_e_volta: boolean;
}

/**
 * Regra de classificação por grupo pra fase suíça, quando a vaga no mata-mata depende da posição
 * DENTRO do próprio pote (não só do lugar na tabela geral) — ex: Paulistão A1 real (2025) classifica
 * os 2 melhores de CADA um dos 4 grupos (`vagas_por_pote: 2, vagas_extras_melhor_geral: 0`); Mineiro/
 * Gauchão reais classificam o líder de cada um dos 3 grupos + o melhor 2º colocado entre todos
 * (`vagas_por_pote: 1, vagas_extras_melhor_geral: 1`). Quando ausente, `classificam_mata_mata` da
 * `FaseSuica` continua sendo aplicado como top-N simples da tabela geral (ex: Paraense real).
 */
export interface ClassificacaoPorPoteFaseSuica {
  vagas_por_pote: number;
  vagas_extras_melhor_geral: number;
}

/**
 * Fase "suíça" por potes (Paulistão A1, Mineiro, Gauchão, Paraense): turno único, cada time joga só
 * contra times de OUTROS potes (nunca dentro do próprio) — ver `docs/dados-a-verificar.md` sobre a
 * confirmação por fonte de cada competição.
 */
export interface FaseSuica {
  num_potes: number;
  times_por_pote: number;
  jogos_por_time: number;
  classificam_mata_mata: number;
  classificacao_por_pote?: ClassificacaoPorPoteFaseSuica;
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
 * Fase final formada por CLASSIFICAÇÃO (não sorteio nem grupos fixos) —
 * depois de uma fase anterior (normalmente `pontos_corridos`), os times
 * são divididos em grupos de tamanhos possivelmente diferentes, cada um
 * com um propósito diferente (título, vaga internacional, rebaixamento),
 * na ordem da tabela final dessa fase anterior. Ex: Equador 1ª divisão
 * (hexagonal do título 1º-6º, quadrangular internacional 7º-10º,
 * hexagonal de rebaixamento 11º-16º) e 2ª divisão (hexagonal de acesso
 * 1º-6º, hexagonal de descenso 7º-12º) — ver docs/dados-a-verificar.md.
 */
export interface FaseFinalPorClassificacao {
  /** Em ordem, do grupo que reúne os melhores colocados da fase anterior ao que reúne os piores — a soma dos `tamanho` deve fechar com o total de times da competição. */
  grupos: { nome: string; tamanho: number }[];
  ida_e_volta: boolean;
  /** Se `true`, os pontos da fase anterior são mantidos (somados), não zerados, ao entrar nesta fase. */
  pontos_carregados: boolean;
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
  fase_final_por_classificacao?: FaseFinalPorClassificacao;
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
  /** URL externa do escudo/emblema da competição (ver `Club.escudo_url` — mesma fonte/convenção, mesma ausência esperada pra maioria). */
  escudo_url?: string;
  /** URL externa da imagem da TAÇA/troféu da competição (distinta do escudo/emblema) — ver `CampeonatoNacional.taca_url`, mesma convenção. Praticamente nenhum estadual tem (fonte pública cobre só ligas de destaque nacional/continental) — a UI cai pra um ícone genérico de taça. */
  taca_url?: string;
}
