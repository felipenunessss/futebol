import { useEffect, useMemo, useRef, useState } from "react";
import type { FocoDeTreino } from "@motor/progression/xp.js";
import { buscarArquetipo } from "@motor/schemas/player.js";
import type { Cenario, Opcao } from "@motor/progression/scenarios.js";
import type { LinhaTabela } from "@motor/simulation/season.js";
import type { SubtipoChance } from "@motor/simulation/tactics.js";
import type { ContextoDecisaoChance, EventoAoVivo, ResultadoDecisaoChance } from "@motor/simulation/live-match.js";
import type { EstadoDeCarreira } from "@motor/career/Player.js";
import {
  jogarTemporadaSemanal,
  type AlocacaoDePontos,
  type AoIniciarSemanaInfo,
  type ContextoPartidaDoJogadorSemanal,
  type ModoDePartida,
  type NegociacaoResolvidaNaTemporada,
  type NivelAlcancadoNaTemporada,
  type OpcoesJogarTemporadaSemanal,
  type PartidaDoJogadorMataMata,
  type PartidaDoJogadorPontosCorridos,
  type ResultadoTemporadaDeCarreira,
  type StatusAtualizadoNaTemporada,
  type TreinoResolvidoNaTemporada,
} from "@motor/career/career-loop.js";
import { loadCampeonatosNacionais, loadClubes, loadEstaduais } from "../../data/browserLoaders.js";

/** ms de espera real por minuto simulado — mais rápido que o padrão da CLI (220ms, ~20s/partida)
 * porque uma temporada web pode ter dezenas de partidas do próprio clube pra assistir. */
const MS_POR_MINUTO_AO_VIVO = 90;

/** Mesmos subtipos de finalização de `progression/xp.ts` (não exportado de lá) — os únicos que
 * viram gol quando bem-sucedidos; os demais (passe/desarme decisivo) são assistência/desarme. */
const SUBTIPOS_DE_GOL = new Set<SubtipoChance>(["voleio", "cabeceio", "chute_de_fora", "jogada_individual"]);

/**
 * Orquestra a temporada jogada semana a semana — espelha o fluxo de
 * `src/cli/index.ts` `jogarCarreiraInterativaCli` (que usa a mesma
 * `career/career-loop.ts` `jogarTemporadaSemanal`), só que os hooks
 * "escolherX" resolvem a Promise no clique de um botão em vez de
 * esperar `readline`, e os hooks "onY" empurram eventos num feed em vez
 * de `console.log`.
 *
 * Escopo da v1 (ver docs/motor-de-partida.md): `responderProposta` e
 * `escolherCampeonatosParaSeguir` ficam OMITIDOS de propósito — o motor
 * já tem um comportamento padrão sensato pra cada um quando o hook não
 * é passado (contraproposta automática, nenhuma outra competição
 * seguida), então não precisam de UI própria ainda.
 */

type EventoDeFeedVariante =
  | { tipo: "treino"; treino: TreinoResolvidoNaTemporada }
  | { tipo: "nivel"; info: NivelAlcancadoNaTemporada }
  | { tipo: "cenario"; cenario: Cenario; opcao: Opcao; narrativa: string }
  | { tipo: "negociacao"; negociacao: NegociacaoResolvidaNaTemporada }
  | { tipo: "partida_propria"; info: PartidaDoJogadorPontosCorridos }
  | { tipo: "partida_rodada"; info: PartidaDoJogadorPontosCorridos }
  | { tipo: "partida_mata_mata"; info: PartidaDoJogadorMataMata }
  | { tipo: "status"; info: StatusAtualizadoNaTemporada }
  | { tipo: "tabela"; campeonatoId: string; periodo: string; tabela: LinhaTabela[] };

export type EventoDeFeed = EventoDeFeedVariante & { id: string };

/** Escolha na tela pré-jogo — espelha o menu de 4 opções de `src/cli/index.ts` `escolherModoDePartidaInterativo`. */
export type EscolhaDePrePartida = "rapida" | "ate_a_metade" | "ate_o_final" | "ao_vivo";

