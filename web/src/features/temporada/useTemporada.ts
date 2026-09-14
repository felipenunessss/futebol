import { useEffect, useMemo, useRef, useState } from "react";
import { converterChancesEmDesempenho, type FocoDeTreino } from "@motor/progression/xp.js";
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
  type CenarioResolvidoNaTemporada,
  type ContextoPartidaDoJogadorSemanal,
  type ModoDePartida,
  type NegociacaoResolvidaNaTemporada,
  type NivelAlcancadoNaTemporada,
  type OpcoesJogarTemporadaSemanal,
  type ChaveamentoDeMataMataNaTemporada,
  type PartidaDoJogadorMataMata,
  type PartidaDoJogadorPontosCorridos,
  type ResultadoTemporadaDeCarreira,
  type SorteioDeGruposNaTemporada,
  type StatusAtualizadoNaTemporada,
  type TreinoResolvidoNaTemporada,
} from "@motor/career/career-loop.js";
import { loadCampeonatosNacionais, loadClubes, loadEstaduais } from "../../data/browserLoaders.js";
import type { CampeonatoEstadual } from "@motor/schemas/championship.js";
import type { CampeonatoNacional } from "@motor/schemas/national-championship.js";
import { aplicarEscolhaDeFimDeTemporada, gerarPropostasDeFimDeTemporada, type EscolhaDeFimDeTemporada, type PropostasDeFimDeTemporada } from "@motor/career/fim-de-temporada.js";
import { aplicarMudancasDeDivisao, calcularMudancasDeDivisao, type CompeticaoParaMundoPersistente } from "@motor/career/mundo-persistente.js";

/** Velocidades de exibição da partida ao vivo escolhíveis pelo jogador (pedido do usuário:
 * "implementar velocidade na simulação do jogo"). ms de espera real por minuto simulado — "normal"
 * já era mais rápido que o padrão da CLI (220ms, ~20s/partida) porque uma temporada web pode ter
 * dezenas de partidas do próprio clube pra assistir; "rápido"/"ultrarrápido" comprimem ainda mais. */
export type VelocidadeAoVivo = "normal" | "rapida" | "ultrarrapida";
const MS_POR_MINUTO_POR_VELOCIDADE: Record<VelocidadeAoVivo, number> = { normal: 90, rapida: 35, ultrarrapida: 8 };

/** Quantas linhas do TOPO/FIM de uma tabela de classificação destacar (pedido do usuário: "quero
 * que a tabela de classificação mostre em cores os classificados pra próxima fase/campeonatos
 * internacionais e os rebaixados") — é sempre uma aproximação POSICIONAL simples (top-N/bottom-N),
 * não tenta reproduzir critério textual mais fino (`vaga_copa_do_brasil_criterio` etc, geralmente
 * "melhor colocado sem competição nacional" — depende de outros clubes, não só posição na tabela),
 * de propósito deixados de fora daqui pra não arriscar destacar a linha errada. */
export interface FaixasDeDestaqueDaTabela {
  /** Top N avança (mata-mata/próxima fase/liguilla) OU tem vaga internacional (Libertadores +
   * Sul-Americana) OU acesso à divisão de cima — o maior desses 3 números, quando mais de um dá
   * pra calcular pro mesmo campeonato (não é comum acontecer, mas nesse caso o de cima já cobre o
   * de baixo). `undefined` = nenhuma dessas informações disponível pra esse campeonato. */
  classificados?: number;
  /** Bottom N é rebaixado — vem direto de `Premiacao.rebaixamento_proxima_divisao`. */
  rebaixados?: number;
}

function faixasDeDestaqueDaTabela(campeonato: CampeonatoEstadual | CampeonatoNacional): FaixasDeDestaqueDaTabela {
  const { formato, premiacao } = campeonato;
  const classificadosParaFase =
    formato.fase_suica?.classificam_mata_mata ??
    formato.fase_grupos?.classificam_por_grupo ??
    (formato.fase_quadrangular?.ativa ? formato.fase_quadrangular.classificam_por_grupo : undefined) ??
    formato.turno?.classificam_proxima_fase ??
    formato.returno?.classificam_proxima_fase ??
    // Pontos corridos + mata-mata simples (sem entrada escalonada por etapa) sem contador próprio —
    // aproxima pelo tamanho do bracket (3 fases = quartas/semi/final = 8 times, etc).
    (formato.pontos_corridos && formato.mata_mata && !formato.mata_mata.etapas ? 2 ** formato.mata_mata.fases.length : undefined);
  const vagaInternacional = (premiacao.vaga_libertadores ?? 0) + (premiacao.vaga_sulamericana ?? 0);
  const acesso = premiacao.acesso_proxima_divisao ?? 0;
  const melhorFaixa = Math.max(classificadosParaFase ?? 0, vagaInternacional, acesso);

  return {
    classificados: melhorFaixa > 0 ? melhorFaixa : undefined,
    rebaixados: premiacao.rebaixamento_proxima_divisao,
  };
}

/** "estadual:MG" ou "nacional:BR" — competições da mesma chave promovem/rebaixam entre si por
 * nivel adjacente (ver `career/mundo-persistente.ts`). Estaduais não têm campo `pais` (são sempre
 * do Brasil, por convenção da pasta `src/data/estaduais/`), nacionais não têm `estado`. */
function chaveDeHierarquia(campeonato: CampeonatoEstadual | CampeonatoNacional): string {
  return "estado" in campeonato ? `estadual:${campeonato.estado}` : `nacional:${campeonato.pais}`;
}

/** Aplica a sobreposição de composição salva na carreira (`EstadoDeCarreira.composicaoDasCompeticoes`,
 * ver `career/mundo-persistente.ts`) sobre a lista estática de campeonatos — sem isso, toda
 * temporada nova usava sempre os mesmos `times` do arquivo de dado, mesmo depois de promoção/
 * rebaixamento em temporadas anteriores da MESMA carreira (bug relatado pelo usuário: "não estou
 * vendo os rebaixamentos/promoções funcionarem"). */
function aplicarComposicaoSalva<T extends CampeonatoEstadual | CampeonatoNacional>(campeonatosBase: T[], composicaoSalva: Record<string, string[]> | undefined): T[] {
  if (!composicaoSalva) return campeonatosBase;
  return campeonatosBase.map((c) => (composicaoSalva[c.id] ? { ...c, times: composicaoSalva[c.id] } : c));
}

