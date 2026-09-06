import type { Club } from "../schemas/club.js";
import type { EtapaMataMata, FaseSuica } from "../schemas/championship.js";
import { construirCalendarioPadrao, janelaDeSemanasPorCompeticao, type JanelaDeSemanas } from "../data/loaders/calendario.js";
import type { CampeonatoSimulavel } from "./engine.js";
import {
  atualizarLinha,
  gerarConfrontosPontosCorridos,
  linhaVazia,
  ordenarTabela,
  type Confronto,
  type EventoConfrontoPontosCorridos,
  type LinhaTabela,
} from "./season.js";
import { gerarConfrontosFaseSuica } from "./swiss.js";
import { dividirEmGruposPorForca } from "./groups.js";
import {
  emparelharPorForca,
  resolverConfronto,
  type EventoConfrontoMataMata,
  type ResultadoConfrontoMataMata,
  type ResultadoEtapaMataMata,
} from "./knockout.js";
import {
  gerarPerfilTime,
  participacaoNoConfronto,
  resolverPartidaPadrao,
  type ParticipacaoJogadorClube,
  type ResolverPartida,
  type ResultadoPartida,
} from "./match.js";
import { obterRating } from "./rating.js";

/**
 * Motor de resolução INCREMENTAL — resolve uma competição rodada/etapa por
 * vez, mantendo estado entre chamadas, em vez de resolver a temporada
 * inteira de uma vez como `simulation/engine.ts` `simularTemporada` faz.
 * Construído do zero, em paralelo ao motor "em lote" (que continua servindo
 * `carreira-loop`/`temporada`/`carreira` e toda a suíte de testes existente,
 * sem nenhuma mudança) — usado só pela carreira interativa (`jogar`), que
 * precisa avançar a temporada semana a semana pra intercalar partida do
 * jogador com treino/cenário de verdade (ver `career/career-loop.ts`
 * `jogarTemporadaSemanal`, `docs/motor-de-partida.md`).
 *
 * **Cobertura**: só as ~8 formas de receita alcançáveis pelo calendário
 * padrão hoje (ver `data/loaders/calendario.ts` `PERIODOS_PADRAO`) —
 * `pontos_corridos`; `fase_suica`+`mata_mata` (com/sem `final_estadual`);
 * `turno`+`returno`+`final_estadual` (Carioca, por id); `fase_grupos`+
 * `fase_quadrangular`+`final_estadual`; `fase_grupos`+`mata_mata` simples;
 * `mata_mata` isolado com `etapas` (Copa do Brasil); e o par conjunto
 * Libertadores+Sul-Americana. As dezenas de receitas internacionais
 * (Uruguai, Colômbia, etc — ver `simulation/engine.ts`) nunca aparecem no
 * calendário hoje, não precisam de versão incremental.
 *
 * **Escala de tempo**: cada competição recebe uma "janela" de semanas
 * (`data/loaders/calendario.ts` `janelaDeSemanasPorCompeticao` — união dos
 * períodos em que ela aparece ativa) e espalha suas rodadas/etapas
 * uniformemente dentro dela (`semanaDaProximaUnidade`) — estimativa de
 * design, não uma simulação de calendário real (o jogo não tem datas de
 * partida reais pra nenhuma competição).
 */

// ---------------------------------------------------------------------------
// Primitivas de fase (rodadas de pontos corridos/fase suíça, etapas de
// mata-mata, e o repechaje especial Libertadores<->Sul-Americana).
// ---------------------------------------------------------------------------

export interface GrupoDeRodadas {
  nome: string;
  confrontos: Confronto[];
  tabela: Map<string, LinhaTabela>;
}

/** Uma rodada por vez de pontos corridos — cobre tanto competição de grupo único (liga, fase suíça) quanto `fase_grupos`/`fase_quadrangular` (vários grupos avançando a MESMA rodada em paralelo, já que rodam na mesma janela de tempo real). */
export interface FaseRodadas {
  tipo: "rodadas";
  nome: string;
  grupos: GrupoDeRodadas[];
  /** Quantos avançam de CADA grupo pra próxima fase (`classificadosDaFase`) — irrelevante pra quem só lê o topo da tabela (`tabelaDoGrupoUnico`, ex: turno/returno/liga). */
  classificamPorGrupo: number;
  rodadaAtual: number;
  totalRodadas: number;
  partidasDoJogador: ResultadoPartida[];
  concluida: boolean;
}

/** Uma etapa de mata-mata por vez — mesma semântica de `knockout.ts` `EtapaMataMata`/`resolverEtapasMataMata`, só que resolvendo 1 etapa e devolvendo controle pro chamador entre uma e outra. */
export interface FaseMataMata {
  tipo: "mata_mata";
  nome: string;
  etapas: EtapaMataMata[];
  indiceAtual: number;
  vivos: string[];
  resultados: ResultadoEtapaMataMata[];
  partidasDoJogador: ResultadoPartida[];
  concluida: boolean;
}

/**
 * O repechaje Libertadores<->Sul-Americana não é um mata-mata comum — o
 * pareamento é por LADO DE ORIGEM (2º da Sula mais forte contra 3º da
 * Libertadores mais forte, nunca 2º-vs-2º), não pelo emparelhamento
 * genérico por força de `FaseMataMata` (que reordena todo mundo junto).
 * Ver `simulation/engine.ts` `receitaLibertadoresESulAmericanaConjunta`.
 */
