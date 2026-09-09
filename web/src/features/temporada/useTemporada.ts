import { useEffect, useMemo, useRef, useState } from "react";
import type { FocoDeTreino } from "@motor/progression/xp.js";
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
  | { tipo: "partida_mata_mata"; info: PartidaDoJogadorMataMata }
  | { tipo: "status"; info: StatusAtualizadoNaTemporada }
  | { tipo: "tabela"; campeonatoId: string; periodo: string; tabela: LinhaTabela[] };

export type EventoDeFeed = EventoDeFeedVariante & { id: string };

export type PromptPendente =
  | { tipo: "foco"; resolve: (foco: FocoDeTreino) => void }
  | { tipo: "pontos"; estado: EstadoDeCarreira; resolve: (alocacoes: AlocacaoDePontos[]) => void }
  | { tipo: "cenario"; cenario: Cenario; resolve: (opcao: Opcao) => void }
  | { tipo: "chance_ao_vivo"; contexto: ContextoDecisaoChance; resolve: (resultado: ResultadoDecisaoChance) => void }
  | { tipo: "evento_ao_vivo"; cenario: Cenario; resolve: (opcao: Opcao) => void }
  | { tipo: "semana"; info: AoIniciarSemanaInfo; resolve: () => void }
  | { tipo: "pre_partida"; contexto: ContextoPartidaDoJogadorSemanal; resolve: (modo: ModoDePartida) => void };

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

export function useTemporada(estadoInicial: EstadoDeCarreira) {
  const [estadoAtual, setEstadoAtual] = useState(estadoInicial);
  const [fase, setFase] = useState<FaseDaTemporada>("jogando");
  const [feed, setFeed] = useState<EventoDeFeed[]>([]);
  const [promptPendente, setPromptPendente] = useState<PromptPendente>();
  const [resultado, setResultado] = useState<ResultadoTemporadaDeCarreira>();
  const [partidaAoVivo, setPartidaAoVivo] = useState<PartidaAoVivoEmAndamento>();
  const [assistirAoVivo, setAssistirAoVivo] = useState(true);
  /** Última tabela conhecida de cada competição — alimentada por `tabelaDepois` de qualquer partida
   * observada (própria ou da rodada, ver `atualizarTabela`), só pra mostrar posição na tela
   * pré-jogo. Aproximação (reflete só até a última partida vista, não necessariamente "agora"). */
  const [tabelaPorCampeonato, setTabelaPorCampeonato] = useState<Map<string, LinhaTabela[]>>(new Map());
  const proximoId = useRef(0);
  const jaIniciouPrimeiraTemporada = useRef(false);
  // `escolherModoDePartida` é capturado 1x por temporada (dentro do `opcoes` montado em
  // `jogarTemporada`) — o ref garante que ele sempre lê o valor mais recente do toggle, mesmo
  // que o usuário mude de ideia no meio da temporada.
  const assistirAoVivoRef = useRef(assistirAoVivo);

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
    return new Promise((resolve) => setPromptPendente({ tipo: "foco", resolve }));
  }

  function escolherDistribuicaoDePontos(estado: EstadoDeCarreira): Promise<AlocacaoDePontos[]> {
    setEstadoAtual(estado);
    return new Promise((resolve) => setPromptPendente({ tipo: "pontos", estado, resolve }));
  }

  function escolherOpcao(cenario: Cenario): Promise<Opcao> {
    return new Promise((resolve) => setPromptPendente({ tipo: "cenario", cenario, resolve }));
  }

  function atualizarTabela(campeonatoId: string, tabela: LinhaTabela[]): void {
    setTabelaPorCampeonato((atual) => new Map(atual).set(campeonatoId, tabela));
  }

  function aoIniciarSemana(info: AoIniciarSemanaInfo): Promise<void> {
    return new Promise((resolve) => setPromptPendente({ tipo: "semana", info, resolve }));
  }

  /** Pausa SEMPRE antes de qualquer partida do jogador (tela pré-jogo — Parte C) — o clique de
   * "Começar partida" resolve com "ao_vivo" ou "rapida" conforme o toggle de assistir ao vivo. */
  function escolherModoDePartida(contexto: ContextoPartidaDoJogadorSemanal): Promise<ModoDePartida> {
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
      },
      // Só alimenta o cache de tabela (pra tela pré-jogo mostrar posição) — não empurra pro feed
      // visível, senão volta o problema de ruído já corrigido (dezenas de jogos de outros clubes).
      onPartidaDaRodadaNaCompeticaoDoJogador: (info) => atualizarTabela(info.campeonatoId, info.evento.tabelaDepois),
      onPartidaMataMata: (info) => {
        setPartidaAoVivo(undefined);
        pushEvento({ tipo: "partida_mata_mata", info });
      },
      onStatusAtualizado: (info) => pushEvento({ tipo: "status", info }),
      onResumoDePeriodoCampeonatoSeguido: (campeonatoId, periodo, tabela) => pushEvento({ tipo: "tabela", campeonatoId, periodo, tabela }),
    };

    const resultadoDaTemporada = await jogarTemporadaSemanal(estadoAtual, campeonatos, clubes, opcoes);
    setResultado(resultadoDaTemporada);
    setEstadoAtual(resultadoDaTemporada.estado);
    setFase("resumo");
  }

  // A 1ª temporada começa sozinha assim que a tela monta — mesmo espírito do
  // `jogar` da CLI, que entra direto no loop de temporada depois da criação.
  useEffect(() => {
    if (jaIniciouPrimeiraTemporada.current) return;
    jaIniciouPrimeiraTemporada.current = true;
    void jogarTemporada();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function responderFoco(foco: FocoDeTreino): void {
    if (promptPendente?.tipo !== "foco") return;
    promptPendente.resolve(foco);
    setPromptPendente(undefined);
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

  function responderPrePartida(): void {
    if (promptPendente?.tipo !== "pre_partida") return;
    const { contexto, resolve } = promptPendente;
    setPromptPendente(undefined);

    if (assistirAoVivoRef.current) {
      setPartidaAoVivo({ mandanteId: contexto.mandanteId, visitanteId: contexto.visitanteId, ladoDoJogador: contexto.lado, minutoAtual: 0, golsCasa: 0, golsFora: 0, eventos: [] });
      resolve("ao_vivo");
    } else {
      resolve("rapida");
    }
  }

  function alternarAssistirAoVivo(): void {
    setAssistirAoVivo((atual) => {
      assistirAoVivoRef.current = !atual;
      return !atual;
    });
  }

  return {
    estadoAtual,
    fase,
    feed,
    promptPendente,
    partidaAoVivo,
    assistirAoVivo,
    alternarAssistirAoVivo,
    tabelaPorCampeonato,
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
  };
}
