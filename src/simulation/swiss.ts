import type { FaseSuica } from "../schemas/championship.js";
import { resolverPartidaPadrao, participacaoNoConfronto, gerarPerfilTime, type ParticipacaoJogadorClube, type ResolverPartida } from "./match.js";
import { atualizarLinha, linhaVazia, type Confronto, type LinhaTabela, type PartidaDoJogador } from "./season.js";

/**
 * Gerador/simulador de fase suíça (`formato.fase_suica`, ver
 * `schemas/championship.ts`) — hoje só usada pelo Paulistão A1 (16 times em
 * 4 potes de 4, turno único, cada time joga 9 dos outros 15, não todos-
 * contra-todos). **O pareamento exato fora do próprio pote não é
 * confirmado por fonte** (ver `docs/dados-a-verificar.md`) — esta
 * implementação garante rodízio completo DENTRO do pote (isso, sim, é
 * conhecido: `times_por_pote - 1` jogos) e distribui os jogos restantes por
 * sorteio entre times de potes diferentes, evitando repetir adversário. É
 * uma aproximação assumida, não o algoritmo real de pareamento da
 * federação — mesma classe de aproximação já usada no sorteio de grupos
 * (`groups.ts`) e no emparelhamento do mata-mata (`knockout.ts`).
 */

function embaralhar<T>(lista: T[], random: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function chaveDoConfronto(a: string, b: string): string {
  return [a, b].sort().join("|");
}

/**
 * Rodízio completo de verdade (método do círculo) — cada time joga contra
 * todos os outros exatamente 1x, distribuído em rodadas reais (1 jogo por
 * time por rodada, nunca 2 no mesmo time na mesma rodada). Corrige um bug
 * real: a versão anterior gerava todos os `n*(n-1)/2` jogos do rodízio
 * dentro do pote de uma vez, todos rotulados como "1 rodada só" — um time
 * podia jogar 3x enquanto outro (de outro pote, também "rodada 1") não
 * tinha entrado ainda, e a tela mostrava "Rodada 1" com times desbalanceados
 * (reportado pelo usuário: Cruzeiro com 3 jogos, Itabirito com 0, ambos
 * ainda "rodada 1" do Campeonato Mineiro - Módulo I). Com número ÍMPAR de
 * times, usa um "bye" (turno de descanso) por rodada — mais rodadas (`n`
 * em vez de `n-1`), mas cada time ainda joga exatamente `n-1` partidas no
 * total. Times por pote nos dados atuais são sempre pares, mas a função
 * fica correta pro caso ímpar também.
 */
function gerarRodadasDeRodizio(times: string[]): [string, string][][] {
  const impar = times.length % 2 !== 0;
  const lista = impar ? [...times, null] : [...times];
  const n = lista.length;
  const fixo = lista[0];
  let resto = lista.slice(1);
  const rodadas: [string, string][][] = [];

  for (let r = 0; r < n - 1; r++) {
    const atual = [fixo, ...resto];
    const pares: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = atual[i];
      const b = atual[n - 1 - i];
      if (a !== null && b !== null) pares.push([a, b]);
    }
    rodadas.push(pares);
    resto = [resto[resto.length - 1], ...resto.slice(0, resto.length - 1)];
  }

  return rodadas;
}

/** Pote 1 = primeiros `times_por_pote` times da lista recebida, etc. — quem monta os potes por força/sorteio real é responsabilidade de quem chama. */
function dividirEmPotes(times: string[], numPotes: number, timesPorPote: number): string[][] {
  return Array.from({ length: numPotes }, (_, i) => times.slice(i * timesPorPote, (i + 1) * timesPorPote));
}

/**
 * Gera os confrontos da fase suíça: rodízio completo dentro do próprio pote
 * primeiro, depois jogos cruzados entre potes diferentes (sorteados por
 * rodada, sem repetir adversário) até chegar em `jogos_por_time`. Pode
 * deixar algum time com menos jogos que `jogos_por_time` se o sorteio de
 * uma rodada não achar adversário válido pra ele — caso raro, aceitável
 * dado que o algoritmo real de pareamento não é conhecido.
 */