export interface FaseRepechaje {
  tipo: "repechaje";
  nome: string;
  segundosSula: string[];
  terceirosLibertadores: string[];
  indiceAtual: number;
  vencedores: string[];
  partidasDoJogador: ResultadoPartida[];
  concluida: boolean;
}

export type Fase = FaseRodadas | FaseMataMata | FaseRepechaje;

/**
 * Hooks pra mostrar jogo a jogo em tempo real — mesma forma de `engine.ts`
 * `EventosSimulacaoTemporada`, só que por fase em vez de por temporada
 * inteira. Podem ser assíncronos (ao contrário dos de `engine.ts`) — é o
 * que permite uma pausa de verdade ("Enter pra continuar") depois de cada
 * partida do jogador, já que aqui cada confronto é `await`ado antes do
 * próximo ser resolvido (ver `career/career-loop.ts` `jogarTemporadaSemanal`).
 */
export interface HooksDeFase {
  aoSimularConfrontoPontosCorridos?: (grupoNome: string, evento: EventoConfrontoPontosCorridos) => void | Promise<void>;
  aoResolverConfrontoMataMata?: (evento: EventoConfrontoMataMata) => void | Promise<void>;
}

/** Mesma matemática de `season.ts` `gerarConfrontosPontosCorridos` — pura, não depende de quem são os times, só de quantos são (por isso dá pra calcular o total de rodadas de uma fase futura ANTES de saber quem classifica pra ela). */
function totalDeRodadas(quantidadeDeTimes: number, idaEVolta: boolean): number {
  if (quantidadeDeTimes < 2) return 0;
  const numTimes = quantidadeDeTimes % 2 === 0 ? quantidadeDeTimes : quantidadeDeTimes + 1;
  const rodadasDeUmTurno = numTimes - 1;
  return idaEVolta ? rodadasDeUmTurno * 2 : rodadasDeUmTurno;
}

/** Mesma matemática de `swiss.ts` `gerarConfrontosFaseSuica` — também pura (só depende dos números do formato). */
function totalDeRodadasSuica(formato: FaseSuica): number {
  const jogosDentroDoPote = formato.times_por_pote - 1;
  const jogosForaDoPote = formato.jogos_por_time - jogosDentroDoPote;
  return 1 + jogosForaDoPote;
}

function criarFaseRodadas(nome: string, gruposDeTimes: string[][], idaEVolta: boolean, classificamPorGrupo: number): FaseRodadas {
  const multiplosGrupos = gruposDeTimes.length > 1;
  const grupos: GrupoDeRodadas[] = gruposDeTimes.map((times, indice) => ({
    nome: multiplosGrupos ? `Grupo ${String.fromCharCode(65 + indice)}` : nome,
    confrontos: gerarConfrontosPontosCorridos(times, idaEVolta),
    tabela: new Map(times.map((id) => [id, linhaVazia(id)])),
  }));
  const totalRodadas = Math.max(0, ...grupos.flatMap((g) => g.confrontos.map((c) => c.rodada)));
  return { tipo: "rodadas", nome, grupos, classificamPorGrupo, rodadaAtual: 1, totalRodadas, partidasDoJogador: [], concluida: totalRodadas === 0 };
}

function criarFaseRodadasSuica(nome: string, times: string[], formato: FaseSuica, random: () => number): FaseRodadas {
  const confrontos = gerarConfrontosFaseSuica(times, formato, random);
  const totalRodadas = Math.max(0, ...confrontos.map((c) => c.rodada));
  return {
    tipo: "rodadas",
    nome,
    grupos: [{ nome, confrontos, tabela: new Map(times.map((id) => [id, linhaVazia(id)])) }],
    classificamPorGrupo: formato.classificam_mata_mata,
    rodadaAtual: 1,
    totalRodadas,
    partidasDoJogador: [],
    concluida: totalRodadas === 0,
  };
}

function criarFaseMataMata(nome: string, etapas: EtapaMataMata[]): FaseMataMata {
  return { tipo: "mata_mata", nome, etapas, indiceAtual: 0, vivos: [], resultados: [], partidasDoJogador: [], concluida: etapas.length === 0 };
}

function criarFaseRepechaje(segundosSula: string[], terceirosLibertadores: string[]): FaseRepechaje {
  return {
    tipo: "repechaje",
    nome: "repescagem",
    segundosSula,
    terceirosLibertadores,
    indiceAtual: 0,
    vencedores: [],
    partidasDoJogador: [],
    concluida: segundosSula.length === 0,
  };
}

async function avancarRodada(
  fase: FaseRodadas,
  ratings: Record<string, number>,
  random: () => number,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  resolverPartida: ResolverPartida,
  hooks?: HooksDeFase,
): Promise<void> {
  const rodada = fase.rodadaAtual;

  for (const grupo of fase.grupos) {
    for (const confronto of grupo.confrontos.filter((c) => c.rodada === rodada)) {
      const perfilMandante = gerarPerfilTime(ratings[confronto.mandante], random);
      const perfilVisitante = gerarPerfilTime(ratings[confronto.visitante], random);
      const participacao = participacaoNoConfronto(participacaoJogador, confronto.mandante, confronto.visitante);
      const resultado = await resolverPartida(perfilMandante, perfilVisitante, random, participacao, { mandanteId: confronto.mandante, visitanteId: confronto.visitante });

      const tabelaAntes = hooks?.aoSimularConfrontoPontosCorridos ? ordenarTabela([...grupo.tabela.values()].map((linha) => ({ ...linha }))) : undefined;
      atualizarLinha(grupo.tabela.get(confronto.mandante)!, resultado.golsCasa, resultado.golsFora);
      atualizarLinha(grupo.tabela.get(confronto.visitante)!, resultado.golsFora, resultado.golsCasa);

      if (hooks?.aoSimularConfrontoPontosCorridos) {
        const tabelaDepois = ordenarTabela([...grupo.tabela.values()].map((linha) => ({ ...linha })));
        await hooks.aoSimularConfrontoPontosCorridos(grupo.nome, { confronto, resultado, tabelaAntes: tabelaAntes!, tabelaDepois });
      }
      if (participacao) fase.partidasDoJogador.push(resultado);
    }
  }

  fase.rodadaAtual++;
  if (fase.rodadaAtual > fase.totalRodadas) fase.concluida = true;
}

