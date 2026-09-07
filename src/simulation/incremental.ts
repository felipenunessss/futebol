import type { Club } from "../schemas/club.js";
import type { EtapaMataMata, FaseSuica, FaseUnica } from "../schemas/championship.js";
import { construirCalendarioPadrao, janelaDeSemanasPorCompeticao, type JanelaDeSemanas } from "../data/loaders/calendario.js";
import type { CampeonatoSimulavel } from "./engine.js";
import {
  atualizarLinha,
  gerarConfrontosPontosCorridos,
  linhaVazia,
  ordenarTabela,
  somarTabelas,
  type Confronto,
  type EventoConfrontoPontosCorridos,
  type LinhaTabela,
} from "./season.js";
import { gerarConfrontosFaseSuica } from "./swiss.js";
import { dividirEmGruposPorForca, type Grupo } from "./groups.js";
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

/**
 * Variante de fase de rodadas pra grupos formados por CORTE de uma tabela anterior (não por força/
 * sorteio nem por tamanho igual) — usada só pelo Equador (`FaseFinalPorClassificacao`, ver
 * `schemas/championship.ts`): o 1º grupo reúne os melhores colocados da fase anterior, o último os
 * piores, e cada grupo pode ter um tamanho diferente dos outros (`avancarRodada` já lida bem com
 * isso — cada grupo só tem confrontos até a própria rodada final, rodadas a mais não encontram
 * nada pra resolver naquele grupo). Se `pontosCarregados`, cada time entra na fase final já com os
 * pontos que tinha antes (soma, não zera).
 */
