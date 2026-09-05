import type { Club } from "../schemas/club.js";
import { buscarArquetipo } from "../schemas/player.js";
import { construirCalendarioPadrao } from "../data/loaders/calendario.js";
import { simularTemporada, type CampeonatoSimulavel, type EventosSimulacaoTemporada, type ResultadoTemporada } from "../simulation/engine.js";
import type { EventoConfrontoMataMata } from "../simulation/knockout.js";
import type { EventoConfrontoPontosCorridos } from "../simulation/season.js";
import type { ParticipacaoJogadorClube } from "../simulation/match.js";
import type { EstiloTecnico } from "../simulation/tactics.js";
import { aplicarTreino, converterChancesEmDesempenho, MORAL_RECUPERADA_NO_DESCANSO, type FocoDeTreino } from "../progression/xp.js";
import {
  CENARIOS,
  filtrarCenariosElegiveis,
  momentoDoPeriodo,
  resolverEscolha,
  sortearCenario,
  type Cenario,
  type ContextoSorteio,
  type EscolhaResolvida,
  type Opcao,
} from "../progression/scenarios.js";
import { calcularValorDeMercado, type PerfilDeMercado } from "../market/valuation.js";
import { estaNaJanelaDeTransferencia, gerarProposta, selecionarClubesInteressados, type PropostaTransferencia, type TermosDeContrato } from "../market/transfers.js";
import { contrapropostaPadrao, negociarTransferencia, type FatoresConfianca, type ResultadoNegociacao } from "../market/negotiation.js";
import { precisaVender } from "./club-finances.js";
import { assinarContrato, aplicarDesempenhoPartida, aplicarImpactoDeCenario, avancarTemporada, overallAtual, type EstadoDeCarreira } from "./Player.js";

/**
 * Game loop de carreira — junta as peças já implementadas (`simulation/
 * engine.ts` pro calendário de competições, `progression/scenarios.ts` pro
 * catálogo de cenários com gatilho, `market/*.ts` pra negociação de
 * transferência, `career/Player.ts` pro estado do jogador) numa única
 * passagem de temporada, sem precisar orquestrar cada partida/cenário/
 * negociação na mão como a demo de `src/cli/index.ts` fazia.
 */

/** Minutos jogados assumidos em toda partida do jogador — não existe sistema de minutagem/banco ainda (pendência, docs/motor-de-partida.md). */
const MINUTOS_POR_PARTIDA_PADRAO = 90;
/** Importância uniforme pra toda partida — o motor ainda não distingue fase (final de mata-mata vs. fase de grupos) dentro de `partidasDoJogador` (pendência). */
const IMPORTANCIA_PADRAO = 1;

export interface PartidaDoJogadorPontosCorridos {
  campeonatoId: string;
  evento: EventoConfrontoPontosCorridos;
}

export interface PartidaDoJogadorMataMata {
  campeonatoId: string;
  evento: EventoConfrontoMataMata;
}

export interface CenarioResolvidoNaTemporada {
  periodo: string;
  momento: NonNullable<ContextoSorteio["momento"]>;
  cenario: Cenario;
  escolha: EscolhaResolvida;
}

export interface NegociacaoResolvidaNaTemporada {
  periodo: string;
  /** "compra" = clube maior demonstrou interesse; "venda_forcada" = o próprio clube atual precisava do dinheiro e aceitou vender pra qualquer comprador capaz de pagar (`career/club-finances.ts` `precisaVender`). */
  tipo: "compra" | "venda_forcada";
  clubeOfertanteId: string;
  proposta: PropostaTransferencia;
  contrapropostaJogador: TermosDeContrato;
  resultado: ResultadoNegociacao;
}

export interface ResumoCompeticaoNaTemporada {
  campeonatoId: string;
  /** Presente quando a competição não pôde ser simulada (ver `simulation/engine.ts` `ResultadoCompeticaoNaTemporada`) — as contagens abaixo ficam zeradas nesse caso. */
  erro?: string;
  /** Ausente quando a competição deu `erro`. */
  campeao?: string;
  partidasDoJogador: number;
  golsDoJogador: number;
  assistenciasDoJogador: number;
}