async function avancarEtapa(
  fase: FaseMataMata,
  ratings: Record<string, number>,
  random: () => number,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  resolverPartida: ResolverPartida,
  hooks?: HooksDeFase,
): Promise<void> {
  const etapa = fase.etapas[fase.indiceAtual];
  fase.vivos = [...fase.vivos, ...(etapa.entrantes ?? [])];

  if (fase.vivos.length === 0) {
    fase.resultados.push({ nome: etapa.nome, confrontos: [], vencedores: [] });
  } else if (fase.vivos.length === 1) {
    // campeão automático sem jogo (ex: mesmo clube venceu turno e returno) — só acontece numa
    // etapa de 1 entrante só, modelando uma final_estadual como FaseMataMata de 1 etapa.
    fase.resultados.push({ nome: etapa.nome, confrontos: [], vencedores: [...fase.vivos] });
  } else {
    const pares = emparelharPorForca(fase.vivos, ratings);
    const confrontos: ResultadoConfrontoMataMata[] = [];
    for (const [timeA, timeB] of pares) {
      const confronto = await resolverConfronto(timeA, timeB, ratings, etapa.ida_e_volta, random, participacaoJogador, resolverPartida);
      await hooks?.aoResolverConfrontoMataMata?.({ etapa: etapa.nome, confronto });
      confrontos.push(confronto);
      if (confronto.partidasDoJogador) fase.partidasDoJogador.push(...confronto.partidasDoJogador);
    }
    fase.vivos = confrontos.map((c) => c.vencedor);
    fase.resultados.push({ nome: etapa.nome, confrontos, vencedores: fase.vivos });
  }

  fase.indiceAtual++;
  if (fase.indiceAtual >= fase.etapas.length) fase.concluida = true;
}

async function avancarRepechaje(
  fase: FaseRepechaje,
  ratings: Record<string, number>,
  random: () => number,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  resolverPartida: ResolverPartida,
  hooks?: HooksDeFase,
): Promise<void> {
  const indice = fase.indiceAtual;
  const confronto = await resolverConfronto(fase.segundosSula[indice], fase.terceirosLibertadores[indice], ratings, true, random, participacaoJogador, resolverPartida);
  await hooks?.aoResolverConfrontoMataMata?.({ etapa: fase.nome, confronto });
  fase.vencedores.push(confronto.vencedor);
  if (confronto.partidasDoJogador) fase.partidasDoJogador.push(...confronto.partidasDoJogador);

  fase.indiceAtual++;
  if (fase.indiceAtual >= fase.segundosSula.length) fase.concluida = true;
}

function classificadosDaFase(fase: FaseRodadas): string[] {
  return fase.grupos.flatMap((grupo) => ordenarTabela([...grupo.tabela.values()]).slice(0, fase.classificamPorGrupo).map((linha) => linha.clubeId));
}

function tabelaDoGrupoUnico(fase: FaseRodadas): LinhaTabela[] {
  return ordenarTabela([...fase.grupos[0].tabela.values()]);
}

function tabelasPorGrupo(fase: FaseRodadas): { nome: string; tabela: LinhaTabela[] }[] {
  return fase.grupos.map((grupo) => ({ nome: grupo.nome, tabela: ordenarTabela([...grupo.tabela.values()]) }));
}

/** Ordena times por rating, do mais forte ao mais fraco — mesma função de `engine.ts` (duplicada aqui, pequena e pura, pra não criar dependência cruzada só por 3 linhas). */
function ordenarPorForca(times: string[], ratings: Record<string, number>): string[] {
  return [...times].sort((a, b) => (ratings[b] ?? 0) - (ratings[a] ?? 0));
}

// ---------------------------------------------------------------------------
// Programa por competição: uma sequência de "passos", cada um construindo
// (só quando chega a vez dele, já que os participantes dependem do passo
// anterior) e resolvendo uma `Fase`, com um `contexto` compartilhado onde
// cada passo grava o que o próximo precisa ler (classificados, campeões
// parciais, etc).
// ---------------------------------------------------------------------------

export interface ContextoDePrograma {
  campeao?: string;
  [chave: string]: unknown;
}

interface PassoDePrograma {
  /** Quantas "unidades" (rodadas ou etapas) esse passo consome — conhecido de antemão (só depende de números estáticos do formato, nunca de quem classifica), usado pra espalhar as semanas uniformemente entre todos os passos do programa. */
  unidades: number;
  /** Se ausente, o passo está sempre pronto pra começar assim que for a vez dele. Usado só pelo repechaje conjunto, que depende de outra competição (Libertadores) já ter concluído sua fase de grupos. */
  estaPronta?: (ctx: ContextoDePrograma) => boolean;
  criar: (ctx: ContextoDePrograma) => Fase;
  aoConcluir: (fase: Fase, ctx: ContextoDePrograma) => void;
}

