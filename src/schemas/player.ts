/**
 * Atributos numéricos (0-99, estilo FIFA) — ver docs/motor-de-partida.md.
 * Sem perks: arquétipo só acelera o crescimento de alguns desses atributos,
 * nunca desbloqueia efeito especial.
 */
export type Atributo =
  | "velocidade"
  | "forca_fisica"
  | "resistencia"
  | "finalizacao"
  | "drible"
  | "cruzamento"
  | "passe_curto"
  | "passe_longo"
  | "cabeceio"
  | "desarme"
  | "interceptacao"
  | "marcacao"
  | "visao_de_jogo"
  | "frieza"
  | "posicionamento_ofensivo"
  | "posicionamento_defensivo"
  | "protecao_de_bola"
  | "movimentacao"
  | "lideranca"
  | "jogo_aereo"
  | "reflexos"
  | "posicionamento_goleiro"
  | "saida_de_gol"
  | "distribuicao";

export type Posicao = "goleiro" | "zagueiro" | "lateral" | "volante" | "meia" | "atacante";

/** Cada valor é 0-99. Só os atributos relevantes pra posição do jogador precisam estar presentes. */
export type Atributos = Partial<Record<Atributo, number>>;

/** Quais atributos importam pra cada posição — usado por `calcularOverall` e pela geração de chance em `simulation/match.ts`. */
export const ATRIBUTOS_POR_POSICAO: Record<Posicao, Atributo[]> = {
  goleiro: ["reflexos", "posicionamento_goleiro", "saida_de_gol", "distribuicao", "jogo_aereo", "forca_fisica"],
  zagueiro: ["desarme", "interceptacao", "marcacao", "cabeceio", "forca_fisica", "posicionamento_defensivo", "passe_curto"],
  lateral: ["velocidade", "resistencia", "cruzamento", "desarme", "marcacao", "posicionamento_defensivo", "passe_curto"],
  volante: ["desarme", "interceptacao", "passe_curto", "passe_longo", "posicionamento_defensivo", "resistencia", "visao_de_jogo"],
  meia: ["visao_de_jogo", "passe_curto", "passe_longo", "drible", "finalizacao", "movimentacao", "resistencia", "desarme"],
  atacante: ["finalizacao", "posicionamento_ofensivo", "frieza", "drible", "velocidade", "cabeceio", "jogo_aereo", "forca_fisica", "protecao_de_bola", "movimentacao", "cruzamento", "visao_de_jogo", "passe_curto"],
};

export interface Arquetipo {
  id: string;
  nome: string;
  posicao: Posicao;
  /** Atributos que crescem mais rápido pra esse arquétipo (ver `progression/xp.ts`). Nunca concede efeito especial. */
  atributos_prioritarios: Atributo[];
}

/**
 * Catálogo inicial de arquétipos — 2-3 por posição. Não é definitivo (ver
 * pendência "arquétipos das posições restantes" em docs/motor-de-partida.md),
 * mas dá cobertura pras 6 posições pra destravar a implementação do motor.
 */
export const ARQUETIPOS: Arquetipo[] = [
  { id: "muralha", nome: "Muralha", posicao: "goleiro", atributos_prioritarios: ["reflexos", "posicionamento_goleiro"] },
  { id: "goleiro_linha", nome: "Goleiro-Linha", posicao: "goleiro", atributos_prioritarios: ["distribuicao", "saida_de_gol"] },

  { id: "xerife_da_area", nome: "Xerife da Área", posicao: "zagueiro", atributos_prioritarios: ["desarme", "cabeceio", "forca_fisica"] },
  { id: "zagueiro_construtor", nome: "Zagueiro Construtor", posicao: "zagueiro", atributos_prioritarios: ["passe_curto", "interceptacao"] },

  { id: "ala_ofensivo", nome: "Ala Ofensivo", posicao: "lateral", atributos_prioritarios: ["cruzamento", "velocidade"] },
  { id: "lateral_cadeado", nome: "Lateral Cadeado", posicao: "lateral", atributos_prioritarios: ["desarme", "marcacao"] },

  { id: "volante_de_contencao", nome: "Volante de Contenção", posicao: "volante", atributos_prioritarios: ["desarme", "interceptacao"] },
  { id: "camisa_5_organizador", nome: "Camisa 5 Organizador", posicao: "volante", atributos_prioritarios: ["passe_curto", "visao_de_jogo"] },

  { id: "armador", nome: "Armador", posicao: "meia", atributos_prioritarios: ["visao_de_jogo", "passe_curto"] },
  { id: "box_to_box", nome: "Box-to-Box", posicao: "meia", atributos_prioritarios: ["resistencia", "desarme", "finalizacao"] },

  { id: "finalizador", nome: "Finalizador", posicao: "atacante", atributos_prioritarios: ["finalizacao", "posicionamento_ofensivo", "frieza"] },
  { id: "pivo", nome: "Pivô de Área", posicao: "atacante", atributos_prioritarios: ["jogo_aereo", "forca_fisica", "protecao_de_bola"] },
  { id: "ponta_velocista", nome: "Ponta Velocista", posicao: "atacante", atributos_prioritarios: ["velocidade", "drible", "cruzamento"] },
  { id: "falso_9", nome: "Falso 9", posicao: "atacante", atributos_prioritarios: ["visao_de_jogo", "passe_curto", "movimentacao"] },
];

export function buscarArquetipo(id: string): Arquetipo {
  const arquetipo = ARQUETIPOS.find((a) => a.id === id);
  if (!arquetipo) throw new Error(`Arquétipo desconhecido: ${id}`);
  return arquetipo;
}

export interface Jogador {
  id: string;
  nome: string;
  posicao: Posicao;
  arquetipo_id: string;
  idade: number;
  atributos: Atributos;
}

/**
 * Overall derivado (tipo "OVR" do FIFA) — substitui o `nível`/slots de perk
 * do desenho antigo (ver docs/motor-de-partida.md seção 3). Média ponderada
 * dos atributos relevantes da posição; os prioritários do arquétipo pesam
 * o dobro. Atributo ausente conta como o mínimo (1), não zera o cálculo.
 */
export function calcularOverall(jogador: Jogador, arquetipo: Arquetipo): number {
  const relevantes = ATRIBUTOS_POR_POSICAO[jogador.posicao];
  let somaPonderada = 0;
  let somaPesos = 0;

  for (const atributo of relevantes) {
    const valor = jogador.atributos[atributo] ?? 1;
    const peso = arquetipo.atributos_prioritarios.includes(atributo) ? 2 : 1;
    somaPonderada += valor * peso;
    somaPesos += peso;
  }

  return somaPesos === 0 ? 0 : Math.round(somaPonderada / somaPesos);
}
