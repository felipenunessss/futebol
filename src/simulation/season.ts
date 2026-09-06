import type { FaseUnica } from "../schemas/championship.js";
import { gerarPerfilTime, participacaoNoConfronto, resolverPartidaPadrao, type ParticipacaoJogadorClube, type ResolverPartida, type ResultadoPartida } from "./match.js";

/**
 * Confrontos e tabela de uma temporada de pontos corridos — o formato mais
 * simples que já modelamos de verdade (`formato.pontos_corridos`, ver
 * `src/schemas/championship.ts`), reaproveitado também por `turno`/`returno`
 * (`FaseUnica`, ver `simularFaseUnicaDoFormato` mais abaixo) — Apertura e
 * Clausura são, na prática, cada um uma mini temporada de pontos corridos
 * entre todos os times da competição.
 */

export interface Confronto {
  mandante: string; // Club.id
  visitante: string; // Club.id
  rodada: number;
}

/**
 * Gera o calendário de pontos corridos pelo método do círculo (um time fixo,
 * os demais rotacionam a cada rodada). Com número ímpar de times, insere um
 * "BYE" fantasma pra fechar a rotação — quem cai contra ele folga na rodada.
 */
export function gerarConfrontosPontosCorridos(times: string[], idaEVolta: boolean): Confronto[] {
  if (times.length < 2) return [];

  const BYE = "__bye__";
  const lista = times.length % 2 === 0 ? [...times] : [...times, BYE];

  const numTimes = lista.length;
  const numRodadasTurno = numTimes - 1;
  const confrontos: Confronto[] = [];

  const fixo = lista[0];
  let rotativo = lista.slice(1);

  for (let rodada = 1; rodada <= numRodadasTurno; rodada++) {
    const rodadaTimes = [fixo, ...rotativo];
    for (let i = 0; i < numTimes / 2; i++) {
      const timeA = rodadaTimes[i];
      const timeB = rodadaTimes[numTimes - 1 - i];
      if (timeA === BYE || timeB === BYE) continue;

      // alterna quem manda o jogo a cada rodada, pra não travar sempre o mesmo lado como mandante
      const [mandante, visitante] = rodada % 2 === 0 ? [timeB, timeA] : [timeA, timeB];
      confrontos.push({ mandante, visitante, rodada });
    }
    rotativo = [rotativo[rotativo.length - 1], ...rotativo.slice(0, -1)];
  }

  if (idaEVolta) {
    const returno = confrontos.map((c) => ({ mandante: c.visitante, visitante: c.mandante, rodada: c.rodada + numRodadasTurno }));
    confrontos.push(...returno);
  }

  return confrontos;
}

export interface LinhaTabela {
  clubeId: string;
  pontos: number;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldoDeGols: number;
}

export interface PartidaDoJogador {
  confronto: Confronto;
  resultado: ResultadoPartida;
}

/**
 * Evento emitido a cada confronto simulado (`aoSimularConfronto`) — dá
 * pra mostrar o jogo a jogo em tempo real (ex: CLI interativa) sem
 * esperar a temporada inteira terminar. `tabelaAntes`/`tabelaDepois` são
 * cópias (não a mesma referência mutável usada internamente), seguras
 * pra guardar/exibir sem se preocupar com mutação posterior.
 */
export interface EventoConfrontoPontosCorridos {
  confronto: Confronto;
  resultado: ResultadoPartida;
  tabelaAntes: LinhaTabela[];
  tabelaDepois: LinhaTabela[];
}

export interface ResultadoTemporadaPontosCorridos {
  confrontos: Confronto[];
  /** Ordenada por pontos, saldo de gols, gols pró — mesmo critério clássico de desempate. */
  tabela: LinhaTabela[];
  /** Só presente quando `participacaoJogador` foi passado — uma entrada por partida do clube dele, na ordem em que aconteceram. */
  partidasDoJogador?: PartidaDoJogador[];
}

/** Exportado pra outros geradores de confronto (ex: `swiss.ts`) montarem tabela sem duplicar essa lógica. */
export function linhaVazia(clubeId: string): LinhaTabela {
  return { clubeId, pontos: 0, jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, saldoDeGols: 0 };
}

/** Exportado pelo mesmo motivo que `linhaVazia`. */
export function atualizarLinha(linha: LinhaTabela, golsFeitos: number, golsSofridos: number): void {
  linha.jogos++;
  linha.golsPro += golsFeitos;
  linha.golsContra += golsSofridos;
  linha.saldoDeGols = linha.golsPro - linha.golsContra;

  if (golsFeitos > golsSofridos) {
    linha.vitorias++;
    linha.pontos += 3;
  } else if (golsFeitos === golsSofridos) {
    linha.empates++;
    linha.pontos += 1;
  } else {
    linha.derrotas++;
  }
}

function ordenarTabela(tabela: LinhaTabela[]): LinhaTabela[] {
  return [...tabela].sort((a, b) => b.pontos - a.pontos || b.saldoDeGols - a.saldoDeGols || b.golsPro - a.golsPro);
}

