import type { EtapaMataMata, FinalEstadual, MataMata } from "../schemas/championship.js";
import { gerarPerfilTime, probabilidadeDeVencer, simularPartida, type ParticipacaoJogador, type ParticipacaoJogadorClube, type ResultadoPartida } from "./match.js";

/**
 * Gerador/simulador de mata-mata (`formato.mata_mata`, ver
 * `schemas/championship.ts`) — cobre tanto o formato simples (`fases` +
 * `ida_e_volta` únicos, todo mundo entra na 1ª fase) quanto o formato com
 * entrada escalonada (`etapas`, usado por Copa do Brasil/Libertadores/
 * Sul-Americana). Se `participacaoJogador` for passado, os confrontos que
 * envolvem o clube dele usam `ParticipacaoJogador` (Camada 2) em cada
 * jogo/perna; o resto do chaveamento continua Camada 1.
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
  /** 1 entrada (jogo único) ou 2 (ida e volta) — só presente quando o clube do jogador estava nesse confronto. */
  partidasDoJogador?: ResultadoPartida[];
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

/** Evento emitido a cada confronto de mata-mata resolvido (`aoResolverConfronto`) — dá pra mostrar o jogo a jogo em tempo real. Ida-e-volta conta como 1 evento só (agregado), não 1 por perna — simplificação documentada. */
export interface EventoConfrontoMataMata {
  etapa: string;
  confronto: ResultadoConfrontoMataMata;
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

function participacaoComoLado(participacao: ParticipacaoJogadorClube | undefined, lado: "casa" | "fora"): ParticipacaoJogador | undefined {
  return participacao ? { lado, jogador: participacao.jogador, estiloTecnico: participacao.estiloTecnico } : undefined;
}

/** Exportado pra `simularFinalEstadualDoFormato` reaproveitar (uma final de estadual é, na essência, um confronto de mata-mata isolado). */
export function resolverConfronto(
  timeA: string,
  timeB: string,
  ratings: Record<string, number>,
  idaEVolta: boolean,
  random: () => number = Math.random,
  participacaoJogador?: ParticipacaoJogadorClube,
): ResultadoConfrontoMataMata {
  const ratingA = ratings[timeA];
  const ratingB = ratings[timeB];
  const ehTimeA = participacaoJogador?.clubeId === timeA;
  const ehTimeB = participacaoJogador?.clubeId === timeB;
  const partidasDoJogador: ResultadoPartida[] = [];

  let golsA: number;
  let golsB: number;

  if (idaEVolta) {
    // jogo 1: A manda em casa
    const participacaoJogo1 = ehTimeA ? participacaoComoLado(participacaoJogador, "casa") : ehTimeB ? participacaoComoLado(participacaoJogador, "fora") : undefined;
    const jogo1 = simularPartida(gerarPerfilTime(ratingA, random), gerarPerfilTime(ratingB, random), random, participacaoJogo1);
    if (participacaoJogo1) partidasDoJogador.push(jogo1);

    // jogo 2: B manda em casa
    const participacaoJogo2 = ehTimeA ? participacaoComoLado(participacaoJogador, "fora") : ehTimeB ? participacaoComoLado(participacaoJogador, "casa") : undefined;
    const jogo2 = simularPartida(gerarPerfilTime(ratingB, random), gerarPerfilTime(ratingA, random), random, participacaoJogo2);
    if (participacaoJogo2) partidasDoJogador.push(jogo2);

    golsA = jogo1.golsCasa + jogo2.golsFora;
    golsB = jogo1.golsFora + jogo2.golsCasa;
  } else {
    const participacao = ehTimeA ? participacaoComoLado(participacaoJogador, "casa") : ehTimeB ? participacaoComoLado(participacaoJogador, "fora") : undefined;
    const jogo = simularPartida(gerarPerfilTime(ratingA, random), gerarPerfilTime(ratingB, random), random, participacao);
    if (participacao) partidasDoJogador.push(jogo);
    golsA = jogo.golsCasa;
    golsB = jogo.golsFora;
  }

  const base = { timeA, timeB, golsA, golsB, ...(partidasDoJogador.length > 0 ? { partidasDoJogador } : {}) };

  if (golsA > golsB) return { ...base, vencedor: timeA, decididoNosPenaltis: false };
  if (golsB > golsA) return { ...base, vencedor: timeB, decididoNosPenaltis: false };

  const vencedor = random() < probabilidadeDeVencer(ratingA, ratingB) ? timeA : timeB;
  return { ...base, vencedor, decididoNosPenaltis: true };
}

/**
 * Simula um mata-mata com entrada escalonada por etapa (`EtapaMataMata[]`,
 * ver `schemas/championship.ts`) — cada etapa soma seus `entrantes` (se
 * houver) aos vencedores que já vinham da etapa anterior, empareiam por
 * força, resolve os confrontos e passa os vencedores adiante. Termina
 * quando sobra 1 só time. Se o clube do jogador for eliminado no meio do
 * caminho, as etapas seguintes simplesmente não têm `partidasDoJogador`.
 */
export function simularMataMataComEtapas(
  etapas: EtapaMataMata[],
  ratings: Record<string, number>,
  random: () => number = Math.random,
  participacaoJogador?: ParticipacaoJogadorClube,
  aoResolverConfronto?: (evento: EventoConfrontoMataMata) => void,
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
    const confrontos = pares.map(([timeA, timeB]) => {
      const confronto = resolverConfronto(timeA, timeB, ratings, etapa.ida_e_volta, random, participacaoJogador);
      aoResolverConfronto?.({ etapa: etapa.nome, confronto });
      return confronto;
    });
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
  participacaoJogador?: ParticipacaoJogadorClube,
  aoResolverConfronto?: (evento: EventoConfrontoMataMata) => void,
): ResultadoMataMata {
  const etapas: EtapaMataMata[] = fases.map((nome, indice) => ({
    nome,
    ida_e_volta: idaEVolta,
    entrantes: indice === 0 ? participantes : undefined,
  }));

  return simularMataMataComEtapas(etapas, ratings, random, participacaoJogador, aoResolverConfronto);
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
  participacaoJogador?: ParticipacaoJogadorClube,
  aoResolverConfronto?: (evento: EventoConfrontoMataMata) => void,
): ResultadoMataMata {
  if (formato.etapas) {
    return simularMataMataComEtapas(formato.etapas, ratings, random, participacaoJogador, aoResolverConfronto);
  }

  return simularMataMataSimples(participantes, formato.fases, formato.ida_e_volta, ratings, random, participacaoJogador, aoResolverConfronto);
}

export interface ResultadoFinalEstadual {
  campeao: string;
  /** Ausente quando não houve final de fato — alguém já tinha se sagrado campeão automático (ex: mesmo clube venceu turno e returno, ver `FinalEstadual.criterio`). */
  confronto?: ResultadoConfrontoMataMata;
}

/**
 * Resolve uma `FinalEstadual` (ver `schemas/championship.ts`) — a final
 * entre campeões de turno/returno (Uruguai, Carioca, etc). `criterio` é
 * texto livre e não é interpretado aqui: cabe a quem chama decidir, a
 * partir dele, quem são os participantes (normalmente 2 — campeão do turno
 * x campeão do returno — ou só 1, quando o mesmo clube venceu os dois e
 * já é campeão automático sem precisar de final).
 */
export function simularFinalEstadualDoFormato(
  formato: FinalEstadual,
  participantes: string[],
  ratings: Record<string, number>,
  random: () => number = Math.random,
  participacaoJogador?: ParticipacaoJogadorClube,
): ResultadoFinalEstadual {
  if (participantes.length === 1) {
    return { campeao: participantes[0] };
  }

  if (participantes.length !== 2) {
    throw new Error(`simularFinalEstadualDoFormato: esperava 1 ou 2 participantes, recebeu ${participantes.length}`);
  }

  const confronto = resolverConfronto(participantes[0], participantes[1], ratings, formato.ida_e_volta, random, participacaoJogador);
  return { campeao: confronto.vencedor, confronto };
}
