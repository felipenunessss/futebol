import type { EtapaMataMata, FinalEstadual, MataMata } from "../schemas/championship.js";
import type { Jogador } from "../schemas/player.js";
import { gerarPerfilTime, probabilidadeDeVencer, resolverPartidaPadrao, type ParticipacaoJogador, type ParticipacaoJogadorClube, type ResolverPartida, type ResultadoPartida } from "./match.js";

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
  /** true quando o agregado empatou e o vencedor saiu de pênaltis (disputa simulada de verdade, ver `simularDisputaDePenaltis` — não é mais um sorteio ponderado sem cobrança nenhuma). */
  decididoNosPenaltis: boolean;
  /** Placar da disputa de pênaltis (perspectiva timeA/timeB) — só presente quando `decididoNosPenaltis`. */
  penaltis?: { golsA: number; golsB: number };
  /** 1 entrada (jogo único) ou 2 (ida e volta) — só presente quando o clube do jogador estava nesse confronto. */
  partidasDoJogador?: ResultadoPartida[];
  /**
   * Placar de cada perna isolada (perspectiva `timeA`/`timeB`, mesma dos campos agregados acima) —
   * só presente quando `ida_e_volta`. Pedido do usuário: mostrar o resultado da ida separado da volta
   * na UI, mesmo simulando as duas pernas de uma vez (sem pausa real no motor) — os dados já saem
   * daqui prontos pra a UI revelar em 2 passos (`web/src/features/temporada/TelaDeTemporada.tsx`
   * `PainelResultadoDaRodada`), sem precisar de um evento por perna.
   */
  ida?: { golsA: number; golsB: number };
  volta?: { golsA: number; golsB: number };
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