export interface ResumoPartidasDaTemporada {
  overallAntes: number;
  overallDepois: number;
  /** Uma entrada por competição do calendário, na mesma ordem de `ResultadoTemporada.competicoes`. */
  competicoes: ResumoCompeticaoNaTemporada[];
}

export interface TreinoResolvidoNaTemporada {
  periodo: string;
  foco: FocoDeTreino;
  overallAntes: number;
  overallDepois: number;
  moralAntes: number;
  moralDepois: number;
}

export interface ResultadoTemporadaDeCarreira {
  /** Estado do jogador ao final da temporada — já com a idade/temporada avançadas (ver `avancarTemporada`). */
  estado: EstadoDeCarreira;
  /** Resultado bruto do calendário de competições da temporada (`simulation/engine.ts`). */
  resultadoTemporada: ResultadoTemporada;
  /** Resumo das partidas do jogador na temporada (gols/assistências/campeão por competição, overall antes/depois) — visão agregada, não partida a partida (ver `onPartidasResumidas` pra saber por quê). */
  resumoPartidas: ResumoPartidasDaTemporada;
  /** Uma sessão de treino resolvida por período do calendário, na ordem em que aconteceram (ver `progression/xp.ts` `aplicarTreino`). */
  treinosResolvidos: TreinoResolvidoNaTemporada[];
  /** Um cenário resolvido por período do calendário, na ordem em que aconteceram. */
  cenariosResolvidos: CenarioResolvidoNaTemporada[];
  /** Propostas de transferência negociadas na janela da temporada (só período mapeado pra `pre_temporada`, ver `market/transfers.ts` `estaNaJanelaDeTransferencia`) — vazio se nenhum clube demonstrou interesse. Para no primeiro `aceito`. */
  negociacoesResolvidas: NegociacaoResolvidaNaTemporada[];
}