/** Compara 2 listas de Club.id como conjunto (ordem não importa) — usado só pra saber se a
 * composição de uma competição realmente divergiu do arquivo de dado estático, e por isso vale a
 * pena persistir uma sobreposição pra ela (ver uso em `jogarTemporada`). */
function mesmoConjunto(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const conjuntoA = new Set(a);
  return b.every((id) => conjuntoA.has(id));
}

/** TODOS os subtipos de chance do jogador viram gol quando `sucesso` — o motor (`match.ts`/
 * `live-match.ts`) incrementa o placar incondicionalmente em qualquer chance bem-sucedida, sem
 * distinguir subtipo (uma assistência ou um desarme decisivo bem-sucedidos são, mecanicamente, tão
 * gol quanto um voleio). Faltava "passe_decisivo"/"desarme_decisivo" aqui antes, e o placar ao vivo
 * ficava sem contar esse gol até o apito final corrigir — mesmo a narração já dizendo "Assistência
 * sua!"/"Desarme decisivo seu!" no momento. */
const SUBTIPOS_DE_GOL = new Set<SubtipoChance>(["voleio", "cabeceio", "chute_de_fora", "jogada_individual", "passe_decisivo", "desarme_decisivo"]);

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
export type EscolhaDePrePartida = "rapida" | "ao_vivo";

export type PromptPendente =
  | { tipo: "foco"; resolve: (foco: FocoDeTreino) => void }
  | { tipo: "pontos"; estado: EstadoDeCarreira; resolve: (alocacoes: AlocacaoDePontos[]) => void }
  | { tipo: "cenario"; cenario: Cenario; resolve: (opcao: Opcao) => void }
  | { tipo: "chance_ao_vivo"; contexto: ContextoDecisaoChance; resolve: (resultado: ResultadoDecisaoChance) => void }
  | { tipo: "evento_ao_vivo"; cenario: Cenario; resolve: (opcao: Opcao) => void }
  | { tipo: "semana"; info: AoIniciarSemanaInfo; resolve: () => void }
  | { tipo: "pre_partida"; contexto: ContextoPartidaDoJogadorSemanal; resolve: (modo: ModoDePartida) => void }
  | { tipo: "seguir_campeonatos"; idsAtivos: string[]; resolve: (ids: string[]) => void };

export type FaseDaTemporada = "jogando" | "resumo" | "propostas";

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
  /** `true` a partir do apito final — o painel ao vivo continua na tela (agora como "fim de jogo",
   * não mais "ao vivo"), esperando o jogador confirmar antes de ir pro resto do fluxo (resultado da
   * rodada, etc). Fora da janela automática (fast-forward), essa confirmação nunca pausa nada de
   * verdade — o motor já resolveu tudo, é só a UI segurando a revelação (mesmo padrão de
   * `resultadoDaRodada`/sorteio/chaveamento). Pedido do usuário: "quero que apareça uma tela de fim
   * de jogo ao final das partidas". */
  finalizada?: boolean;
}

/** Fase atual do jogador numa competição de mata-mata — só existe pra competições em fase eliminatória; pontos corridos usa `tabelaPorCampeonato`/posição. */
export interface FaseMataMata {
  etapa: string;
  eliminado: boolean;
}

/** Um confronto já resolvido dentro do chaveamento acumulado (`chaveamentoPorCampeonato`) — ver `ConfrontoDoChaveamento`. */
export interface ConfrontoDoChaveamento {
  timeA: string;
  timeB: string;
  golsA: number;
  golsB: number;
  vencedor: string;
  decididoNosPenaltis: boolean;
}