/** Exportado pra `simulation/incremental.ts` reaproveitar o mesmo emparelhamento etapa a etapa. */
export function emparelharPorForca(participantes: string[], ratings: Record<string, number>): [string, string][] {
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

/**
 * Sorteio real (aleatório, não por força) da virada fase de grupos →
 * mata-mata — critério padrão de Copa do Brasil/Libertadores/Sul-Americana
 * de verdade: 1º colocado de um grupo enfrenta o 2º colocado de OUTRO
 * grupo, nunca do mesmo grupo. Diferente de `emparelharPorForca` (usado nas
 * demais rodadas do mata-mata, que não têm registro de sorteio real e
 * continuam por rating) — aqui `random` decide de fato quem pega quem
 * dentro dessa restrição.
 *
 * Só cobre o caso de exatamente 2 classificados por grupo (`times: [1º,
 * 2º]`), o único padrão presente nos dados hoje — ver `simulation/
 * incremental.ts` onde é chamada.
 */
export function sortearConfrontosPorPotes(gruposClassificados: { nome: string; times: [string, string] }[], random: () => number): [string, string][] {
  if (gruposClassificados.length < 2) {
    throw new Error(`sortearConfrontosPorPotes: precisa de pelo menos 2 grupos pra sortear (recebeu ${gruposClassificados.length})`);
  }
  const primeiros = gruposClassificados.map((g) => ({ time: g.times[0], grupo: g.nome }));
  const segundos = gruposClassificados.map((g) => ({ time: g.times[1], grupo: g.nome }));

  // Sorteia (Fisher-Yates com `random` injetado) e corrige localmente qualquer posição em que o
  // sorteio caiu num confronto do mesmo grupo, tentando de novo do zero se a correção local não
  // achar parceiro de troca válido (não deveria acontecer com N ≥ 2 grupos, mas um limite de
  // tentativas evita loop infinito em vez de assumir a prova por escrito).
  for (let tentativa = 0; tentativa < 200; tentativa++) {
    const embaralhados = [...segundos];
    for (let i = embaralhados.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [embaralhados[i], embaralhados[j]] = [embaralhados[j], embaralhados[i]];
    }

    for (let i = 0; i < embaralhados.length; i++) {
      if (embaralhados[i].grupo !== primeiros[i].grupo) continue;
      const j = embaralhados.findIndex((s, indice) => indice !== i && s.grupo !== primeiros[i].grupo && primeiros[indice].grupo !== embaralhados[i].grupo);
      if (j !== -1) [embaralhados[i], embaralhados[j]] = [embaralhados[j], embaralhados[i]];
    }

    if (embaralhados.every((s, i) => s.grupo !== primeiros[i].grupo)) {
      return primeiros.map((p, i) => [p.time, embaralhados[i].time] as [string, string]);
    }
  }

  throw new Error("sortearConfrontosPorPotes: não conseguiu sortear um pareamento sem confronto do mesmo grupo em 200 tentativas");
}

function participacaoComoLado(participacao: ParticipacaoJogadorClube | undefined, lado: "casa" | "fora"): ParticipacaoJogador | undefined {
  return participacao ? { lado, jogador: participacao.jogador, estiloTecnico: participacao.estiloTecnico } : undefined;
}

/** Conversão média real de cobranças de pênalti em futebol profissional (~75-80%). */
const CONVERSAO_BASE_PENALTI = 0.78;
/** Cobranças por time na fase inicial da disputa (5 a 5) antes de ir pra morte súbita. */
const COBRANCAS_INICIAIS = 5;

function clamp01(valor: number): number {
  return Math.max(0.5, Math.min(0.95, valor));
}

/**
 * Probabilidade do time que está cobrando converter UMA cobrança contra o goleiro adversário —
 * base realista (`CONVERSAO_BASE_PENALTI`) com um pequeno ajuste pela diferença de rating geral
 * (`probabilidadeDeVencer`, mesma fórmula Elo do resto do motor, só que com peso reduzido — pênalti
 * é mais aleatório que jogo aberto). Quando o clube do JOGADOR está envolvido (Camada 2, mesmo
 * espírito de `ParticipacaoJogador` no resto do arquivo): se ele é quem cobra e joga numa posição
 * com `frieza` (meia/atacante), a própria frieza pesa na conversão; se é o goleiro adversário, os
 * `reflexos` dele pesam pra baixo na conversão de quem cobra — sem precisar simular cobrador a
 * cobrador (o resto do elenco continua Camada 1, probabilidade só de time).
 */
function probabilidadeDeConversao(
  ratingCobrador: number,
  ratingGoleiro: number,
  clubeCobrador: string,
  clubeGoleiro: string,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
): number {
  let probabilidade = CONVERSAO_BASE_PENALTI + (probabilidadeDeVencer(ratingCobrador, ratingGoleiro) - 0.5) * 0.2;

  if (participacaoJogador?.clubeId === clubeCobrador) {
    const frieza = jogadorTemAtributo(participacaoJogador.jogador, "frieza") ? (participacaoJogador.jogador.atributos.frieza ?? 70) : undefined;
    if (frieza !== undefined) probabilidade += (frieza - 70) / 500;
  }
  if (participacaoJogador?.clubeId === clubeGoleiro && participacaoJogador.jogador.posicao === "goleiro") {
    const reflexos = participacaoJogador.jogador.atributos.reflexos ?? 70;
    probabilidade -= (reflexos - 70) / 500;
  }

  return clamp01(probabilidade);
}

function jogadorTemAtributo(jogador: Jogador, atributo: "frieza"): boolean {
  return jogador.posicao === "meia" || jogador.posicao === "atacante" || jogador.atributos[atributo] !== undefined;
}

/**
 * Simula uma disputa de pênaltis de verdade — 5 cobranças por time (parando mais cedo se o
 * resultado já estiver matematicamente decidido, regra padrão de futebol), depois morte súbita
 * (1 cobrança cada por rodada até alguém marcar e o outro não). Substitui a antiga "moeda ponderada
 * pelo rating" (que decidia o vencedor sem simular cobrança nenhuma) — ver
 * `ResultadoConfrontoMataMata.penaltis`.
 */
function simularDisputaDePenaltis(
  timeA: string,
  timeB: string,
  ratingA: number,
  ratingB: number,
  random: () => number,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
): { golsA: number; golsB: number } {
  const probA = probabilidadeDeConversao(ratingA, ratingB, timeA, timeB, participacaoJogador);
  const probB = probabilidadeDeConversao(ratingB, ratingA, timeB, timeA, participacaoJogador);

  let golsA = 0;
  let golsB = 0;
  let cobrancasA = 0;
  let cobrancasB = 0;

  const decidido = (): boolean => {
    const restantesA = COBRANCAS_INICIAIS - cobrancasA;
    const restantesB = COBRANCAS_INICIAIS - cobrancasB;
    return golsA > golsB + restantesB || golsB > golsA + restantesA;
  };

  while (cobrancasA < COBRANCAS_INICIAIS || cobrancasB < COBRANCAS_INICIAIS) {
    if (decidido()) break;
    if (cobrancasA < COBRANCAS_INICIAIS) {
      if (random() < probA) golsA++;
      cobrancasA++;
      if (decidido()) break;
    }
    if (cobrancasB < COBRANCAS_INICIAIS) {
      if (random() < probB) golsB++;
      cobrancasB++;
    }
  }

  // Morte súbita: 1 cobrança cada por rodada — decide assim que um marca e o outro erra. Teto de
  // segurança (nunca deveria chegar perto disso com probabilidades reais) pra garantir término.
  for (let rodada = 0; golsA === golsB && rodada < 50; rodada++) {
    const marcouA = random() < probA;
    const marcouB = random() < probB;
    if (marcouA) golsA++;
    if (marcouB) golsB++;
  }
  if (golsA === golsB) golsA++; // teto de segurança improvável: decide sem empate eterno

  return { golsA, golsB };
}

/**
 * Exportado pra `simularFinalEstadualDoFormato` reaproveitar (uma final de
 * estadual é, na essência, um confronto de mata-mata isolado).
 * `resolverPartida` (padrão `resolverPartidaPadrao`) segue o mesmo ponto de
 * injeção documentado em `simulation/match.ts` — permite pausar/narrar
 * qualquer uma das pernas (ida/volta) individualmente.
 */
export async function resolverConfronto(
  timeA: string,
  timeB: string,
  ratings: Record<string, number>,
  idaEVolta: boolean,
  random: () => number = Math.random,
  participacaoJogador?: ParticipacaoJogadorClube,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
  /** Nome da etapa de mata-mata (ex: "quartas") — meramente informativo, repassado em `ContextoConfronto.etapa` pra quem resolve a partida (`career/career-loop.ts`) saber mostrar isso na tela de partida antes/durante o jogo. Opcional pra não quebrar quem já chama `resolverConfronto` sem essa info. */
  etapa?: string,
): Promise<ResultadoConfrontoMataMata> {
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
    const jogo1 = await resolverPartida(gerarPerfilTime(ratingA, random), gerarPerfilTime(ratingB, random), random, participacaoJogo1, { mandanteId: timeA, visitanteId: timeB, etapa });
    if (participacaoJogo1) partidasDoJogador.push(jogo1);

    // jogo 2: B manda em casa
    const participacaoJogo2 = ehTimeA ? participacaoComoLado(participacaoJogador, "fora") : ehTimeB ? participacaoComoLado(participacaoJogador, "casa") : undefined;
    const jogo2 = await resolverPartida(gerarPerfilTime(ratingB, random), gerarPerfilTime(ratingA, random), random, participacaoJogo2, { mandanteId: timeB, visitanteId: timeA, etapa });
    if (participacaoJogo2) partidasDoJogador.push(jogo2);

    golsA = jogo1.golsCasa + jogo2.golsFora;
    golsB = jogo1.golsFora + jogo2.golsCasa;

    const base = {
      timeA,
      timeB,
      golsA,
      golsB,
      ida: { golsA: jogo1.golsCasa, golsB: jogo1.golsFora },
      volta: { golsA: jogo2.golsFora, golsB: jogo2.golsCasa },
      ...(partidasDoJogador.length > 0 ? { partidasDoJogador } : {}),
    };

    if (golsA > golsB) return { ...base, vencedor: timeA, decididoNosPenaltis: false };
    if (golsB > golsA) return { ...base, vencedor: timeB, decididoNosPenaltis: false };

    const penaltis = simularDisputaDePenaltis(timeA, timeB, ratingA, ratingB, random, participacaoJogador);
    const vencedorIdaVolta = penaltis.golsA > penaltis.golsB ? timeA : timeB;
    return { ...base, vencedor: vencedorIdaVolta, decididoNosPenaltis: true, penaltis };
  } else {
    const participacao = ehTimeA ? participacaoComoLado(participacaoJogador, "casa") : ehTimeB ? participacaoComoLado(participacaoJogador, "fora") : undefined;
    const jogo = await resolverPartida(gerarPerfilTime(ratingA, random), gerarPerfilTime(ratingB, random), random, participacao, { mandanteId: timeA, visitanteId: timeB, etapa });
    if (participacao) partidasDoJogador.push(jogo);
    golsA = jogo.golsCasa;
    golsB = jogo.golsFora;
  }

  const base = { timeA, timeB, golsA, golsB, ...(partidasDoJogador.length > 0 ? { partidasDoJogador } : {}) };

  if (golsA > golsB) return { ...base, vencedor: timeA, decididoNosPenaltis: false };
  if (golsB > golsA) return { ...base, vencedor: timeB, decididoNosPenaltis: false };

  const penaltis = simularDisputaDePenaltis(timeA, timeB, ratingA, ratingB, random, participacaoJogador);
  const vencedor = penaltis.golsA > penaltis.golsB ? timeA : timeB;
  return { ...base, vencedor, decididoNosPenaltis: true, penaltis };
}

