import type { ChanceJogador } from "../simulation/match.js";

/**
 * Geração de XP e crescimento de atributo — ver docs/motor-de-partida.md
 * seção 3. Sem perks: XP alimenta diretamente o atributo, com retorno
 * decrescente perto de 99 e multiplicador de arquétipo nos prioritários.
 */

export interface DesempenhoPartida {
  gols: number;
  assistencias: number;
  desarmesBemSucedidos: number;
  /** Chances que o jogador teve e desperdiçou — penalidade leve na nota. */
  chancesPerdidas: number;
  minutosJogados: number;
  /** Multiplicador de importância da partida: 1 = jogo normal, >1 clássico/final/competição mais relevante. */
  importancia: number;
}

/** Subtipos que resultam em gol quando bem-sucedidos — ver simulation/tactics.ts. */
const SUBTIPOS_DE_FINALIZACAO = new Set(["voleio", "cabeceio", "chute_de_fora", "jogada_individual"]);

/**
 * Converte as chances individuais do jogador numa partida (`simularPartida`,
 * campo `chancesJogador`) num `DesempenhoPartida` pronto pra
 * `calcularNotaPartida`/`calcularXpPartida`. Cada subtipo de chance vira um
 * tipo de evento diferente: finalização (voleio/cabeceio/chute de
 * fora/jogada individual) sucesso vira gol, falha vira chance perdida;
 * passe decisivo sucesso vira assistência (também penaliza a falha, é uma
 * chance de criar jogada desperdiçada); desarme decisivo só soma quando dá
 * certo — uma tentativa de desarme que falha não é uma chance de ataque
 * desperdiçada, então não entra em `chancesPerdidas`.
 */
export function converterChancesEmDesempenho(
  chances: ChanceJogador[],
  minutosJogados: number,
  importancia: number,
): DesempenhoPartida {
  let gols = 0;
  let assistencias = 0;
  let desarmesBemSucedidos = 0;
  let chancesPerdidas = 0;

  for (const chance of chances) {
    if (SUBTIPOS_DE_FINALIZACAO.has(chance.subtipo)) {
      if (chance.sucesso) gols++;
      else chancesPerdidas++;
    } else if (chance.subtipo === "passe_decisivo") {
      if (chance.sucesso) assistencias++;
      else chancesPerdidas++;
    } else if (chance.subtipo === "desarme_decisivo" && chance.sucesso) {
      desarmesBemSucedidos++;
    }
  }

  return { gols, assistencias, desarmesBemSucedidos, chancesPerdidas, minutosJogados, importancia };
}

const NOTA_BASE = 6;
const NOTA_MINIMA = 0;
const NOTA_MAXIMA = 10;

/** Nota de desempenho (0-10, estilo cobertura esportiva) a partir dos eventos da partida. */
export function calcularNotaPartida(desempenho: DesempenhoPartida): number {
  const bonus =
    desempenho.gols * 1.2 +
    desempenho.assistencias * 0.8 +
    desempenho.desarmesBemSucedidos * 0.3 -
    desempenho.chancesPerdidas * 0.4;

  const fatorMinutos = Math.min(1, desempenho.minutosJogados / 90);
  const nota = NOTA_BASE + bonus * fatorMinutos;

  return Math.max(NOTA_MINIMA, Math.min(NOTA_MAXIMA, nota));
}

const XP_BASE_POR_PARTIDA = 100;

/** XP total gerado pela partida — nota, tempo em campo e importância do jogo. */
export function calcularXpPartida(desempenho: DesempenhoPartida): number {
  const nota = calcularNotaPartida(desempenho);
  const fatorMinutos = Math.min(1, desempenho.minutosJogados / 90);
  return nota * fatorMinutos * desempenho.importancia * XP_BASE_POR_PARTIDA;
}

const GANHO_BASE = 0.02;

/**
 * Aplica XP a um atributo (0-99), com retorno decrescente perto do teto —
 * sair de 90→99 custa muito mais XP que 40→50 — e multiplicador de
 * arquétipo (prioritário = cresce mais rápido, sem limite especial).
 */
export function aplicarXpAtributo(valorAtual: number, xp: number, multiplicadorArquetipo = 1): number {
  const fatorRetornoDecrescente = 1 - valorAtual / 100;
  const ganho = xp * multiplicadorArquetipo * fatorRetornoDecrescente * GANHO_BASE;
  return Math.min(99, valorAtual + ganho);
}