export interface OpcoesJogarTemporada {
  estiloTecnico?: EstiloTecnico;
  /**
   * UF/região do clube atual — decide onde deltas de reputação regional
   * caem (ver `progression/scenarios.ts` `aplicarImpacto`) e filtra
   * cenários por reputação regional. Derivada automaticamente de
   * `Club.estado` a cada período (então acompanha uma transferência de
   * clube dentro da própria temporada); esta opção só serve de fallback
   * pra clube sem `estado` (a maioria dos clubes fora do Brasil).
   */
  regiaoAtual?: string;
  /**
   * Como decidir qual opção de um cenário é escolhida — por padrão,
   * sempre a primeira (mesmo comportamento das demos de CLI). Injete pra
   * plugar uma interface real (jogador humano escolhendo via prompt, IA,
   * sempre a opção mais segura, etc). Pode ser assíncrona (ex: esperar o
   * jogador digitar uma resposta no terminal) — `jogarTemporada`/
   * `jogarCarreira` são `async` justamente pra suportar isso.
   */
  escolherOpcao?: (cenario: Cenario) => Opcao | Promise<Opcao>;
  /** Como o jogador contrapropõe uma oferta de transferência recebida — por padrão, `market/negotiation.ts` `contrapropostaPadrao` (pede mais salário/luvas que a proposta inicial). Injete pra plugar outra estratégia (também pode ser assíncrona). */
  responderProposta?: (proposta: PropostaTransferencia) => TermosDeContrato | Promise<TermosDeContrato>;
  /**
   * Como decidir o foco de treino de cada período — por padrão, sempre
   * `"tecnico"` (escolha arbitrária, mesmo espírito do padrão de
   * `escolherOpcao`). Injete pra plugar uma escolha real (jogador humano
   * escolhendo via prompt, IA, etc — também pode ser assíncrona). Recebe
   * o `EstadoDeCarreira` atual (já com o XP das partidas da temporada
   * aplicado) pra poder decidir com base em atributos/moral atuais.
   */
  escolherFocoDeTreino?: (estado: EstadoDeCarreira) => FocoDeTreino | Promise<FocoDeTreino>;
  /** Chamado assim que cada sessão de treino do período é resolvida — útil pra mostrar o desfecho em tempo real numa interface interativa. */
  onTreinoResolvido?: (treino: TreinoResolvidoNaTemporada) => void | Promise<void>;
  /**
   * Chamado a cada confronto de pontos corridos que o clube atual do
   * jogador disputa (`simulation/season.ts` `EventoConfrontoPontosCorridos`
   * — inclui a tabela antes/depois desse confronto específico), na ordem
   * em que os confrontos acontecem dentro da competição. **Síncrono, não
   * assíncrono** (ao contrário dos outros hooks) — a temporada inteira é
   * simulada de uma vez só (`simulation/engine.ts` `simularTemporada` não
   * é assíncrono), então não dá pra pausar/esperar entrada de usuário
   * entre partidas sem reescrever todo o motor de simulação como
   * assíncrono; o hook serve pra **mostrar** o jogo a jogo em tempo real
   * conforme a temporada é processada, não pra interagir partida a
   * partida.
   */
  onPartidaPontosCorridos?: (info: PartidaDoJogadorPontosCorridos) => void;
  /** Equivalente a `onPartidaPontosCorridos`, mas pra confrontos de mata-mata (`simulation/knockout.ts` `EventoConfrontoMataMata`) — também síncrono, mesma ressalva. */
  onPartidaMataMata?: (info: PartidaDoJogadorMataMata) => void;
  /** Chamado assim que cada negociação de transferência é resolvida (aceita ou não) — útil pra mostrar o desfecho em tempo real numa interface interativa, antes do resto da temporada continuar. */
  onNegociacaoResolvida?: (negociacao: NegociacaoResolvidaNaTemporada) => void | Promise<void>;
  /**
   * Chamado uma vez por temporada, logo depois de todas as partidas do
   * calendário serem simuladas e o XP aplicado — antes do primeiro
   * cenário do período ser sorteado. Não é partida a partida: `simularTemporada`
   * roda a temporada inteira de uma vez (não período a período), então
   * não dá pra saber o resultado de uma partida específica antes das
   * outras sem reestruturar o motor de calendário — o resumo agregado
   * (gols/assistências/campeão por competição, overall antes/depois) é
   * o meio-termo prático (ver `ResumoPartidasDaTemporada`).
   */
  onPartidasResumidas?: (resumo: ResumoPartidasDaTemporada) => void | Promise<void>;
  /** Chamado assim que cada cenário do período é resolvido — útil pra mostrar o desfecho em tempo real numa interface interativa. */
  onCenarioResolvido?: (resolvido: CenarioResolvidoNaTemporada) => void | Promise<void>;
  random?: () => number;
}

/**
 * Roda a negociação real com cada clube interessado (compra ou venda
 * forçada, mesma mecânica pro comprador — o que muda entre os dois casos
 * é só quem entra na lista de `interessados`, ver `selecionarClubesInteressados`
 * `exigirUpgrade`), parando no primeiro que aceitar. Registra toda
 * tentativa (aceita ou não) em `negociacoesResolvidas`.
 */
