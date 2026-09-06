import type { ForcaFinanceira } from "../schemas/club.js";

/**
 * Status do jogador dentro do elenco do clube atual — pedido explícito:
 * "promessa, titular, etc" impactando desempenho/stats e as propostas de
 * mercado que o jogador recebe. Não existe sistema de escalação/minutagem
 * de verdade (isso seria uma peça de gestão bem maior) — status é uma
 * aproximação simples de "quanto o clube confia em você", que:
 *
 * 1. Decide quantos minutos você costuma jogar, com variação partida a
 *    partida (`minutosEsperadosPorStatus`), afetando XP/nota ganhos por
 *    partida (`progression/xp.ts` já escala por `minutosJogados/90`).
 * 2. Evolui/regride uma vez por temporada a partir da nota média nas
 *    partidas jogadas (`evoluirStatus`), com um piso mínimo por idade
 *    (`statusMinimoPorIdade` — acima de 22 anos, não é mais plausível
 *    ser tratado como "promessa").
 * 3. Afeta o valor de mercado (`market/valuation.ts` `PerfilDeMercado.multiplicadorStatus`)
 *    e qual status um clube interessado oferece (`statusOferecido`) — a
 *    partir de 4 fatores: diferença de rating com o clube atual,
 *    concorrência interna do clube ofertante (proxy: `forca_financeira`,
 *    clube mais rico tende a ter elenco mais forte/concorrido), fase
 *    atual do clube ofertante, e o mesmo piso por idade.
 */
export type StatusNoClube = "promessa" | "reserva" | "titular" | "idolo";

const ORDEM_STATUS: StatusNoClube[] = ["promessa", "reserva", "titular", "idolo"];

export function indiceDoStatus(status: StatusNoClube): number {
  return ORDEM_STATUS.indexOf(status);
}

/**
 * Idade acima da qual não é mais plausível ser tratado como "promessa"
 * (jovem em formação) — a partir daí, o piso é "reserva": ou o clube já
 * decidiu que você é peça do elenco (mesmo que não titular), ou você não
 * está mais lá. Aplicado tanto na evolução de status
 * (`evoluirStatus`) quanto na oferta de um clube interessado
 * (`statusOferecido`).
 */
const IDADE_MAXIMA_PROMESSA = 22;

/** Status mínimo plausível pra uma dada idade — usado como piso, não como valor "correto" único (um veterano pode muito bem ser "reserva" ou "titular", só não "promessa"). */
export function statusMinimoPorIdade(idade: number): StatusNoClube {
  return idade > IDADE_MAXIMA_PROMESSA ? "reserva" : "promessa";
}

function aplicarPisoPorIdade(status: StatusNoClube, idade: number): StatusNoClube {
  const piso = statusMinimoPorIdade(idade);
  return indiceDoStatus(status) < indiceDoStatus(piso) ? piso : status;
}

/**
 * Faixa de minutos "esperados" por partida conforme o status — estimativa
 * de design (mesma ressalva do resto do jogo), não uma simulação de
 * escalação de verdade. As faixas se sobrepõem de propósito (ex: um
 * reserva num dia inspirado pode jogar quase o jogo inteiro, um titular
 * pode ser poupado) — é isso que dá variação partida a partida em vez de
 * um número fixo sempre igual.
 */
const FAIXA_DE_MINUTOS_POR_STATUS: Record<StatusNoClube, { min: number; max: number }> = {
  promessa: { min: 5, max: 30 },
  reserva: { min: 15, max: 70 },
  titular: { min: 60, max: 90 },
  idolo: { min: 70, max: 90 },
};

/** Minutos jogados numa partida específica, sorteados dentro da faixa do status (`random` injetado, mesmo padrão do resto do jogo). Chame uma vez por partida, não uma vez por temporada, pra ter variação de verdade jogo a jogo. */
export function minutosEsperadosPorStatus(status: StatusNoClube, random: () => number = Math.random): number {
  const { min, max } = FAIXA_DE_MINUTOS_POR_STATUS[status];
  return Math.round(min + random() * (max - min));
}

/** Multiplicador de valor de mercado por status — mesmo overall, um titular vale mais que um reserva/promessa (mais minutagem comprovada = menos risco pro clube comprador); ídolo vale um pouco mais ainda (referência do time). */
const MULTIPLICADOR_VALORIZACAO_POR_STATUS: Record<StatusNoClube, number> = {
  promessa: 0.7,
  reserva: 0.85,
  titular: 1,
  idolo: 1.25,
};

export function multiplicadorDeValorizacaoPorStatus(status: StatusNoClube): number {
  return MULTIPLICADOR_VALORIZACAO_POR_STATUS[status];
}

const NOTA_MEDIA_PARA_PROMOCAO = 7;
const NOTA_MEDIA_PARA_REBAIXAMENTO = 5;

