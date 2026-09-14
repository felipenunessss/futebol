import type { Atributo } from "../schemas/player.js";
import type { ChanceJogador } from "../simulation/match.js";

/**
 * Geração de XP, nota de partida e curva de nível — ver
 * docs/motor-de-partida.md seção 3. XP vem exclusivamente do DESEMPENHO EM
 * PARTIDA (`calcularXpPartida`, `career/Player.ts` `aplicarDesempenhoPartida`)
 * — o sistema de treino com foco foi descontinuado (pedido do usuário: "o
 * jogador ganha XP exclusivamente pelo desempenho nas partidas"). XP não
 * sobe atributo nenhum diretamente — só alimenta um **nível**
 * (`career/Player.ts` `ganharXp`), e subir de nível dá pontos pra investir
 * manualmente em QUALQUER atributo da posição (`career/Player.ts`
 * `investirPontos`), estilo Pro Clubs, numa tela de alocação disparada a
 * cada level-up. Continua "sem perks": pontos só somam atributo numérico,
 * nunca desbloqueiam efeito especial.
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

/** Nota de desempenho (0-10, estilo cobertura esportiva) a partir dos eventos da partida — usada por `career/status.ts` `evoluirStatus`, sem relação com o nível/XP abaixo. */
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

/** XP total gerado pela partida (rumo ao nível, `career/Player.ts` `ganharXp`) — nota, tempo em campo e importância do jogo. */
export function calcularXpPartida(desempenho: DesempenhoPartida): number {
  const nota = calcularNotaPartida(desempenho);
  const fatorMinutos = Math.min(1, desempenho.minutosJogados / 90);
  return nota * fatorMinutos * desempenho.importancia * XP_BASE_POR_PARTIDA;
}

/**
 * Curva de XP necessária pra sair do nível `nivel` pro próximo — cada
 * nível fica um pouco mais caro que o anterior. Estimativa de design,
 * não fórmula validada (mesma ressalva de toda constante de progressão
 * do jogo) — calibrada pra um titular ativo (partidas + treino) subir
 * uns 8-12 níveis numa temporada cheia.
 */
export function xpParaProximoNivel(nivel: number): number {
  return 150 + nivel * 50;
}

/** Pontos de atributo ganhos a cada level-up (`career/Player.ts` `ganharXp`). */
export const PONTOS_POR_NIVEL = 3;

/** Quanto 1 ponto investido soma no atributo — mais se for prioritário do arquétipo (`career/Player.ts` `investirPontos`): o arquétipo continua sendo multiplicador, nunca restrição (dá pra investir em qualquer atributo da posição, só rende menos fora da prioridade). */
export const GANHO_POR_PONTO_PRIORITARIO = 1.5;
export const GANHO_POR_PONTO_PADRAO = 1;

export function ganhoPorPonto(atributo: Atributo, atributosPrioritarios: Atributo[]): number {
  return atributosPrioritarios.includes(atributo) ? GANHO_POR_PONTO_PRIORITARIO : GANHO_POR_PONTO_PADRAO;
}

/**
 * Retorno decrescente perto do teto (99) — reintroduz a curva descrita em
 * `docs/motor-de-partida.md` seção 3 ("sair de 90→99 custa muito mais que
 * 40→50"), perdida na seção 5.17 quando o crescimento virou pontos manuais
 * lineares (o único limite era o clamp duro em 99, sem nada tornando os
 * últimos pontos mais caros — jogador reportou "atributos 99 muito rápido").
 * Abaixo de `LIMIAR_RETORNO_DECRESCENTE` o ganho é 100% (mesmo
 * comportamento de antes); a partir daí, decai suavemente até
 * `FATOR_MINIMO_RETORNO` bem perto do teto — nunca chega a exatamente 0
 * pra não travar o jogador para sempre num último ponto, só torna
 * extremamente lento (estilo FIFA/EA FC: raríssimo alguém bater 99 de
 * verdade). Estimativa de design, não fórmula validada (mesma ressalva de
 * toda constante de progressão do jogo) — aplicada em `career/Player.ts`
 * `investirPontos`, o único canal de ganho de atributo.
 */
const LIMIAR_RETORNO_DECRESCENTE = 60;
const FATOR_MINIMO_RETORNO = 0.08;
const EXPOENTE_RETORNO_DECRESCENTE = 2.2;
const ATRIBUTO_MAXIMO = 99;

export function fatorDeRetornoDecrescente(valorAtual: number): number {
  if (valorAtual <= LIMIAR_RETORNO_DECRESCENTE) return 1;

  const distanciaMaxima = ATRIBUTO_MAXIMO - LIMIAR_RETORNO_DECRESCENTE;
  const distanciaAoTeto = Math.max(0, ATRIBUTO_MAXIMO - valorAtual);
  const fracaoLinear = Math.min(1, distanciaAoTeto / distanciaMaxima);

  return FATOR_MINIMO_RETORNO + (1 - FATOR_MINIMO_RETORNO) * Math.pow(fracaoLinear, EXPOENTE_RETORNO_DECRESCENTE);
}