export function gerarConfrontosFaseSuica(times: string[], formato: FaseSuica, random: () => number = Math.random): Confronto[] {
  const { num_potes, times_por_pote, jogos_por_time } = formato;
  const esperado = num_potes * times_por_pote;
  if (times.length !== esperado) {
    throw new Error(
      `gerarConfrontosFaseSuica: esperava ${esperado} times (${num_potes} potes de ${times_por_pote}), recebeu ${times.length}`,
    );
  }

  const jogosDentroDoPote = times_por_pote - 1;
  const jogosForaDoPote = jogos_por_time - jogosDentroDoPote;
  if (jogosForaDoPote < 0) {
    throw new Error(
      `gerarConfrontosFaseSuica: jogos_por_time (${jogos_por_time}) é menor que os ${jogosDentroDoPote} jogos garantidos dentro do próprio pote`,
    );
  }

  const potes = dividirEmPotes(times, num_potes, times_por_pote);
  const potePorTime = new Map(potes.flatMap((pote, indice) => pote.map((time) => [time, indice] as const)));

  const jaJogaram = new Set<string>();
  const confrontos: Confronto[] = [];
  let rodadaAtual = 1;

  function registrar(a: string, b: string): void {
    const [mandante, visitante] = random() < 0.5 ? [a, b] : [b, a];
    confrontos.push({ mandante, visitante, rodada: rodadaAtual });
    jaJogaram.add(chaveDoConfronto(a, b));
  }

  // Rodízio completo dentro de cada pote, intercalado por rodada real (a rodada 1 de TODOS os
  // potes acontece "ao mesmo tempo", não pote por pote) — ver `gerarRodadasDeRodizio`.
  const rodadasPorPote = potes.map((pote) => gerarRodadasDeRodizio(pote));
  const numRodadasDentroDoPote = Math.max(0, ...rodadasPorPote.map((rodadas) => rodadas.length));
  for (let r = 0; r < numRodadasDentroDoPote; r++) {
    for (const rodadasDoPote of rodadasPorPote) {
      for (const [a, b] of rodadasDoPote[r] ?? []) registrar(a, b);
    }
    rodadaAtual++;
  }

  for (let rodadaCruzada = 0; rodadaCruzada < jogosForaDoPote; rodadaCruzada++) {
    const disponiveis = embaralhar(times, random);
    const usadosNaRodada = new Set<string>();

    for (const time of disponiveis) {
      if (usadosNaRodada.has(time)) continue;

      const candidato = disponiveis.find(
        (outro) =>
          outro !== time &&
          !usadosNaRodada.has(outro) &&
          potePorTime.get(outro) !== potePorTime.get(time) &&
          !jaJogaram.has(chaveDoConfronto(time, outro)),
      );

      if (candidato) {
        registrar(time, candidato);
        usadosNaRodada.add(time);
        usadosNaRodada.add(candidato);
      }
    }

    rodadaAtual++;
  }

  return confrontos;
}

export interface ResultadoFaseSuica {
  confrontos: Confronto[];
  tabela: LinhaTabela[];
  /** Top `classificam_mata_mata` da tabela. */
  classificados: string[];
  /** Só presente quando `participacaoJogador` foi passado — uma entrada por partida do clube dele. */
  partidasDoJogador?: PartidaDoJogador[];
}

export async function simularFaseSuica(
  times: string[],
  formato: FaseSuica,
  ratings: Record<string, number>,
  random: () => number = Math.random,
  participacaoJogador?: ParticipacaoJogadorClube,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoFaseSuica> {
  const confrontos = gerarConfrontosFaseSuica(times, formato, random);
  const tabela = new Map<string, LinhaTabela>(times.map((id) => [id, linhaVazia(id)]));
  const partidasDoJogador: PartidaDoJogador[] = [];

  for (const confronto of confrontos) {
    const perfilMandante = gerarPerfilTime(ratings[confronto.mandante], random);
    const perfilVisitante = gerarPerfilTime(ratings[confronto.visitante], random);
    const participacao = participacaoNoConfronto(participacaoJogador, confronto.mandante, confronto.visitante);
    const resultado = await resolverPartida(perfilMandante, perfilVisitante, random, participacao, { mandanteId: confronto.mandante, visitanteId: confronto.visitante });

    atualizarLinha(tabela.get(confronto.mandante)!, resultado.golsCasa, resultado.golsFora);
    atualizarLinha(tabela.get(confronto.visitante)!, resultado.golsFora, resultado.golsCasa);

    if (participacao) partidasDoJogador.push({ confronto, resultado });
  }

  const tabelaOrdenada = [...tabela.values()].sort(
    (a, b) => b.pontos - a.pontos || b.saldoDeGols - a.saldoDeGols || b.golsPro - a.golsPro,
  );

  return {
    confrontos,
    tabela: tabelaOrdenada,
    classificados: tabelaOrdenada.slice(0, formato.classificam_mata_mata).map((linha) => linha.clubeId),
    ...(participacaoJogador ? { partidasDoJogador } : {}),
  };
}
