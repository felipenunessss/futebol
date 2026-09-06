/**
 * Status do jogador dentro do elenco do clube atual — pedido explícito:
 * "promessa, titular, etc" impactando desempenho/stats e as propostas de
 * mercado que o jogador recebe. Não existe sistema de escalação/minutagem
 * de verdade (isso seria uma peça de gestão bem maior) — status é uma
 * aproximação simples de "quanto o clube confia em você", que:
 *
 * 1. Decide quantos minutos você costuma jogar (`minutosEsperadosPorStatus`),
 *    afetando XP ganho por partida (`progression/xp.ts` já escala XP por
 *    `minutosJogados/90`).
 * 2. Evolui/regride uma vez por temporada a partir da nota média nas
 *    partidas jogadas (`evoluirStatus`).
 * 3. Afeta o valor de mercado (`market/valuation.ts` `PerfilDeMercado.multiplicadorStatus`)
 *    e qual status um clube interessado oferece (`statusOferecido`) — um
 *    clube bem mais fraco que o atual tende a oferecer status melhor (é
 *    a peça central pro pedido "reserva do Flamengo pode ser titular
 *    numa Série B"); um clube bem mais forte tende a oferecer status
 *    igual ou pior (não chega chegando como titular).
 */
export type StatusNoClube = "promessa" | "reserva" | "titular" | "idolo";

const ORDEM_STATUS: StatusNoClube[] = ["promessa", "reserva", "titular", "idolo"];

export function indiceDoStatus(status: StatusNoClube): number {
  return ORDEM_STATUS.indexOf(status);
}

/** Minutos "esperados" por partida conforme o status — estimativa de design (mesma ressalva do resto do jogo), não uma simulação de escalação de verdade. */
const MINUTOS_POR_STATUS: Record<StatusNoClube, number> = {
  promessa: 15,
  reserva: 45,
  titular: 90,
  idolo: 90,
};

export function minutosEsperadosPorStatus(status: StatusNoClube): number {
  return MINUTOS_POR_STATUS[status];
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
 * sobe/desce 1 degrau por temporada (sem saltos), e nunca sai da faixa
 * `"promessa"`-`"idolo"`. Sem partida jogada na temporada (nota média
 * indefinida), quem chama deve simplesmente não chamar essa função —
 * status só muda com base em desempenho real em campo.
 */
export function evoluirStatus(statusAtual: StatusNoClube, notaMedia: number): StatusNoClube {
  const indice = indiceDoStatus(statusAtual);

  if (notaMedia >= NOTA_MEDIA_PARA_PROMOCAO && indice < ORDEM_STATUS.length - 1) return ORDEM_STATUS[indice + 1];
  if (notaMedia < NOTA_MEDIA_PARA_REBAIXAMENTO && indice > 0) return ORDEM_STATUS[indice - 1];
  return statusAtual;
}

/** Diferença de rating (escala tipo Elo, `simulation/rating.ts`) acima/abaixo da qual um clube conta como "bem mais forte"/"bem mais fraco" que o atual, pra decidir o status oferecido — mesma unidade de `QUEDA_POR_NIVEL` de `rating.ts` (~1 nível de divisão). */
const MARGEM_CLUBE_MAIOR = 150;
const MARGEM_CLUBE_MENOR = 150;

/**
 * Decide o status que um clube interessado oferece, a partir da
 * diferença de rating esportivo entre ele e o clube atual do jogador
 * (`ratingClubeAtual` = 0 quando o jogador ainda não tem clube — início
 * de carreira — o que já cai naturalmente no caso "clube bem mais forte",
 * mantendo `"promessa"` pra toda proposta inicial, sem precisar de um
 * caminho especial pra isso).
 */
export function statusOferecido(statusAtual: StatusNoClube, ratingClubeAtual: number, ratingClubeOfertante: number): StatusNoClube {
  const indice = indiceDoStatus(statusAtual);
  const diferenca = ratingClubeOfertante - ratingClubeAtual;

  if (diferenca > MARGEM_CLUBE_MAIOR) return ORDEM_STATUS[Math.max(0, indice - 1)];
  if (diferenca < -MARGEM_CLUBE_MENOR) return ORDEM_STATUS[Math.min(ORDEM_STATUS.length - 1, indice + 1)];
  return statusAtual;
}
