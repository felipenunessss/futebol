import type { Atributo, Atributos } from "../schemas/player.js";

/**
 * Curva de pico/declínio por idade — ver docs/motor-de-partida.md seção 3
 * ("jovem cresce mais rápido no físico, veterano estabiliza/decai").
 * Aplicada uma vez por temporada (`career/Player.ts`, `avancarTemporada`),
 * como efeito passivo separado do XP ganho em partida/treino
 * (`progression/xp.ts`) — antes do pico não muda nada aqui (o crescimento
 * de jovem já vem do multiplicador de XP do arquétipo); depois do pico,
 * perde pontos a cada temporada.
 *
 * Constantes (idade de pico, taxa de declínio) são estimativas de design,
 * não uma fórmula validada — ficam pra calibrar quando o jogo puder ser
 * testado de verdade (mesma pendência já registrada pras outras fórmulas
 * do motor).
 */

export type CategoriaEtaria = "fisico" | "mental" | "sem_declinio";

/**
 * Físico (velocidade, força, resistência, salto/reflexo) declina cedo e
 * rápido. Mental/técnico declina tarde e devagar. Liderança nunca declina
 * — veterano só ganha experiência, não perde.
 */
export const CATEGORIA_POR_ATRIBUTO: Record<Atributo, CategoriaEtaria> = {
  velocidade: "fisico",
  forca_fisica: "fisico",
  resistencia: "fisico",
  jogo_aereo: "fisico",
  reflexos: "fisico",
  finalizacao: "mental",
  drible: "mental",
  cruzamento: "mental",
  passe_curto: "mental",
  passe_longo: "mental",
  cabeceio: "mental",
  desarme: "mental",
  interceptacao: "mental",
  marcacao: "mental",
  visao_de_jogo: "mental",
  frieza: "mental",
  posicionamento_ofensivo: "mental",
  posicionamento_defensivo: "mental",
  protecao_de_bola: "mental",
  movimentacao: "mental",
  posicionamento_goleiro: "mental",
  saida_de_gol: "mental",
  distribuicao: "mental",
  lideranca: "sem_declinio",
};

const IDADE_PICO: Record<CategoriaEtaria, number> = {
  fisico: 26,
  mental: 30,
  sem_declinio: Infinity,
};

const DECLINIO_POR_TEMPORADA_APOS_PICO: Record<CategoriaEtaria, number> = {
  fisico: 2,
  mental: 0.8,
  sem_declinio: 0,
};

/**
 * Aplica o declínio de UMA temporada aos atributos, dada a idade já
 * incrementada (`novaIdade`). Atributo cuja categoria ainda não passou da
 * idade de pico não muda. Não muta `atributos`; devolve uma cópia.
 */
export function aplicarDeclinioPorIdade(atributos: Atributos, novaIdade: number): Atributos {
  const atualizados: Atributos = { ...atributos };

  for (const [atributo, valor] of Object.entries(atualizados) as [Atributo, number][]) {
    const categoria = CATEGORIA_POR_ATRIBUTO[atributo];
    if (novaIdade > IDADE_PICO[categoria]) {
      atualizados[atributo] = Math.max(1, valor - DECLINIO_POR_TEMPORADA_APOS_PICO[categoria]);
    }
  }

  return atualizados;
}