async function resolverNegociacaoDeTransferencia(
  estado: EstadoDeCarreira,
  interessados: Club[],
  valorDeMercado: number,
  tipo: NegociacaoResolvidaNaTemporada["tipo"],
  periodo: string,
  responderProposta: (proposta: PropostaTransferencia) => TermosDeContrato | Promise<TermosDeContrato>,
  random: () => number,
  negociacoesResolvidas: NegociacaoResolvidaNaTemporada[],
  onNegociacaoResolvida?: (negociacao: NegociacaoResolvidaNaTemporada) => void | Promise<void>,
): Promise<{ estado: EstadoDeCarreira; aceita: boolean }> {
  let estadoAtual = estado;

  for (const clube of interessados) {
    const proposta = gerarProposta(clube, valorDeMercado, random);
    const contraproposta = await responderProposta(proposta);
    const fatoresConfianca: FatoresConfianca = {
      overall: overallAtual(estadoAtual),
      reputacaoNacional: estadoAtual.reputacao.nacional,
      concorrentes: interessados.length - 1,
    };
    const resultado = negociarTransferencia(proposta, contraproposta, fatoresConfianca, estadoAtual.temporada, random);

    const negociacao: NegociacaoResolvidaNaTemporada = { periodo, tipo, clubeOfertanteId: clube.id, proposta, contrapropostaJogador: contraproposta, resultado };
    negociacoesResolvidas.push(negociacao);
    await onNegociacaoResolvida?.(negociacao);

    if (resultado.aceito && resultado.contrato) {
      return { estado: assinarContrato(estadoAtual, resultado.contrato), aceita: true };
    }
  }

  return { estado: estadoAtual, aceita: false };
}

/**
 * Joga uma temporada inteira da carreira: simula todas as competições
 * ativas do calendário padrão (`simulation/engine.ts` `simularTemporada`),
 * aplica o XP de cada partida do jogador em ordem (`aplicarDesempenhoPartida`),
 * e por período do calendário: deriva o momento (`momentoDoPeriodo`),
 * verifica interesse real de mercado se a janela estiver aberta
 * (`market/transfers.ts` `estaNaJanelaDeTransferencia`/
 * `selecionarClubesInteressados`), e sorteia+resolve um cenário elegível
 * pro contexto atual.
 *
 * **Cenário e mercado são a mesma coisa, não duas coisas coexistindo**:
 * havendo interesse real de mercado nesse período — de **compra** (clube
 * maior sondando, `Opcao.disparaNegociacaoReal`) ou de **venda forçada**
 * (o próprio clube atual precisando do dinheiro,
 * `career/club-finances.ts` `precisaVender`, `Opcao.disparaVendaForcada`,
 * ambos em `progression/scenarios.ts`) — o sorteio prioriza um cenário
 * "de transferência" do tipo certo sobre o resto do catálogo (venda
 * forçada tem prioridade se os dois calharem no mesmo período). Se o
 * jogador escolhe a opção de buscar/aceitar a saída, o desfecho não vem
 * da probabilidade estática do cenário: vem de uma negociação de verdade
 * (`market/negotiation.ts`), e só então aplica o impacto narrativo
 * correspondente (favorável se aceita, desfavorável se recusada). Sem
 * interesse real nesse período, cenários de transferência nem entram no
 * sorteio (não teria proposta nenhuma por trás pra sustentar a cena). O
 * interesse de compra é filtrado por `calcularRatingDeInteresse`
 * (`market/valuation.ts`) pra ficar factível com o desempenho real do
 * jogador (overall), não só com o rating do clube atual dele — venda
 * forçada dispensa essa exigência de "clube maior" (o clube desesperado
 * vende pra qualquer comprador capaz de pagar).
 *
 * Por fim avança pra próxima temporada (`avancarTemporada`: idade+1,
 * declínio por idade, renda de patrocínio). Não muta o `estado` recebido.
 *
 * **Simplificações documentadas** (não são bugs escondidos, ver pendências
 * em `docs/motor-de-partida.md`): toda partida é tratada como 90 minutos
 * jogados e importância 1 — não existe sistema de minutagem/banco nem
 * diferenciação de fase (final vs. fase de grupos) dentro de
 * `partidasDoJogador` ainda. Uma negociação aceita por temporada, no
 * máximo (para no primeiro clube que aceitar a contraproposta).
 */
