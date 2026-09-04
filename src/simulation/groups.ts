import type { FaseGrupos } from "../schemas/championship.js";
import type { Confronto, LinhaTabela } from "./season.js";
import { simularTemporadaPontosCorridos } from "./season.js";

/**
 * Gerador/simulador de fase de grupos (`formato.fase_grupos`, ver
 * `schemas/championship.ts`) — usado por Libertadores/Sul-Americana (8×4),
 * Mineiro Módulo II, Venezuela, Peru Liga 2, etc. Cada grupo é uma mini
 * temporada de pontos corridos, então reaproveita `season.ts` internamente.
 */

export interface Grupo {
  nome: string;
  times: string[];
}

function nomeDoGrupo(indice: number): string {
  return `Grupo ${String.fromCharCode(65 + indice)}`; // A, B, C, ...
}

/**
 * Divide os times em grupos por sorteio de potes (método serpentina/snake:
 * 1º melhor rating vai pro grupo A, 2º pro B, ..., o último pote inverte o
 * sentido) — evita que os times mais fortes caiam todos no mesmo grupo por
 * acaso, mesma lógica de um sorteio real com potes por ranking.
 */
export function dividirEmGruposPorForca(times: string[], numGrupos: number, ratings: Record<string, number>): Grupo[] {
  const ordenados = [...times].sort((a, b) => (ratings[b] ?? 0) - (ratings[a] ?? 0));
  const grupos: Grupo[] = Array.from({ length: numGrupos }, (_, i) => ({ nome: nomeDoGrupo(i), times: [] as string[] }));

  ordenados.forEach((time, indice) => {
    const ciclo = indice % (numGrupos * 2);
    const indiceGrupo = ciclo < numGrupos ? ciclo : numGrupos * 2 - 1 - ciclo;
    grupos[indiceGrupo].times.push(time);
  });

  return grupos;
}

/** Divide os times em grupos na ordem em que já vêm na lista (sem reordenar por força) — útil quando o sorteio real já é conhecido. */
export function dividirEmGruposSequencial(times: string[], numGrupos: number): Grupo[] {
  const timesPorGrupo = Math.ceil(times.length / numGrupos);
  return Array.from({ length: numGrupos }, (_, i) => ({
    nome: nomeDoGrupo(i),
    times: times.slice(i * timesPorGrupo, (i + 1) * timesPorGrupo),
  }));
}

export interface ResultadoGrupo {
  nome: string;
  confrontos: Confronto[];
  tabela: LinhaTabela[];
  /** Times classificados desse grupo, na ordem da tabela (1º colocado primeiro). */
  classificados: string[];
}

export interface ResultadoFaseDeGrupos {
  grupos: ResultadoGrupo[];
  /** União dos classificados de todos os grupos, agrupados por grupo (não misturados por posição geral entre grupos). */
  classificados: string[];
}

/** Simula todos os grupos (cada um como uma mini temporada de pontos corridos) e extrai os classificados de cada um. */
export function simularFaseDeGrupos(
  grupos: Grupo[],
  ratings: Record<string, number>,
  idaEVolta: boolean,
  classificamPorGrupo: number,
  random: () => number = Math.random,
): ResultadoFaseDeGrupos {
  const resultados: ResultadoGrupo[] = grupos.map((grupo) => {
    const { confrontos, tabela } = simularTemporadaPontosCorridos(grupo.times, ratings, idaEVolta, random);
    const classificados = tabela.slice(0, classificamPorGrupo).map((linha) => linha.clubeId);
    return { nome: grupo.nome, confrontos, tabela, classificados };
  });

  return {
    grupos: resultados,
    classificados: resultados.flatMap((grupo) => grupo.classificados),
  };
}

/**
 * Atalho que já lê `num_grupos`/`times_por_grupo`/`ida_e_volta`/
 * `classificam_por_grupo` direto do bloco `FaseGrupos` do schema — usa
 * sorteio por força (`dividirEmGruposPorForca`). `times` precisa ter
 * exatamente `num_grupos × times_por_grupo` elementos: quem entra na fase
 * de grupos, sem os times de fase preliminar (ver `formato.mata_mata.etapas`
 * quando a competição tem entrada escalonada, como Libertadores/Sul-Americana).
 */
export function simularFaseDeGruposDoFormato(
  formato: FaseGrupos,
  times: string[],
  ratings: Record<string, number>,
  random: () => number = Math.random,
): ResultadoFaseDeGrupos {
  const esperado = formato.num_grupos * formato.times_por_grupo;
  if (times.length !== esperado) {
    throw new Error(
      `simularFaseDeGruposDoFormato: esperava ${esperado} times (${formato.num_grupos} grupos de ${formato.times_por_grupo}), recebeu ${times.length}`,
    );
  }

  const grupos = dividirEmGruposPorForca(times, formato.num_grupos, ratings);
  return simularFaseDeGrupos(grupos, ratings, formato.ida_e_volta, formato.classificam_por_grupo, random);
}
