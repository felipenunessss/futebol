import type { FormatoEstadual } from "../schemas/championship.js";
import type { Club } from "../schemas/club.js";
import { construirCalendarioPadrao } from "../data/loaders/calendario.js";
import { simularFaseDeGruposDoFormato } from "./groups.js";
import { simularMataMataDoFormato, simularMataMataSimples } from "./knockout.js";
import type { ParticipacaoJogadorClube, ResultadoPartida } from "./match.js";
import { obterRating } from "./rating.js";
import { simularTemporadaPontosCorridos } from "./season.js";

/**
 * Loop de calendário — percorre o calendário mestre de uma temporada
 * (`data/loaders/calendario.ts`) e simula cada competição ativa.
 *
 * **Limitação real, não escondida**: muitos campeonatos combinam blocos de
 * formato (`turno`+`returno`+`tabela_acumulada`/`final_estadual` reaproveitado,
 * etc) de um jeito que só dá pra simular corretamente sabendo o significado
 * específico daquele campeonato — o `criterio` desses blocos é texto livre
 * (ver `docs/dados-a-verificar.md`), não dá pra interpretar de forma
 * genérica e seguro. Este motor só despacha automaticamente as 3
 * combinações de blocos **estruturalmente inambíguas**:
 *
 * - só `pontos_corridos` (ex: Brasileirão A/B, Chile, Bolívia)
 * - só `mata_mata` (ex: Copa do Brasil)
 * - `fase_grupos` + `mata_mata`, classificados do grupo alimentando o
 *   mata-mata direto (a maioria dos estaduais brasileiros)
 *
 * Qualquer outra combinação de blocos (a maioria dos países CONMEBOL, e
 * alguns estaduais como Paulistão A1/A2) não tem receita automática —
 * aparece como `erro` no resultado da competição em vez de quebrar a
 * temporada inteira. Ver exemplos de simulação bespoke pra esses casos em
 * `src/cli/index.ts` (`simularArgentina`).
 */

export interface ResultadoCampeonatoSimples {
  campeao: string;
  /** Uma entrada por partida do clube do jogador nessa competição (todas as fases/etapas), se ele participou. */
  partidasDoJogador: ResultadoPartida[];
}

interface CampeonatoSimulavel {
  id: string;
  formato: FormatoEstadual;
  times: string[];
}

function receitaPontosCorridos(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
): ResultadoCampeonatoSimples {
  const resultado = simularTemporadaPontosCorridos(campeonato.times, ratings, campeonato.formato.pontos_corridos!.ida_e_volta, random, participacaoJogador);
  return {
    campeao: resultado.tabela[0].clubeId,
    partidasDoJogador: (resultado.partidasDoJogador ?? []).map((p) => p.resultado),
  };
}

function receitaMataMata(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
): ResultadoCampeonatoSimples {
  const resultado = simularMataMataDoFormato(campeonato.formato.mata_mata!, ratings, campeonato.times, random, participacaoJogador);
  const partidasDoJogador = resultado.etapas.flatMap((etapa) => etapa.confrontos.flatMap((c) => c.partidasDoJogador ?? []));
  return { campeao: resultado.campeao, partidasDoJogador };
}

function receitaGruposEMataMata(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
): ResultadoCampeonatoSimples {
  const grupos = simularFaseDeGruposDoFormato(campeonato.formato.fase_grupos!, campeonato.times, ratings, random, participacaoJogador);
  const mataMata = campeonato.formato.mata_mata!;
  const resultadoMataMata = simularMataMataSimples(grupos.classificados, mataMata.fases, mataMata.ida_e_volta, ratings, random, participacaoJogador);

  const partidasDosGrupos = grupos.grupos.flatMap((g) => (g.partidasDoJogador ?? []).map((p) => p.resultado));
  const partidasDoMataMata = resultadoMataMata.etapas.flatMap((etapa) => etapa.confrontos.flatMap((c) => c.partidasDoJogador ?? []));

  return { campeao: resultadoMataMata.campeao, partidasDoJogador: [...partidasDosGrupos, ...partidasDoMataMata] };
}

type Receita = (
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
) => ResultadoCampeonatoSimples;

/** Despacha pela combinação exata de blocos de `formato` — só cobre as 3 combinações estruturalmente inambíguas (ver comentário do arquivo). */
function despacharReceita(formato: FormatoEstadual): Receita {
  const blocos = Object.keys(formato).sort().join(",");

  switch (blocos) {
    case "pontos_corridos":
      return receitaPontosCorridos;
    case "mata_mata":
      return receitaMataMata;
    case "fase_grupos,mata_mata":
      return receitaGruposEMataMata;
    default:
      throw new Error(`sem receita de simulação genérica pra combinação de blocos [${blocos}]`);
  }
}

export interface ResultadoCompeticaoNaTemporada {
  campeonatoId: string;
  resultado?: ResultadoCampeonatoSimples;
  /** Presente quando a competição não pôde ser simulada — combinação de blocos sem receita, dados ausentes, etc. Não interrompe as demais competições da temporada. */
  erro?: string;
}

export interface ResultadoTemporada {
  temporada: number;
  competicoes: ResultadoCompeticaoNaTemporada[];
}

/**
 * Simula uma temporada inteira: lê o calendário mestre, reúne todas as
 * competições ativas em algum período do ano e simula cada uma (com
 * `ParticipacaoJogador` nas que incluem o clube do jogador). Uma
 * competição que falha (sem receita, dados ausentes) não derruba as
 * demais — aparece com `erro` no resultado.
 */
export function simularTemporada(
  temporada: number,
  campeonatos: CampeonatoSimulavel[],
  clubes: Club[],
  participacaoJogador?: ParticipacaoJogadorClube,
  random: () => number = Math.random,
): ResultadoTemporada {
  const calendario = construirCalendarioPadrao(temporada);
  const idsAtivos = new Set(calendario.calendario.flatMap((periodo) => periodo.competicoes_ativas));
  const campeonatoPorId = new Map(campeonatos.map((c) => [c.id, c]));
  const clubePorId = new Map(clubes.map((c) => [c.id, c]));

  const competicoes: ResultadoCompeticaoNaTemporada[] = [];

  for (const campeonatoId of idsAtivos) {
    const campeonato = campeonatoPorId.get(campeonatoId);
    if (!campeonato) {
      competicoes.push({ campeonatoId, erro: "competição não encontrada nos campeonatos carregados" });
      continue;
    }

    try {
      const ratings = Object.fromEntries(campeonato.times.map((clubeId) => [clubeId, obterRating(clubePorId.get(clubeId)!)]));
      const participacaoNestaCompeticao =
        participacaoJogador && campeonato.times.includes(participacaoJogador.clubeId) ? participacaoJogador : undefined;

      const receita = despacharReceita(campeonato.formato);
      const resultado = receita(campeonato, ratings, participacaoNestaCompeticao, random);
      competicoes.push({ campeonatoId, resultado });
    } catch (erro) {
      competicoes.push({ campeonatoId, erro: erro instanceof Error ? erro.message : String(erro) });
    }
  }

  return { temporada, competicoes };
}
