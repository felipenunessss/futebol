import type { EtapaMataMata, FormatoEstadual } from "../schemas/championship.js";
import type { Club } from "../schemas/club.js";
import { construirCalendarioPadrao } from "../data/loaders/calendario.js";
import { simularFaseDeGruposDoFormato, simularFaseQuadrangularDoFormato } from "./groups.js";
import { simularEtapasMataMataParcial, simularFinalEstadualDoFormato, simularMataMataComEtapas, simularMataMataDoFormato, simularMataMataSimples, type EventoConfrontoMataMata } from "./knockout.js";
import { resolverPartidaPadrao, type ParticipacaoJogadorClube, type ResolverPartida, type ResultadoPartida } from "./match.js";
import { obterRating } from "./rating.js";
import { simularFaseUnicaDoFormato, simularTemporadaPontosCorridos, somarTabelas, type EventoConfrontoPontosCorridos, type ResultadoFaseUnica } from "./season.js";
import { simularFaseSuica } from "./swiss.js";

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
 * **id específico** (`RECEITAS_POR_ID` — hoje `argentina_primera` e
 * `carioca_a`) antes de cair no despacho genérico por combinação de blocos
 * (ver `despacharReceitaGenerica` pra lista completa e comentário de cada
 * receita pra detalhe — cobre `pontos_corridos`/`mata_mata` isolados,
 * `fase_grupos`/`fase_suica`/`turno` alimentando um `mata_mata` (com ou sem
 * `final_estadual` depois), `fase_grupos`+`fase_quadrangular`+`final_estadual`,
 * `pontos_corridos`+`mata_mata` (liguilla de acesso), `returno`+`turno`
 * somados sem final, e o caso escalonado de Libertadores/Sul-Americana
 * — `fase_grupos`+`mata_mata` com `mata_mata.etapas` detalhado, ver
 * `receitaFaseGruposComPreClassificatorioEMataMata`).
 *
 * Qualquer competição fora dessas receitas (por id + pelas combinações
 * genéricas cobertas) não tem simulação automática ainda — aparece como
 * `erro` no resultado da competição em vez de quebrar a temporada inteira.
 * Ver `docs/dados-a-verificar.md` pros formatos internacionais ainda não
 * cobertos (Uruguai, Venezuela, Peru, Colômbia, Equador, Argentina 2ª
 * divisão, Copa Verde, Copa do Nordeste) — a maioria já tinha mecanismo
 * real não totalmente confirmado por fonte, então ficou de fora em vez de
 * arriscar inventar regra.
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

