import type { EtapaMataMata, MataMata } from "../schemas/championship.js";
import { gerarPerfilTime, probabilidadeDeVencer, simularPartida } from "./match.js";

/**
 * Gerador/simulador de mata-mata (`formato.mata_mata`, ver
 * `schemas/championship.ts`) — cobre tanto o formato simples (`fases` +
 * `ida_e_volta` únicos, todo mundo entra na 1ª fase) quanto o formato com
 * entrada escalonada (`etapas`, usado por Copa do Brasil/Libertadores/
 * Sul-Americana). Camada 1 só (agregado) — nenhum dos confrontos é o
 * clube do jogador; ligar `ParticipacaoJogador` num mata-mata fica pra
 * um próximo incremento.
 *
 * Sem dado de sorteio real: os confrontos de cada etapa são emparelhados
 * por força (mais forte x mais fraco, 2º mais forte x 2º mais fraco, ...)
 * — mesmo tipo de aproximação já usado no sorteio de grupos (`groups.ts`).
 */

export interface ResultadoConfrontoMataMata {
  timeA: string;
  timeB: string;
  /** Placar agregado — soma dos 2 jogos se `ida_e_volta`, senão o placar do jogo único. */
  golsA: number;
  golsB: number;
  vencedor: string;
  /** true quando o agregado empatou e o vencedor saiu de pênaltis (aproximação: sorteio ponderado pelo rating geral, sem zona). */
  decididoNosPenaltis: boolean;
}

export interface ResultadoEtapaMataMata {
  nome: string;
  confrontos: ResultadoConfrontoMataMata[];
  vencedores: string[];
}

export interface ResultadoMataMata {
  etapas: ResultadoEtapaMataMata[];
  campeao: string;
}

function emparelharPorForca(participantes: string[], ratings: Record<string, number>): [string, string][] {
  if (participantes.length % 2 !== 0) {
    throw new Error(`emparelharPorForca: número ímpar de participantes (${participantes.length})`);
  }

  const ordenados = [...participantes].sort((a, b) => (ratings[b] ?? 0) - (ratings[a] ?? 0));
  const pares: [string, string][] = [];
  const metade = ordenados.length / 2;

  for (let i = 0; i < metade; i++) {
    pares.push([ordenados[i], ordenados[ordenados.length - 1 - i]]);
  }

  return pares;
}

function resolverConfronto(
  timeA: string,
  timeB: string,
  ratings: Record<string, number>,
  idaEVolta: boolean,
  random: () => number,
): ResultadoConfrontoMataMata {
  const ratingA = ratings[timeA];
  const ratingB = ratings[timeB];

  let golsA: number;
  let golsB: number;

  if (idaEVolta) {
    const jogo1 = simularPartida(gerarPerfilTime(ratingA, random), gerarPerfilTime(ratingB, random), random); // A em casa
    const jogo2 = simularPartida(gerarPerfilTime(ratingB, random), gerarPerfilTime(ratingA, random), random); // B em casa
    golsA = jogo1.golsCasa + jogo2.golsFora;
    golsB = jogo1.golsFora + jogo2.golsCasa;
  } else {
    const jogo = simularPartida(gerarPerfilTime(ratingA, random), gerarPerfilTime(ratingB, random), random);
    golsA = jogo.golsCasa;
    golsB = jogo.golsFora;
  }

  if (golsA > golsB) return { timeA, timeB, golsA, golsB, vencedor: timeA, decididoNosPenaltis: false };
  if (golsB > golsA) return { timeA, timeB, golsA, golsB, vencedor: timeB, decididoNosPenaltis: false };

  const vencedor = random() < probabilidadeDeVencer(ratingA, ratingB) ? timeA : timeB;
  return { timeA, timeB, golsA, golsB, vencedor, decididoNosPenaltis: true };
}

/**
 * Simula um mata-mata com entrada escalonada por etapa (`EtapaMataMata[]`,
 * ver `schemas/championship.ts`) — cada etapa soma seus `entrantes` (se
 * houver) aos vencedores que já vinham da etapa anterior, empareiam por
 * força, resolve os confrontos e passa os vencedores adiante. Termina
 * quando sobra 1 só time.
 */
export function simularMataMataComEtapas(
  etapas: EtapaMataMata[],
  ratings: Record<string, number>,
  random: () => number = Math.random,
): ResultadoMataMata {
  let vivos: string[] = [];
  const resultadoEtapas: ResultadoEtapaMataMata[] = [];

  for (const etapa of etapas) {
    vivos = [...vivos, ...(etapa.entrantes ?? [])];

    if (vivos.length === 0) {
      resultadoEtapas.push({ nome: etapa.nome, confrontos: [], vencedores: [] });
      continue;
    }

    const pares = emparelharPorForca(vivos, ratings);
    const confrontos = pares.map(([timeA, timeB]) => resolverConfronto(timeA, timeB, ratings, etapa.ida_e_volta, random));
    const vencedores = confrontos.map((c) => c.vencedor);

    resultadoEtapas.push({ nome: etapa.nome, confrontos, vencedores });
    vivos = vencedores;
  }

  if (vivos.length !== 1) {
    throw new Error(`simularMataMataComEtapas: terminou com ${vivos.length} times ainda vivos, esperava 1 campeão`);
  }

  return { etapas: resultadoEtapas, campeao: vivos[0] };
}

/** Mata-mata simples: todos os `participantes` entram já na 1ª fase, mesmo `ida_e_volta` em todas as fases. */
export function simularMataMataSimples(
  participantes: string[],
  fases: string[],
  idaEVolta: boolean,
  ratings: Record<string, number>,
  random: () => number = Math.random,
): ResultadoMataMata {
  const etapas: EtapaMataMata[] = fases.map((nome, indice) => ({
    nome,
    ida_e_volta: idaEVolta,
    entrantes: indice === 0 ? participantes : undefined,
  }));

  return simularMataMataComEtapas(etapas, ratings, random);
}

/**
 * Atalho que lê direto o bloco `MataMata` do schema: usa `etapas` quando
 * presente (entrada escalonada), senão cai no formato simples com
 * `fases`/`ida_e_volta` + a lista de `participantes` (só necessária nesse
 * segundo caso — `etapas` já traz os entrantes embutidos).
 */
export function simularMataMataDoFormato(
  formato: MataMata,
  ratings: Record<string, number>,
  participantes: string[] = [],
  random: () => number = Math.random,
): ResultadoMataMata {
  if (formato.etapas) {
    return simularMataMataComEtapas(formato.etapas, ratings, random);
  }

  return simularMataMataSimples(participantes, formato.fases, formato.ida_e_volta, ratings, random);
}
