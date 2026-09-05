import type { FormatoEstadual } from "../schemas/championship.js";
import type { Club } from "../schemas/club.js";
import { construirCalendarioPadrao } from "../data/loaders/calendario.js";
import { simularFaseDeGruposDoFormato } from "./groups.js";
import { simularMataMataDoFormato, simularMataMataSimples, type EventoConfrontoMataMata } from "./knockout.js";
import type { ParticipacaoJogadorClube, ResultadoPartida } from "./match.js";
import { obterRating } from "./rating.js";
import { simularFaseUnicaDoFormato, simularTemporadaPontosCorridos, somarTabelas, type EventoConfrontoPontosCorridos } from "./season.js";

/**
 * Hooks pra acompanhar jogo a jogo em tempo real (ex: CLI interativa),
 * sem esperar a temporada/competição inteira terminar — ver
 * `season.ts` `EventoConfrontoPontosCorridos`/`knockout.ts`
 * `EventoConfrontoMataMata`. Cada evento já vem com `campeonatoId` pra
 * quem consome saber de qual competição é (`simularTemporada` roda
 * várias ao mesmo tempo). **Cobertura parcial**: só pontos_corridos e
 * mata_mata têm hook hoje — a parte de fase_grupos de
 * `receitaGruposEMataMata` ainda não emite eventos (pendência).
 */
export interface EventosSimulacaoTemporada {
  aoSimularConfrontoPontosCorridos?: (campeonatoId: string, evento: EventoConfrontoPontosCorridos) => void;
  aoResolverConfrontoMataMata?: (campeonatoId: string, evento: EventoConfrontoMataMata) => void;
}

/**
 * Loop de calendário — percorre o calendário mestre de uma temporada
 * (`data/loaders/calendario.ts`) e simula cada competição ativa.
 *
 * **Limitação real, não escondida**: muitos campeonatos combinam blocos de
 * formato (`turno`+`returno`+`tabela_acumulada`/`final_estadual` reaproveitado,
 * etc) de um jeito que só dá pra simular corretamente sabendo o significado
 * específico daquele campeonato — o `criterio` desses blocos é texto livre
 * (ver `docs/dados-a-verificar.md`), não dá pra interpretar de forma
 * genérica e segura só pela combinação de blocos (o Carioca usa a mesma
 * combinação `final_estadual`+`returno`+`turno` que a Argentina, com
 * significado bem diferente — lá é final de verdade, aqui é reconciliação
 * por tabela). Por isso `escolherReceita` primeiro confere um registro por
 * **id específico** (`RECEITAS_POR_ID`, pras competições já com lógica
 * bespoke conhecida — hoje só `argentina_primera`) antes de cair no
 * despacho genérico, que só cobre as 3 combinações de blocos
 * **estruturalmente inambíguas**:
 *
 * - só `pontos_corridos` (ex: Brasileirão A/B, Chile, Bolívia)
 * - só `mata_mata` (ex: Copa do Brasil)
 * - `fase_grupos` + `mata_mata`, classificados do grupo alimentando o
 *   mata-mata direto (a maioria dos estaduais brasileiros)
 *
 * Qualquer competição fora dessas 4 receitas (id específico + 3 genéricas)
 * não tem simulação automática ainda — aparece como `erro` no resultado
 * da competição em vez de quebrar a temporada inteira.
 */

export interface ResultadoCampeonatoSimples {
  campeao: string;
  /** Uma entrada por partida do clube do jogador nessa competição (todas as fases/etapas), se ele participou. */
  partidasDoJogador: ResultadoPartida[];
}

export interface CampeonatoSimulavel {
  id: string;
  formato: FormatoEstadual;
  times: string[];
}

function receitaPontosCorridos(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
): ResultadoCampeonatoSimples {
  const aoSimularConfronto = eventos?.aoSimularConfrontoPontosCorridos
    ? (evento: EventoConfrontoPontosCorridos) => eventos.aoSimularConfrontoPontosCorridos!(campeonato.id, evento)
    : undefined;
  const resultado = simularTemporadaPontosCorridos(
    campeonato.times,
    ratings,
    campeonato.formato.pontos_corridos!.ida_e_volta,
    random,
    participacaoJogador,
    aoSimularConfronto,
  );
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
  eventos?: EventosSimulacaoTemporada,
): ResultadoCampeonatoSimples {
  const aoResolverConfronto = eventos?.aoResolverConfrontoMataMata
    ? (evento: EventoConfrontoMataMata) => eventos.aoResolverConfrontoMataMata!(campeonato.id, evento)
    : undefined;
  const resultado = simularMataMataDoFormato(campeonato.formato.mata_mata!, ratings, campeonato.times, random, participacaoJogador, aoResolverConfronto);
  const partidasDoJogador = resultado.etapas.flatMap((etapa) => etapa.confrontos.flatMap((c) => c.partidasDoJogador ?? []));
  return { campeao: resultado.campeao, partidasDoJogador };
}