export interface ResultadoEtapasMataMata {
  etapas: ResultadoEtapaMataMata[];
}

/**
 * Resolve as etapas de um mata-mata escalonado (`EtapaMataMata[]`, ver
 * `schemas/championship.ts`) — cada etapa soma seus `entrantes` (se
 * houver) aos vencedores que já vinham da etapa anterior, emparelha por
 * força, resolve os confrontos e passa os vencedores adiante. **Não exige
 * terminar com 1 campeão só** — quem terminar com mais de 1 sobrevivente
 * na última etapa (ex: uma "semifinal" isolada, de propósito, pra um
 * `final_estadual` de verdade decidir os últimos dois — ver
 * `simulation/engine.ts` `receitaFaseSuicaMataMataEFinal`/
 * `receitaFaseGruposComPreClassificatorioEMataMata`) lê
 * `etapas[etapas.length-1].vencedores` direto. `simularMataMataComEtapas`
 * (abaixo) é a variante que EXIGE 1 campeão — usada quando o mata-mata
 * decide o título sozinho.
 */
async function resolverEtapasMataMata(
  etapas: EtapaMataMata[],
  ratings: Record<string, number>,
  random: () => number,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  aoResolverConfronto: ((evento: EventoConfrontoMataMata) => void) | undefined,
  resolverPartida: ResolverPartida,
): Promise<ResultadoEtapasMataMata> {
  let vivos: string[] = [];
  const resultadoEtapas: ResultadoEtapaMataMata[] = [];

  for (const etapa of etapas) {
    vivos = [...vivos, ...(etapa.entrantes ?? [])];

    if (vivos.length === 0) {
      resultadoEtapas.push({ nome: etapa.nome, confrontos: [], vencedores: [] });
      continue;
    }

    const pares = emparelharPorForca(vivos, ratings);
    const confrontos: ResultadoConfrontoMataMata[] = [];
    for (const [timeA, timeB] of pares) {
      const confronto = await resolverConfronto(timeA, timeB, ratings, etapa.ida_e_volta, random, participacaoJogador, resolverPartida, etapa.nome);
      aoResolverConfronto?.({ etapa: etapa.nome, confronto });
      confrontos.push(confronto);
    }
    const vencedores = confrontos.map((c) => c.vencedor);

    resultadoEtapas.push({ nome: etapa.nome, confrontos, vencedores });
    vivos = vencedores;
  }

  return { etapas: resultadoEtapas };
}

