import { gerarPerfilTime, simularPartida } from "./match.js";

/**
 * Confrontos e tabela de uma temporada de pontos corridos — o formato mais
 * simples que já modelamos de verdade (`formato.pontos_corridos`, ver
 * `src/schemas/championship.ts`). Formatos com fase de grupos/mata-mata
 * ainda não têm gerador de confronto — ver TODO em `engine.ts`.
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

export interface ResultadoTemporadaPontosCorridos {
  confrontos: Confronto[];
  /** Ordenada por pontos, saldo de gols, gols pró — mesmo critério clássico de desempate. */
  tabela: LinhaTabela[];
}

function linhaVazia(clubeId: string): LinhaTabela {
  return { clubeId, pontos: 0, jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, saldoDeGols: 0 };
}

function atualizarLinha(linha: LinhaTabela, golsFeitos: number, golsSofridos: number): void {
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

/**
 * Simula uma temporada inteira de pontos corridos (Camada 1 — nenhum time é
 * o do jogador; pra incluir o clube do jogador, resolva as partidas dele à
 * parte com `ParticipacaoJogador` e substitua o resultado antes de montar a
 * tabela). `ratings` precisa ter uma entrada por clube em `times` — ver
 * `obterRating` em `simulation/rating.ts`.
 */
export function simularTemporadaPontosCorridos(
  times: string[],
  ratings: Record<string, number>,
  idaEVolta: boolean,
  random: () => number = Math.random,
): ResultadoTemporadaPontosCorridos {
  const confrontos = gerarConfrontosPontosCorridos(times, idaEVolta);
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

  return { confrontos, tabela: tabelaOrdenada };
}