export async function jogarTemporada(
  estado: EstadoDeCarreira,
  campeonatos: CampeonatoSimulavel[],
  clubes: Club[],
  opcoes: OpcoesJogarTemporada = {},
): Promise<ResultadoTemporadaDeCarreira> {
  const {
    estiloTecnico = "equilibrado",
    regiaoAtual: regiaoAtualPadrao,
    escolherOpcao = (cenario: Cenario) => cenario.opcoes[0],
    responderProposta = contrapropostaPadrao,
    escolherFocoDeTreino = () => "tecnico" as const,
    onNegociacaoResolvida,
    onCenarioResolvido,
    onPartidasResumidas,
    onTreinoResolvido,
    onPartidaPontosCorridos,
    onPartidaMataMata,
    random = Math.random,
  } = opcoes;

  const clubePorId = new Map(clubes.map((c) => [c.id, c]));
  const clubeNoInicioDaTemporada = estado.clubeAtualId;

  const participacaoJogador: ParticipacaoJogadorClube = { clubeId: estado.clubeAtualId, jogador: estado.jogador, estiloTecnico };
  const eventosDeSimulacao: EventosSimulacaoTemporada = {
    aoSimularConfrontoPontosCorridos: onPartidaPontosCorridos
      ? (campeonatoId, evento) => {
          if (evento.confronto.mandante === clubeNoInicioDaTemporada || evento.confronto.visitante === clubeNoInicioDaTemporada) {
            onPartidaPontosCorridos({ campeonatoId, evento });
          }
        }
      : undefined,
    aoResolverConfrontoMataMata: onPartidaMataMata
      ? (campeonatoId, evento) => {
          if (evento.confronto.timeA === clubeNoInicioDaTemporada || evento.confronto.timeB === clubeNoInicioDaTemporada) {
            onPartidaMataMata({ campeonatoId, evento });
          }
        }
      : undefined,
  };
  const resultadoTemporada = simularTemporada(estado.temporada, campeonatos, clubes, participacaoJogador, random, eventosDeSimulacao);

  const overallAntes = overallAtual(estado);
  let estadoAtual = estado;
  const resumoCompeticoes: ResumoCompeticaoNaTemporada[] = [];

  for (const competicao of resultadoTemporada.competicoes) {
    if (!competicao.resultado) {
      resumoCompeticoes.push({ campeonatoId: competicao.campeonatoId, erro: competicao.erro, partidasDoJogador: 0, golsDoJogador: 0, assistenciasDoJogador: 0 });
      continue;
    }

    let golsDoJogador = 0;
    let assistenciasDoJogador = 0;
    for (const partida of competicao.resultado.partidasDoJogador) {
      const desempenho = converterChancesEmDesempenho(partida.chancesJogador, MINUTOS_POR_PARTIDA_PADRAO, IMPORTANCIA_PADRAO);
      estadoAtual = aplicarDesempenhoPartida(estadoAtual, partida.chancesJogador, desempenho);
      golsDoJogador += desempenho.gols;
      assistenciasDoJogador += desempenho.assistencias;
    }

    resumoCompeticoes.push({
      campeonatoId: competicao.campeonatoId,
      campeao: competicao.resultado.campeao,
      partidasDoJogador: competicao.resultado.partidasDoJogador.length,
      golsDoJogador,
      assistenciasDoJogador,
    });
  }

  const resumoPartidas: ResumoPartidasDaTemporada = { overallAntes, overallDepois: overallAtual(estadoAtual), competicoes: resumoCompeticoes };
  await onPartidasResumidas?.(resumoPartidas);

  const cenariosResolvidos: CenarioResolvidoNaTemporada[] = [];
  const negociacoesResolvidas: NegociacaoResolvidaNaTemporada[] = [];
  const treinosResolvidos: TreinoResolvidoNaTemporada[] = [];

  for (const periodo of construirCalendarioPadrao(estadoAtual.temporada).calendario) {
    const momento = momentoDoPeriodo(periodo.periodo);

    const foco = await escolherFocoDeTreino(estadoAtual);
    const overallAntesTreino = overallAtual(estadoAtual);
    const moralAntesTreino = estadoAtual.moral;

    if (foco === "descanso") {
      const regiaoParaDescanso = clubePorId.get(estadoAtual.clubeAtualId)?.estado ?? regiaoAtualPadrao;
      estadoAtual = aplicarImpactoDeCenario(estadoAtual, { moral: MORAL_RECUPERADA_NO_DESCANSO, narrativa: "" }, regiaoParaDescanso);
    } else {
      const arquetipo = buscarArquetipo(estadoAtual.jogador.arquetipo_id);
      const atributosTreinados = aplicarTreino(estadoAtual.jogador, arquetipo, foco);
      estadoAtual = { ...estadoAtual, jogador: { ...estadoAtual.jogador, atributos: atributosTreinados } };
    }

    const treinoResolvido: TreinoResolvidoNaTemporada = {
      periodo: periodo.periodo,
      foco,
      overallAntes: overallAntesTreino,
      overallDepois: overallAtual(estadoAtual),
      moralAntes: moralAntesTreino,
      moralDepois: estadoAtual.moral,
    };
    treinosResolvidos.push(treinoResolvido);
    await onTreinoResolvido?.(treinoResolvido);

    const regiaoAtual = clubePorId.get(estadoAtual.clubeAtualId)?.estado ?? regiaoAtualPadrao;

    let interessadosCompra: Club[] = [];
    let interessadosVenda: Club[] = [];
    let valorDeMercado = 0;

    if (estaNaJanelaDeTransferencia(momento)) {
      const perfil: PerfilDeMercado = {
        overall: overallAtual(estadoAtual),
        idade: estadoAtual.jogador.idade,
        reputacaoNacional: estadoAtual.reputacao.nacional,
      };
      valorDeMercado = calcularValorDeMercado(perfil);
      interessadosCompra = selecionarClubesInteressados(clubes, estadoAtual.clubeAtualId, perfil, { random });

      const clubeAtualObj = clubePorId.get(estadoAtual.clubeAtualId);
      if (clubeAtualObj && precisaVender(clubeAtualObj, random)) {
        interessadosVenda = selecionarClubesInteressados(clubes, estadoAtual.clubeAtualId, perfil, { random, exigirUpgrade: false });
      }
    }

    const contexto: ContextoSorteio = {
      idadeJogador: estadoAtual.jogador.idade,
      reputacaoNacional: estadoAtual.reputacao.nacional,
      reputacaoRegional: regiaoAtual !== undefined ? (estadoAtual.reputacao.porRegiao[regiaoAtual] ?? 0) : 0,
      moral: estadoAtual.moral,
      relacoesInternas: estadoAtual.relacoesInternas,
      momento,
    };

    // Cenários "de transferência" (compra ou venda forçada) só entram no sorteio quando há o
    // interesse real correspondente nesse período — evita prometer proposta que não existe
    // mecanicamente. Havendo interesse real E ao menos um cenário elegível, o sorteio fica restrito
    // a eles (não competem contra o resto do catálogo) — garante que a negociação real sempre venha
    // acompanhada da moldura narrativa certa, em vez de só "coexistir" sem se referenciar. Venda
    // forçada tem prioridade sobre interesse de compra quando os dois calham no mesmo período.
    const elegiveis = filtrarCenariosElegiveis(CENARIOS, contexto);
    const elegiveisDeVenda = elegiveis.filter((c) => c.opcoes.some((o) => o.disparaVendaForcada));
    const elegiveisDeCompra = elegiveis.filter((c) => c.opcoes.some((o) => o.disparaNegociacaoReal));
    const elegiveisGerais = elegiveis.filter((c) => !c.opcoes.some((o) => o.disparaVendaForcada || o.disparaNegociacaoReal));

    let poolDeSorteio: Cenario[];
    if (interessadosVenda.length > 0 && elegiveisDeVenda.length > 0) {
      poolDeSorteio = elegiveisDeVenda;
    } else if (interessadosCompra.length > 0 && elegiveisDeCompra.length > 0) {
      poolDeSorteio = elegiveisDeCompra;
    } else {
      poolDeSorteio = elegiveisGerais;
    }

    const cenario = sortearCenario(poolDeSorteio, random);
    const opcaoEscolhida = await escolherOpcao(cenario);

    const negociacaoAplicavel =
      opcaoEscolhida.disparaVendaForcada && interessadosVenda.length > 0
        ? { interessados: interessadosVenda, tipo: "venda_forcada" as const }
        : opcaoEscolhida.disparaNegociacaoReal && interessadosCompra.length > 0
          ? { interessados: interessadosCompra, tipo: "compra" as const }
          : undefined;

    let escolha: EscolhaResolvida;
    if (negociacaoAplicavel) {
      const { estado: novoEstado, aceita } = await resolverNegociacaoDeTransferencia(
        estadoAtual,
        negociacaoAplicavel.interessados,
        valorDeMercado,
        negociacaoAplicavel.tipo,
        periodo.periodo,
        responderProposta,
        random,
        negociacoesResolvidas,
        onNegociacaoResolvida,
      );
      estadoAtual = novoEstado;

      // resultados[0] é o molde de narrativa/impacto pro desfecho favorável (negociação aceita),
      // resultados[último] pro desfecho desfavorável (recusada) — ver Opcao.disparaNegociacaoReal/disparaVendaForcada.
      escolha = { opcao: opcaoEscolhida, resultado: aceita ? opcaoEscolhida.resultados[0] : opcaoEscolhida.resultados[opcaoEscolhida.resultados.length - 1] };
    } else {
      escolha = resolverEscolha(opcaoEscolhida, random);
    }

    const regiaoParaImpacto = clubePorId.get(estadoAtual.clubeAtualId)?.estado ?? regiaoAtualPadrao;
    estadoAtual = aplicarImpactoDeCenario(estadoAtual, escolha.resultado.impacto, regiaoParaImpacto);

    const resolvido: CenarioResolvidoNaTemporada = { periodo: periodo.periodo, momento, cenario, escolha };
    cenariosResolvidos.push(resolvido);
    await onCenarioResolvido?.(resolvido);
  }

  const regiaoFinal = clubePorId.get(estadoAtual.clubeAtualId)?.estado ?? regiaoAtualPadrao;
  estadoAtual = avancarTemporada(estadoAtual, regiaoFinal);

  return { estado: estadoAtual, resultadoTemporada, resumoPartidas, treinosResolvidos, cenariosResolvidos, negociacoesResolvidas };
}

export interface ResultadoCarreiraDeVariasTemporadas {
  estadoFinal: EstadoDeCarreira;
  /** Uma entrada por temporada jogada, na ordem. */
  temporadas: ResultadoTemporadaDeCarreira[];
}

/** Encadeia `jogarTemporada` por várias temporadas seguidas, alimentando o estado final de uma na próxima — o "save" indo de temporada em temporada sozinho, incluindo eventuais trocas de clube por transferência. */
export async function jogarCarreira(
  estadoInicial: EstadoDeCarreira,
  quantidadeDeTemporadas: number,
  campeonatos: CampeonatoSimulavel[],
  clubes: Club[],
  opcoes: OpcoesJogarTemporada = {},
): Promise<ResultadoCarreiraDeVariasTemporadas> {
  let estado = estadoInicial;
  const temporadas: ResultadoTemporadaDeCarreira[] = [];

  for (let i = 0; i < quantidadeDeTemporadas; i++) {
    const resultado = await jogarTemporada(estado, campeonatos, clubes, opcoes);
    temporadas.push(resultado);
    estado = resultado.estado;
  }

  return { estadoFinal: estado, temporadas };
}