function passosPontosCorridos(campeonato: CampeonatoSimulavel): PassoDePrograma[] {
  const idaEVolta = campeonato.formato.pontos_corridos!.ida_e_volta;
  return [
    {
      unidades: totalDeRodadas(campeonato.times.length, idaEVolta),
      criar: () => criarFaseRodadas("liga", [campeonato.times], idaEVolta, 1),
      aoConcluir: (fase, ctx) => {
        ctx.campeao = tabelaDoGrupoUnico(fase as FaseRodadas)[0].clubeId;
      },
    },
  ];
}

function passosFaseSuicaEMataMata(campeonato: CampeonatoSimulavel, random: () => number): PassoDePrograma[] {
  const suica = campeonato.formato.fase_suica!;
  const mataMata = campeonato.formato.mata_mata!;
  return [
    {
      unidades: totalDeRodadasSuica(suica),
      criar: () => criarFaseRodadasSuica("suica", campeonato.times, suica, random),
      aoConcluir: (fase, ctx) => {
        ctx.classificados = classificadosDaFase(fase as FaseRodadas);
      },
    },
    {
      unidades: mataMata.fases.length,
      criar: (ctx) =>
        criarFaseMataMata(
          "mata_mata",
          mataMata.fases.map((nome, indice) => ({ nome, ida_e_volta: mataMata.ida_e_volta, entrantes: indice === 0 ? (ctx.classificados as string[]) : undefined })),
        ),
      aoConcluir: (fase, ctx) => {
        ctx.campeao = (fase as FaseMataMata).vivos[0];
      },
    },
  ];
}

function passosFaseSuicaMataMataEFinal(campeonato: CampeonatoSimulavel, random: () => number): PassoDePrograma[] {
  const suica = campeonato.formato.fase_suica!;
  const mataMata = campeonato.formato.mata_mata!;
  const final = campeonato.formato.final_estadual!;
  return [
    {
      unidades: totalDeRodadasSuica(suica),
      criar: () => criarFaseRodadasSuica("suica", campeonato.times, suica, random),
      aoConcluir: (fase, ctx) => {
        ctx.classificados = classificadosDaFase(fase as FaseRodadas);
      },
    },
    {
      unidades: mataMata.fases.length,
      criar: (ctx) =>
        criarFaseMataMata(
          "mata_mata",
          mataMata.fases.map((nome, indice) => ({ nome, ida_e_volta: mataMata.ida_e_volta, entrantes: indice === 0 ? (ctx.classificados as string[]) : undefined })),
        ),
      aoConcluir: (fase, ctx) => {
        ctx.finalistas = (fase as FaseMataMata).vivos;
      },
    },
    {
      unidades: 1,
      criar: (ctx) => criarFaseMataMata("final", [{ nome: "final", ida_e_volta: final.ida_e_volta, entrantes: ctx.finalistas as string[] }]),
      aoConcluir: (fase, ctx) => {
        ctx.campeao = (fase as FaseMataMata).vivos[0];
      },
    },
  ];
}

/** Carioca (por id — mesma ressalva de `engine.ts` `receitaCarioca`: combinação de blocos ambígua, não dá pra despachar genericamente). */
function passosCarioca(campeonato: CampeonatoSimulavel): PassoDePrograma[] {
  const turno = campeonato.formato.turno!;
  const returno = campeonato.formato.returno!;
  const final = campeonato.formato.final_estadual!;
  return [
    {
      unidades: totalDeRodadas(campeonato.times.length, turno.ida_e_volta),
      criar: () => criarFaseRodadas("taca_guanabara", [campeonato.times], turno.ida_e_volta, 1),
      aoConcluir: (fase, ctx) => {
        ctx.campeaoTurno = tabelaDoGrupoUnico(fase as FaseRodadas)[0].clubeId;
      },
    },
    {
      unidades: totalDeRodadas(campeonato.times.length, returno.ida_e_volta),
      criar: () => criarFaseRodadas("taca_rio", [campeonato.times], returno.ida_e_volta, 1),
      aoConcluir: (fase, ctx) => {
        ctx.campeaoReturno = tabelaDoGrupoUnico(fase as FaseRodadas)[0].clubeId;
      },
    },
    {
      unidades: 1,
      criar: (ctx) => {
        const a = ctx.campeaoTurno as string;
        const b = ctx.campeaoReturno as string;
        return criarFaseMataMata("final", [{ nome: "final", ida_e_volta: final.ida_e_volta, entrantes: a === b ? [a] : [a, b] }]);
      },
      aoConcluir: (fase, ctx) => {
        ctx.campeao = (fase as FaseMataMata).vivos[0];
      },
    },
  ];
}

