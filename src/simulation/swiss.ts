import type { FaseSuica } from "../schemas/championship.js";
import { resolverPartidaPadrao, participacaoNoConfronto, gerarPerfilTime, type ParticipacaoJogadorClube, type ResolverPartida } from "./match.js";
import { atualizarLinha, linhaVazia, type Confronto, type LinhaTabela, type PartidaDoJogador } from "./season.js";

/**
 * Gerador/simulador de fase suíça (`formato.fase_suica`, ver `schemas/championship.ts`) — usada por
 * Paulistão A1, Mineiro, Gauchão e Paraense: times divididos em potes/grupos, cada time joga
 * EXATAMENTE UMA VEZ contra cada time de OUTRO pote, nunca contra time do próprio pote (confirmado
 * por fonte — Wikipédia/CNN/Lance — pra edição 2025 de cada uma; ver `docs/dados-a-verificar.md`
 * pras ressalvas específicas de cada competição, ex: Troféu Farroupilha do Gauchão não modelado).
 * `jogos_por_time` é sempre `total_times - times_por_pote` (todos os times de fora do próprio pote).
 */

/** Pote 1 = primeiros `times_por_pote` times da lista recebida, etc. — quem monta os potes por força/sorteio real é responsabilidade de quem chama. */
function dividirEmPotes(times: string[], numPotes: number, timesPorPote: number): string[][] {
  return Array.from({ length: numPotes }, (_, i) => times.slice(i * timesPorPote, (i + 1) * timesPorPote));
}

/** Mesma convenção de `dividirEmPotes` — usado por quem precisa saber o pote de cada time fora deste módulo (ex: `incremental.ts`, pra aplicar `classificacao_por_pote` na tabela geral já calculada). */
export function construirPotePorTime(times: string[], numPotes: number, timesPorPote: number): Map<string, number> {
  const potes = dividirEmPotes(times, numPotes, timesPorPote);
  return new Map(potes.flatMap((pote, indice) => pote.map((time) => [time, indice] as const)));
}

/**
 * Emparelhamento MÁXIMO exato num grafo geral, via backtracking com poda (grafos pequenos aqui —
 * no máximo poucas dezenas de times — então busca exaustiva é instantânea). Precisa ser MÁXIMO (não
 * só "algum" emparelhamento válido) pra fechar no número mínimo de rodadas: um emparelhamento guloso
 * comum (primeiro-que-serve) pode deixar times "encalhados" numa rodada e sobrar rodadas extras com
 * poucos jogos — verificado empiricamente (script de validação) que só a busca máxima exata fecha
 * exatamente em `times - times_por_pote` rodadas pros formatos reais (4 potes de 4, 3 potes de 4, 2
 * potes de 6).
 */
function encontrarEmparelhamentoMaximo(vertices: string[], arestasPermitidas: Map<string, Set<string>>): [string, string][] {
  let melhor: [string, string][] = [];

  function grauRestante(v: string, restantes: string[]): number {
    const arestas = arestasPermitidas.get(v)!;
    let grau = 0;
    for (const u of restantes) if (u !== v && arestas.has(u)) grau++;
    return grau;
  }

  function dfs(restantes: string[], atual: [string, string][]): void {
    const limiteSuperior = atual.length + Math.floor(restantes.length / 2);
    if (limiteSuperior <= melhor.length) return;
    if (restantes.length === 0) {
      if (atual.length > melhor.length) melhor = [...atual];
      return;
    }

    let v = restantes[0];
    let menorGrau = Infinity;
    for (const candidato of restantes) {
      const grau = grauRestante(candidato, restantes);
      if (grau < menorGrau) {
        menorGrau = grau;
        v = candidato;
      }
    }

    const arestasDeV = arestasPermitidas.get(v)!;
    const candidatos = restantes.filter((u) => u !== v && arestasDeV.has(u));

    if (candidatos.length > 0) {
      for (const c of candidatos) {
        const proximosRestantes = restantes.filter((x) => x !== v && x !== c);
        atual.push([v, c]);
        dfs(proximosRestantes, atual);
        atual.pop();
      }
    }
    // também considera deixar v de fora dessa rodada (necessário pra corretude — pode ser ótimo)
    dfs(
      restantes.filter((x) => x !== v),
      atual,
    );
  }

  dfs(vertices, []);
  return melhor;
}

/**
 * Gera as rodadas de confrontos cruzados: repete emparelhamento máximo sobre as arestas restantes
 * até esgotar todos os pares cruzados possíveis. Cada rodada resultante já garante 1 jogo por time
 * (nunca 2 no mesmo time na mesma rodada), por construção do emparelhamento.
 */