/**
 * Simula uma temporada inteira de pontos corridos. Se `participacaoJogador`
 * for passado, as partidas do clube dele usam `ParticipacaoJogador` (Camada
 * 2 — chance individual resolvida por atributo) em vez do duelo agregado;
 * o resto da temporada continua Camada 1. `ratings` precisa ter uma
 * entrada por clube em `times` — ver `obterRating` em `simulation/rating.ts`.
 *
 * `aoSimularConfronto`, se passado, é chamado depois de cada confronto ser
 * resolvido (na ordem em que `confrontos` já vem, que é ordem de rodada),
 * com a tabela antes/depois desse confronto específico — dá pra mostrar o
 * jogo a jogo em tempo real. As cópias só são feitas quando esse callback
 * é passado (sem custo extra quando ninguém precisa disso).
 *
 * `resolverPartida` (padrão `resolverPartidaPadrao`, síncrono) decide como
 * cada confronto é resolvido — quem passa um resolvedor assíncrono (ex:
 * `simulation/live-match.ts`, via `career/career-loop.ts`) consegue pausar
 * a simulação de uma partida específica pra decisão real do jogador sem
 * essa função (ou quem chama ela) precisar saber disso: é por isso que ela
 * é `async` agora, mesmo continuando 100% síncrona no caminho padrão.
 */
export async function simularTemporadaPontosCorridos(
  times: string[],
  ratings: Record<string, number>,
  idaEVolta: boolean,
  random: () => number = Math.random,
  participacaoJogador?: ParticipacaoJogadorClube,
  aoSimularConfronto?: (evento: EventoConfrontoPontosCorridos) => void,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoTemporadaPontosCorridos> {
  const confrontos = gerarConfrontosPontosCorridos(times, idaEVolta);
  const tabela = new Map<string, LinhaTabela>(times.map((id) => [id, linhaVazia(id)]));
  const partidasDoJogador: PartidaDoJogador[] = [];

  for (const confronto of confrontos) {
    const perfilMandante = gerarPerfilTime(ratings[confronto.mandante], random);
    const perfilVisitante = gerarPerfilTime(ratings[confronto.visitante], random);
    const participacao = participacaoNoConfronto(participacaoJogador, confronto.mandante, confronto.visitante);
    const resultado = await resolverPartida(perfilMandante, perfilVisitante, random, participacao, { mandanteId: confronto.mandante, visitanteId: confronto.visitante });

    const tabelaAntes = aoSimularConfronto ? ordenarTabela([...tabela.values()].map((linha) => ({ ...linha }))) : undefined;

    atualizarLinha(tabela.get(confronto.mandante)!, resultado.golsCasa, resultado.golsFora);
    atualizarLinha(tabela.get(confronto.visitante)!, resultado.golsFora, resultado.golsCasa);

    if (aoSimularConfronto) {
      const tabelaDepois = ordenarTabela([...tabela.values()].map((linha) => ({ ...linha })));
      aoSimularConfronto({ confronto, resultado, tabelaAntes: tabelaAntes!, tabelaDepois });
    }

    if (participacao) partidasDoJogador.push({ confronto, resultado });
  }

  return {
    confrontos,
    tabela: ordenarTabela([...tabela.values()]),
    ...(participacaoJogador ? { partidasDoJogador } : {}),
  };
}

export interface ResultadoFaseUnica extends ResultadoTemporadaPontosCorridos {
  /** Top `classificam_proxima_fase` da tabela DESSE torneio (não da tabela acumulada — some com `somarTabelas` se precisar da acumulada). */
  classificados: string[];
}

/**
 * Simula um `turno` ou `returno` (Apertura/Clausura, ver `FaseUnica` em
 * `schemas/championship.ts`) — é a mesma mecânica de `pontos_corridos`, só
 * que rodando entre todos os times da competição pra decidir quem classifica
 * a partir dessa fase específica (`classificam_proxima_fase`), não pra
 * decidir campeão sozinho.
 */
export async function simularFaseUnicaDoFormato(
  formato: FaseUnica,
  times: string[],
  ratings: Record<string, number>,
  random: () => number = Math.random,
  participacaoJogador?: ParticipacaoJogadorClube,
  aoSimularConfronto?: (evento: EventoConfrontoPontosCorridos) => void,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoFaseUnica> {
  const { confrontos, tabela, partidasDoJogador } = await simularTemporadaPontosCorridos(times, ratings, formato.ida_e_volta, random, participacaoJogador, aoSimularConfronto, resolverPartida);
  const classificados = tabela.slice(0, formato.classificam_proxima_fase).map((linha) => linha.clubeId);

  return { confrontos, tabela, classificados, ...(partidasDoJogador ? { partidasDoJogador } : {}) };
}

/**
 * Soma várias tabelas (ex: turno + returno) numa tabela acumulada só —
 * cobre o padrão "soma dos pontos de Apertura e Clausura" que aparece no
 * `tabela_acumulada.criterio` (texto livre) de quase todo país CONMEBOL
 * modelado. Não tenta interpretar o texto do critério — só soma; se o
 * critério real for outra coisa (ex: média em vez de soma), não serve.
 */
export function somarTabelas(tabelas: LinhaTabela[][]): LinhaTabela[] {
  const acumulado = new Map<string, LinhaTabela>();

  for (const tabela of tabelas) {
    for (const linha of tabela) {
      const atual = acumulado.get(linha.clubeId) ?? linhaVazia(linha.clubeId);
      atual.pontos += linha.pontos;
      atual.jogos += linha.jogos;
      atual.vitorias += linha.vitorias;
      atual.empates += linha.empates;
      atual.derrotas += linha.derrotas;
      atual.golsPro += linha.golsPro;
      atual.golsContra += linha.golsContra;
      atual.saldoDeGols = atual.golsPro - atual.golsContra;
      acumulado.set(linha.clubeId, atual);
    }
  }

  return [...acumulado.values()].sort(
    (a, b) => b.pontos - a.pontos || b.saldoDeGols - a.saldoDeGols || b.golsPro - a.golsPro,
  );
}