function criarFaseRodadasPorClassificacao(
  nome: string,
  tabelaAnterior: LinhaTabela[],
  gruposConfig: { nome: string; tamanho: number }[],
  idaEVolta: boolean,
  pontosCarregados: boolean,
): FaseRodadas {
  const pontosAntes = new Map(tabelaAnterior.map((linha) => [linha.clubeId, linha.pontos]));

  let indice = 0;
  const grupos: GrupoDeRodadas[] = gruposConfig.map((config) => {
    const timesDoGrupo = tabelaAnterior.slice(indice, indice + config.tamanho).map((linha) => linha.clubeId);
    indice += config.tamanho;

    const tabela = new Map(
      timesDoGrupo.map((id) => {
        const linha = linhaVazia(id);
        if (pontosCarregados) linha.pontos = pontosAntes.get(id) ?? 0;
        return [id, linha] as const;
      }),
    );
    return { nome: config.nome, confrontos: gerarConfrontosPontosCorridos(timesDoGrupo, idaEVolta), tabela };
  });

  const totalRodadas = Math.max(0, ...grupos.flatMap((g) => g.confrontos.map((c) => c.rodada)));
  return { tipo: "rodadas", nome, grupos, classificamPorGrupo: 0, rodadaAtual: 1, totalRodadas, partidasDoJogador: [], concluida: totalRodadas === 0 };
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

/**
 * Mesma validação de `groups.ts` `simularFaseDeGruposDoFormato` — confere que a contagem de times
 * bate com `numGrupos × timesPorGrupo` antes de dividir, pra falhar alto (erro claro só naquela
 * competição, sem derrubar as demais — mesmo tratamento de `criarCompeticoesIncrementaisDaTemporada`)
 * em vez de formar grupos quebrados silenciosamente quando o dado não reconcilia (ex:
 * `venezuela_segunda`, dado incompatível já documentado em `docs/dados-a-verificar.md`).
 */
function dividirEmGruposValidado(times: string[], numGrupos: number, timesPorGrupo: number, ratings: Record<string, number>, contexto: string): Grupo[] {
  const esperado = numGrupos * timesPorGrupo;
  if (times.length !== esperado) {
    throw new Error(`${contexto}: esperava ${esperado} times (${numGrupos} grupos de ${timesPorGrupo}), recebeu ${times.length}`);
  }
  return dividirEmGruposPorForca(times, numGrupos, ratings);
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

/**
 * `mata_mata` + `pontos_corridos` (Chile 2ª divisão) — espelha `engine.ts`
 * `receitaPontosCorridosComLiguilla`: temporada inteira de pontos corridos decide a tabela, os
 * `2^(nº de fases do mata_mata)` melhores colocados disputam uma liguilla de acesso.
 */
function passosPontosCorridosComLiguilla(campeonato: CampeonatoSimulavel): PassoDePrograma[] {
  const idaEVolta = campeonato.formato.pontos_corridos!.ida_e_volta;
  const mataMata = campeonato.formato.mata_mata!;
  const quantidadeClassificados = Math.pow(2, mataMata.fases.length);

  return [
    {
      unidades: totalDeRodadas(campeonato.times.length, idaEVolta),
      criar: () => criarFaseRodadas("liga", [campeonato.times], idaEVolta, quantidadeClassificados),
      aoConcluir: (fase, ctx) => {
        ctx.classificados = classificadosDaFase(fase as FaseRodadas);
      },
    },
    {
      unidades: mataMata.fases.length,
      criar: (ctx) =>
        criarFaseMataMata(
          "liguilla",
          mataMata.fases.map((nome, indice) => ({ nome, ida_e_volta: mataMata.ida_e_volta, entrantes: indice === 0 ? (ctx.classificados as string[]) : undefined })),
        ),
      aoConcluir: (fase, ctx) => {
        ctx.campeao = (fase as FaseMataMata).vivos[0];
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

/**
 * Uruguai 1ª divisão (por id, mesmo critério de `engine.ts` `receitaUruguaiPrimeira`): Apertura e
 * Clausura decididos pelo topo da própria tabela; mesmo clube campeão dos 2 = campeão automático;
 * senão, semifinal entre os 2 campeões de torneio — se o líder da Tabla Anual (soma Apertura+
 * Clausura) for um dos 2 semifinalistas, quem vencer a semifinal já é campeão; senão, o vencedor
 * da semifinal ainda precisa vencer uma final contra o líder. Os 2 casos condicionais (auto-campeão
 * sem semifinal, e semifinal decide sozinha sem final) reaproveitam a mesma degradação de
 * `avancarEtapa` pra etapa de 1 entrante só — só varia a lista de entrantes montada depois que
 * Apertura/Clausura concluem.
 */
function passosUruguaiPrimeira(campeonato: CampeonatoSimulavel): PassoDePrograma[] {
  const turno = campeonato.formato.turno!;
  const returno = campeonato.formato.returno!;
  const mataMata = campeonato.formato.mata_mata!;
  return [
    {
      unidades: totalDeRodadas(campeonato.times.length, turno.ida_e_volta),
      criar: () => criarFaseRodadas("apertura", [campeonato.times], turno.ida_e_volta, 1),
      aoConcluir: (fase, ctx) => {
        const tabelaApertura = tabelaDoGrupoUnico(fase as FaseRodadas);
        ctx.tabelaApertura = tabelaApertura;
        ctx.campeaoApertura = tabelaApertura[0].clubeId;
      },
    },
    {
      unidades: totalDeRodadas(campeonato.times.length, returno.ida_e_volta),
      criar: () => criarFaseRodadas("clausura", [campeonato.times], returno.ida_e_volta, 1),
      aoConcluir: (fase, ctx) => {
        const tabelaClausura = tabelaDoGrupoUnico(fase as FaseRodadas);
        const campeaoApertura = ctx.campeaoApertura as string;
        const campeaoClausura = tabelaClausura[0].clubeId;
        ctx.campeaoClausura = campeaoClausura;

        if (campeaoApertura === campeaoClausura) {
          ctx.entrantesSemifinal = [campeaoApertura];
          ctx.entrantesFinal = undefined;
        } else {
          const tabelaAnual = somarTabelas([ctx.tabelaApertura as LinhaTabela[], tabelaClausura]);
          const lider = tabelaAnual[0].clubeId;
          ctx.entrantesSemifinal = [campeaoApertura, campeaoClausura];
          ctx.entrantesFinal = lider === campeaoApertura || lider === campeaoClausura ? undefined : [lider];
        }
      },
    },
    {
      unidades: 2,
      criar: (ctx) =>
        criarFaseMataMata("mata_mata", [
          { nome: "semifinal", ida_e_volta: mataMata.ida_e_volta, entrantes: ctx.entrantesSemifinal as string[] },
          { nome: "final", ida_e_volta: mataMata.ida_e_volta, entrantes: ctx.entrantesFinal as string[] | undefined },
        ]),
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

/**
 * Peru 1ª divisão (por id — mesma combinação de blocos que Argentina 1ª, `final_estadual,returno,turno`,
 * com significado diferente, ver `engine.ts` `receitaPeruPrimeira`): mesmo clube campeão dos 2
 * torneios = campeão automático; senão, liguilla de 4 (2 campeões de torneio + 2 melhores do
 * acumulado). O caso automático reaproveita a degradação que `avancarEtapa` já faz pra uma etapa
 * de 1 entrante só (sem jogo) — não precisa de nenhum mecanismo novo, só montar a lista de
 * entrantes certa depois que turno/returno concluem.
 */
function passosPeruPrimeira(campeonato: CampeonatoSimulavel): PassoDePrograma[] {
  const turno = campeonato.formato.turno!;
  const returno = campeonato.formato.returno!;
  const finalEstadual = campeonato.formato.final_estadual!;
  return [
    {
      unidades: totalDeRodadas(campeonato.times.length, turno.ida_e_volta),
      criar: () => criarFaseRodadas("turno", [campeonato.times], turno.ida_e_volta, 1),
      aoConcluir: (fase, ctx) => {
        const tabelaTurno = tabelaDoGrupoUnico(fase as FaseRodadas);
        ctx.tabelaTurno = tabelaTurno;
        ctx.campeaoApertura = tabelaTurno[0].clubeId;
      },
    },
    {
      unidades: totalDeRodadas(campeonato.times.length, returno.ida_e_volta),
      criar: () => criarFaseRodadas("returno", [campeonato.times], returno.ida_e_volta, 1),
      aoConcluir: (fase, ctx) => {
        const tabelaReturno = tabelaDoGrupoUnico(fase as FaseRodadas);
        const campeaoApertura = ctx.campeaoApertura as string;
        const campeaoClausura = tabelaReturno[0].clubeId;
        ctx.campeaoClausura = campeaoClausura;

        if (campeaoApertura === campeaoClausura) {
          ctx.entrantesLiguilla = [campeaoApertura];
        } else {
          const tabelaAcumulada = somarTabelas([ctx.tabelaTurno as LinhaTabela[], tabelaReturno]);
          const melhoresDoAcumulado = tabelaAcumulada
            .filter((linha) => linha.clubeId !== campeaoApertura && linha.clubeId !== campeaoClausura)
            .slice(0, 2)
            .map((linha) => linha.clubeId);
          ctx.entrantesLiguilla = [campeaoApertura, campeaoClausura, ...melhoresDoAcumulado];
        }
      },
    },
    {
      unidades: 2,
      criar: (ctx) =>
        criarFaseMataMata("liguilla", [
          { nome: "semifinal", ida_e_volta: finalEstadual.ida_e_volta, entrantes: ctx.entrantesLiguilla as string[] },
          { nome: "final", ida_e_volta: finalEstadual.ida_e_volta },
        ]),
      aoConcluir: (fase, ctx) => {
        ctx.campeao = (fase as FaseMataMata).vivos[0];
      },
    },
  ];
}

/**
 * Uruguai 2ª divisão (por id, mesmo critério de `engine.ts` `receitaUruguaiSegunda`): 4 partes que
 * não dependem uma da outra pra decidir o campeão — só o playoff depende da tabela regular já
 * pronta. O campeão da divisão é sempre o líder da tabela regular (`pontos_corridos`); o Torneo
 * Competencia (séries + final) e o playoff do 3º acesso (posições 3ª-6ª da regular) só são
 * registrados/mostrados, não mudam quem é campeão — mesma aproximação documentada na receita em
 * lote (o playoff real inclui condicionalmente o campeão do Torneo Competencia; aqui usa sempre
 * as posições 3ª-6ª da regular).
 */
function passosUruguaiSegunda(campeonato: CampeonatoSimulavel, ratings: Record<string, number>): PassoDePrograma[] {
  const fg = campeonato.formato.fase_grupos!;
  const final = campeonato.formato.final_estadual!;
  const pontosCorridos = campeonato.formato.pontos_corridos!;
  const mataMata = campeonato.formato.mata_mata!;
  const quantidadeNoPlayoff = Math.pow(2, mataMata.fases.length);

  return [
    {
      unidades: totalDeRodadas(fg.times_por_grupo, fg.ida_e_volta),
      criar: () => criarFaseRodadas("series", dividirEmGruposValidado(campeonato.times, fg.num_grupos, fg.times_por_grupo, ratings, campeonato.id).map((g) => g.times), fg.ida_e_volta, 1),
      aoConcluir: (fase, ctx) => {
        ctx.campeoesDeSerie = tabelasPorGrupo(fase as FaseRodadas).map((g) => g.tabela[0].clubeId);
      },
    },
    {
      unidades: 1,
      criar: (ctx) => criarFaseMataMata("final_torneio_competencia", [{ nome: "final", ida_e_volta: final.ida_e_volta, entrantes: ctx.campeoesDeSerie as string[] }]),
      aoConcluir: () => {
        // não decide o campeão da divisão — só é disputado/registrado (ver engine.ts receitaUruguaiSegunda).
      },
    },
    {
      unidades: totalDeRodadas(campeonato.times.length, pontosCorridos.ida_e_volta),
      criar: () => criarFaseRodadas("regular", [campeonato.times], pontosCorridos.ida_e_volta, 1),
      aoConcluir: (fase, ctx) => {
        const tabela = tabelaDoGrupoUnico(fase as FaseRodadas);
        ctx.campeao = tabela[0].clubeId;
        ctx.participantesDoPlayoff = tabela.slice(2, 2 + quantidadeNoPlayoff).map((linha) => linha.clubeId);
      },
    },
    {
      unidades: mataMata.fases.length,
      criar: (ctx) =>
        criarFaseMataMata(
          "playoff_acesso",
          mataMata.fases.map((nome, indice) => ({ nome, ida_e_volta: mataMata.ida_e_volta, entrantes: indice === 0 ? (ctx.participantesDoPlayoff as string[]) : undefined })),
        ),
      aoConcluir: () => {
        // vencedor disputa uma vaga extra de acesso — não é "o campeão" (já definido pela tabela regular).
      },
    },
  ];
}

/**
 * Argentina 2ª divisão / Primera Nacional (por id, mesmo critério de `engine.ts`
 * `receitaArgentinaSegunda`): 2 zonas, líder de cada uma disputa uma final direta pelo 1º ascenso
 * (é o "campeão" retornado); os 7 restantes de cada zona (2º-8º, 14 no total) MAIS o perdedor
 * dessa final entram no "Reduzido" escalonado, que decide o 2º ascenso — não muda quem é campeão.
 * O perdedor da final direta é derivado do próprio confronto resolvido (`resultados[0].confrontos[0]`),
 * não de um cálculo à parte.
 */
function passosArgentinaSegunda(campeonato: CampeonatoSimulavel, ratings: Record<string, number>): PassoDePrograma[] {
  const fg = campeonato.formato.fase_grupos!;
  const finalEstadual = campeonato.formato.final_estadual!;

  return [
    {
      unidades: totalDeRodadas(fg.times_por_grupo, fg.ida_e_volta),
      criar: () => criarFaseRodadas("grupos", dividirEmGruposValidado(campeonato.times, fg.num_grupos, fg.times_por_grupo, ratings, campeonato.id).map((g) => g.times), fg.ida_e_volta, fg.classificam_por_grupo),
      aoConcluir: (fase, ctx) => {
        const porGrupo = tabelasPorGrupo(fase as FaseRodadas);
        ctx.lideresDeZona = porGrupo.map((g) => g.tabela[0].clubeId);
        ctx.restantesParaOReduzido = porGrupo.flatMap((g) => g.tabela.slice(1, fg.classificam_por_grupo).map((linha) => linha.clubeId));
      },
    },
    {
      unidades: 1,
      criar: (ctx) => criarFaseMataMata("final_direta", [{ nome: "final", ida_e_volta: finalEstadual.ida_e_volta, entrantes: ctx.lideresDeZona as string[] }]),
      aoConcluir: (fase, ctx) => {
        const faseMataMata = fase as FaseMataMata;
        ctx.campeao = faseMataMata.vivos[0];
        const confronto = faseMataMata.resultados[0]?.confrontos[0];
        ctx.perdedorDaFinal = confronto ? (confronto.timeA === ctx.campeao ? confronto.timeB : confronto.timeA) : undefined;
      },
    },
    {
      unidades: 4,
      criar: (ctx) =>
        criarFaseMataMata("reduzido", [
          { nome: "primeira_fase", ida_e_volta: false, entrantes: ctx.restantesParaOReduzido as string[] },
          { nome: "quartas", ida_e_volta: true, entrantes: ctx.perdedorDaFinal ? [ctx.perdedorDaFinal as string] : [] },
          { nome: "semifinal", ida_e_volta: true },
          { nome: "final", ida_e_volta: true },
        ]),
      aoConcluir: () => {
        // decide o 2º ascenso — não é "o campeão" retornado (já definido pela final direta, 1º ascenso).
      },
    },
  ];
}

/**
 * Um "torneio" (Apertura ou Clausura) dentro de `turno`+`returno`+`final_estadual` — reaproveitado
 * por `passosColombia` (o classificatório é `fase_quadrangular`) e `passosVenezuela` (o
 * classificatório é `fase_grupos`), que só diferem em COMO o torneio classifica os times e decide
 * seu próprio campeão. `criarClassificatorio`/`criarFinalDoTorneio` isolam essa diferença; o resto
 * (fase única alimentando o classificatório, gravar `campeaoApertura`/`campeaoClausura` no
 * contexto compartilhado) é idêntico nos dois países.
 */
function passosDeUmTorneio(
  campeonato: CampeonatoSimulavel,
  nomeTorneio: string,
  formatoFaseUnica: FaseUnica,
  chaveDeSaida: "campeaoApertura" | "campeaoClausura",
  unidadesDoClassificatorio: number,
  criarClassificatorio: (classificados: string[]) => Fase,
  aoConcluirClassificatorio: (fase: Fase, ctx: ContextoDePrograma) => void,
  unidadesDaFinalDoTorneio: number,
  criarFinalDoTorneio: (ctx: ContextoDePrograma) => Fase,
): PassoDePrograma[] {
  return [
    {
      unidades: totalDeRodadas(campeonato.times.length, formatoFaseUnica.ida_e_volta),
      criar: () => criarFaseRodadas(nomeTorneio, [campeonato.times], formatoFaseUnica.ida_e_volta, formatoFaseUnica.classificam_proxima_fase),
      aoConcluir: (fase, ctx) => {
        ctx[`classificados_${nomeTorneio}`] = classificadosDaFase(fase as FaseRodadas);
      },
    },
    {
      unidades: unidadesDoClassificatorio,
      criar: (ctx) => criarClassificatorio(ctx[`classificados_${nomeTorneio}`] as string[]),
      aoConcluir: aoConcluirClassificatorio,
    },
    {
      unidades: unidadesDaFinalDoTorneio,
      criar: criarFinalDoTorneio,
      aoConcluir: (fase, ctx) => {
        ctx[chaveDeSaida] = (fase as FaseMataMata).vivos[0];
      },
    },
  ];
}

/** Passo final comum a Colômbia e Venezuela: os 2 campeões de torneio (Apertura/Clausura) disputam a final da temporada — mesmo campeão dos 2 = automático. */
function passoFinalDaTemporada(finalEstadual: { ida_e_volta: boolean }): PassoDePrograma {
  return {
    unidades: 1,
    criar: (ctx) => {
      const a = ctx.campeaoApertura as string;
      const b = ctx.campeaoClausura as string;
      return criarFaseMataMata("final_temporada", [{ nome: "final", ida_e_volta: finalEstadual.ida_e_volta, entrantes: a === b ? [a] : [a, b] }]);
    },
    aoConcluir: (fase, ctx) => {
      ctx.campeao = (fase as FaseMataMata).vivos[0];
    },
  };
}

/**
 * Colômbia 1ª e 2ª divisão — espelha `engine.ts` `receitaTurnoRetornoComQuadrangularEFinal`: cada
 * torneio (Apertura/Finalización) tem sua própria fase_quadrangular (2 grupos de 4, sempre ida e
 * volta) cujos líderes disputam uma final (ida e volta) que decide o campeão DAQUELE torneio; só
 * depois os 2 campeões de torneio se enfrentam na final da temporada.
 */
function passosColombia(campeonato: CampeonatoSimulavel, ratings: Record<string, number>): PassoDePrograma[] {
  const turno = campeonato.formato.turno!;
  const returno = campeonato.formato.returno!;
  const fq = campeonato.formato.fase_quadrangular!;
  const finalEstadual = campeonato.formato.final_estadual!;

  function classificatorio(nomeTorneio: string) {
    return (classificados: string[]) =>
      criarFaseRodadas(`${nomeTorneio}_quadrangular`, dividirEmGruposValidado(classificados, fq.num_grupos, fq.times_por_grupo, ratings, campeonato.id).map((g) => g.times), true, 1);
  }

  const passosApertura = passosDeUmTorneio(
    campeonato,
    "apertura",
    turno,
    "campeaoApertura",
    totalDeRodadas(fq.times_por_grupo, true),
    classificatorio("apertura"),
    (fase, ctx) => {
      ctx.lideres_apertura = tabelasPorGrupo(fase as FaseRodadas).map((g) => g.tabela[0].clubeId);
    },
    1,
    (ctx) => criarFaseMataMata("apertura_final", [{ nome: "final", ida_e_volta: true, entrantes: ctx.lideres_apertura as string[] }]),
  );
  const passosClausura = passosDeUmTorneio(
    campeonato,
    "clausura",
    returno,
    "campeaoClausura",
    totalDeRodadas(fq.times_por_grupo, true),
    classificatorio("clausura"),
    (fase, ctx) => {
      ctx.lideres_clausura = tabelasPorGrupo(fase as FaseRodadas).map((g) => g.tabela[0].clubeId);
    },
    1,
    (ctx) => criarFaseMataMata("clausura_final", [{ nome: "final", ida_e_volta: true, entrantes: ctx.lideres_clausura as string[] }]),
  );

  return [...passosApertura, ...passosClausura, passoFinalDaTemporada(finalEstadual)];
}

/**
 * Venezuela 1ª divisão (venezuela_segunda fica de fora — dado incompatível conhecido, ver
 * `docs/dados-a-verificar.md`) — espelha `engine.ts` `receitaTurnoRetornoComGrupoEMataMataEFinal`:
 * mesma estrutura de `passosColombia` (torneio → classificatório → mini-final → final da
 * temporada), só que o classificatório de cada torneio é `fase_grupos` (não `fase_quadrangular`)
 * e a "final do torneio" é um `mata_mata` de verdade (pode ter mais de 1 fase), não um confronto só.
 */
function passosVenezuela(campeonato: CampeonatoSimulavel, ratings: Record<string, number>): PassoDePrograma[] {
  const turno = campeonato.formato.turno!;
  const returno = campeonato.formato.returno!;
  const fg = campeonato.formato.fase_grupos!;
  const mataMata = campeonato.formato.mata_mata!;
  const finalEstadual = campeonato.formato.final_estadual!;

  function classificatorio(nomeTorneio: string) {
    return (classificados: string[]) =>
      criarFaseRodadas(`${nomeTorneio}_grupos`, dividirEmGruposValidado(classificados, fg.num_grupos, fg.times_por_grupo, ratings, campeonato.id).map((g) => g.times), fg.ida_e_volta, fg.classificam_por_grupo);
  }

  function montarTorneio(nomeTorneio: string, formatoFaseUnica: FaseUnica, chaveDeSaida: "campeaoApertura" | "campeaoClausura"): PassoDePrograma[] {
    return passosDeUmTorneio(
      campeonato,
      nomeTorneio,
      formatoFaseUnica,
      chaveDeSaida,
      totalDeRodadas(fg.times_por_grupo, fg.ida_e_volta),
      classificatorio(nomeTorneio),
      (fase, ctx) => {
        ctx[`classificadosGrupo_${nomeTorneio}`] = classificadosDaFase(fase as FaseRodadas);
      },
      mataMata.fases.length,
      (ctx) =>
        criarFaseMataMata(
          `${nomeTorneio}_mata_mata`,
          mataMata.fases.map((nome, indice) => ({
            nome,
            ida_e_volta: mataMata.ida_e_volta,
            entrantes: indice === 0 ? (ctx[`classificadosGrupo_${nomeTorneio}`] as string[]) : undefined,
          })),
        ),
    );
  }

  return [...montarTorneio("apertura", turno, "campeaoApertura"), ...montarTorneio("clausura", returno, "campeaoClausura"), passoFinalDaTemporada(finalEstadual)];
}

function passosFaseGruposFaseQuadrangularEFinal(campeonato: CampeonatoSimulavel, ratings: Record<string, number>): PassoDePrograma[] {
  const fg = campeonato.formato.fase_grupos!;
  const fq = campeonato.formato.fase_quadrangular!;
  const final = campeonato.formato.final_estadual!;
  return [
    {
      unidades: totalDeRodadas(fg.times_por_grupo, fg.ida_e_volta),
      criar: () => criarFaseRodadas("grupos", dividirEmGruposValidado(campeonato.times, fg.num_grupos, fg.times_por_grupo, ratings, campeonato.id).map((g) => g.times), fg.ida_e_volta, fg.classificam_por_grupo),
      aoConcluir: (fase, ctx) => {
        ctx.classificadosGrupos = classificadosDaFase(fase as FaseRodadas);
      },
    },
    {
      unidades: totalDeRodadas(fq.times_por_grupo, true),
      criar: (ctx) =>
        criarFaseRodadas("quadrangular", dividirEmGruposValidado(ctx.classificadosGrupos as string[], fq.num_grupos, fq.times_por_grupo, ratings, campeonato.id).map((g) => g.times), true, fq.classificam_por_grupo),
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

/** Soma dos `totalDeRodadas` de cada grupo — o total de rodadas da fase inteira é o do MAIOR grupo (`criarFaseRodadasPorClassificacao` já deixa os grupos menores ociosos nas rodadas finais). */
function totalDeRodadasPorClassificacao(gruposConfig: { tamanho: number }[], idaEVolta: boolean): number {
  return Math.max(0, ...gruposConfig.map((config) => totalDeRodadas(config.tamanho, idaEVolta)));
}

/**
 * `pontos_corridos` + `fase_final_por_classificacao` (Equador 1ª e 2ª divisão) — espelha
 * `engine.ts` `receitaPontosCorridosComFaseFinalPorClassificacao`/`simularFaseFinalPorClassificacao`:
 * fase regular decide a tabela, dividida em grupos consecutivos por CLASSIFICAÇÃO (não força) pra
 * fase final — o campeão é o líder do PRIMEIRO grupo (o hexagonal do título).
 */
function passosPontosCorridosComFaseFinalPorClassificacao(campeonato: CampeonatoSimulavel): PassoDePrograma[] {
  const pontosCorridos = campeonato.formato.pontos_corridos!;
  const faseFinal = campeonato.formato.fase_final_por_classificacao!;

  return [
    {
      unidades: totalDeRodadas(campeonato.times.length, pontosCorridos.ida_e_volta),
      criar: () => criarFaseRodadas("regular", [campeonato.times], pontosCorridos.ida_e_volta, 1),
      aoConcluir: (fase, ctx) => {
        ctx.tabelaRegular = tabelaDoGrupoUnico(fase as FaseRodadas);
      },
    },
    {
      unidades: totalDeRodadasPorClassificacao(faseFinal.grupos, faseFinal.ida_e_volta),
      criar: (ctx) => criarFaseRodadasPorClassificacao("fase_final", ctx.tabelaRegular as LinhaTabela[], faseFinal.grupos, faseFinal.ida_e_volta, faseFinal.pontos_carregados),
      aoConcluir: (fase, ctx) => {
        ctx.campeao = tabelasPorGrupo(fase as FaseRodadas)[0].tabela[0].clubeId;
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
      criar: () => criarFaseRodadas("grupos", dividirEmGruposValidado(campeonato.times, fg.num_grupos, fg.times_por_grupo, ratings, campeonato.id).map((g) => g.times), fg.ida_e_volta, fg.classificam_por_grupo),
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

/**
 * `turno` + `returno` sem `final_estadual` nenhum (Paraguai 1ª divisão) — espelha `engine.ts`
 * `receitaTurnoRetornoSomado`: soma as 2 tabelas direto, sem final nenhuma decidindo o campeão.
 * Combinação de blocos inambígua (`returno,turno`, sem `final_estadual`) — Argentina/Carioca usam
 * a mesma dupla `turno`/`returno`, mas sempre COM um bloco a mais (`final_estadual`), então nunca
 * caem neste caso.
 */
function passosTurnoRetornoSomado(campeonato: CampeonatoSimulavel): PassoDePrograma[] {
  const turno = campeonato.formato.turno!;
  const returno = campeonato.formato.returno!;
  return [
    {
      unidades: totalDeRodadas(campeonato.times.length, turno.ida_e_volta),
      criar: () => criarFaseRodadas("turno", [campeonato.times], turno.ida_e_volta, 1),
      aoConcluir: (fase, ctx) => {
        ctx.tabelaTurno = tabelaDoGrupoUnico(fase as FaseRodadas);
      },
    },
    {
      unidades: totalDeRodadas(campeonato.times.length, returno.ida_e_volta),
      criar: () => criarFaseRodadas("returno", [campeonato.times], returno.ida_e_volta, 1),
      aoConcluir: (fase, ctx) => {
        const tabelaSomada = somarTabelas([ctx.tabelaTurno as LinhaTabela[], tabelaDoGrupoUnico(fase as FaseRodadas)]);
        ctx.campeao = tabelaSomada[0].clubeId;
      },
    },
  ];
}

function construirPassos(campeonato: CampeonatoSimulavel, ratings: Record<string, number>, random: () => number): PassoDePrograma[] {
  if (campeonato.id === "carioca_a") return passosCarioca(campeonato);
  if (campeonato.id === "peru_primera") return passosPeruPrimeira(campeonato);
  // Argentina 1ª (por id — mesma combinação de blocos ambígua de Peru 1ª/Carioca): o
  // `final_estadual` ali não é uma final de verdade, é reaproveitado só pra representar a Tabla
  // Anual (soma dos 2 torneios) — mecanicamente idêntico a Paraguai 1ª, ver `engine.ts`
  // `receitaArgentina`/`receitaTurnoRetornoSomado`.
  if (campeonato.id === "argentina_primera") return passosTurnoRetornoSomado(campeonato);
  if (campeonato.id === "argentina_segunda") return passosArgentinaSegunda(campeonato, ratings);
  if (campeonato.id === "uruguai_primera") return passosUruguaiPrimeira(campeonato);
  if (campeonato.id === "uruguai_segunda") return passosUruguaiSegunda(campeonato, ratings);

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
    case "returno,turno":
      return passosTurnoRetornoSomado(campeonato);
    case "mata_mata,pontos_corridos":
      return passosPontosCorridosComLiguilla(campeonato);
    case "fase_final_por_classificacao,pontos_corridos":
      return passosPontosCorridosComFaseFinalPorClassificacao(campeonato);
    case "fase_quadrangular,final_estadual,returno,turno":
      return passosColombia(campeonato, ratings);
    case "fase_grupos,final_estadual,mata_mata,returno,turno":
      return passosVenezuela(campeonato, ratings);
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
  /** Presente quando a competição quebrou no meio da temporada (ex: dado incompatível só detectável depois que uma fase anterior já concluiu — `criar` de um passo posterior pode lançar). A partir daí `avancarSemana` não tenta mais avançar essa competição (fica `concluida: true` sem `campeao`) — mesma tolerância a falha isolada de `engine.ts` `ResultadoCompeticaoNaTemporada.erro`, só que detectada mais tarde (aqui) em vez de na montagem inicial (`CompeticoesDaTemporada.erros`). */
  erro?: string;
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
  try {
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
  } catch (erro) {
    // Falha isolada, não em cascata (mesmo princípio de `engine.ts` `simularTemporada`): um passo
    // posterior pode só descobrir um problema de dado (ex: contagem de times incompatível, ver
    // `dividirEmGruposValidado`) depois que uma fase anterior já rodou de verdade — não dava pra
    // pegar isso na montagem inicial (`criarCompeticoesIncrementaisDaTemporada`). Marca esta
    // competição como quebrada e para de tentar avançá-la; as demais continuam normalmente.
    estado.erro = erro instanceof Error ? erro.message : String(erro);
    estado.concluida = true;
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
      criar: (ctx) => criarFaseRodadas("grupos", dividirEmGruposValidado(ctx.timesDaFaseDeGrupos as string[], fg.num_grupos, fg.times_por_grupo, ratings, campeonato.id).map((g) => g.times), fg.ida_e_volta, 3),
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
      criar: (ctx) =>
        criarFaseRodadas("grupos", dividirEmGruposValidado(ctx.timesDaFaseDeGrupos as string[], fg.num_grupos, fg.times_por_grupo, ratings, campeonato.id).map((g) => g.times), fg.ida_e_volta, fg.classificam_por_grupo),
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
