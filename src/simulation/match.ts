import type { Atributo, Jogador } from "../schemas/player.js";
import { type EstiloTecnico, type SubtipoChance, ATRIBUTO_POR_SUBTIPO, sortearSubtipo } from "./tactics.js";

/**
 * Motor de partida por duelo de zona — ver docs/motor-de-partida.md seção 2.
 * Nenhum clube (fora o do jogador) tem elenco persistido: a força de cada
 * zona é gerada por partida a partir do rating do clube (`simulation/rating.ts`).
 */

export interface PerfilTime {
  defesa: number;
  meio: number;
  ataque: number;
}

/** Desvio (pra mais ou pra menos) aplicado ao rating do clube ao gerar cada zona — é o que permite zebra. */
const VARIANCIA_PERFIL = 80;

/** Gera o perfil de zonas de um time pra uma partida, com variância em torno do rating do clube. */
export function gerarPerfilTime(rating: number, random: () => number = Math.random): PerfilTime {
  const ruido = () => (random() - 0.5) * 2 * VARIANCIA_PERFIL;
  return {
    defesa: rating + ruido(),
    meio: rating + ruido(),
    ataque: rating + ruido(),
  };
}

/** Probabilidade de A vencer um duelo contra B — mesma fórmula logística do Elo, reaproveitada pra qualquer comparação de força. */
export function probabilidadeDeVencer(forcaA: number, forcaB: number): number {
  return 1 / (1 + Math.pow(10, (forcaB - forcaA) / 400));
}

function resolverDuelo(forcaA: number, forcaB: number, random: () => number): "A" | "B" {
  return random() < probabilidadeDeVencer(forcaA, forcaB) ? "A" : "B";
}

const CHANCES_BASE_POR_PARTIDA = 10;
/** Quanto o time que vence o duelo de meio pode esticar a fatia de chances a seu favor (0.3 = até 80%/20% num duelo muito dominante). */
const VANTAGEM_MAXIMA_DE_MEIO = 0.3;

export interface ResultadoPartida {
  golsCasa: number;
  golsFora: number;
  chancesCasa: number;
  chancesFora: number;
}

/**
 * Resolve uma partida agregada (Camada 1 — nenhum dos dois times é o do
 * jogador). O duelo de meio decide quantas chances a partida tem e como
 * elas se distribuem; cada chance individual é ataque vs defesa do
 * adversário, sem detalhamento de subtipo/jogador.
 */
export function simularPartida(perfilCasa: PerfilTime, perfilFora: PerfilTime, random: () => number = Math.random): ResultadoPartida {
  const probabilidadeMeioCasa = probabilidadeDeVencer(perfilCasa.meio, perfilFora.meio);
  const margemMeio = Math.abs(probabilidadeMeioCasa - 0.5) * 2; // 0 (equilibrado) a 1 (duelo dominado)

  const totalChances = Math.max(2, Math.round(CHANCES_BASE_POR_PARTIDA + margemMeio * 4));
  const fatiaCasa = probabilidadeMeioCasa >= 0.5
    ? 0.5 + margemMeio * VANTAGEM_MAXIMA_DE_MEIO
    : 0.5 - margemMeio * VANTAGEM_MAXIMA_DE_MEIO;

  const chancesCasa = Math.round(totalChances * fatiaCasa);
  const chancesFora = totalChances - chancesCasa;

  let golsCasa = 0;
  for (let i = 0; i < chancesCasa; i++) {
    if (resolverDuelo(perfilCasa.ataque, perfilFora.defesa, random) === "A") golsCasa++;
  }

  let golsFora = 0;
  for (let i = 0; i < chancesFora; i++) {
    if (resolverDuelo(perfilFora.ataque, perfilCasa.defesa, random) === "A") golsFora++;
  }

  return { golsCasa, golsFora, chancesCasa, chancesFora };
}

export interface ChanceJogador {
  subtipo: SubtipoChance;
  sucesso: boolean;
  atributoUsado: Atributo;
}

/** Converte um atributo (0-99) numa força comparável à escala de rating dos times (~1000-2000). */
function forcaDoAtributo(valor: number): number {
  return 1000 + valor * 10;
}

/**
 * Resolve uma chance específica do jogador (Camada 2) — sorteia o subtipo
 * (ponderado pelo estilo do técnico) e resolve com o atributo
 * correspondente contra a força defensiva do adversário naquele momento.
 *
 * Ainda não é chamada por `simularPartida`: falta decidir, dentro do total
 * de chances de um time, quantas são "do jogador" vs. de um companheiro
 * anônimo (ver docs/motor-de-partida.md seção 2) — próximo incremento.
 */
export function resolverChanceJogador(
  jogador: Jogador,
  estiloTecnico: EstiloTecnico,
  forcaDefensivaAdversario: number,
  random: () => number = Math.random,
): ChanceJogador {
  const subtipo = sortearSubtipo(estiloTecnico, random);
  const atributo = ATRIBUTO_POR_SUBTIPO[subtipo];
  const valorAtributo = jogador.atributos[atributo] ?? 1;
  const forcaJogador = forcaDoAtributo(valorAtributo);
  const sucesso = resolverDuelo(forcaJogador, forcaDefensivaAdversario, random) === "A";

  return { subtipo, sucesso, atributoUsado: atributo };
}