/**
 * Evolui (ou regride) o status a partir da nota média do jogador na
 * temporada (`progression/xp.ts` `calcularNotaPartida`, escala 0-10) — só
 * sobe/desce 1 degrau por temporada (sem saltos), nunca sai da faixa
 * `"promessa"`-`"idolo"`, e nunca fica abaixo do piso de
 * `statusMinimoPorIdade` pra idade atual do jogador. Sem partida jogada
 * na temporada (nota média indefinida), quem chama deve simplesmente não
 * chamar essa função — status só muda com base em desempenho real em
 * campo.
 */
export function evoluirStatus(statusAtual: StatusNoClube, notaMedia: number, idadeJogador: number): StatusNoClube {
  const indice = indiceDoStatus(statusAtual);

  let novoStatus = statusAtual;
  if (notaMedia >= NOTA_MEDIA_PARA_PROMOCAO && indice < ORDEM_STATUS.length - 1) novoStatus = ORDEM_STATUS[indice + 1];
  else if (notaMedia < NOTA_MEDIA_PARA_REBAIXAMENTO && indice > 0) novoStatus = ORDEM_STATUS[indice - 1];

  return aplicarPisoPorIdade(novoStatus, idadeJogador);
}

export interface FatoresDeOferta {
  idadeJogador: number;
  ratingClubeAtual: number;
  ratingClubeOfertante: number;
  /**
   * Proxy de concorrência/profundidade do elenco do clube ofertante —
   * não existe simulação de elenco alheio de verdade (isso exigiria
   * modelar o time inteiro de cada clube, não só o jogador), então
   * `forca_financeira` faz esse papel: clube mais rico tende a ter mais
   * opções pra mesma posição, o que reduz a chance de oferecer um
   * status melhor. Ausente (clube sem `forca_financeira` cadastrada)
   * conta como neutro.
   */
  concorrenciaDoClube?: ForcaFinanceira;
  /**
   * Fase atual do clube ofertante, de -1 (crise, mais aberto a mudar e
   * dar espaço a gente nova) a +1 (auge, mais fechado com quem já está
   * jogando bem) — **não existe simulação de forma de equipe no motor
   * ainda** (rating de clube é estático durante a carreira toda, ver
   * pendências), então isso é sorteado por quem chama
   * (`market/transfers.ts` `gerarProposta`, com `random` injetado) —
   * representa a imprevisibilidade real de cair num clube num momento
   * bom ou ruim, não uma fase calculada de verdade.
   */
  faseDaEquipe: number;
}

/** Normaliza a diferença de rating pra escala de score (~1 nível de divisão de `simulation/rating.ts` vira ±1 de score). */
const MARGEM_DE_RATING_PARA_SCORE = 150;

const SCORE_CONCORRENCIA_POR_FORCA: Record<ForcaFinanceira, number> = {
  muito_alta: -1,
  alta: -0.5,
  media: 0,
  baixa: 0.5,
  muito_baixa: 1,
};

/** Score total (rating + concorrência + fase) acima/abaixo do qual o status oferecido sobe/desce 1 degrau — 1.0 sozinho já é atingido só pela diferença de rating na margem de "1 nível" (compatibilidade com o comportamento anterior, só-rating), mas concorrência/fase também podem empurrar pra lá sozinhos ou reforçar/contrabalançar o rating. */
const LIMIAR_DE_DEGRAU = 1;

/**
 * Decide o status que um clube interessado oferece — combina diferença
 * de rating com o clube atual, concorrência interna (proxy de
 * `forca_financeira`) e a fase atual do clube ofertante (sorteada, ver
 * `FatoresDeOferta.faseDaEquipe`) num score só; só sobe/desce 1 degrau
 * (nunca um salto maior, por mais extremo que o score fique), e nunca
 * abaixo do piso de `statusMinimoPorIdade`. `ratingClubeAtual = 0`
 * (início de carreira, sem clube ainda) sempre pesa como "clube bem mais
 * forte" nesse score, então cai naturalmente pra baixo (clampado no
 * piso "promessa"/"reserva" pela idade) sem precisar de um caminho
 * especial pra isso.
 */
export function statusOferecido(statusAtual: StatusNoClube, fatores: FatoresDeOferta): StatusNoClube {
  const indice = indiceDoStatus(statusAtual);

  const diferencaDeRating = fatores.ratingClubeOfertante - fatores.ratingClubeAtual;
  const scoreRating = -diferencaDeRating / MARGEM_DE_RATING_PARA_SCORE;
  const scoreConcorrencia = fatores.concorrenciaDoClube ? SCORE_CONCORRENCIA_POR_FORCA[fatores.concorrenciaDoClube] : 0;
  const scoreFase = -fatores.faseDaEquipe;
  const scoreTotal = scoreRating + scoreConcorrencia + scoreFase;

  let novoIndice = indice;
  if (scoreTotal <= -LIMIAR_DE_DEGRAU) novoIndice = Math.max(0, indice - 1);
  else if (scoreTotal >= LIMIAR_DE_DEGRAU) novoIndice = Math.min(ORDEM_STATUS.length - 1, indice + 1);

  return aplicarPisoPorIdade(ORDEM_STATUS[novoIndice], fatores.idadeJogador);
}