function passosFaseGruposFaseQuadrangularEFinal(campeonato: CampeonatoSimulavel, ratings: Record<string, number>): PassoDePrograma[] {
  const fg = campeonato.formato.fase_grupos!;
  const fq = campeonato.formato.fase_quadrangular!;
  const final = campeonato.formato.final_estadual!;
  return [
    {
      unidades: totalDeRodadas(fg.times_por_grupo, fg.ida_e_volta),
      criar: () => criarFaseRodadas("grupos", dividirEmGruposPorForca(campeonato.times, fg.num_grupos, ratings).map((g) => g.times), fg.ida_e_volta, fg.classificam_por_grupo),
      aoConcluir: (fase, ctx) => {
        ctx.classificadosGrupos = classificadosDaFase(fase as FaseRodadas);
      },
    },
    {
      unidades: totalDeRodadas(fq.times_por_grupo, true),
      criar: (ctx) =>
        criarFaseRodadas("quadrangular", dividirEmGruposPorForca(ctx.classificadosGrupos as string[], fq.num_grupos, ratings).map((g) => g.times), true, fq.classificam_por_grupo),
      aoConcluir: (fase, ctx) => {
        ctx.lideres = tabelasPorGrupo(fase as FaseRodadas).map((g) => g.tabela[0].clubeId);
      },
    },
    {
      unidades: 1,
      criar: (ctx) => {
        const [a, b] = ctx.lideres as string[];
        return criarFaseMataMata("final", [{ nome: "final", ida_e_volta: final.ida_e_volta, entrantes: a === b ? [a] : [a, b] }]);
      },
      aoConcluir: (fase, ctx) => {
        ctx.campeao = (fase as FaseMataMata).vivos[0];
      },
    },
  ];
}

function passosFaseGruposEMataMata(campeonato: CampeonatoSimulavel, ratings: Record<string, number>): PassoDePrograma[] {
  const fg = campeonato.formato.fase_grupos!;
  const mataMata = campeonato.formato.mata_mata!;
  return [
    {
      unidades: totalDeRodadas(fg.times_por_grupo, fg.ida_e_volta),
      criar: () => criarFaseRodadas("grupos", dividirEmGruposPorForca(campeonato.times, fg.num_grupos, ratings).map((g) => g.times), fg.ida_e_volta, fg.classificam_por_grupo),
      aoConcluir: (fase, ctx) => {
        ctx.classificados = classificadosDaFase(fase as FaseRodadas);
      },
    },
    {
      unidades: mataMata.fases.length,
      criar: (ctx) =>
        criarFaseMataMata(
          "mata_mata",
          mataMata.fases.map((nome, indice) => ({ nome, ida_e_volta: mataMata.ida_e_volta, entrantes: indice === 0 ? (ctx.classificados as string[]) : undefined })),
        ),
      aoConcluir: (fase, ctx) => {
        ctx.campeao = (fase as FaseMataMata).vivos[0];
      },
    },
  ];
}

function passosMataMata(campeonato: CampeonatoSimulavel): PassoDePrograma[] {
  const mataMata = campeonato.formato.mata_mata!;
  const etapas = mataMata.etapas ?? mataMata.fases.map((nome, indice) => ({ nome, ida_e_volta: mataMata.ida_e_volta, entrantes: indice === 0 ? campeonato.times : undefined }));
  return [
    {
      unidades: etapas.length,
      criar: () => criarFaseMataMata("mata_mata", etapas),
      aoConcluir: (fase, ctx) => {
        ctx.campeao = (fase as FaseMataMata).vivos[0];
      },
    },
  ];
}

function construirPassos(campeonato: CampeonatoSimulavel, ratings: Record<string, number>, random: () => number): PassoDePrograma[] {
  if (campeonato.id === "carioca_a") return passosCarioca(campeonato);

  const formato = campeonato.formato;
  const blocos = Object.keys(formato)
    .filter((chave) => chave !== "tabela_acumulada")
    .sort()
    .join(",");

  switch (blocos) {
    case "pontos_corridos":
      return passosPontosCorridos(campeonato);
    case "fase_suica,mata_mata":
      return passosFaseSuicaEMataMata(campeonato, random);
    case "fase_suica,final_estadual,mata_mata":
      return passosFaseSuicaMataMataEFinal(campeonato, random);
    case "fase_grupos,fase_quadrangular,final_estadual":
      return passosFaseGruposFaseQuadrangularEFinal(campeonato, ratings);
    case "fase_grupos,mata_mata":
      // Só chega aqui pra combinações SEM `mata_mata.etapas` (Série D) — Libertadores/Sul-Americana
      // (que têm `etapas`) são interceptadas antes disso, ver `criarCompeticoesIncrementaisDaTemporada`.
      return passosFaseGruposEMataMata(campeonato, ratings);
    case "mata_mata":
      return passosMataMata(campeonato);
    default:
      throw new Error(`incremental: sem receita incremental pra combinação de blocos [${blocos}] (campeonato ${campeonato.id})`);
  }
}

// ---------------------------------------------------------------------------
// Estado de uma competição incremental (avulsa) e o driver semanal.
// ---------------------------------------------------------------------------

export interface CompeticaoIncremental {
  campeonatoId: string;
  ratings: Record<string, number>;
  participacaoJogador: ParticipacaoJogadorClube | undefined;
  semanaInicio: number;
  semanaFim: number;
  totalUnidades: number;
  unidadesConcluidas: number;
  passos: PassoDePrograma[];
  indicePasso: number;
  faseAtual?: Fase;
  contexto: ContextoDePrograma;
  concluida: boolean;
  campeao?: string;
  partidasDoJogador: ResultadoPartida[];
}

function criarEstadoIncremental(
  campeonatoId: string,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  janela: JanelaDeSemanas,
  passos: PassoDePrograma[],
): CompeticaoIncremental {
  const totalUnidades = passos.reduce((soma, passo) => soma + passo.unidades, 0);
  return {
    campeonatoId,
    ratings,
    participacaoJogador,
    semanaInicio: janela.semanaInicio,
    semanaFim: janela.semanaFim,
    totalUnidades,
    unidadesConcluidas: 0,
    passos,
    indicePasso: 0,
    contexto: {},
    concluida: totalUnidades === 0,
    partidasDoJogador: [],
  };
}

