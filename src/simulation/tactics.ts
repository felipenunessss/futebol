import type { Atributo } from "../schemas/player.js";

/** Estilo do técnico — pondera que tipo de chance aparece mais pro jogador. Ver docs/motor-de-partida.md seção 2. */
export type EstiloTecnico = "posse" | "contra_ataque" | "jogo_aereo" | "pressao_alta" | "equilibrado";

/** Subtipo de uma chance individual do jogador — decide qual atributo resolve o lance. */
export type SubtipoChance = "voleio" | "cabeceio" | "chute_de_fora" | "jogada_individual" | "passe_decisivo" | "desarme_decisivo";

/** Qual atributo resolve cada subtipo de chance. */
export const ATRIBUTO_POR_SUBTIPO: Record<SubtipoChance, Atributo> = {
  voleio: "finalizacao",
  cabeceio: "cabeceio",
  chute_de_fora: "finalizacao",
  jogada_individual: "drible",
  passe_decisivo: "visao_de_jogo",
  desarme_decisivo: "desarme",
};

const PESO_PADRAO = 1;

const TODOS_SUBTIPOS: SubtipoChance[] = ["voleio", "cabeceio", "chute_de_fora", "jogada_individual", "passe_decisivo", "desarme_decisivo"];

/** Multiplicadores de peso por estilo — só lista os subtipos que o estilo favorece; o resto fica no peso padrão. */
const MODIFICADORES_POR_ESTILO: Record<EstiloTecnico, Partial<Record<SubtipoChance, number>>> = {
  posse: { jogada_individual: 1.5, passe_decisivo: 1.5 },
  contra_ataque: { chute_de_fora: 1.3, jogada_individual: 1.3 },
  jogo_aereo: { cabeceio: 2, voleio: 1.3 },
  pressao_alta: { desarme_decisivo: 1.8 },
  equilibrado: {},
};

export function pesosDeSubtipo(estilo: EstiloTecnico): Record<SubtipoChance, number> {
  const modificadores = MODIFICADORES_POR_ESTILO[estilo];
  const pesos = {} as Record<SubtipoChance, number>;

  for (const subtipo of TODOS_SUBTIPOS) {
    pesos[subtipo] = PESO_PADRAO * (modificadores[subtipo] ?? 1);
  }

  return pesos;
}

/** Sorteia o subtipo de uma chance do jogador, ponderado pelo estilo do técnico. */
export function sortearSubtipo(estilo: EstiloTecnico, random: () => number = Math.random): SubtipoChance {
  const pesos = pesosDeSubtipo(estilo);
  const total = TODOS_SUBTIPOS.reduce((soma, subtipo) => soma + pesos[subtipo], 0);
  let alvo = random() * total;

  for (const subtipo of TODOS_SUBTIPOS) {
    if (alvo < pesos[subtipo]) return subtipo;
    alvo -= pesos[subtipo];
  }

  return TODOS_SUBTIPOS[TODOS_SUBTIPOS.length - 1];
}