/** Ver `resolverEtapasMataMata` — variante que NÃO exige terminar com 1 campeão só, pra mata-matas que são só uma etapa de um formato maior. */
export async function simularEtapasMataMataParcial(
  etapas: EtapaMataMata[],
  ratings: Record<string, number>,
  random: () => number = Math.random,
  participacaoJogador?: ParticipacaoJogadorClube,
  aoResolverConfronto?: (evento: EventoConfrontoMataMata) => void,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoEtapasMataMata> {
  return resolverEtapasMataMata(etapas, ratings, random, participacaoJogador, aoResolverConfronto, resolverPartida);
}

/**
 * Simula um mata-mata com entrada escalonada por etapa até sobrar 1 só
 * time (ver `resolverEtapasMataMata` pra semântica de cada etapa). Se o
 * clube do jogador for eliminado no meio do caminho, as etapas seguintes
 * simplesmente não têm `partidasDoJogador`.
 */
export async function simularMataMataComEtapas(
  etapas: EtapaMataMata[],
  ratings: Record<string, number>,
  random: () => number = Math.random,
  participacaoJogador?: ParticipacaoJogadorClube,
  aoResolverConfronto?: (evento: EventoConfrontoMataMata) => void,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoMataMata> {
  const { etapas: resultadoEtapas } = await resolverEtapasMataMata(etapas, ratings, random, participacaoJogador, aoResolverConfronto, resolverPartida);
  const vivos = resultadoEtapas[resultadoEtapas.length - 1]?.vencedores ?? [];

  if (vivos.length !== 1) {
    throw new Error(`simularMataMataComEtapas: terminou com ${vivos.length} times ainda vivos, esperava 1 campeão`);
  }

  return { etapas: resultadoEtapas, campeao: vivos[0] };
}

/** Mata-mata simples: todos os `participantes` entram já na 1ª fase, mesmo `ida_e_volta` em todas as fases. */
export async function simularMataMataSimples(
  participantes: string[],
  fases: string[],
  idaEVolta: boolean,
  ratings: Record<string, number>,
  random: () => number = Math.random,
  participacaoJogador?: ParticipacaoJogadorClube,
  aoResolverConfronto?: (evento: EventoConfrontoMataMata) => void,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoMataMata> {
  const etapas: EtapaMataMata[] = fases.map((nome, indice) => ({
    nome,
    ida_e_volta: idaEVolta,
    entrantes: indice === 0 ? participantes : undefined,
  }));

  return simularMataMataComEtapas(etapas, ratings, random, participacaoJogador, aoResolverConfronto, resolverPartida);
}

/**
 * Atalho que lê direto o bloco `MataMata` do schema: usa `etapas` quando
 * presente (entrada escalonada), senão cai no formato simples com
 * `fases`/`ida_e_volta` + a lista de `participantes` (só necessária nesse
 * segundo caso — `etapas` já traz os entrantes embutidos).
 */
export async function simularMataMataDoFormato(
  formato: MataMata,
  ratings: Record<string, number>,
  participantes: string[] = [],
  random: () => number = Math.random,
  participacaoJogador?: ParticipacaoJogadorClube,
  aoResolverConfronto?: (evento: EventoConfrontoMataMata) => void,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoMataMata> {
  if (formato.etapas) {
    return simularMataMataComEtapas(formato.etapas, ratings, random, participacaoJogador, aoResolverConfronto, resolverPartida);
  }

  return simularMataMataSimples(participantes, formato.fases, formato.ida_e_volta, ratings, random, participacaoJogador, aoResolverConfronto, resolverPartida);
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
export async function simularFinalEstadualDoFormato(
  formato: FinalEstadual,
  participantes: string[],
  ratings: Record<string, number>,
  random: () => number = Math.random,
  participacaoJogador?: ParticipacaoJogadorClube,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoFinalEstadual> {
  if (participantes.length === 1) {
    return { campeao: participantes[0] };
  }

  if (participantes.length !== 2) {
    throw new Error(`simularFinalEstadualDoFormato: esperava 1 ou 2 participantes, recebeu ${participantes.length}`);
  }

  const confronto = await resolverConfronto(participantes[0], participantes[1], ratings, formato.ida_e_volta, random, participacaoJogador, resolverPartida, "final");
  return { campeao: confronto.vencedor, confronto };
}