export function criarCompeticaoIncremental(
  campeonato: CampeonatoSimulavel,
  ratings: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  janela: JanelaDeSemanas,
  random: () => number,
): CompeticaoIncremental {
  return criarEstadoIncremental(campeonato.id, ratings, participacaoJogador, janela, construirPassos(campeonato, ratings, random));
}

function semanaDaProximaUnidade(estado: CompeticaoIncremental): number {
  if (estado.totalUnidades === 0) return estado.semanaInicio;
  const fracao = estado.unidadesConcluidas / estado.totalUnidades;
  return estado.semanaInicio + Math.floor(fracao * (estado.semanaFim - estado.semanaInicio + 1));
}

/**
 * Avança uma competição incremental até a `semanaAtual` — resolve toda
 * rodada/etapa cujo "horário" (`semanaDaProximaUnidade`) já chegou, uma de
 * cada vez, na ordem do programa. Idempotente dentro da mesma semana: se
 * não houver nada pendente, não faz nada. Chamado uma vez por semana do
 * loop de carreira (`career/career-loop.ts` `jogarTemporadaSemanal`) pra
 * CADA competição ativa da temporada (do jogador, seguida, ou nenhuma das
 * duas — o mecanismo de resolução é o mesmo pras três, só a UI muda).
 */
export async function avancarSemana(
  estado: CompeticaoIncremental,
  semanaAtual: number,
  random: () => number,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
  hooks?: HooksDeFase,
): Promise<void> {
  while (!estado.concluida && semanaAtual >= semanaDaProximaUnidade(estado)) {
    const passo = estado.passos[estado.indicePasso];

    if (!estado.faseAtual) {
      if (passo.estaPronta && !passo.estaPronta(estado.contexto)) break; // aguarda dependência externa (ex: repechaje aguardando Libertadores)
      estado.faseAtual = passo.criar(estado.contexto);
    }

    if (!estado.faseAtual.concluida) {
      if (estado.faseAtual.tipo === "rodadas") {
        await avancarRodada(estado.faseAtual, estado.ratings, random, estado.participacaoJogador, resolverPartida, hooks);
      } else if (estado.faseAtual.tipo === "mata_mata") {
        await avancarEtapa(estado.faseAtual, estado.ratings, random, estado.participacaoJogador, resolverPartida, hooks);
      } else {
        await avancarRepechaje(estado.faseAtual, estado.ratings, random, estado.participacaoJogador, resolverPartida, hooks);
      }
      estado.unidadesConcluidas++;
    }

    if (estado.faseAtual.concluida) {
      passo.aoConcluir(estado.faseAtual, estado.contexto);
      estado.partidasDoJogador.push(...estado.faseAtual.partidasDoJogador);
      estado.faseAtual = undefined;
      estado.indicePasso++;

      if (estado.indicePasso >= estado.passos.length) {
        estado.concluida = true;
        estado.campeao = estado.contexto.campeao as string;
      }
    }
  }
}

