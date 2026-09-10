import type { Atributo } from "../schemas/player.js";
import type { ChanceJogador } from "../simulation/match.js";

/**
 * Geração de XP, nota de partida e curva de nível — ver
 * docs/motor-de-partida.md seção 3. Desde a seção 5.16, XP de
 * partida/treino não sobe atributo nenhum diretamente — só alimenta um
 * **nível** (`career/Player.ts` `ganharXp`), e subir de nível dá pontos
 * pra investir manualmente em QUALQUER atributo da posição
 * (`career/Player.ts` `investirPontos`), estilo Pro Clubs. Continua
 * "sem perks": pontos só somam atributo numérico, nunca desbloqueiam
 * efeito especial.
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
 * Sessões de treino com escolha de foco — ver `docs/game-design.md` seção
 * 5.2. A seção 5.16 tinha desligado o foco de qualquer atributo específico
 * (só decidia gerar XP de nível ou recuperar moral, com a escolha de ONDE
 * investir totalmente livre em `investirPontos`) — decisão revertida: o
 * foco volta a ter efeito direto e específico sobre os atributos da sua
 * categoria (`ATRIBUTOS_POR_FOCO` abaixo, ver `career/Player.ts`
 * `aplicarGanhoDeTreino`), sem tirar o sistema de nível/pontos livres (que
 * continua alimentado igualmente pelos 3 focos — esse ganho direto é
 * complementar, não substitui). `descanso` continua sem gerar XP nem
 * ganho direto, só recupera moral.
 */
export type FocoDeTreino = "fisico" | "tecnico" | "tatico" | "descanso";

/**
 * Quais atributos cada foco de treino desenvolve diretamente
 * (`career/Player.ts` `aplicarGanhoDeTreino`) — cobre os 24 atributos sem
 * sobreposição, agrupados por natureza física/técnica/tática (goleiro
 * incluído: reflexos/jogo_aereo/forca_fisica no físico, saida_de_gol/
 * distribuicao no técnico, posicionamento_goleiro no tático). Uma sessão
 * só afeta, dentro dessa lista, os atributos que também estejam em
 * `schemas/player.ts` `ATRIBUTOS_POR_POSICAO` da posição do jogador — o
 * foco nunca cria valor num atributo que a posição não usa.
 */
export const ATRIBUTOS_POR_FOCO: Record<Exclude<FocoDeTreino, "descanso">, Atributo[]> = {
  fisico: ["velocidade", "forca_fisica", "resistencia", "jogo_aereo", "reflexos"],
  tecnico: ["finalizacao", "drible", "cruzamento", "passe_curto", "passe_longo", "cabeceio", "protecao_de_bola", "saida_de_gol", "distribuicao"],
  tatico: ["desarme", "interceptacao", "marcacao", "visao_de_jogo", "frieza", "posicionamento_ofensivo", "posicionamento_defensivo", "movimentacao", "lideranca", "posicionamento_goleiro"],
};

/**
 * Ganho direto (fora do sistema de pontos/nível) aplicado a cada atributo
 * relevante numa sessão de treino com foco — mais se for prioritário do
 * arquétipo (mesmo multiplicador de `ganhoPorPonto`). Pequeno de
 * propósito: uma sessão toca vários atributos de uma vez (todos os da
 * categoria relevantes pra posição), então o total por sessão já soma
 * mais que um ponto manual isolado — não deveria dominar sozinho o
 * crescimento da temporada.
 */
export const GANHO_DIRETO_POR_ATRIBUTO_NO_TREINO = 0.5;

/** XP de uma sessão de treino — estimativa de design (mesma ressalva das demais constantes do jogo): rende mais que uma fração do XP de partida, mas 5 sessões (uma por período) não dominam a progressão da temporada sozinhas. */
const XP_POR_SESSAO_DE_TREINO = 250;

/** Moral recuperada ao escolher "descanso" como foco — não gera XP. */
export const MORAL_RECUPERADA_NO_DESCANSO = 8;

/** XP de uma sessão de treino (rumo ao nível, `career/Player.ts` `ganharXp`) — 0 pra "descanso" (não treina, só recupera moral, responsabilidade de quem chama). */
export function xpDeSessaoDeTreino(foco: FocoDeTreino): number {
  return foco === "descanso" ? 0 : XP_POR_SESSAO_DE_TREINO;
}