/** Uma etapa do chaveamento (ex: "quartas", "semifinal", "final") com todos os confrontos JÁ resolvidos dela — ver `chaveamentoPorCampeonato`. */
export interface EtapaDoChaveamento {
  nome: string;
  confrontos: ConfrontoDoChaveamento[];
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

/**
 * Cenário de carreira já resolvido (o motor já sabe o desfecho — ver
 * `career-loop.ts` `resolverPeriodoDaCarreira`), mas represado aqui pra UI
 * tocar uma pequena animação alternando entre as opções possíveis antes de
 * revelar em qual o resultado realmente parou (`indiceResultado`, o índice
 * em `escolha.opcao.resultados` — a `PainelAnimacaoDeEscolha` usa isso pra
 * saber onde "parar de girar"). Só existe fora da janela automática e só
 * quando a opção escolhida tinha mais de 1 resultado possível (sem risco
 * real não tem o que animar) — ver `emJanelaAutomatica`.
 */
export interface AnimacaoDeEscolhaPendente {
  cenarioResolvido: CenarioResolvidoNaTemporada;
  indiceResultado: number;
  /** "cenario" = cenário de carreira fora de campo (resultado vai pro feed geral ao concluir, ver
   * `concluirAnimacaoDeEscolha`); "incidente" = incidente de partida ao vivo (cartão/lesão) — já foi
   * narrado direto em `partidaAoVivo.eventos` quando aconteceu, então concluir só fecha a animação,
   * sem duplicar no feed geral. Padrão "cenario" (mantém o comportamento já existente). */
  origem?: "cenario" | "incidente";
}

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
  /** Propostas de transferência/renovação de fim de temporada (ver `career/fim-de-temporada.ts`) —
   * geradas ao sair do resumo (`verPropostasFimDeTemporada`), resolvidas em `responderFimDeTemporada`
   * antes de iniciar a próxima temporada. */
  const [propostasFimDeTemporada, setPropostasFimDeTemporada] = useState<PropostasDeFimDeTemporada>();
  const [partidaAoVivo, setPartidaAoVivo] = useState<PartidaAoVivoEmAndamento>();
  /** Velocidade escolhida da partida ao vivo — `useState` pra UI (seletor) e `useRef` em paralelo
   * (`velocidadeAoVivoRef`) porque o motor (`career-loop.ts`/`live-match.ts`) lê `msPorMinutoAoVivo`
   * como uma FUNÇÃO chamada minuto a minuto durante a partida (ver `jogarPartidaAoVivo`), não 1x só
   * no início — sem o ref, trocar a velocidade no meio de uma partida em andamento não faria nada
   * até a próxima partida (o `useState` sozinho fica "preso" no valor capturado quando a partida
   * começou, por causa de closures). */
  const [velocidadeAoVivo, setVelocidadeAoVivo] = useState<VelocidadeAoVivo>("normal");
  const velocidadeAoVivoRef = useRef<VelocidadeAoVivo>("normal");
  function definirVelocidadeAoVivo(velocidade: VelocidadeAoVivo): void {
    velocidadeAoVivoRef.current = velocidade;
    setVelocidadeAoVivo(velocidade);
  }
  /** Última tabela conhecida de cada competição — alimentada por `tabelaDepois` de qualquer partida
   * observada (própria ou da rodada, ver `atualizarTabela`), só pra mostrar posição na tela
   * pré-jogo. Aproximação (reflete só até a última partida vista, não necessariamente "agora"). */
  const [tabelaPorCampeonato, setTabelaPorCampeonato] = useState<Map<string, LinhaTabela[]>>(new Map());
  /** Fase mais recente conhecida de cada competição de mata-mata do jogador — alimentada por `onPartidaMataMata`. */
  const [faseMataMataPorCampeonato, setFaseMataMataPorCampeonato] = useState<Map<string, FaseMataMata>>(new Map());
  /** Chaveamento acumulado (todas as etapas já resolvidas, todos os confrontos — não só os do
   * próprio clube) de cada competição de mata-mata do jogador — alimentado por
   * `onConfrontoMataMataNaCompeticao`, que dispara pra TODO confronto (diferente de
   * `onPartidaMataMata`/`onChaveamentoDefinido`, que só cobrem o clube do jogador ou a 1ª etapa).
   * Pedido do usuário: "aba específica pros mata-matas mostrando o chaveamento". */
  const [chaveamentoPorCampeonato, setChaveamentoPorCampeonato] = useState<Map<string, EtapaDoChaveamento[]>>(new Map());
  /**
   * Nome do grupo do PRÓPRIO clube em cada competição do jogador (ex:
   * "Grupo B", ou o próprio nome da fase quando ela tem um grupo só) —
   * capturado de `onPartidaPontosCorridos` (única fonte confiável: só
   * dispara pro confronto do próprio clube, então o `grupoNome` ali é
   * sempre o grupo dele). Usado tanto pra rotular a aba de Classificação
   * quanto pra `atualizarTabela` (via `onPartidaDaRodadaNaCompeticaoDoJogador`)
   * não sobrescrever a tabela do jogador com a de outro grupo da mesma
   * competição (ver `career/career-loop.ts` `grupoNome`).
   */
  const [grupoDoJogadorPorCampeonato, setGrupoDoJogadorPorCampeonato] = useState<Map<string, string>>(new Map());
  /** Espelha `grupoDoJogadorPorCampeonato` num ref — necessário porque `jogarTemporada()` roda a
   * temporada inteira numa única clausura de longa duração (mesmo motivo de `semanaAtualRef`): o
   * estado capturado ali ficaria congelado no valor de quando a Promise começou, sem refletir
   * atualizações feitas por ela mesma no meio do caminho. */
  const grupoDoJogadorPorCampeonatoRef = useRef<Map<string, string>>(new Map());
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
  /** Espelha `modoAutoAteSemanaRef` em estado só pra UI mostrar um aviso/botão de "parar" enquanto a janela automática de semanas está ativa (ver `pararSimulacaoAutomatica`). */
  const [simulandoAutomaticamente, setSimulandoAutomaticamente] = useState(false);
  /** Setado por `pararSimulacaoAutomatica` — consumido e limpo no próximo `aoIniciarSemana` (não dá pra interromper no meio de uma semana já em andamento, só no próximo limite natural). Existe porque, ao contrário de `pularAteProximoJogoRef` (que sempre se limpa sozinho ao achar a próxima partida), `modoAutoAteSemanaRef` pode ficar até a semana 52 ("até o final") sem NENHUM ponto de saída natural dentro da mesma temporada — sem isso, quem clica "até o final" fica preso no automático até o fim da temporada inteira. */
  const cancelarAutoRef = useRef(false);
  /**
   * "Simular até o próximo jogo" — pula tudo que não é partida (semana,
   * treino, pontos, cenário, resultado da rodada) até a PRÓXIMA vez que
   * `escolherModoDePartida` for chamado, onde volta a perguntar (o próprio
   * `escolherModoDePartida` desliga essa flag ao chegar lá — ver mais
   * abaixo). Ao contrário de `modoAutoAteSemanaRef`, não é por número de
   * semana: é "só até a próxima partida", não importa quantas semanas isso
   * leve.
   */
  const pularAteProximoJogoRef = useRef(false);
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
  /** Resultado da rodada calculado no momento em que a partida ao vivo do jogador termina, mas
   * represado até o jogador confirmar a tela de "fim de jogo" (`confirmarFimDeJogo`) — sem isso, o
   * painel de resultado da rodada substituía o painel ao vivo instantaneamente no apito final, sem
   * dar nenhum momento de "fim de jogo" (ver `PartidaAoVivoEmAndamento.finalizada`). Ref, não
   * state: não precisa re-renderizar nada sozinho, só ser lido quando `confirmarFimDeJogo` rodar. */
  const resultadoDaRodadaPendenteRef = useRef<ResultadoDaRodadaExibido | undefined>(undefined);
  /** `true` do momento em que o jogador escolhe "ao vivo" no menu pré-jogo até `confirmarFimDeJogo`
   * — evita ler `partidaAoVivo` (state) dentro do updater de outro `setState` (efeito colateral
   * indevido); os hooks de resultado da partida (`onPartidaPontosCorridos`/`onPartidaMataMata`)
   * consultam este ref pra saber se devem represar o resultado da rodada ou revelar na hora. */
  const partidaAoVivoAtivaRef = useRef(false);
  const [animacaoDeEscolha, setAnimacaoDeEscolha] = useState<AnimacaoDeEscolhaPendente>();
  /** Fila de sorteios de grupos aguardando revelação — ver `onSorteioDeGrupos`. Fila (não um valor
   * único) porque o motor não pausa pra UI consumir cada um: se o clube do jogador entra em 2+
   * competições cuja fase de grupos começa na MESMA semana (ex: estadual + Série D), os hooks
   * disparam um atrás do outro na mesma janela de execução, antes de qualquer render — um valor
   * único perdia (sobrescrevia) o sorteio anterior sem o jogador nunca ver a animação dele (bug
   * relatado: "senti falta das animações de sorteio"). Só o primeiro da fila é exibido por vez. */
  const [filaDeSorteios, setFilaDeSorteios] = useState<SorteioDeGruposNaTemporada[]>([]);
  const sorteioPendente = filaDeSorteios[0];
  /** Mesma ideia de `filaDeSorteios`, pro chaveamento definido da 1ª etapa de um mata-mata — ver `onChaveamentoDefinido`. */
  const [filaDeChaveamentos, setFilaDeChaveamentos] = useState<ChaveamentoDeMataMataNaTemporada[]>([]);
  const chaveamentoPendente = filaDeChaveamentos[0];
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