export type PromptPendente =
  | { tipo: "foco"; resolve: (foco: FocoDeTreino) => void }
  | { tipo: "pontos"; estado: EstadoDeCarreira; resolve: (alocacoes: AlocacaoDePontos[]) => void }
  | { tipo: "cenario"; cenario: Cenario; resolve: (opcao: Opcao) => void }
  | { tipo: "chance_ao_vivo"; contexto: ContextoDecisaoChance; resolve: (resultado: ResultadoDecisaoChance) => void }
  | { tipo: "evento_ao_vivo"; cenario: Cenario; resolve: (opcao: Opcao) => void }
  | { tipo: "semana"; info: AoIniciarSemanaInfo; resolve: () => void }
  | { tipo: "pre_partida"; contexto: ContextoPartidaDoJogadorSemanal; resolve: (modo: ModoDePartida) => void }
  | { tipo: "seguir_campeonatos"; idsAtivos: string[]; resolve: (ids: string[]) => void };

export type FaseDaTemporada = "jogando" | "resumo";

/** Snapshot em andamento de uma partida sendo simulada "ao vivo" — some quando o apito final chega
 * e o resultado final já entrou no feed permanente (ver `onPartidaPontosCorridos`). */
export interface PartidaAoVivoEmAndamento {
  mandanteId: string;
  visitanteId: string;
  ladoDoJogador: "casa" | "fora";
  minutoAtual: number;
  golsCasa: number;
  golsFora: number;
  eventos: EventoAoVivo[];
}

/** Fase atual do jogador numa competição de mata-mata — só existe pra competições em fase eliminatória; pontos corridos usa `tabelaPorCampeonato`/posição. */
export interface FaseMataMata {
  etapa: string;
  eliminado: boolean;
}

interface ConfrontoResultado {
  mandanteId: string;
  visitanteId: string;
  golsCasa: number;
  golsFora: number;
  ehDoJogador: boolean;
}

/**
 * Tela de "resultados da rodada" mostrada assim que a partida do próprio
 * jogador termina — junta os outros confrontos da mesma rodada (buferizados
 * conforme chegam por `onPartidaDaRodadaNaCompeticaoDoJogador`, que dispara
 * um a um, sem sinalizar "rodada completa") com a tabela/fase atual, e só
 * então libera pra próxima semana (`responderResultadoDaRodada`). O motor
 * não pausa por causa disso — ele já resolveu tudo antes deste hook disparar
 * (ver `onPartidaPontosCorridos`/`onPartidaMataMata`) — é só a UI que espera
 * o clique antes de revelar o próximo prompt (pré-partida da próxima
 * semana, por exemplo), pra não pular a rodada sem o jogador ver.
 */
export type ResultadoDaRodadaExibido =
  | { tipo: "pontos_corridos"; campeonatoId: string; rodada: number; confrontos: ConfrontoResultado[]; tabela: LinhaTabela[] | undefined }
  | { tipo: "mata_mata"; campeonatoId: string; etapa: string; confrontoDoJogador: ConfrontoResultado; eliminado: boolean };

/** Jogo do próprio clube "desta semana" pro calendário lateral — criado quando o menu pré-jogo chega (`escolherModoDePartida`) e completado com o placar quando o resultado sai (`onPartidaPontosCorridos`/`onPartidaMataMata`). `undefined` = sem jogo do clube nesta semana (ou ainda não se sabe). */
export interface JogoDaSemana {
  campeonatoId: string;
  semana: number;
  mandanteId: string;
  visitanteId: string;
  resultado?: { golsCasa: number; golsFora: number };
}

export interface TituloDeCarreira {
  campeonatoId: string;
  temporada: number;
  clubeId: string;
}

/** Totais acumulados ao longo de toda a carreira (não só a temporada atual) — somado a cada `jogarTemporada()` que termina. Puramente client-side, o motor não guarda isso (ver docs/motor-de-partida.md). */
export interface EstatisticasCarreira {
  temporadas: number;
  partidas: number;
  gols: number;
  assistencias: number;
  titulos: TituloDeCarreira[];
}

const ESTATISTICAS_INICIAIS: EstatisticasCarreira = { temporadas: 0, partidas: 0, gols: 0, assistencias: 0, titulos: [] };

/** Mesmas janelas da CLI (`ULTIMA_SEMANA_DA_TEMPORADA = 52`, metade = 26). */
const ULTIMA_SEMANA_DA_TEMPORADA = 52;