function receitaGruposEMataMata(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
): ResultadoCampeonatoSimples {
  // A fase de grupos ainda não emite evento (pendência) — só o mata-mata que segue.
  const grupos = simularFaseDeGruposDoFormato(campeonato.formato.fase_grupos!, campeonato.times, ratings, random, participacaoJogador);
  const mataMata = campeonato.formato.mata_mata!;
  const aoResolverConfronto = eventos?.aoResolverConfrontoMataMata
    ? (evento: EventoConfrontoMataMata) => eventos.aoResolverConfrontoMataMata!(campeonato.id, evento)
    : undefined;
  const resultadoMataMata = simularMataMataSimples(
    grupos.classificados,
    mataMata.fases,
    mataMata.ida_e_volta,
    ratings,
    random,
    participacaoJogador,
    aoResolverConfronto,
  );

  const partidasDosGrupos = grupos.grupos.flatMap((g) => (g.partidasDoJogador ?? []).map((p) => p.resultado));
  const partidasDoMataMata = resultadoMataMata.etapas.flatMap((etapa) => etapa.confrontos.flatMap((c) => c.partidasDoJogador ?? []));

  return { campeao: resultadoMataMata.campeao, partidasDoJogador: [...partidasDosGrupos, ...partidasDoMataMata] };
}

type Receita = (
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
) => ResultadoCampeonatoSimples;

/** Despacha pela combinação exata de blocos de `formato` — só cobre as 3 combinações estruturalmente inambíguas (ver comentário do arquivo). */
function despacharReceitaGenerica(formato: FormatoEstadual): Receita {
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

/**
 * Argentina: `turno`+`returno` são Apertura/Clausura; o `final_estadual`
 * não é uma final de jogo de verdade, é reaproveitado pra representar a
 * Tabla Anual (soma dos pontos dos dois torneios define o Campeón de Liga
 * — ver `final_estadual.criterio` no próprio dado e
 * `docs/dados-a-verificar.md`). Mesma combinação de blocos
 * (`final_estadual,returno,turno`) que o Carioca usa com significado
 * diferente (lá é uma final de verdade) — por isso não dá pra despachar
 * isso por formato genérico, só por id específico (ver `RECEITAS_POR_ID`).
 */
/**
 * Exportada (diferente das outras receitas) porque `argentina_primera`
 * ainda não é referenciada pelo calendário padrão (`calendario.ts` só
 * cobre Brasil + competições continentais hoje) — então não dá pra
 * exercitar essa receita via `simularTemporada` ainda, só testando a
 * função diretamente.
 */
export function receitaArgentina(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
): ResultadoCampeonatoSimples {
  const aoSimularConfronto = eventos?.aoSimularConfrontoPontosCorridos
    ? (evento: EventoConfrontoPontosCorridos) => eventos.aoSimularConfrontoPontosCorridos!(campeonato.id, evento)
    : undefined;
  const apertura = simularFaseUnicaDoFormato(campeonato.formato.turno!, campeonato.times, ratings, random, participacaoJogador, aoSimularConfronto);
  const clausura = simularFaseUnicaDoFormato(campeonato.formato.returno!, campeonato.times, ratings, random, participacaoJogador, aoSimularConfronto);
  const tabelaAnual = somarTabelas([apertura.tabela, clausura.tabela]);

  const partidasDoJogador = [...(apertura.partidasDoJogador ?? []), ...(clausura.partidasDoJogador ?? [])].map((p) => p.resultado);

  return { campeao: tabelaAnual[0].clubeId, partidasDoJogador };
}

/**
 * Receitas registradas por id — pra competições cuja combinação de blocos
 * é ambígua (o mesmo formato pode significar coisas diferentes em
 * campeonatos diferentes, ver `receitaArgentina`). Checada antes da
 * despacho genérico por formato.
 */
const RECEITAS_POR_ID: Record<string, Receita> = {
  argentina_primera: receitaArgentina,
};

function escolherReceita(campeonato: CampeonatoSimulavel): Receita {
  return RECEITAS_POR_ID[campeonato.id] ?? despacharReceitaGenerica(campeonato.formato);
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
  eventos?: EventosSimulacaoTemporada,
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

      const receita = escolherReceita(campeonato);
      const resultado = receita(campeonato, ratings, participacaoNestaCompeticao, random, eventos);
      competicoes.push({ campeonatoId, resultado });
    } catch (erro) {
      competicoes.push({ campeonatoId, erro: erro instanceof Error ? erro.message : String(erro) });
    }
  }

  return { temporada, competicoes };
}