  /**
   * Janela "não perguntar de novo" (ver `modoAutoAteSemanaRef`/
   * `pularAteProximoJogoRef`) — quando ativa (por número de semana OU por
   * "até o próximo jogo"), os demais prompts da semana (treino,
   * distribuição de pontos, cenário, resultado da rodada) também se
   * resolvem sozinhos com um padrão sensato, em vez de pausar, pra
   * "simular até a metade/final/próximo jogo" ser de verdade sem clique
   * nenhum.
   */
  function emJanelaAutomatica(): boolean {
    if (pularAteProximoJogoRef.current) return true;
    return modoAutoAteSemanaRef.current !== undefined && semanaAtualRef.current <= modoAutoAteSemanaRef.current;
  }

  const clubes = useMemo(() => loadClubes(), []);
  const clubePorId = useMemo(() => new Map(clubes.map((c) => [c.id, c])), [clubes]);
  const campeonatos = useMemo(() => [...loadCampeonatosNacionais(), ...loadEstaduais()], []);
  /** Nome de exibição (ex: "Campeonato Brasileiro Série C") por id (ex: "brasileirao_serie_c") — pra UI nunca mostrar o id bruto com "_". */
  const nomePorCampeonato = useMemo(() => new Map(campeonatos.map((c) => [c.id, c.nome])), [campeonatos]);
  const escudoPorCampeonato = useMemo(() => new Map(campeonatos.map((c) => [c.id, c.escudo_url])), [campeonatos]);
  const faixasPorCampeonato = useMemo(() => new Map(campeonatos.map((c) => [c.id, faixasDeDestaqueDaTabela(c)])), [campeonatos]);

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

  function registrarGrupoDoJogador(campeonatoId: string, grupoNome: string): void {
    grupoDoJogadorPorCampeonatoRef.current = new Map(grupoDoJogadorPorCampeonatoRef.current).set(campeonatoId, grupoNome);
    setGrupoDoJogadorPorCampeonato(grupoDoJogadorPorCampeonatoRef.current);
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

  /** Fecha a tela de "fim de jogo" (`PartidaAoVivoEmAndamento.finalizada`) — libera o resultado da
   * rodada represado por `onPartidaPontosCorridos`/`onPartidaMataMata`, se houver (não há quando a
   * partida terminou já em modo automático, ou quando a competição não tem resultado de rodada
   * pra mostrar). */
  function confirmarFimDeJogo(): void {
    setPartidaAoVivo(undefined);
    partidaAoVivoAtivaRef.current = false;
    const pendente = resultadoDaRodadaPendenteRef.current;
    resultadoDaRodadaPendenteRef.current = undefined;
    if (pendente) setResultadoDaRodada(pendente);
  }

  /** Fecha o painel de sorteio de grupos — chamado pelo clique do jogador, não pelo motor (que já
   * seguiu em frente, ver `onSorteioDeGrupos`). Só remove o 1º da fila — se houver outro represado
   * atrás, aparece em seguida. */
  function fecharSorteioDeGrupos(): void {
    setFilaDeSorteios((atual) => atual.slice(1));
  }

  /** Fecha o painel de chaveamento — mesma ideia de `fecharSorteioDeGrupos`. */
  function fecharChaveamento(): void {
    setFilaDeChaveamentos((atual) => atual.slice(1));
  }

  /** Chamado pela própria `PainelAnimacaoDeEscolha` quando o timer da animação termina (não é clique do jogador) — só então o resultado entra de fato no feed. */
  function concluirAnimacaoDeEscolha(): void {
    if (!animacaoDeEscolha) return;
    const { cenarioResolvido, origem } = animacaoDeEscolha;
    if (origem !== "incidente") {
      pushEvento({ tipo: "cenario", cenario: cenarioResolvido.cenario, opcao: cenarioResolvido.escolha.opcao, narrativa: cenarioResolvido.escolha.resultado.impacto.narrativa });
    }
    setAnimacaoDeEscolha(undefined);
  }

  function aoIniciarSemana(info: AoIniciarSemanaInfo): Promise<void> {
    if (cancelarAutoRef.current) {
      cancelarAutoRef.current = false;
      modoAutoAteSemanaRef.current = undefined;
      pularAteProximoJogoRef.current = false;
      setSimulandoAutomaticamente(false);
    }
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
   * mostrar nada (mesmo comportamento de `src/cli/index.ts`). "Até o
   * próximo jogo" (`pularAteProximoJogoRef`) é diferente: essa flag só vale
   * pra pular o que vem ANTES desta partida — ao CHEGAR aqui, o "próximo
   * jogo" já é este, então ela é desligada e o menu pré-jogo aparece
   * normalmente de novo (não auto-resolve).
   */
  function escolherModoDePartida(contexto: ContextoPartidaDoJogadorSemanal): Promise<ModoDePartida> {
    setJogoDaSemana({ campeonatoId: contexto.campeonatoId, semana: contexto.semana, mandanteId: contexto.mandanteId, visitanteId: contexto.visitanteId });
    pularAteProximoJogoRef.current = false;
    if (modoAutoAteSemanaRef.current !== undefined) {
      if (contexto.semana <= modoAutoAteSemanaRef.current) return Promise.resolve("rapida");
      modoAutoAteSemanaRef.current = undefined; // passou da janela automática, volta a perguntar
      setSimulandoAutomaticamente(false);
    }
    return new Promise((resolve) => setPromptPendente({ tipo: "pre_partida", contexto, resolve }));
  }

  function decidirChanceAoVivo(contexto: ContextoDecisaoChance): Promise<ResultadoDecisaoChance> {
    return new Promise((resolve) => setPromptPendente({ tipo: "chance_ao_vivo", contexto, resolve }));
  }

  function decidirEventoDePartida(cenario: Cenario): Promise<Opcao> {
    return new Promise((resolve) => setPromptPendente({ tipo: "evento_ao_vivo", cenario, resolve }));
  }

  /** Minuto "de passagem" sem evento nenhum — só atualiza o relógio exibido, pra ele correr de
   * forma contínua em vez de só pular quando um evento chega (pedido do usuário). */
  function onMinutoAoVivo(minuto: number): void {
    setPartidaAoVivo((atual) => (atual ? { ...atual, minutoAtual: minuto } : atual));
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
        // Alguns cenários de contexto são um gol de verdade acontecendo (pênalti, gol contra, falta
        // decisiva — ver `Cenario.efeitoDeGol` em `progression/scenarios.ts`) — sem atualizar o
        // placar aqui, o motor já contava certo por baixo (`resultado.golsCasa/golsFora` final),
        // mas a tela ao vivo ficava mostrando o placar antigo até o apito final (bug relatado:
        // "gol contra e placar 0-0").
        const efeitoDeGol = evento.escolha.resultado.impacto.efeitoDeGol;
        const ladoQueMarcou = efeitoDeGol === "a_favor" ? atual.ladoDoJogador : efeitoDeGol === "contra" ? (atual.ladoDoJogador === "casa" ? "fora" : "casa") : undefined;
        return {
          ...atual,
          eventos,
          minutoAtual: evento.minuto,
          golsCasa: atual.golsCasa + (ladoQueMarcou === "casa" ? 1 : 0),
          golsFora: atual.golsFora + (ladoQueMarcou === "fora" ? 1 : 0),
        };
      }
      if (evento.tipo === "incidente_jogador") {
        return { ...atual, eventos, minutoAtual: evento.minuto };
      }
      // apito_final — placar oficial substitui qualquer contagem aproximada feita ao vivo, e marca
      // "finalizada" pro painel virar a tela de fim de jogo (ver `PartidaAoVivoEmAndamento.finalizada`).
      return { ...atual, eventos, minutoAtual: 90, golsCasa: evento.golsCasa, golsFora: evento.golsFora, finalizada: true };
    });

