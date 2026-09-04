import type { FaseSuica } from "../schemas/championship.js";
import { gerarPerfilTime, simularPartida } from "./match.js";
import { atualizarLinha, linhaVazia, type Confronto, type LinhaTabela } from "./season.js";

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

  for (const pote of potes) {
    for (let i = 0; i < pote.length; i++) {
      for (let j = i + 1; j < pote.length; j++) {
        registrar(pote[i], pote[j]);
      }
    }
  }
  rodadaAtual++;

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
}

export function simularFaseSuica(
  times: string[],
  formato: FaseSuica,
  ratings: Record<string, number>,
  random: () => number = Math.random,
): ResultadoFaseSuica {
  const confrontos = gerarConfrontosFaseSuica(times, formato, random);
  const tabela = new Map<string, LinhaTabela>(times.map((id) => [id, linhaVazia(id)]));

  for (const confronto of confrontos) {
    const perfilMandante = gerarPerfilTime(ratings[confronto.mandante], random);
    const perfilVisitante = gerarPerfilTime(ratings[confronto.visitante], random);
    const resultado = simularPartida(perfilMandante, perfilVisitante, random);

    atualizarLinha(tabela.get(confronto.mandante)!, resultado.golsCasa, resultado.golsFora);
    atualizarLinha(tabela.get(confronto.visitante)!, resultado.golsFora, resultado.golsCasa);
  }

  const tabelaOrdenada = [...tabela.values()].sort(
    (a, b) => b.pontos - a.pontos || b.saldoDeGols - a.saldoDeGols || b.golsPro - a.golsPro,
  );

  return {
    confrontos,
    tabela: tabelaOrdenada,
    classificados: tabelaOrdenada.slice(0, formato.classificam_mata_mata).map((linha) => linha.clubeId),
  };
}