export function useTemporada(estadoInicial: EstadoDeCarreira) {
  const [estadoAtual, setEstadoAtual] = useState(estadoInicial);
  const [fase, setFase] = useState<FaseDaTemporada>("jogando");
  const [feed, setFeed] = useState<EventoDeFeed[]>([]);
  const [promptPendente, setPromptPendente] = useState<PromptPendente>();
  const [resultado, setResultado] = useState<ResultadoTemporadaDeCarreira>();
  const [partidaAoVivo, setPartidaAoVivo] = useState<PartidaAoVivoEmAndamento>();
  /** Última tabela conhecida de cada competição — alimentada por `tabelaDepois` de qualquer partida
   * observada (própria ou da rodada, ver `atualizarTabela`), só pra mostrar posição na tela
   * pré-jogo. Aproximação (reflete só até a última partida vista, não necessariamente "agora"). */
  const [tabelaPorCampeonato, setTabelaPorCampeonato] = useState<Map<string, LinhaTabela[]>>(new Map());
  /** Fase mais recente conhecida de cada competição de mata-mata do jogador — alimentada por `onPartidaMataMata`. */
  const [faseMataMataPorCampeonato, setFaseMataMataPorCampeonato] = useState<Map<string, FaseMataMata>>(new Map());
  /** Ids das competições do próprio clube — capturado do 1º `aoIniciarSemana` da temporada (o conjunto não muda semana a semana). */
  const [competicoesDoJogador, setCompeticoesDoJogador] = useState<string[]>([]);
  const [estatisticasCarreira, setEstatisticasCarreira] = useState<EstatisticasCarreira>(ESTATISTICAS_INICIAIS);
  const proximoId = useRef(0);
  const jaIniciouPrimeiraTemporada = useRef(false);
  /**
   * Janela de "não perguntar de novo" pro menu pré-jogo — mesma ideia de
   * `src/cli/index.ts` `modoAutoAteSemana`: `undefined` = pergunta toda
   * partida; um número = pula o prompt (sempre "rápida") até aquela
   * semana, depois volta a perguntar. `escolherModoDePartida` é capturado
   * 1x por temporada dentro do `opcoes` de `jogarTemporada`, então precisa
   * de um ref pra ler o valor mais recente mesmo dentro dessa clausura.
   */
  const modoAutoAteSemanaRef = useRef<number | undefined>(undefined);
  /**
   * Foco de treino automático ("treino rápido") — quando definido, pula o
   * `PromptFoco` e resolve direto com esse foco, sem perguntar de novo.
   * Ref por causa da mesma clausura de `jogarTemporada()` que já explica
   * `modoAutoAteSemanaRef` acima; `focoAutomatico` (estado) só existe pra UI
   * mostrar/desligar, o ref é que vale de verdade dentro da Promise.
   */
  const focoAutomaticoRef = useRef<FocoDeTreino | undefined>(undefined);
  const [focoAutomatico, setFocoAutomatico] = useState<FocoDeTreino>();
  const [resultadoDaRodada, setResultadoDaRodada] = useState<ResultadoDaRodadaExibido>();
  /** Confrontos da rodada atual de cada competição, acumulados conforme os hooks disparam (ver `ResultadoDaRodadaExibido`). Reseta ao detectar que uma nova rodada começou. */
  const bufferRodadaRef = useRef<Map<string, { rodada: number; confrontos: ConfrontoResultado[] }>>(new Map());
  /**
   * Semana atual — ref (fonte de verdade dentro das clausuras de
   * `jogarTemporada`, mesmo motivo de `modoAutoAteSemanaRef`) + estado
   * espelhado só pra UI (calendário lateral) reagir. Atualizado 1x por
   * semana em `aoIniciarSemana`, mesmo durante a janela automática (que só
   * pula a PAUSA, não para de contar semana).
   */
  const semanaAtualRef = useRef(1);
  const [semanaAtual, setSemanaAtual] = useState(1);
  const [jogoDaSemana, setJogoDaSemana] = useState<JogoDaSemana>();

  /** Janela "não perguntar de novo" (ver `modoAutoAteSemanaRef`) — quando ativa, os demais prompts da semana (treino, distribuição de pontos, cenário, resultado da rodada) também se resolvem sozinhos com um padrão sensato, em vez de pausar, pra "simular até a metade/final" ser de verdade sem clique nenhum. */
  function emJanelaAutomatica(): boolean {
    return modoAutoAteSemanaRef.current !== undefined && semanaAtualRef.current <= modoAutoAteSemanaRef.current;
  }

  const clubes = useMemo(() => loadClubes(), []);
  const clubePorId = useMemo(() => new Map(clubes.map((c) => [c.id, c])), [clubes]);
  const campeonatos = useMemo(() => [...loadCampeonatosNacionais(), ...loadEstaduais()], []);
  /** Nome de exibição (ex: "Campeonato Brasileiro Série C") por id (ex: "brasileirao_serie_c") — pra UI nunca mostrar o id bruto com "_". */
  const nomePorCampeonato = useMemo(() => new Map(campeonatos.map((c) => [c.id, c.nome])), [campeonatos]);

  function pushEvento(evento: EventoDeFeedVariante): void {
    setFeed((atual) => [{ ...evento, id: `evt-${proximoId.current++}` }, ...atual]);
  }

  function escolherFocoDeTreino(estado: EstadoDeCarreira): Promise<FocoDeTreino> {
    setEstadoAtual(estado);
    if (focoAutomaticoRef.current !== undefined) return Promise.resolve(focoAutomaticoRef.current);
    if (emJanelaAutomatica()) return Promise.resolve("tecnico"); // mesmo padrão do motor quando ninguém escolhe (ver career-loop.ts)
    return new Promise((resolve) => setPromptPendente({ tipo: "foco", resolve }));
  }

  function escolherDistribuicaoDePontos(estado: EstadoDeCarreira): Promise<AlocacaoDePontos[]> {
    setEstadoAtual(estado);
    if (emJanelaAutomatica()) {
      // Mesmo padrão do motor quando ninguém escolhe: tudo no 1º atributo prioritário do arquétipo (ver career-loop.ts investirPontosDisponiveis).
      return Promise.resolve([{ atributo: buscarArquetipo(estado.jogador.arquetipo_id).atributos_prioritarios[0], quantidade: estado.pontosDisponiveis }]);
    }
    return new Promise((resolve) => setPromptPendente({ tipo: "pontos", estado, resolve }));
  }

  function escolherOpcao(cenario: Cenario): Promise<Opcao> {
    if (emJanelaAutomatica()) return Promise.resolve(cenario.opcoes[0]); // mesmo padrão do motor quando ninguém escolhe
    return new Promise((resolve) => setPromptPendente({ tipo: "cenario", cenario, resolve }));
  }

  function atualizarTabela(campeonatoId: string, tabela: LinhaTabela[]): void {
    setTabelaPorCampeonato((atual) => new Map(atual).set(campeonatoId, tabela));
  }

  function registrarConfrontoNoBufferDaRodada(campeonatoId: string, rodada: number, confronto: ConfrontoResultado): void {
    const atual = bufferRodadaRef.current.get(campeonatoId);
    if (!atual || atual.rodada !== rodada) {
      bufferRodadaRef.current.set(campeonatoId, { rodada, confrontos: [confronto] });
    } else {
      atual.confrontos.push(confronto);
    }
  }

  function responderResultadoDaRodada(): void {
    setResultadoDaRodada(undefined);
  }

  function aoIniciarSemana(info: AoIniciarSemanaInfo): Promise<void> {
    setCompeticoesDoJogador(info.competicoesDoJogador);
    semanaAtualRef.current = info.semana;
    setSemanaAtual(info.semana);
    setJogoDaSemana(undefined); // novo jogo (se houver) só é conhecido quando escolherModoDePartida chamar pra essa semana
    if (emJanelaAutomatica()) return Promise.resolve();
    return new Promise((resolve) => setPromptPendente({ tipo: "semana", info, resolve }));
  }

  function escolherCampeonatosParaSeguir(idsAtivos: string[]): Promise<string[]> {
    if (idsAtivos.length === 0) return Promise.resolve([]);
    if (emJanelaAutomatica()) return Promise.resolve([]); // padrão: não acompanhar nenhuma outra competição além da(s) do próprio clube
    return new Promise((resolve) => setPromptPendente({ tipo: "seguir_campeonatos", idsAtivos, resolve }));
  }

  /**
   * Pausa antes de cada partida do jogador com a tela pré-jogo (Parte C) —
   * EXCETO durante uma janela de "não perguntar de novo" ativada por
   * "até a metade"/"até o final" no próprio menu pré-jogo
   * (`modoAutoAteSemanaRef`), quando resolve direto com "rapida" sem
   * mostrar nada (mesmo comportamento de `src/cli/index.ts`).
   */
  function escolherModoDePartida(contexto: ContextoPartidaDoJogadorSemanal): Promise<ModoDePartida> {
    setJogoDaSemana({ campeonatoId: contexto.campeonatoId, semana: contexto.semana, mandanteId: contexto.mandanteId, visitanteId: contexto.visitanteId });
    if (modoAutoAteSemanaRef.current !== undefined) {
      if (contexto.semana <= modoAutoAteSemanaRef.current) return Promise.resolve("rapida");
      modoAutoAteSemanaRef.current = undefined; // passou da janela automática, volta a perguntar
    }
    return new Promise((resolve) => setPromptPendente({ tipo: "pre_partida", contexto, resolve }));
  }

  function decidirChanceAoVivo(contexto: ContextoDecisaoChance): Promise<ResultadoDecisaoChance> {
    return new Promise((resolve) => setPromptPendente({ tipo: "chance_ao_vivo", contexto, resolve }));
  }

  function decidirEventoDePartida(cenario: Cenario): Promise<Opcao> {
    return new Promise((resolve) => setPromptPendente({ tipo: "evento_ao_vivo", cenario, resolve }));
  }

  function onEventoAoVivo(evento: EventoAoVivo): void {
    setPartidaAoVivo((atual) => {
      if (!atual) return atual;
      const eventos = [...atual.eventos, evento];

      if (evento.tipo === "chance_generica") {
        return { ...atual, eventos, minutoAtual: evento.minuto, golsCasa: atual.golsCasa + (evento.gol && evento.lado === "casa" ? 1 : 0), golsFora: atual.golsFora + (evento.gol && evento.lado === "fora" ? 1 : 0) };
      }
      if (evento.tipo === "chance_jogador") {
        const fezGol = evento.chance.sucesso && SUBTIPOS_DE_GOL.has(evento.chance.subtipo);
        return {
          ...atual,
          eventos,
          minutoAtual: evento.minuto,
          golsCasa: atual.golsCasa + (fezGol && atual.ladoDoJogador === "casa" ? 1 : 0),
          golsFora: atual.golsFora + (fezGol && atual.ladoDoJogador === "fora" ? 1 : 0),
        };
      }
      if (evento.tipo === "evento_de_contexto") {
        return { ...atual, eventos, minutoAtual: evento.minuto };
      }
      // apito_final — placar oficial substitui qualquer contagem aproximada feita ao vivo.
      return { ...atual, eventos, minutoAtual: 90, golsCasa: evento.golsCasa, golsFora: evento.golsFora };
    });
  }

  async function jogarTemporada(): Promise<void> {
    setFase("jogando");
    setFeed([]);
    setResultado(undefined);

    const opcoes: OpcoesJogarTemporadaSemanal = {
      escolherFocoDeTreino,
      onTreinoResolvido: (treino) => pushEvento({ tipo: "treino", treino }),
      escolherDistribuicaoDePontos,
      onNivelAlcancado: (info) => {
        setEstadoAtual((atual) => ({ ...atual, nivel: info.nivelNovo, pontosDisponiveis: atual.pontosDisponiveis + info.pontosGanhos }));
        pushEvento({ tipo: "nivel", info });
      },
      escolherOpcao,
      onCenarioResolvido: (resolvido) =>
        pushEvento({ tipo: "cenario", cenario: resolvido.cenario, opcao: resolvido.escolha.opcao, narrativa: resolvido.escolha.resultado.impacto.narrativa }),
      onNegociacaoResolvida: (negociacao) => pushEvento({ tipo: "negociacao", negociacao }),
      aoIniciarSemana,
      escolherModoDePartida,
      decidirChanceAoVivo,
      decidirEventoDePartida,
      onEventoAoVivo,
      msPorMinutoAoVivo: MS_POR_MINUTO_AO_VIVO,
      onPartidaPontosCorridos: (info) => {
        // a partida "ao vivo" já resolveu por completo antes deste hook disparar — some o painel
        // em andamento (o resultado final já vai pro feed permanente logo abaixo).
        setPartidaAoVivo(undefined);
        atualizarTabela(info.campeonatoId, info.evento.tabelaDepois);
        pushEvento({ tipo: "partida_propria", info });
        const { confronto, resultado: resultadoDaPartida } = info.evento;
        registrarConfrontoNoBufferDaRodada(info.campeonatoId, confronto.rodada, {
          mandanteId: confronto.mandante,
          visitanteId: confronto.visitante,
          golsCasa: resultadoDaPartida.golsCasa,
          golsFora: resultadoDaPartida.golsFora,
          ehDoJogador: true,
        });
        setJogoDaSemana((atual) =>
          atual && atual.campeonatoId === info.campeonatoId ? { ...atual, resultado: { golsCasa: resultadoDaPartida.golsCasa, golsFora: resultadoDaPartida.golsFora } } : atual,
        );
        if (!emJanelaAutomatica()) {
          const bufferDaRodada = bufferRodadaRef.current.get(info.campeonatoId);
          setResultadoDaRodada({
            tipo: "pontos_corridos",
            campeonatoId: info.campeonatoId,
            rodada: confronto.rodada,
            confrontos: bufferDaRodada ? [...bufferDaRodada.confrontos] : [],
            tabela: info.evento.tabelaDepois,
          });
        }
      },
      escolherCampeonatosParaSeguir,
      onPartidaDaRodadaNaCompeticaoDoJogador: (info) => {
        atualizarTabela(info.campeonatoId, info.evento.tabelaDepois);
        pushEvento({ tipo: "partida_rodada", info });
        registrarConfrontoNoBufferDaRodada(info.campeonatoId, info.evento.confronto.rodada, {
          mandanteId: info.evento.confronto.mandante,
          visitanteId: info.evento.confronto.visitante,
          golsCasa: info.evento.resultado.golsCasa,
          golsFora: info.evento.resultado.golsFora,
          ehDoJogador: false,
        });
      },
      onPartidaMataMata: (info) => {
        setPartidaAoVivo(undefined);
        const eliminado = info.evento.confronto.vencedor !== estadoAtual.clubeAtualId;
        setFaseMataMataPorCampeonato((atual) => new Map(atual).set(info.campeonatoId, { etapa: info.evento.etapa, eliminado }));
        pushEvento({ tipo: "partida_mata_mata", info });
        setJogoDaSemana((atual) =>
          atual && atual.campeonatoId === info.campeonatoId ? { ...atual, resultado: { golsCasa: info.evento.confronto.golsA, golsFora: info.evento.confronto.golsB } } : atual,
        );
        if (!emJanelaAutomatica()) {
          setResultadoDaRodada({
            tipo: "mata_mata",
            campeonatoId: info.campeonatoId,
            etapa: info.evento.etapa,
            confrontoDoJogador: {
              mandanteId: info.evento.confronto.timeA,
              visitanteId: info.evento.confronto.timeB,
              golsCasa: info.evento.confronto.golsA,
              golsFora: info.evento.confronto.golsB,
              ehDoJogador: true,
            },
            eliminado,
          });
        }
      },
      onStatusAtualizado: (info) => pushEvento({ tipo: "status", info }),
      onResumoDePeriodoCampeonatoSeguido: (campeonatoId, periodo, tabela) => pushEvento({ tipo: "tabela", campeonatoId, periodo, tabela }),
    };

    const resultadoDaTemporada = await jogarTemporadaSemanal(estadoAtual, campeonatos, clubes, opcoes);
    setResultado(resultadoDaTemporada);
    setEstadoAtual(resultadoDaTemporada.estado);
    setFase("resumo");

    const clubeDaTemporada = resultadoDaTemporada.estado.clubeAtualId;
    const novosTitulos: TituloDeCarreira[] = resultadoDaTemporada.resultadoTemporada.competicoes
      .filter((c) => c.resultado?.campeao === clubeDaTemporada)
      .map((c) => ({ campeonatoId: c.campeonatoId, temporada: resultadoDaTemporada.resultadoTemporada.temporada, clubeId: clubeDaTemporada }));
    setEstatisticasCarreira((atual) => ({
      temporadas: atual.temporadas + 1,
      partidas: atual.partidas + resultadoDaTemporada.resumoPartidas.competicoes.reduce((soma, c) => soma + c.partidasDoJogador, 0),
      gols: atual.gols + resultadoDaTemporada.resumoPartidas.competicoes.reduce((soma, c) => soma + c.golsDoJogador, 0),
      assistencias: atual.assistencias + resultadoDaTemporada.resumoPartidas.competicoes.reduce((soma, c) => soma + c.assistenciasDoJogador, 0),
      titulos: [...atual.titulos, ...novosTitulos],
    }));
  }

  // A 1ª temporada começa sozinha assim que a tela monta — mesmo espírito do
  // `jogar` da CLI, que entra direto no loop de temporada depois da criação.
  useEffect(() => {
    if (jaIniciouPrimeiraTemporada.current) return;
    jaIniciouPrimeiraTemporada.current = true;
    void jogarTemporada();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** `manterAutomatico` liga o "treino rápido" — próximos treinos usam esse foco sem perguntar de novo (ver `desligarTreinoAutomatico`). */
  function responderFoco(foco: FocoDeTreino, manterAutomatico = false): void {
    if (promptPendente?.tipo !== "foco") return;
    if (manterAutomatico) {
      focoAutomaticoRef.current = foco;
      setFocoAutomatico(foco);
    }
    promptPendente.resolve(foco);
    setPromptPendente(undefined);
  }

  function desligarTreinoAutomatico(): void {
    focoAutomaticoRef.current = undefined;
    setFocoAutomatico(undefined);
  }

  function responderDistribuicaoDePontos(alocacoes: AlocacaoDePontos[]): void {
    if (promptPendente?.tipo !== "pontos") return;
    promptPendente.resolve(alocacoes);
    setPromptPendente(undefined);
  }

  function responderCenario(opcao: Opcao): void {
    if (promptPendente?.tipo !== "cenario") return;
    promptPendente.resolve(opcao);
    setPromptPendente(undefined);
  }

  function responderChanceAoVivo(resultado: ResultadoDecisaoChance): void {
    if (promptPendente?.tipo !== "chance_ao_vivo") return;
    promptPendente.resolve(resultado);
    setPromptPendente(undefined);
  }

  function responderEventoAoVivo(opcao: Opcao): void {
    if (promptPendente?.tipo !== "evento_ao_vivo") return;
    promptPendente.resolve(opcao);
    setPromptPendente(undefined);
  }

  function responderSemana(): void {
    if (promptPendente?.tipo !== "semana") return;
    promptPendente.resolve();
    setPromptPendente(undefined);
  }

  /** Resolve o menu pré-jogo — ver `EscolhaDePrePartida` (mesmas 4 opções do menu da CLI). */
  function responderPrePartida(escolha: EscolhaDePrePartida): void {
    if (promptPendente?.tipo !== "pre_partida") return;
    const { contexto, resolve } = promptPendente;
    setPromptPendente(undefined);

    if (escolha === "ate_a_metade") modoAutoAteSemanaRef.current = Math.floor(ULTIMA_SEMANA_DA_TEMPORADA / 2);
    if (escolha === "ate_o_final") modoAutoAteSemanaRef.current = ULTIMA_SEMANA_DA_TEMPORADA;

    if (escolha === "ao_vivo") {
      setPartidaAoVivo({ mandanteId: contexto.mandanteId, visitanteId: contexto.visitanteId, ladoDoJogador: contexto.lado, minutoAtual: 0, golsCasa: 0, golsFora: 0, eventos: [] });
      resolve("ao_vivo");
    } else {
      resolve("rapida");
    }
  }

  function responderSeguirCampeonatos(idsEscolhidos: string[]): void {
    if (promptPendente?.tipo !== "seguir_campeonatos") return;
    promptPendente.resolve(idsEscolhidos);
    setPromptPendente(undefined);
  }

  return {
    estadoAtual,
    fase,
    feed,
    promptPendente,
    partidaAoVivo,
    tabelaPorCampeonato,
    faseMataMataPorCampeonato,
    competicoesDoJogador,
    estatisticasCarreira,
    resultado,
    clubePorId,
    nomePorCampeonato,
    jogarTemporada,
    responderFoco,
    responderDistribuicaoDePontos,
    responderCenario,
    responderChanceAoVivo,
    responderEventoAoVivo,
    responderSemana,
    responderPrePartida,
    responderSeguirCampeonatos,
    focoAutomatico,
    desligarTreinoAutomatico,
    resultadoDaRodada,
    responderResultadoDaRodada,
    semanaAtual,
    jogoDaSemana,
  };
}
