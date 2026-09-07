import { useEffect, useMemo, useRef, useState } from "react";
import type { FocoDeTreino } from "@motor/progression/xp.js";
import type { Cenario, Opcao } from "@motor/progression/scenarios.js";
import type { LinhaTabela } from "@motor/simulation/season.js";
import type { EstadoDeCarreira } from "@motor/career/Player.js";
import {
  jogarTemporadaSemanal,
  type AlocacaoDePontos,
  type NegociacaoResolvidaNaTemporada,
  type NivelAlcancadoNaTemporada,
  type OpcoesJogarTemporadaSemanal,
  type PartidaDoJogadorPontosCorridos,
  type ResultadoTemporadaDeCarreira,
  type StatusAtualizadoNaTemporada,
  type TreinoResolvidoNaTemporada,
} from "@motor/career/career-loop.js";
import { loadCampeonatosNacionais, loadClubes, loadEstaduais } from "../../data/browserLoaders.js";

/**
 * Orquestra a temporada jogada semana a semana — espelha o fluxo de
 * `src/cli/index.ts` `jogarCarreiraInterativaCli` (que usa a mesma
 * `career/career-loop.ts` `jogarTemporadaSemanal`), só que os hooks
 * "escolherX" resolvem a Promise no clique de um botão em vez de
 * esperar `readline`, e os hooks "onY" empurram eventos num feed em vez
 * de `console.log`.
 *
 * Escopo da v1 (ver docs/motor-de-partida.md): `escolherModoDePartida`,
 * `responderProposta` e `escolherCampeonatosParaSeguir` ficam OMITIDOS
 * de propósito — o motor já tem um comportamento padrão sensato pra
 * cada um quando o hook não é passado (partida "rápida" sempre,
 * contraproposta automática, nenhuma outra competição seguida), então
 * não precisam de UI própria ainda.
 */

type EventoDeFeedVariante =
  | { tipo: "treino"; treino: TreinoResolvidoNaTemporada }
  | { tipo: "nivel"; info: NivelAlcancadoNaTemporada }
  | { tipo: "cenario"; cenario: Cenario; opcao: Opcao; narrativa: string }
  | { tipo: "negociacao"; negociacao: NegociacaoResolvidaNaTemporada }
  | { tipo: "partida_propria"; info: PartidaDoJogadorPontosCorridos }
  | { tipo: "partida_rodada"; info: PartidaDoJogadorPontosCorridos }
  | { tipo: "status"; info: StatusAtualizadoNaTemporada }
  | { tipo: "tabela"; campeonatoId: string; periodo: string; tabela: LinhaTabela[] };

export type EventoDeFeed = EventoDeFeedVariante & { id: string };

export type PromptPendente =
  | { tipo: "foco"; resolve: (foco: FocoDeTreino) => void }
  | { tipo: "pontos"; estado: EstadoDeCarreira; resolve: (alocacoes: AlocacaoDePontos[]) => void }
  | { tipo: "cenario"; cenario: Cenario; resolve: (opcao: Opcao) => void };

export type FaseDaTemporada = "jogando" | "resumo";

export function useTemporada(estadoInicial: EstadoDeCarreira) {
  const [estadoAtual, setEstadoAtual] = useState(estadoInicial);
  const [fase, setFase] = useState<FaseDaTemporada>("jogando");
  const [feed, setFeed] = useState<EventoDeFeed[]>([]);
  const [promptPendente, setPromptPendente] = useState<PromptPendente>();
  const [resultado, setResultado] = useState<ResultadoTemporadaDeCarreira>();
  const proximoId = useRef(0);
  const jaIniciouPrimeiraTemporada = useRef(false);

  const clubes = useMemo(() => loadClubes(), []);
  const clubePorId = useMemo(() => new Map(clubes.map((c) => [c.id, c])), [clubes]);
  const campeonatos = useMemo(() => [...loadCampeonatosNacionais(), ...loadEstaduais()], []);

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
      onPartidaPontosCorridos: (info) => pushEvento({ tipo: "partida_propria", info }),
      onPartidaDaRodadaNaCompeticaoDoJogador: (info) => pushEvento({ tipo: "partida_rodada", info }),
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

  return {
    estadoAtual,
    fase,
    feed,
    promptPendente,
    resultado,
    clubePorId,
    jogarTemporada,
    responderFoco,
    responderDistribuicaoDePontos,
    responderCenario,
  };
}