/** Tabela corrente da fase em andamento — só definida quando a fase atual é de grupo único (liga, fase suíça, turno/returno); `undefined` em fase de mata-mata ou de múltiplos grupos (pendência de UI: não daria pra mostrar "uma" tabela só nesses casos). Usada pelo resumo por período de competições seguidas (ver `career/career-loop.ts`). */
export function tabelaAtualDaCompeticao(estado: CompeticaoIncremental): LinhaTabela[] | undefined {
  const fase = estado.faseAtual;
  if (fase && fase.tipo === "rodadas" && fase.grupos.length === 1) {
    return tabelaDoGrupoUnico(fase);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Caso conjunto Libertadores + Sul-Americana — ver
// `simulation/engine.ts` `receitaLibertadoresESulAmericanaConjunta` pro
// motor "em lote" equivalente (essa é a versão incremental).
// ---------------------------------------------------------------------------

/**
 * Deriva o corte entre as etapas pré-classificatórias de `mata_mata.etapas`
 * (que acontecem ANTES da fase de grupos) e as etapas finais (que
 * acontecem DEPOIS) — mesma lógica (e mesma limitação: só fecha certo pra
 * Libertadores, não pra Sul-Americana isolada) de `engine.ts`
 * `resolverPreClassificatorioDeFaseDeGrupos`, duplicada aqui porque lá ela
 * está entrelaçada com a resolução síncrona das partidas (não dá pra
 * reaproveitar sem reestruturar o motor em lote) — mas o cálculo em si é
 * puro (só conta `entrantes.length`, nunca resultado de partida), então a
 * duplicação não arrisca os dois motores divergirem em como CONTAM, só
 * em COMO resolvem.
 */
function derivarCortePreClassificatorio(campeonato: CampeonatoSimulavel): { etapasPreClassificatorias: EtapaMataMata[]; etapasRestantes: EtapaMataMata[]; diretos: string[] } {
  const faseGrupos = campeonato.formato.fase_grupos!;
  const etapas = campeonato.formato.mata_mata!.etapas!;
  const tamanhoDaFaseDeGrupos = faseGrupos.num_grupos * faseGrupos.times_por_grupo;

  const listadosComoEntrantes = new Set(etapas.flatMap((etapa) => etapa.entrantes ?? []));
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
    throw new Error(`${campeonato.id}: não foi possível derivar o corte entre as etapas pré-classificatórias e a fase de grupos (motor incremental)`);
  }

  return {
    etapasPreClassificatorias: etapas.slice(0, indiceDeCorte + 1),
    etapasRestantes: etapas.slice(indiceDeCorte + 1),
    diretos,
  };
}

function passosLibertadores(campeonato: CampeonatoSimulavel, ratings: Record<string, number>): PassoDePrograma[] {
  const { etapasPreClassificatorias, etapasRestantes, diretos } = derivarCortePreClassificatorio(campeonato);
  const fg = campeonato.formato.fase_grupos!;

  return [
    {
      unidades: etapasPreClassificatorias.length,
      criar: () => criarFaseMataMata("pre_classificatorio", etapasPreClassificatorias),
      aoConcluir: (fase, ctx) => {
        ctx.timesDaFaseDeGrupos = [...diretos, ...(fase as FaseMataMata).vivos];
      },
    },
    {
      // classifica 3 por grupo (não só os 2 que declaradamente avançam) — o 3º alimenta o repechaje da Sul-Americana.
      unidades: totalDeRodadas(fg.times_por_grupo, fg.ida_e_volta),
      criar: (ctx) => criarFaseRodadas("grupos", dividirEmGruposPorForca(ctx.timesDaFaseDeGrupos as string[], fg.num_grupos, ratings).map((g) => g.times), fg.ida_e_volta, 3),
      aoConcluir: (fase, ctx) => {
        const porGrupo = tabelasPorGrupo(fase as FaseRodadas);
        ctx.classificados = porGrupo.flatMap((g) => g.tabela.slice(0, 2).map((linha) => linha.clubeId));
        ctx.terceiros = porGrupo.map((g) => g.tabela[2].clubeId);
      },
    },
    {
      unidades: etapasRestantes.length,
      criar: (ctx) =>
        criarFaseMataMata(
          "mata_mata_final",
          etapasRestantes.map((etapa, indice) => ({
            nome: etapa.nome,
            ida_e_volta: etapa.ida_e_volta,
            entrantes: indice === 0 ? [...(ctx.classificados as string[]), ...(etapa.entrantes ?? [])] : etapa.entrantes,
          })),
        ),
      aoConcluir: (fase, ctx) => {
        ctx.campeao = (fase as FaseMataMata).vivos[0];
      },
    },
  ];
}

function passosSulAmericana(campeonato: CampeonatoSimulavel, ratings: Record<string, number>, libertadores: CompeticaoIncremental): PassoDePrograma[] {
  const { etapasPreClassificatorias, etapasRestantes, diretos } = derivarCortePreClassificatorio(campeonato);
  // "repescagem" já é resolvida à parte pelo passo de repechaje abaixo (empareada por lado de
  // origem, não pelo emparelhamento genérico por força) — não entra de novo nas etapas finais.
  const etapasPosRepechaje = etapasRestantes.filter((etapa) => etapa.nome !== "repescagem");
  const fg = campeonato.formato.fase_grupos!;

  return [
    {
      unidades: etapasPreClassificatorias.length,
      criar: () => criarFaseMataMata("pre_classificatorio", etapasPreClassificatorias),
      aoConcluir: (fase, ctx) => {
        ctx.timesDaFaseDeGrupos = [...diretos, ...(fase as FaseMataMata).vivos];
      },
    },
    {
      unidades: totalDeRodadas(fg.times_por_grupo, fg.ida_e_volta),
      criar: (ctx) => criarFaseRodadas("grupos", dividirEmGruposPorForca(ctx.timesDaFaseDeGrupos as string[], fg.num_grupos, ratings).map((g) => g.times), fg.ida_e_volta, fg.classificam_por_grupo),
      aoConcluir: (fase, ctx) => {
        const porGrupo = tabelasPorGrupo(fase as FaseRodadas);
        ctx.lideres = porGrupo.map((g) => g.tabela[0].clubeId);
        ctx.segundos = porGrupo.map((g) => g.tabela[1].clubeId);
      },
    },
    {
      unidades: fg.num_grupos,
      estaPronta: () => libertadores.contexto.terceiros !== undefined,
      criar: (ctx) => criarFaseRepechaje(ordenarPorForca(ctx.segundos as string[], ratings), ordenarPorForca(libertadores.contexto.terceiros as string[], libertadores.ratings)),
      aoConcluir: (fase, ctx) => {
        ctx.classificadosDoRepechaje = (fase as FaseRepechaje).vencedores;
      },
    },
    {
      unidades: etapasPosRepechaje.length,
      criar: (ctx) =>
        criarFaseMataMata(
          "mata_mata_final",
          etapasPosRepechaje.map((etapa, indice) => ({
            nome: etapa.nome,
            ida_e_volta: etapa.ida_e_volta,
            entrantes: indice === 0 ? [...(ctx.lideres as string[]), ...(ctx.classificadosDoRepechaje as string[])] : etapa.entrantes,
          })),
        ),
      aoConcluir: (fase, ctx) => {
        ctx.campeao = (fase as FaseMataMata).vivos[0];
      },
    },
  ];
}

export interface CompeticaoIncrementalConjunta {
  tipo: "conjunta_lib_sula";
  lib: CompeticaoIncremental;
  sula: CompeticaoIncremental;
}

export function criarCompeticaoIncrementalConjunta(
  libertadores: CampeonatoSimulavel,
  sulAmericana: CampeonatoSimulavel,
  ratingsLibertadores: Record<string, number>,
  ratingsSulAmericana: Record<string, number>,
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  janela: JanelaDeSemanas,
): CompeticaoIncrementalConjunta {
  const participacaoLib = participacaoJogador && libertadores.times.includes(participacaoJogador.clubeId) ? participacaoJogador : undefined;
  const participacaoSula = participacaoJogador && sulAmericana.times.includes(participacaoJogador.clubeId) ? participacaoJogador : undefined;
  // um time que cai da Libertadores pro repechaje da Sul-Americana pode seguir jogando (e até ser
  // campeão) — os ratings dele (só cadastrados em ratingsLibertadores) precisam estar disponíveis
  // desde já pro lado Sul-Americana também (ver mesmo bug/fix documentado em `engine.ts`).
  const ratingsSulAmericanaComCruzados = { ...ratingsSulAmericana, ...ratingsLibertadores };

  const lib = criarEstadoIncremental(libertadores.id, ratingsLibertadores, participacaoLib, janela, []);
  lib.passos = passosLibertadores(libertadores, ratingsLibertadores);
  lib.totalUnidades = lib.passos.reduce((soma, passo) => soma + passo.unidades, 0);
  lib.concluida = lib.totalUnidades === 0;

  const sula = criarEstadoIncremental(sulAmericana.id, ratingsSulAmericanaComCruzados, participacaoSula, janela, []);
  sula.passos = passosSulAmericana(sulAmericana, ratingsSulAmericanaComCruzados, lib);
  sula.totalUnidades = sula.passos.reduce((soma, passo) => soma + passo.unidades, 0);
  sula.concluida = sula.totalUnidades === 0;

  return { tipo: "conjunta_lib_sula", lib, sula };
}

export async function avancarSemanaConjunta(
  estado: CompeticaoIncrementalConjunta,
  semanaAtual: number,
  random: () => number,
  resolverPartida: ResolverPartida = resolverPartidaPadrao,
  hooksLib?: HooksDeFase,
  hooksSula?: HooksDeFase,
): Promise<void> {
  await avancarSemana(estado.lib, semanaAtual, random, resolverPartida, hooksLib);
  await avancarSemana(estado.sula, semanaAtual, random, resolverPartida, hooksSula);
}

// ---------------------------------------------------------------------------
// Monta todas as competições ativas da temporada, incrementais — equivalente
// de `engine.ts` `simularTemporada`, só que devolvendo estado resumível em
// vez de já ter resolvido tudo.
// ---------------------------------------------------------------------------

export interface CompeticoesDaTemporada {
  avulsas: Map<string, CompeticaoIncremental>;
  conjuntas: CompeticaoIncrementalConjunta[];
  /** Competições ativas que não puderam ser montadas (sem receita incremental, dados ausentes) — mesma tolerância a falha parcial de `engine.ts` `ResultadoCompeticaoNaTemporada.erro`. */
  erros: { campeonatoId: string; erro: string }[];
}

export function criarCompeticoesIncrementaisDaTemporada(
  temporada: number,
  campeonatos: CampeonatoSimulavel[],
  clubes: Club[],
  participacaoJogador: ParticipacaoJogadorClube | undefined,
  random: () => number,
): CompeticoesDaTemporada {
  const calendario = construirCalendarioPadrao(temporada);
  const idsAtivos = new Set(calendario.calendario.flatMap((periodo) => periodo.competicoes_ativas));
  const campeonatoPorId = new Map(campeonatos.map((c) => [c.id, c]));
  const clubePorId = new Map(clubes.map((c) => [c.id, c]));

  const avulsas = new Map<string, CompeticaoIncremental>();
  const conjuntas: CompeticaoIncrementalConjunta[] = [];
  const erros: { campeonatoId: string; erro: string }[] = [];
  const idsJaTratados = new Set<string>();

  const libertadores = campeonatoPorId.get("libertadores");
  const sulAmericana = campeonatoPorId.get("sulamericana");
  if (idsAtivos.has("libertadores") && idsAtivos.has("sulamericana") && libertadores && sulAmericana) {
    try {
      const ratingsLib = Object.fromEntries(libertadores.times.map((clubeId) => [clubeId, obterRating(clubePorId.get(clubeId)!)]));
      const ratingsSula = Object.fromEntries(sulAmericana.times.map((clubeId) => [clubeId, obterRating(clubePorId.get(clubeId)!)]));
      const janela = janelaDeSemanasPorCompeticao("libertadores", calendario)!;
      conjuntas.push(criarCompeticaoIncrementalConjunta(libertadores, sulAmericana, ratingsLib, ratingsSula, participacaoJogador, janela));
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      erros.push({ campeonatoId: "libertadores", erro: mensagem }, { campeonatoId: "sulamericana", erro: mensagem });
    }
    idsJaTratados.add("libertadores");
    idsJaTratados.add("sulamericana");
  }

  for (const campeonatoId of idsAtivos) {
    if (idsJaTratados.has(campeonatoId)) continue;

    const campeonato = campeonatoPorId.get(campeonatoId);
    if (!campeonato) {
      erros.push({ campeonatoId, erro: "competição não encontrada nos campeonatos carregados" });
      continue;
    }

    try {
      const ratings = Object.fromEntries(campeonato.times.map((clubeId) => [clubeId, obterRating(clubePorId.get(clubeId)!)]));
      const participacaoNestaCompeticao = participacaoJogador && campeonato.times.includes(participacaoJogador.clubeId) ? participacaoJogador : undefined;
      const janela = janelaDeSemanasPorCompeticao(campeonatoId, calendario)!;
      avulsas.set(campeonatoId, criarCompeticaoIncremental(campeonato, ratings, participacaoNestaCompeticao, janela, random));
    } catch (erro) {
      erros.push({ campeonatoId, erro: erro instanceof Error ? erro.message : String(erro) });
    }
  }

  return { avulsas, conjuntas, erros };
}