async function receitaPontosCorridos(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoCampeonatoSimples> {
  const aoSimularConfronto = eventos?.aoSimularConfrontoPontosCorridos
    ? (evento: EventoConfrontoPontosCorridos) => eventos.aoSimularConfrontoPontosCorridos!(campeonato.id, evento)
    : undefined;
  const resultado = await simularTemporadaPontosCorridos(
    campeonato.times,
    ratings,
    campeonato.formato.pontos_corridos!.ida_e_volta,
    random,
    participacaoJogador,
    aoSimularConfronto,
    resolverPartida,
  );
  return {
    campeao: resultado.tabela[0].clubeId,
    partidasDoJogador: (resultado.partidasDoJogador ?? []).map((p) => p.resultado),
  };
}

async function receitaMataMata(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoCampeonatoSimples> {
  const aoResolverConfronto = eventos?.aoResolverConfrontoMataMata
    ? (evento: EventoConfrontoMataMata) => eventos.aoResolverConfrontoMataMata!(campeonato.id, evento)
    : undefined;
  const resultado = await simularMataMataDoFormato(campeonato.formato.mata_mata!, ratings, campeonato.times, random, participacaoJogador, aoResolverConfronto, resolverPartida);
  const partidasDoJogador = resultado.etapas.flatMap((etapa) => etapa.confrontos.flatMap((c) => c.partidasDoJogador ?? []));
  return { campeao: resultado.campeao, partidasDoJogador };
}

async function receitaGruposEMataMata(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoCampeonatoSimples> {
  // A fase de grupos ainda não emite evento (pendência) — só o mata-mata que segue.
  const grupos = await simularFaseDeGruposDoFormato(campeonato.formato.fase_grupos!, campeonato.times, ratings, random, participacaoJogador, resolverPartida);
  const mataMata = campeonato.formato.mata_mata!;
  const aoResolverConfronto = eventos?.aoResolverConfrontoMataMata
    ? (evento: EventoConfrontoMataMata) => eventos.aoResolverConfrontoMataMata!(campeonato.id, evento)
    : undefined;
  const resultadoMataMata = await simularMataMataSimples(
    grupos.classificados,
    mataMata.fases,
    mataMata.ida_e_volta,
    ratings,
    random,
    participacaoJogador,
    aoResolverConfronto,
    resolverPartida,
  );

  const partidasDosGrupos = grupos.grupos.flatMap((g) => (g.partidasDoJogador ?? []).map((p) => p.resultado));
  const partidasDoMataMata = resultadoMataMata.etapas.flatMap((etapa) => etapa.confrontos.flatMap((c) => c.partidasDoJogador ?? []));

  return { campeao: resultadoMataMata.campeao, partidasDoJogador: [...partidasDosGrupos, ...partidasDoMataMata] };
}

/**
 * `fase_suica` + `mata_mata` (Paulistão A1, Gauchão, Catarinense, Goiano,
 * Paraense, Paranaense, Copa Sul-Sudeste) — mesma ideia de
 * `receitaGruposEMataMata`, só que o classificatório é a fase suíça em vez
 * da fase de grupos.
 */
export async function receitaFaseSuicaEMataMata(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoCampeonatoSimples> {
  const suica = await simularFaseSuica(campeonato.times, campeonato.formato.fase_suica!, ratings, random, participacaoJogador, resolverPartida);
  const mataMata = campeonato.formato.mata_mata!;
  const aoResolverConfronto = eventos?.aoResolverConfrontoMataMata
    ? (evento: EventoConfrontoMataMata) => eventos.aoResolverConfrontoMataMata!(campeonato.id, evento)
    : undefined;
  const resultadoMataMata = await simularMataMataSimples(
    suica.classificados,
    mataMata.fases,
    mataMata.ida_e_volta,
    ratings,
    random,
    participacaoJogador,
    aoResolverConfronto,
    resolverPartida,
  );

  const partidasDaSuica = (suica.partidasDoJogador ?? []).map((p) => p.resultado);
  const partidasDoMataMata = resultadoMataMata.etapas.flatMap((etapa) => etapa.confrontos.flatMap((c) => c.partidasDoJogador ?? []));

  return { campeao: resultadoMataMata.campeao, partidasDoJogador: [...partidasDaSuica, ...partidasDoMataMata] };
}

/**
 * `fase_suica` + `mata_mata` + `final_estadual` (Mineiro Módulo I): a fase
 * suíça classifica pra um mata-mata que **não decide o campeão sozinho**
 * — a última etapa do `mata_mata` (aqui só `["semifinal"]`) produz os 2
 * finalistas, e o `final_estadual` ("cruzamento_dos_classificados_da_fase_suica")
 * é a final de verdade entre eles.
 */
export async function receitaFaseSuicaMataMataEFinal(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoCampeonatoSimples> {
  const suica = await simularFaseSuica(campeonato.times, campeonato.formato.fase_suica!, ratings, random, participacaoJogador, resolverPartida);
  const mataMata = campeonato.formato.mata_mata!;
  const aoResolverConfronto = eventos?.aoResolverConfrontoMataMata
    ? (evento: EventoConfrontoMataMata) => eventos.aoResolverConfrontoMataMata!(campeonato.id, evento)
    : undefined;
  // simularEtapasMataMataParcial (não simularMataMataSimples/simularMataMataComEtapas): o mata_mata
  // aqui é só a semifinal — não decide o título sozinho, os 2 vencedores vão pro final_estadual.
  const etapasDoMataMata: EtapaMataMata[] = mataMata.fases.map((nome, indice) => ({
    nome,
    ida_e_volta: mataMata.ida_e_volta,
    entrantes: indice === 0 ? suica.classificados : undefined,
  }));
  const resultadoMataMata = await simularEtapasMataMataParcial(etapasDoMataMata, ratings, random, participacaoJogador, aoResolverConfronto, resolverPartida);
  const finalistas = resultadoMataMata.etapas[resultadoMataMata.etapas.length - 1].vencedores;
  const final = await simularFinalEstadualDoFormato(campeonato.formato.final_estadual!, finalistas, ratings, random, participacaoJogador, resolverPartida);

  const partidasDaSuica = (suica.partidasDoJogador ?? []).map((p) => p.resultado);
  const partidasDoMataMata = resultadoMataMata.etapas.flatMap((etapa) => etapa.confrontos.flatMap((c) => c.partidasDoJogador ?? []));
  const partidasDaFinal = final.confronto?.partidasDoJogador ?? [];

  return { campeao: final.campeao, partidasDoJogador: [...partidasDaSuica, ...partidasDoMataMata, ...partidasDaFinal] };
}

/**
 * `fase_grupos` + `fase_quadrangular` + `final_estadual` (Série C,
 * Paulistão A2): fase de grupos classifica pros 2 quadrangulares
 * ("líderes dos quadrangulares disputam o título/a final de acesso" —
 * só o 1º colocado de CADA quadrangular, não todo `classificam_por_grupo`),
 * final_estadual é a final de verdade entre os 2 líderes.
 */
export async function receitaFaseGruposFaseQuadrangularEFinal(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoCampeonatoSimples> {
  // Fase de grupos e quadrangular ainda não emitem evento (mesma pendência de receitaGruposEMataMata).
  const grupos = await simularFaseDeGruposDoFormato(campeonato.formato.fase_grupos!, campeonato.times, ratings, random, participacaoJogador, resolverPartida);
  const quadrangulares = await simularFaseQuadrangularDoFormato(campeonato.formato.fase_quadrangular!, grupos.classificados, ratings, random, true, participacaoJogador, resolverPartida);
  const lideres = quadrangulares.grupos.map((g) => g.classificados[0]);
  const final = await simularFinalEstadualDoFormato(campeonato.formato.final_estadual!, lideres, ratings, random, participacaoJogador, resolverPartida);

  const partidasDosGrupos = grupos.grupos.flatMap((g) => (g.partidasDoJogador ?? []).map((p) => p.resultado));
  const partidasDosQuadrangulares = quadrangulares.grupos.flatMap((g) => (g.partidasDoJogador ?? []).map((p) => p.resultado));
  const partidasDaFinal = final.confronto?.partidasDoJogador ?? [];

  return { campeao: final.campeao, partidasDoJogador: [...partidasDosGrupos, ...partidasDosQuadrangulares, ...partidasDaFinal] };
}

/** `mata_mata` + `turno` (Carioca A2): fase única classifica pro mata-mata, que decide o campeão sozinho — mesmo padrão de `receitaGruposEMataMata`, só que o classificatório é uma `FaseUnica` (`turno`). */
export async function receitaTurnoEMataMata(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoCampeonatoSimples> {
  const aoSimularConfronto = eventos?.aoSimularConfrontoPontosCorridos
    ? (evento: EventoConfrontoPontosCorridos) => eventos.aoSimularConfrontoPontosCorridos!(campeonato.id, evento)
    : undefined;
  const turno = await simularFaseUnicaDoFormato(campeonato.formato.turno!, campeonato.times, ratings, random, participacaoJogador, aoSimularConfronto, resolverPartida);
  const mataMata = campeonato.formato.mata_mata!;
  const aoResolverConfronto = eventos?.aoResolverConfrontoMataMata
    ? (evento: EventoConfrontoMataMata) => eventos.aoResolverConfrontoMataMata!(campeonato.id, evento)
    : undefined;
  const resultadoMataMata = await simularMataMataSimples(
    turno.classificados,
    mataMata.fases,
    mataMata.ida_e_volta,
    ratings,
    random,
    participacaoJogador,
    aoResolverConfronto,
    resolverPartida,
  );

  const partidasDoTurno = (turno.partidasDoJogador ?? []).map((p) => p.resultado);
  const partidasDoMataMata = resultadoMataMata.etapas.flatMap((etapa) => etapa.confrontos.flatMap((c) => c.partidasDoJogador ?? []));

  return { campeao: resultadoMataMata.campeao, partidasDoJogador: [...partidasDoTurno, ...partidasDoMataMata] };
}

/**
 * `mata_mata` + `pontos_corridos` (Chile 2ª divisão): temporada inteira de
 * pontos corridos decide a tabela, os melhores colocados (`2^(nº de fases
 * do mata_mata)`, ex: 3 fases -> 8 times) disputam uma liguilla de acesso
 * (`mata_mata`). **Aproximação documentada** (`docs/dados-a-verificar.md`):
 * a liguilla real do Chile dá bye pro 2º colocado (só 3º-8º jogam
 * quartas) — não representável com o bloco `MataMata` atual, então aqui
 * todos os classificados entram direto nas quartas, sem bye.
 */
export async function receitaPontosCorridosComLiguilla(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoCampeonatoSimples> {
  const aoSimularConfronto = eventos?.aoSimularConfrontoPontosCorridos
    ? (evento: EventoConfrontoPontosCorridos) => eventos.aoSimularConfrontoPontosCorridos!(campeonato.id, evento)
    : undefined;
  const resultado = await simularTemporadaPontosCorridos(
    campeonato.times,
    ratings,
    campeonato.formato.pontos_corridos!.ida_e_volta,
    random,
    participacaoJogador,
    aoSimularConfronto,
    resolverPartida,
  );

  const mataMata = campeonato.formato.mata_mata!;
  const quantidadeClassificados = Math.pow(2, mataMata.fases.length);
  const classificados = resultado.tabela.slice(0, quantidadeClassificados).map((linha) => linha.clubeId);
  const aoResolverConfronto = eventos?.aoResolverConfrontoMataMata
    ? (evento: EventoConfrontoMataMata) => eventos.aoResolverConfrontoMataMata!(campeonato.id, evento)
    : undefined;
  const resultadoMataMata = await simularMataMataSimples(
    classificados,
    mataMata.fases,
    mataMata.ida_e_volta,
    ratings,
    random,
    participacaoJogador,
    aoResolverConfronto,
    resolverPartida,
  );

  const partidasDaTemporada = (resultado.partidasDoJogador ?? []).map((p) => p.resultado);
  const partidasDoMataMata = resultadoMataMata.etapas.flatMap((etapa) => etapa.confrontos.flatMap((c) => c.partidasDoJogador ?? []));

  return { campeao: resultadoMataMata.campeao, partidasDoJogador: [...partidasDaTemporada, ...partidasDoMataMata] };
}

/** Une todo `Club.id` que aparece em algum `entrantes` de qualquer etapa — usado por `receitaFaseGruposComPreClassificatorioEMataMata` pra achar quem entra direto na fase de grupos. */
function clubesListadosEmEntrantes(etapas: EtapaMataMata[]): Set<string> {
  return new Set(etapas.flatMap((etapa) => etapa.entrantes ?? []));
}

/**
 * `fase_grupos` + `mata_mata` com `mata_mata.etapas` detalhado (Libertadores,
 * Sul-Americana): ao contrário do caso simples (`receitaGruposEMataMata`,
 * usado quando só `mata_mata.fases`/`ida_e_volta` estão presentes, sem
 * `etapas`), aqui uma PARTE das etapas do mata-mata acontece **antes** da
 * fase de grupos (fases preliminares/pré-classificatório — só alguns times
 * entram direto na fase de grupos, o resto disputa vaga) e o RESTO
 * acontece **depois** (mata-mata final entre os classificados da fase de
 * grupos).
 *
 * O corte entre "antes" e "depois" é derivado da própria contagem de
 * times, não hardcoded: times que nunca aparecem em nenhum `entrantes` são
 * "diretos" à fase de grupos; percorremos as etapas resolvendo o
 * pré-classificatório até o nº de sobreviventes + diretos bater
 * exatamente com o tamanho esperado da fase de grupos
 * (`num_grupos × times_por_grupo`). Pra Libertadores isso fecha exatamente
 * (28 diretos + 4 sobreviventes do pré-classificatório = 32) — pra
 * Sul-Americana **não fecha em nenhum ponto** (a matemática das etapas
 * "repescagem"/"oitavas"/"quartas" não bate com nenhum corte válido, nem
 * mesmo somando os pré-classificatórios de forma diferente — ver
 * `docs/dados-a-verificar.md`), então essa competição continua sem
 * simulação automática (erro claro, não crash da temporada).
 */
export async function receitaFaseGruposComPreClassificatorioEMataMata(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoCampeonatoSimples> {
  const faseGrupos = campeonato.formato.fase_grupos!;
  const mataMata = campeonato.formato.mata_mata!;
  const etapas = mataMata.etapas!;
  const tamanhoDaFaseDeGrupos = faseGrupos.num_grupos * faseGrupos.times_por_grupo;

  const listadosComoEntrantes = clubesListadosEmEntrantes(etapas);
  const diretos = campeonato.times.filter((t) => !listadosComoEntrantes.has(t));

  let sobreviventes = 0;
  let indiceDeCorte = -1;
  for (let i = 0; i < etapas.length; i++) {
    sobreviventes = Math.floor((sobreviventes + (etapas[i].entrantes?.length ?? 0)) / 2);
    if (diretos.length + sobreviventes === tamanhoDaFaseDeGrupos) {
      indiceDeCorte = i;
      break;
    }
  }
  if (indiceDeCorte === -1) {
    throw new Error(
      `${campeonato.id}: não foi possível derivar o corte entre as etapas pré-classificatórias e a fase de grupos (esperava ${tamanhoDaFaseDeGrupos} times entrando na fase de grupos, a soma de diretos + sobreviventes das etapas de mata_mata.etapas nunca fecha nesse número)`,
    );
  }

  const aoResolverConfronto = eventos?.aoResolverConfrontoMataMata
    ? (evento: EventoConfrontoMataMata) => eventos.aoResolverConfrontoMataMata!(campeonato.id, evento)
    : undefined;

  const etapasPreClassificatorias = etapas.slice(0, indiceDeCorte + 1);
  const preClassificatorio = await simularEtapasMataMataParcial(etapasPreClassificatorias, ratings, random, participacaoJogador, aoResolverConfronto, resolverPartida);
  const qualificados = preClassificatorio.etapas[preClassificatorio.etapas.length - 1].vencedores;

  const timesDaFaseDeGrupos = [...diretos, ...qualificados];
  const grupos = await simularFaseDeGruposDoFormato(faseGrupos, timesDaFaseDeGrupos, ratings, random, participacaoJogador, resolverPartida);

  const etapasFinais: EtapaMataMata[] = etapas.slice(indiceDeCorte + 1).map((etapa, indice) => ({
    nome: etapa.nome,
    ida_e_volta: etapa.ida_e_volta,
    // a 1ª etapa pós-grupos recebe os classificados JUNTO com quem já tinha entrantes próprios ali
    // (ex: Sul-Americana tem uma "repescagem" com entrantes próprios logo depois do corte) — soma, não substitui.
    entrantes: indice === 0 ? [...grupos.classificados, ...(etapa.entrantes ?? [])] : etapa.entrantes,
  }));
  const resultadoMataMataFinal = await simularMataMataComEtapas(etapasFinais, ratings, random, participacaoJogador, aoResolverConfronto, resolverPartida);

  const partidasPreClassificatorio = preClassificatorio.etapas.flatMap((etapa) => etapa.confrontos.flatMap((c) => c.partidasDoJogador ?? []));
  const partidasDosGrupos = grupos.grupos.flatMap((g) => (g.partidasDoJogador ?? []).map((p) => p.resultado));
  const partidasDoMataMataFinal = resultadoMataMataFinal.etapas.flatMap((etapa) => etapa.confrontos.flatMap((c) => c.partidasDoJogador ?? []));

  return {
    campeao: resultadoMataMataFinal.campeao,
    partidasDoJogador: [...partidasPreClassificatorio, ...partidasDosGrupos, ...partidasDoMataMataFinal],
  };
}

type Receita = (
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
  resolverPartida?: ResolverPartida,
) => Promise<ResultadoCampeonatoSimples>;

/**
 * Despacha pela combinação exata de blocos de `formato`. `tabela_acumulada`
 * nunca entra na chave de despacho: o bloco é só `{criterio: string}`
 * (nenhum dado numérico próprio, ver `schemas/championship.ts`) — é uma
 * anotação de que os blocos presentes devem ter suas tabelas somadas, não
 * um mecanismo independente de simulação. A receita que trata os blocos
 * "de verdade" (`turno`/`returno`/`pontos_corridos`) já sabe se soma
 * tabelas ou não; ignorar `tabela_acumulada` aqui evita que sua mera
 * presença quebre o casamento de combinação (ex: Paraguai 2ª divisão é só
 * `pontos_corridos` na prática — o `tabela_acumulada` ali é só uma nota
 * sobre rebaixamento por média de temporadas, sem efeito na simulação
 * desta temporada).
 */
function despacharReceitaGenerica(formato: FormatoEstadual): Receita {
  const blocos = Object.keys(formato)
    .filter((chave) => chave !== "tabela_acumulada")
    .sort()
    .join(",");

  switch (blocos) {
    case "pontos_corridos":
      return receitaPontosCorridos;
    case "mata_mata":
      return receitaMataMata;
    case "fase_grupos,mata_mata":
      // Libertadores/Sul-Americana detalham `mata_mata.etapas` (fases pré-classificatórias
      // que alimentam a fase de grupos, ver receitaFaseGruposComPreClassificatorioEMataMata)
      // — a maioria dos estaduais brasileiros não tem isso e usa o caso simples.
      return formato.mata_mata!.etapas ? receitaFaseGruposComPreClassificatorioEMataMata : receitaGruposEMataMata;
    case "fase_suica,mata_mata":
      return receitaFaseSuicaEMataMata;
    case "fase_suica,final_estadual,mata_mata":
      return receitaFaseSuicaMataMataEFinal;
    case "fase_grupos,fase_quadrangular,final_estadual":
      return receitaFaseGruposFaseQuadrangularEFinal;
    case "mata_mata,turno":
      return receitaTurnoEMataMata;
    case "mata_mata,pontos_corridos":
      return receitaPontosCorridosComLiguilla;
    case "returno,turno":
      return receitaTurnoRetornoSomado;
    default:
      throw new Error(`sem receita de simulação genérica pra combinação de blocos [${blocos}]`);
  }
}

/** Roda `turno`+`returno` (2 `FaseUnica` independentes) e devolve as duas tabelas junto com as partidas do jogador — compartilhado por `receitaArgentina` (soma as tabelas pra Tabla Anual) e `receitaTurnoRetornoSomado` (soma pra decidir o campeão direto, sem final). */
async function simularTurnoRetorno(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos: EventosSimulacaoTemporada | undefined,
  resolverPartida: ResolverPartida,
): Promise<{ turno: ResultadoFaseUnica; returno: ResultadoFaseUnica }> {
  const aoSimularConfronto = eventos?.aoSimularConfrontoPontosCorridos
    ? (evento: EventoConfrontoPontosCorridos) => eventos.aoSimularConfrontoPontosCorridos!(campeonato.id, evento)
    : undefined;
  const turno = await simularFaseUnicaDoFormato(campeonato.formato.turno!, campeonato.times, ratings, random, participacaoJogador, aoSimularConfronto, resolverPartida);
  const returno = await simularFaseUnicaDoFormato(campeonato.formato.returno!, campeonato.times, ratings, random, participacaoJogador, aoSimularConfronto, resolverPartida);
  return { turno, returno };
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
export async function receitaArgentina(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoCampeonatoSimples> {
  const { turno: apertura, returno: clausura } = await simularTurnoRetorno(campeonato, ratings, participacaoJogador, random, eventos, resolverPartida);
  const tabelaAnual = somarTabelas([apertura.tabela, clausura.tabela]);

  const partidasDoJogador = [...(apertura.partidasDoJogador ?? []), ...(clausura.partidasDoJogador ?? [])].map((p) => p.resultado);

  return { campeao: tabelaAnual[0].clubeId, partidasDoJogador };
}

/**
 * `turno` + `returno` sem `final_estadual` nenhum (Paraguai 1ª divisão):
 * ao contrário da Argentina (que reaproveita `final_estadual` pra
 * representar a Tabla Anual), aqui não há bloco nenhum sobrando — a soma
 * de Apertura+Clausura decide o campeão direto, sem reconciliação
 * adicional. Combinação de blocos inambígua (`returno,turno`, sem
 * `final_estadual`), então despachável genericamente — diferente de
 * Argentina/Carioca, que precisam de receita por id.
 */
export async function receitaTurnoRetornoSomado(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoCampeonatoSimples> {
  const { turno, returno } = await simularTurnoRetorno(campeonato, ratings, participacaoJogador, random, eventos, resolverPartida);
  const tabelaSomada = somarTabelas([turno.tabela, returno.tabela]);

  const partidasDoJogador = [...(turno.partidasDoJogador ?? []), ...(returno.partidasDoJogador ?? [])].map((p) => p.resultado);

  return { campeao: tabelaSomada[0].clubeId, partidasDoJogador };
}

/**
 * Carioca: `turno`+`returno` são Taça Guanabara/Taça Rio, cada uma
 * decidida pelo topo da própria tabela (não usa `classificam_proxima_fase`
 * pra nada — não há mais nenhuma fase entre elas e a final). `final_estadual`
 * ("campeões_turno_returno_ou_melhor_campanha") é uma final de verdade
 * entre os 2 campeões — mesmo clube campeão dos dois vira campeão
 * automático, sem final (`simularFinalEstadualDoFormato` já cobre o caso
 * de 1 participante só). Mesma combinação de blocos que
 * `receitaArgentina`, com significado bem diferente — por isso por id, não
 * genérico (ver `RECEITAS_POR_ID`).
 */
export async function receitaCarioca(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
  eventos?: EventosSimulacaoTemporada,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoCampeonatoSimples> {
  const { turno: tacaGuanabara, returno: tacaRio } = await simularTurnoRetorno(campeonato, ratings, participacaoJogador, random, eventos, resolverPartida);
  const campeaoGuanabara = tacaGuanabara.tabela[0].clubeId;
  const campeaoRio = tacaRio.tabela[0].clubeId;
  const participantesDaFinal = campeaoGuanabara === campeaoRio ? [campeaoGuanabara] : [campeaoGuanabara, campeaoRio];

  const final = await simularFinalEstadualDoFormato(campeonato.formato.final_estadual!, participantesDaFinal, ratings, random, participacaoJogador, resolverPartida);

  const partidasDoJogador = [
    ...(tacaGuanabara.partidasDoJogador ?? []).map((p) => p.resultado),
    ...(tacaRio.partidasDoJogador ?? []).map((p) => p.resultado),
    ...(final.confronto?.partidasDoJogador ?? []),
  ];

  return { campeao: final.campeao, partidasDoJogador };
}

/**
 * Receitas registradas por id — pra competições cuja combinação de blocos
 * é ambígua (o mesmo formato pode significar coisas diferentes em
 * campeonatos diferentes, ver `receitaArgentina`/`receitaCarioca`).
 * Checada antes da despacho genérico por formato.
 */
const RECEITAS_POR_ID: Record<string, Receita> = {
  argentina_primera: receitaArgentina,
  carioca_a: receitaCarioca,
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
export async function simularTemporada(
  temporada: number,
  campeonatos: CampeonatoSimulavel[],
  clubes: Club[],
  participacaoJogador?: ParticipacaoJogadorClube,
  random: () => number = Math.random,
  eventos?: EventosSimulacaoTemporada,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
): Promise<ResultadoTemporada> {
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
      const resultado = await receita(campeonato, ratings, participacaoNestaCompeticao, random, eventos, resolverPartida);
      competicoes.push({ campeonatoId, resultado });
    } catch (erro) {
      competicoes.push({ campeonatoId, erro: erro instanceof Error ? erro.message : String(erro) });
    }
  }

  return { temporada, competicoes };
}