function gerarRodadasCruzadas(times: string[], potePorTime: Map<string, number>): [string, string][][] {
  const arestas = new Map<string, Set<string>>(times.map((t) => [t, new Set<string>()]));
  for (let i = 0; i < times.length; i++) {
    for (let j = i + 1; j < times.length; j++) {
      if (potePorTime.get(times[i]) !== potePorTime.get(times[j])) {
        arestas.get(times[i])!.add(times[j]);
        arestas.get(times[j])!.add(times[i]);
      }
    }
  }

  const rodadas: [string, string][][] = [];
  let salvaguarda = 0;
  while ([...arestas.values()].some((s) => s.size > 0)) {
    if (++salvaguarda > 1000) throw new Error("gerarRodadasCruzadas: loop além do esperado — grafo não deveria precisar de tantas rodadas");
    const vertices = times.filter((t) => arestas.get(t)!.size > 0);
    const emparelhamento = encontrarEmparelhamentoMaximo(vertices, arestas);
    if (emparelhamento.length === 0) throw new Error("gerarRodadasCruzadas: não conseguiu progredir — sobrou aresta sem emparelhamento possível");
    rodadas.push(emparelhamento);
    for (const [a, b] of emparelhamento) {
      arestas.get(a)!.delete(b);
      arestas.get(b)!.delete(a);
    }
  }
  return rodadas;
}

/** Exportado pra `incremental.ts` reaproveitar o mesmo Fisher-Yates (embaralhar `campeonato.times` antes de gerar calendário de pontos corridos/turno — ver `construirPassos`). */
export function embaralhar<T>(lista: T[], random: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Gera os confrontos da fase suíça: cada time joga exatamente 1x contra cada time de fora do
 * próprio pote (nunca contra time do próprio pote) — `jogos_por_time` deve bater com
 * `total_times - times_por_pote`, validado abaixo.
 */
export function gerarConfrontosFaseSuica(times: string[], formato: FaseSuica, random: () => number = Math.random): Confronto[] {
  const { num_potes, times_por_pote, jogos_por_time } = formato;
  const esperado = num_potes * times_por_pote;
  if (times.length !== esperado) {
    throw new Error(
      `gerarConfrontosFaseSuica: esperava ${esperado} times (${num_potes} potes de ${times_por_pote}), recebeu ${times.length}`,
    );
  }

  const jogosCruzadosEsperados = esperado - times_por_pote;
  if (jogos_por_time !== jogosCruzadosEsperados) {
    throw new Error(
      `gerarConfrontosFaseSuica: jogos_por_time (${jogos_por_time}) deveria ser ${jogosCruzadosEsperados} (todos os times de fora do próprio pote, jogo cruzado único)`,
    );
  }

  const potePorTime = construirPotePorTime(times, num_potes, times_por_pote);

  const rodadasDeConfrontos = gerarRodadasCruzadas(times, potePorTime);
  const confrontos: Confronto[] = [];
  rodadasDeConfrontos.forEach((rodada, indiceRodada) => {
    for (const [a, b] of embaralhar(rodada, random)) {
      const [mandante, visitante] = random() < 0.5 ? [a, b] : [b, a];
      confrontos.push({ mandante, visitante, rodada: indiceRodada + 1 });
    }
  });

  return confrontos;
}

/**
 * Aplica a regra de classificação: por padrão, top-N simples da tabela geral (`classificam_mata_mata`,
 * ex: Paraense real). Quando `classificacao_por_pote` está presente, primeiro garante `vagas_por_pote`
 * times de CADA pote (na ordem da tabela geral, restrito aos times daquele pote), depois preenche
 * `vagas_extras_melhor_geral` vagas extras com os melhores da tabela geral ainda não classificados
 * (ex: Mineiro/Gauchão reais: líder de cada grupo + melhor 2º colocado geral).
 */
export function selecionarClassificadosFaseSuica(
  tabelaOrdenada: LinhaTabela[],
  potePorTime: Map<string, number>,
  formato: Pick<FaseSuica, "classificam_mata_mata" | "classificacao_por_pote">,
): string[] {
  const regra = formato.classificacao_por_pote;
  if (!regra) return tabelaOrdenada.slice(0, formato.classificam_mata_mata).map((linha) => linha.clubeId);

  const classificados: string[] = [];
  const vagasUsadasPorPote = new Map<number, number>();

  for (const linha of tabelaOrdenada) {
    const pote = potePorTime.get(linha.clubeId);
    if (pote === undefined) continue;
    const usadas = vagasUsadasPorPote.get(pote) ?? 0;
    if (usadas < regra.vagas_por_pote) {
      classificados.push(linha.clubeId);
      vagasUsadasPorPote.set(pote, usadas + 1);
    }
  }

  if (regra.vagas_extras_melhor_geral > 0) {
    const jaClassificados = new Set(classificados);
    let extrasPreenchidas = 0;
    for (const linha of tabelaOrdenada) {
      if (extrasPreenchidas >= regra.vagas_extras_melhor_geral) break;
      if (jaClassificados.has(linha.clubeId)) continue;
      classificados.push(linha.clubeId);
      jaClassificados.add(linha.clubeId);
      extrasPreenchidas++;
    }
  }

  return classificados;
}

export interface ResultadoFaseSuica {
  confrontos: Confronto[];
  tabela: LinhaTabela[];
  /** Times classificados pro mata-mata — respeita `classificacao_por_pote` quando presente. */
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

  const potePorTime = construirPotePorTime(times, formato.num_potes, formato.times_por_pote);

  return {
    confrontos,
    tabela: tabelaOrdenada,
    classificados: selecionarClassificadosFaseSuica(tabelaOrdenada, potePorTime, formato),
    ...(participacaoJogador ? { partidasDoJogador } : {}),
  };
}