    // Reaproveita a mesma animação de "spin" dos cenários de carreira fora de campo (`onCenarioResolvido`
    // abaixo) pra revelar cartão/lesão — diferente de `evento_de_contexto` (uma escolha interativa do
    // jogador, sem suspense de resultado), aqui o desfecho já é 100% automático/sorteado, então faz
    // sentido girar entre as possibilidades antes de mostrar qual aconteceu de verdade.
    if (evento.tipo === "incidente_jogador") {
      const cenario: Cenario = { id: "incidente_de_jogo", titulo: "Lance de jogo", descricao: "", opcoes: [evento.escolha.opcao] };
      const indiceResultado = evento.escolha.opcao.resultados.indexOf(evento.escolha.resultado);
      setAnimacaoDeEscolha({
        cenarioResolvido: { periodo: "", momento: "temporada_regular", cenario, escolha: evento.escolha },
        indiceResultado,
        origem: "incidente",
      });
    }
  }

  /** `estadoParaComecar` permite iniciar a temporada a partir de um estado diferente do `estadoAtual`
   * já renderizado — necessário pra tela de fim de temporada (`responderFimDeTemporada`), que assina um
   * contrato novo (`aplicarEscolhaDeFimDeTemporada`) e precisa que a temporada comece JÁ com o clube
   * atualizado, sem esperar o próximo render pra `estadoAtual` refletir isso (React `setState` é
   * assíncrono — usar `estadoAtual` direto aqui pegaria o clube ANTIGO). */
  async function jogarTemporada(estadoParaComecar?: EstadoDeCarreira): Promise<void> {
    const estadoInicialDaTemporada = estadoParaComecar ?? estadoAtual;
    // Reflete qualquer promoção/rebaixamento de temporadas anteriores desta carreira antes de
    // montar a temporada (ver `career/mundo-persistente.ts`) — sem isso, um clube rebaixado
    // continuaria aparecendo na divisão de cima pra sempre, todo ano.
    const campeonatosEfetivos = aplicarComposicaoSalva(campeonatos, estadoInicialDaTemporada.composicaoDasCompeticoes);
    setEstadoAtual(estadoInicialDaTemporada);
    setFase("jogando");
    setFeed([]);
    setResultado(undefined);
    // Toda temporada nova cria competições incrementais do zero (`criarCompeticoesIncrementaisDaTemporada`,
    // ver `career-loop.ts`), então nenhum estado derivado da temporada ANTERIOR deveria sobreviver até
    // aqui — sem isso, a tela da temporada 2+ começava mostrando tabela/fase/grupo da temporada 1 (até
    // ser sobrescrito aos poucos pelos primeiros eventos), e o filtro de grupo em
    // `onPartidaDaRodadaNaCompeticaoDoJogador` comparava contra o grupo da temporada passada, mascarando
    // atualizações de tabela da rodada atual (parecia "jogo por rodada errado"/time duplicado).
    setTabelaPorCampeonato(new Map());
    setFaseMataMataPorCampeonato(new Map());
    setChaveamentoPorCampeonato(new Map());
    grupoDoJogadorPorCampeonatoRef.current = new Map();
    setGrupoDoJogadorPorCampeonato(new Map());
    bufferRodadaRef.current = new Map();
    setJogoDaSemana(undefined);
    setResultadoDaRodada(undefined);
    setPartidaAoVivo(undefined);
    partidaAoVivoAtivaRef.current = false;
    resultadoDaRodadaPendenteRef.current = undefined;
    setAnimacaoDeEscolha(undefined);
    setFilaDeSorteios([]);
    setFilaDeChaveamentos([]);
    // Crítico: sem isso, "simular até o final" na temporada 1 deixava `modoAutoAteSemanaRef` em 52 —
    // como `semanaAtualRef` volta pra 1 (linha abaixo) mas o alvo continuava 52, `emJanelaAutomatica()`
    // ficava verdadeiro DESDE A SEMANA 1 da temporada 2 (1 <= 52), simulando a temporada inteira sozinha
    // sem nenhuma pausa — exatamente o "a temporada 2 não parece a primeira" reportado.
    modoAutoAteSemanaRef.current = undefined;
    pularAteProximoJogoRef.current = false;
    cancelarAutoRef.current = false;
    setSimulandoAutomaticamente(false);
    semanaAtualRef.current = 1;
    setSemanaAtual(1);

    const opcoes: OpcoesJogarTemporadaSemanal = {
      // A tela de fim de temporada (`responderFimDeTemporada`) já resolveu transferência/renovação
      // antes de chegar aqui — sem isso, o jogador podia receber a MESMA proposta de novo, narrada
      // durante a pré-temporada, um mecanismo antigo que essa tela substitui.
      desativarNegociacaoNarrativa: true,
      escolherFocoDeTreino,
      onTreinoResolvido: (treino) => pushEvento({ tipo: "treino", treino }),
      escolherDistribuicaoDePontos,
      onNivelAlcancado: (info) => {
        setEstadoAtual((atual) => ({ ...atual, nivel: info.nivelNovo, pontosDisponiveis: atual.pontosDisponiveis + info.pontosGanhos }));
        pushEvento({ tipo: "nivel", info });
      },
      escolherOpcao,
      onCenarioResolvido: (resolvido) => {
        const indiceResultado = resolvido.escolha.opcao.resultados.indexOf(resolvido.escolha.resultado);
        // Sem risco real (1 resultado só) ou em janela automática (fast-forward): revela direto,
        // sem pausa nenhuma — a animação só faz sentido quando havia mais de 1 desfecho possível.
        if (resolvido.escolha.opcao.resultados.length < 2 || emJanelaAutomatica()) {
          pushEvento({ tipo: "cenario", cenario: resolvido.cenario, opcao: resolvido.escolha.opcao, narrativa: resolvido.escolha.resultado.impacto.narrativa });
          return;
        }
        setAnimacaoDeEscolha({ cenarioResolvido: resolvido, indiceResultado });
      },
      onNegociacaoResolvida: (negociacao) => pushEvento({ tipo: "negociacao", negociacao }),
      aoIniciarSemana,
      escolherModoDePartida,
      decidirChanceAoVivo,
      decidirEventoDePartida,
      onEventoAoVivo,
      onMinutoAoVivo,
      msPorMinutoAoVivo: () => MS_POR_MINUTO_POR_VELOCIDADE[velocidadeAoVivoRef.current],
      onPartidaPontosCorridos: (info) => {
        if (info.grupoNome) registrarGrupoDoJogador(info.campeonatoId, info.grupoNome);
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
        // Estatísticas da carreira atualizam partida a partida, não só de uma vez no fim da
        // temporada (pedido do usuário: "os jogos devem atualizar as estatísticas conforme
        // acontecem, não quero que os números da temporada apareçam direto").
        const desempenhoDaPartida = converterChancesEmDesempenho(resultadoDaPartida.chancesJogador, 0, 1);
        setEstatisticasCarreira((atual) => ({
          ...atual,
          partidas: atual.partidas + 1,
          gols: atual.gols + desempenhoDaPartida.gols,
          assistencias: atual.assistencias + desempenhoDaPartida.assistencias,
        }));
        const resultadoParaExibir: ResultadoDaRodadaExibido | undefined = emJanelaAutomatica()
          ? undefined
          : {
              tipo: "pontos_corridos",
              campeonatoId: info.campeonatoId,
              rodada: confronto.rodada,
              confrontos: (() => {
                const bufferDaRodada = bufferRodadaRef.current.get(info.campeonatoId);
                return bufferDaRodada ? [...bufferDaRodada.confrontos] : [];
              })(),
              tabela: info.evento.tabelaDepois,
            };
        // Se a partida foi "ao vivo", represa o resultado da rodada até o jogador confirmar a tela
        // de fim de jogo (`confirmarFimDeJogo`) — o painel ao vivo continua na tela (já marcado
        // `finalizada` por `onEventoAoVivo`). Se foi "simulação rápida" (sem painel ao vivo) ou
        // estamos em modo automático, revela na hora, como sempre.
        if (partidaAoVivoAtivaRef.current) {
          resultadoDaRodadaPendenteRef.current = resultadoParaExibir;
        } else {
          setPartidaAoVivo(undefined);
          if (resultadoParaExibir) setResultadoDaRodada(resultadoParaExibir);
        }
      },
      escolherCampeonatosParaSeguir,
      onPartidaDaRodadaNaCompeticaoDoJogador: (info) => {
        // Numa competição com >1 grupo, este hook dispara pra TODO confronto da fase, de QUALQUER
        // grupo — não só o do jogador (só `onPartidaPontosCorridos`, que só dispara pra partida do
        // próprio clube, sabe de antemão que é do grupo certo). Sem filtrar aqui, os grupos alheios
        // se misturavam com o do jogador na tabela, no feed e no resumo da rodada (parecia "jogo por
        // rodada errado"/número de jogos desbalanceado, mesmo sem nenhum time jogando duas vezes de
        // verdade — eram só confrontos de OUTRO grupo entrando junto). Só quando ainda não se sabe o
        // grupo do jogador nesta fase (ele ainda não jogou) deixa passar, igual antes.
        const grupoDoJogador = grupoDoJogadorPorCampeonatoRef.current.get(info.campeonatoId);
        const ehDoGrupoDoJogador = !info.grupoNome || !grupoDoJogador || grupoDoJogador === info.grupoNome;
        if (!ehDoGrupoDoJogador) return;

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
      onConfrontoMataMataNaCompeticao: (info) => {
        setChaveamentoPorCampeonato((atual) => {
          const nova = new Map(atual);
          const etapas = [...(nova.get(info.campeonatoId) ?? [])];
          const confronto: ConfrontoDoChaveamento = {
            timeA: info.evento.confronto.timeA,
            timeB: info.evento.confronto.timeB,
            golsA: info.evento.confronto.golsA,
            golsB: info.evento.confronto.golsB,
            vencedor: info.evento.confronto.vencedor,
            decididoNosPenaltis: info.evento.confronto.decididoNosPenaltis,
          };
          const indiceEtapa = etapas.findIndex((e) => e.nome === info.evento.etapa);
          if (indiceEtapa === -1) {
            etapas.push({ nome: info.evento.etapa, confrontos: [confronto] });
          } else {
            etapas[indiceEtapa] = { ...etapas[indiceEtapa], confrontos: [...etapas[indiceEtapa].confrontos, confronto] };
          }
          nova.set(info.campeonatoId, etapas);
          return nova;
        });
      },
      onPartidaMataMata: (info) => {
        const eliminado = info.evento.confronto.vencedor !== estadoAtual.clubeAtualId;
        setFaseMataMataPorCampeonato((atual) => new Map(atual).set(info.campeonatoId, { etapa: info.evento.etapa, eliminado }));
        pushEvento({ tipo: "partida_mata_mata", info });
        setJogoDaSemana((atual) =>
          atual && atual.campeonatoId === info.campeonatoId ? { ...atual, resultado: { golsCasa: info.evento.confronto.golsA, golsFora: info.evento.confronto.golsB } } : atual,
        );
        // Mesma atualização incremental de `onPartidaPontosCorridos` — 1 ou 2 partidas (ida e
        // volta) por confronto de mata-mata.
        const partidasDoJogadorNestaEtapa = info.evento.confronto.partidasDoJogador ?? [];
        if (partidasDoJogadorNestaEtapa.length > 0) {
          let golsDaEtapa = 0;
          let assistenciasDaEtapa = 0;
          for (const partida of partidasDoJogadorNestaEtapa) {
            const desempenho = converterChancesEmDesempenho(partida.chancesJogador, 0, 1);
            golsDaEtapa += desempenho.gols;
            assistenciasDaEtapa += desempenho.assistencias;
          }
          setEstatisticasCarreira((atual) => ({
            ...atual,
            partidas: atual.partidas + partidasDoJogadorNestaEtapa.length,
            gols: atual.gols + golsDaEtapa,
            assistencias: atual.assistencias + assistenciasDaEtapa,
          }));
        }
        const resultadoParaExibir: ResultadoDaRodadaExibido | undefined = emJanelaAutomatica()
          ? undefined
          : {
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
            };
        // Mesmo represamento de `onPartidaPontosCorridos` — ver comentário lá.
        if (partidaAoVivoAtivaRef.current) {
          resultadoDaRodadaPendenteRef.current = resultadoParaExibir;
        } else {
          setPartidaAoVivo(undefined);
          if (resultadoParaExibir) setResultadoDaRodada(resultadoParaExibir);
        }
      },
      onStatusAtualizado: (info) => pushEvento({ tipo: "status", info }),
      onResumoDePeriodoCampeonatoSeguido: (campeonatoId, periodo, tabela) => pushEvento({ tipo: "tabela", campeonatoId, periodo, tabela }),
      onSorteioDeGrupos: (info) => {
        // motor já decidiu os grupos antes deste hook disparar — em janela automática (fast-forward)
        // não pausa, mesmo padrão de `animacaoDeEscolha`/`resultadoDaRodada`. Empilha (não sobrescreve)
        // porque outra competição do jogador pode ter sorteado grupos na MESMA semana — ver comentário
        // de `filaDeSorteios`.
        if (!emJanelaAutomatica()) setFilaDeSorteios((atual) => [...atual, info]);
      },
      onChaveamentoDefinido: (info) => {
        if (!emJanelaAutomatica()) setFilaDeChaveamentos((atual) => [...atual, info]);
      },
    };

    const resultadoDaTemporada = await jogarTemporadaSemanal(estadoInicialDaTemporada, campeonatosEfetivos, clubes, opcoes);
    setResultado(resultadoDaTemporada);

    // Promoção/rebaixamento entre temporadas (ver `career/mundo-persistente.ts`) — calcula a partir
    // da classificação final desta temporada (só disponível pra competições `pontos_corridos`
    // puras por enquanto) e persiste só o que realmente divergiu da referência estática original,
    // pra `composicaoDasCompeticoes` não crescer sem necessidade.
    const competicoesParaMundo: CompeticaoParaMundoPersistente[] = campeonatosEfetivos.map((c) => ({
      id: c.id,
      chaveDeHierarquia: chaveDeHierarquia(c),
      nivel: c.nivel,
      premiacao: c.premiacao,
      tabelaFinal: resultadoDaTemporada.resultadoTemporada.competicoes.find((r) => r.campeonatoId === c.id)?.resultado?.tabelaFinal,
    }));
    const mudancasDeDivisao = calcularMudancasDeDivisao(competicoesParaMundo);
    const composicaoAtualMap = new Map(campeonatosEfetivos.map((c) => [c.id, c.times]));
    const novaComposicaoMap = aplicarMudancasDeDivisao(composicaoAtualMap, mudancasDeDivisao);
    const novaComposicaoSalva: Record<string, string[]> = {};
    for (const base of campeonatos) {
      const novosTimes = novaComposicaoMap.get(base.id);
      if (novosTimes && !mesmoConjunto(novosTimes, base.times)) novaComposicaoSalva[base.id] = novosTimes;
    }

    setEstadoAtual({ ...resultadoDaTemporada.estado, composicaoDasCompeticoes: Object.keys(novaComposicaoSalva).length > 0 ? novaComposicaoSalva : undefined });
    setFase("resumo");

    const clubeDaTemporada = resultadoDaTemporada.estado.clubeAtualId;
    const novosTitulos: TituloDeCarreira[] = resultadoDaTemporada.resultadoTemporada.competicoes
      .filter((c) => c.resultado?.campeao === clubeDaTemporada)
      .map((c) => ({ campeonatoId: c.campeonatoId, temporada: resultadoDaTemporada.resultadoTemporada.temporada, clubeId: clubeDaTemporada }));
    // partidas/gols/assistências já foram somados partida a partida (`onPartidaPontosCorridos`/
    // `onPartidaMataMata`, ver comentário lá) — aqui só soma o que só faz sentido fechar no fim da
    // temporada (temporadas jogadas, títulos conquistados).
    setEstatisticasCarreira((atual) => ({
      ...atual,
      temporadas: atual.temporadas + 1,
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

  /**
   * Pede pra interromper "simular até a metade/final da temporada" — não
   * corta na hora (a semana em andamento termina normalmente), só marca
   * `cancelarAutoRef` pro próximo `aoIniciarSemana` desligar o modo
   * automático e voltar a pausar semana a semana, como antes de escolher
   * "até a metade/final".
   */
  function pararSimulacaoAutomatica(): void {
    cancelarAutoRef.current = true;
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

  /**
   * `pularAteProximoJogo` = true liga o "simular até o próximo jogo"
   * (`pularAteProximoJogoRef`) — fica nesta tela (não na pré-partida)
   * porque é aqui que o jogador vê "essa semana não tem jogo do seu
   * clube" e decide se quer pular as semanas sem partida até a próxima
   * que tiver, em vez de clicar "Continuar" uma a uma.
   */
  function responderSemana(pularAteProximoJogo = false): void {
    if (promptPendente?.tipo !== "semana") return;
    if (pularAteProximoJogo) pularAteProximoJogoRef.current = true;
    promptPendente.resolve();
    setPromptPendente(undefined);
  }

  /** Resolve o menu pré-jogo — ver `EscolhaDePrePartida`. */
  function responderPrePartida(escolha: EscolhaDePrePartida): void {
    if (promptPendente?.tipo !== "pre_partida") return;
    const { contexto, resolve } = promptPendente;
    setPromptPendente(undefined);

    if (escolha === "ao_vivo") {
      partidaAoVivoAtivaRef.current = true;
      setPartidaAoVivo({ mandanteId: contexto.mandanteId, visitanteId: contexto.visitanteId, ladoDoJogador: contexto.lado, minutoAtual: 0, golsCasa: 0, golsFora: 0, eventos: [] });
      resolve("ao_vivo");
    } else {
      resolve("rapida");
    }
  }

  /** Liga o modo "não perguntar de novo até a semana X" — botão sempre visível na tela (fora do menu
   * pré-jogo, ver `docs`/pedido do usuário: "as opções de simular a temporada devem ficar fora do menu
   * de jogo"), funciona a qualquer momento, não só quando há uma partida do jogador essa semana. Se
   * houver QUALQUER prompt de transição de semana pendente no momento do clique (semana sem jogo,
   * menu pré-jogo, treino, distribuição de pontos, cenário de carreira), resolve ele direto com o
   * mesmo padrão automático que `emJanelaAutomatica()` já usa daqui pra frente — sem isso, o clique
   * ligava o modo automático mas o jogador ainda precisava dar 1 clique manual em "Continuar" pra
   * sair da tela em que já estava, o que não é "um botão direto" (pedido explícito do usuário).
   * Prompts que representam uma decisão real e não repetitiva (ex: `seguir_campeonatos`, ou uma
   * partida "ao vivo" já em andamento) ficam de fora de propósito. */
  function simularAteSemana(semana: number): void {
    modoAutoAteSemanaRef.current = semana;
    setSimulandoAutomaticamente(true);
    // Painéis de "pausa" que NÃO fazem parte de `promptPendente` (resultado da rodada, sorteio de
    // grupos, chaveamento, animação de escolha) não bloqueiam o motor de verdade — ele já resolveu
    // tudo e seguiu em frente sozinho (ver comentário de `ResultadoDaRodadaExibido`), só a UI que
    // fica esperando o clique antes de trocar de tela. Sem fechar esses aqui, o painel antigo (de
    // ANTES do modo automático ligar) ficava preso na tela pro resto da simulação inteira — o motor
    // simulava a temporada inteira (e a próxima) por baixo, mas a tela continuava mostrando o
    // resultado da 1ª rodada, porque nada nunca mais chamava `setResultadoDaRodada` de novo (só
    // acontece fora da janela automática).
    setResultadoDaRodada(undefined);
    setFilaDeSorteios([]);
    setFilaDeChaveamentos([]);
    concluirAnimacaoDeEscolha();
    // Mesma ideia acima, pro painel de "fim de jogo" (`PartidaAoVivoEmAndamento.finalizada`) — só
    // fecha se já tiver chegado no apito final; uma partida ainda em andamento nesse exato instante
    // não é interrompida (o motor já vai resolvê-la sozinho, sem pausa, pelo resto da simulação).
    setPartidaAoVivo((atual) => {
      if (!atual?.finalizada) return atual;
      partidaAoVivoAtivaRef.current = false;
      resultadoDaRodadaPendenteRef.current = undefined;
      return undefined;
    });
    if (!promptPendente) return;
    switch (promptPendente.tipo) {
      case "semana":
        promptPendente.resolve();
        break;
      case "pre_partida":
        promptPendente.resolve("rapida");
        break;
      case "foco":
        promptPendente.resolve("tecnico"); // mesmo padrão do motor quando ninguém escolhe (ver career-loop.ts)
        break;
      case "pontos": {
        const { estado } = promptPendente;
        promptPendente.resolve([{ atributo: buscarArquetipo(estado.jogador.arquetipo_id).atributos_prioritarios[0], quantidade: estado.pontosDisponiveis }]);
        break;
      }
      case "cenario":
        promptPendente.resolve(promptPendente.cenario.opcoes[0]); // mesmo padrão do motor quando ninguém escolhe
        break;
      default:
        return;
    }
    setPromptPendente(undefined);
  }

  function simularAteAMetadeDaTemporada(): void {
    simularAteSemana(Math.floor(ULTIMA_SEMANA_DA_TEMPORADA / 2));
  }

  function simularAteOFinalDaTemporada(): void {
    simularAteSemana(ULTIMA_SEMANA_DA_TEMPORADA);
  }

  function responderSeguirCampeonatos(idsEscolhidos: string[]): void {
    if (promptPendente?.tipo !== "seguir_campeonatos") return;
    promptPendente.resolve(idsEscolhidos);
    setPromptPendente(undefined);
  }

  /** Chamado pelo botão do resumo de fim de temporada — gera as propostas (transferência +
   * renovação do clube atual, ver `career/fim-de-temporada.ts`) e abre a tela dedicada
   * (`fase: "propostas"`), sem ainda iniciar a próxima temporada (isso só acontece depois que o
   * jogador responder, ver `responderFimDeTemporada`). */
  function verPropostasFimDeTemporada(): void {
    setPropostasFimDeTemporada(gerarPropostasDeFimDeTemporada(estadoAtual, clubes));
    setFase("propostas");
  }

  /** Aplica a escolha do jogador (renovar/transferir/ficar sem assinar nada) e já inicia a próxima
   * temporada a partir do estado atualizado — ver `jogarTemporada` (`estadoParaComecar`), necessário
   * porque o clube pode ter mudado nesta mesma chamada. */
  function responderFimDeTemporada(escolha: EscolhaDeFimDeTemporada): void {
    if (!propostasFimDeTemporada) return;
    const estadoComContrato = aplicarEscolhaDeFimDeTemporada(estadoAtual, propostasFimDeTemporada, escolha);
    setPropostasFimDeTemporada(undefined);
    void jogarTemporada(estadoComContrato);
  }

  return {
    estadoAtual,
    fase,
    feed,
    promptPendente,
    partidaAoVivo,
    velocidadeAoVivo,
    definirVelocidadeAoVivo,
    tabelaPorCampeonato,
    faseMataMataPorCampeonato,
    chaveamentoPorCampeonato,
    grupoDoJogadorPorCampeonato,
    competicoesDoJogador,
    estatisticasCarreira,
    resultado,
    clubePorId,
    nomePorCampeonato,
    escudoPorCampeonato,
    faixasPorCampeonato,
    jogarTemporada,
    propostasFimDeTemporada,
    verPropostasFimDeTemporada,
    responderFimDeTemporada,
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
    simulandoAutomaticamente,
    pararSimulacaoAutomatica,
    simularAteAMetadeDaTemporada,
    simularAteOFinalDaTemporada,
    resultadoDaRodada,
    responderResultadoDaRodada,
    confirmarFimDeJogo,
    animacaoDeEscolha,
    concluirAnimacaoDeEscolha,
    sorteioPendente,
    fecharSorteioDeGrupos,
    chaveamentoPendente,
    fecharChaveamento,
    semanaAtual,
    jogoDaSemana,
  };
}
