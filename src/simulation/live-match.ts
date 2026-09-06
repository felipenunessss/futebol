import type { Atributo } from "../schemas/player.js";
import { EVENTOS_DE_PARTIDA } from "../progression/match-events.js";
import { resolverEscolha, sortearCenario, type Cenario, type EscolhaResolvida, type ImpactoCarreira, type Opcao } from "../progression/scenarios.js";
import { ATRIBUTO_POR_SUBTIPO, sortearSubtipo, type SubtipoChance } from "./tactics.js";
import {
  CHANCES_BASE_POR_PARTIDA,
  PESO_ENVOLVIMENTO_ATAQUE,
  VANTAGEM_MAXIMA_DE_MEIO,
  forcaDoAtributo,
  probabilidadeDeVencer,
  resolverDuelo,
  type ChanceJogador,
  type ParticipacaoJogador,
  type PerfilTime,
  type ResultadoPartida,
} from "./match.js";

/**
 * Motor de partida "ao vivo" — mesma matemática de `simulation/match.ts`
 * `simularPartida` (chances totais/fatia casa-fora a partir do duelo de
 * meio, chance do jogador via `PESO_ENVOLVIMENTO_ATAQUE`/`resolverChanceJogador`),
 * só que resolvida **evento a evento, em ordem de minuto**, com uma pausa
 * de verdade (`decidirChance`) numa **fração** das chances do jogador
 * (`PROBABILIDADE_DE_PAUSAR_CHANCE_DO_JOGADOR` — nem toda chance sua para
 * o jogo, de propósito: frequência fixa/sempre igual foi pedido explícito
 * pra evitar) — quando pausa, a decisão muda a força de verdade antes do
 * duelo ser resolvido (não é só narrativa, ver `docs/motor-de-partida.md`
 * seção 5.7) — e eventos de contexto sorteados do catálogo
 * `progression/match-events.ts` (cartão, disputa dura, provocação, etc),
 * com quantidade por partida também variável (não um número fixo por
 * jogo), cada um também pausável (`decidirEventoDeContexto`).
 *
 * Não duplica a lógica de agendamento de rodada/chaveamento — é chamado
 * como um `simulation/match.ts` `ResolverPartida` alternativo, injetado
 * por quem orquestra a partida específica do clube do jogador
 * (`career/career-loop.ts`), no lugar do `resolverPartidaPadrao`
 * instantâneo.
 */

const MINUTOS_NA_PARTIDA = 90;
/** ~90 minutos em ~20 segundos reais — estimativa de design, calibrada pra sensação de "jogo passando rápido, mas dando tempo de ler". */
const MS_POR_MINUTO_PADRAO = 220;

export interface ContextoDecisaoChance {
  minuto: number;
  subtipo: SubtipoChance;
  atributoUsado: Atributo;
}

export interface ResultadoDecisaoChance {
  /** Somado à força do jogador antes do duelo (pode ser negativo). */
  ajusteForcaJogador: number;
  /** Somado à força defensiva do adversário antes do duelo (pode ser negativo). */
  ajusteForcaDefensiva: number;
}

const DECISAO_PADRAO: ResultadoDecisaoChance = { ajusteForcaJogador: 0, ajusteForcaDefensiva: 0 };

export type EventoAoVivo =
  | { tipo: "chance_generica"; minuto: number; lado: "casa" | "fora"; gol: boolean }
  | { tipo: "chance_jogador"; minuto: number; chance: ChanceJogador }
  | { tipo: "evento_de_contexto"; minuto: number; cenario: Cenario; escolha: EscolhaResolvida }
  | { tipo: "apito_final"; golsCasa: number; golsFora: number };

export interface OpcoesPartidaAoVivo {
  /**
   * Pausa numa chance do próprio jogador — o ajuste devolvido entra
   * direto no duelo (ver `ContextoDecisaoChance`). **Nem toda chance sua
   * pausa**: só uma fração delas, sorteada por `probabilidadeDePausarChance`
   * (pedido explícito — a frequência de interrupção não pode ser sempre a
   * mesma/fixa). Nas chances que não pausam (ou sem callback nenhum),
   * resolve sem ajuste nenhum (equivalente a "jogar sem pensar duas
   * vezes"), mas continua narrada normalmente (`onEvento`).
   */
  decidirChance?: (contexto: ContextoDecisaoChance) => ResultadoDecisaoChance | Promise<ResultadoDecisaoChance>;
  /** Pausa num evento de contexto sorteado (`progression/match-events.ts`). Sem callback, sempre escolhe a 1ª opção (mesmo padrão de `career/career-loop.ts` `escolherOpcao`). */
  decidirEventoDeContexto?: (cenario: Cenario) => Opcao | Promise<Opcao>;
  /** Chamado a cada evento da linha do tempo (chance genérica, chance do jogador, evento de contexto resolvido, apito final) — pra narrar em tempo real. */
  onEvento?: (evento: EventoAoVivo) => void | Promise<void>;
  /** ms de espera real por minuto de jogo decorrido — 0 pula a espera (sem isso os testes ficariam lentos de verdade). Padrão `MS_POR_MINUTO_PADRAO`. */
  msPorMinuto?: number;
  /**
   * Teto de quantos eventos de contexto **podem** ser sorteados nesta
   * partida — o número real que acontece varia partida a partida (cada
   * candidato até esse teto só vira evento de verdade com
   * `PROBABILIDADE_DE_EVENTO_DE_CONTEXTO`, então o resultado típico é 0-1,
   * raramente o teto inteiro). 0 desliga totalmente. Padrão
   * `MAX_EVENTOS_DE_CONTEXTO_PADRAO`.
   */
  maxEventosDeContexto?: number;
  /** Probabilidade de uma chance do jogador realmente pausar pra decisão (as demais resolvem automaticamente, sem ajuste). Padrão `PROBABILIDADE_DE_PAUSAR_CHANCE_DO_JOGADOR`. */
  probabilidadeDePausarChance?: number;
}

export interface ResultadoPartidaAoVivo {
  /** Mesmo formato de `simularPartida` — pra quem orquestra o confronto (`simulation/season.ts`/`knockout.ts`) não precisar saber que essa partida foi ao vivo. */
  resultado: ResultadoPartida;
  /** Impacto de cada evento de contexto resolvido durante a partida, na ordem em que aconteceram — o motor de partida não tem acesso ao estado de carreira (moral/relações internas), então quem chama (`career/career-loop.ts`) aplica isso no estado depois. */
  impactosDeContexto: ImpactoCarreira[];
}

function dormir(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

interface SlotDeChance {
  tipo: "chance";
  minuto: number;
  lado: "casa" | "fora";
}
interface SlotDeEvento {
  tipo: "evento";
  minuto: number;
}
type Slot = SlotDeChance | SlotDeEvento;

/** Teto de eventos de contexto candidatos por partida (não é a quantidade real — ver `PROBABILIDADE_DE_EVENTO_DE_CONTEXTO`). Um pouco mais alto que "quantidade típica" de propósito, pra deixar espaço pra partidas raras e mais eventadas. */
const MAX_EVENTOS_DE_CONTEXTO_PADRAO = 3;
/** Chance de CADA slot candidato (até `maxEventosDeContexto`) virar um evento de contexto de verdade — estimativa de design, calibrada pra "acontece de vez em quando, não toda partida, e não sempre a mesma quantidade". */
const PROBABILIDADE_DE_EVENTO_DE_CONTEXTO = 0.25;
/** Fração das chances do próprio jogador que realmente pausam pra decisão — o resto flui automático (sem ajuste), só narrado. Estimativa de design: interrupção frequente demais cansa, rara demais não parece dar controle nenhum. */
const PROBABILIDADE_DE_PAUSAR_CHANCE_DO_JOGADOR = 0.6;

export async function jogarPartidaAoVivo(
  perfilCasa: PerfilTime,
  perfilFora: PerfilTime,
  random: () => number = Math.random,
  participacaoJogador?: ParticipacaoJogador,
  opcoes: OpcoesPartidaAoVivo = {},
): Promise<ResultadoPartidaAoVivo> {
  const {
    decidirChance,
    decidirEventoDeContexto,
    onEvento,
    msPorMinuto = MS_POR_MINUTO_PADRAO,
    maxEventosDeContexto = MAX_EVENTOS_DE_CONTEXTO_PADRAO,
    probabilidadeDePausarChance = PROBABILIDADE_DE_PAUSAR_CHANCE_DO_JOGADOR,
  } = opcoes;

  const probabilidadeMeioCasa = probabilidadeDeVencer(perfilCasa.meio, perfilFora.meio);
  const margemMeio = Math.abs(probabilidadeMeioCasa - 0.5) * 2;
  const totalChances = Math.max(2, Math.round(CHANCES_BASE_POR_PARTIDA + margemMeio * 4));
  const fatiaCasa = probabilidadeMeioCasa >= 0.5 ? 0.5 + margemMeio * VANTAGEM_MAXIMA_DE_MEIO : 0.5 - margemMeio * VANTAGEM_MAXIMA_DE_MEIO;
  const chancesCasa = Math.round(totalChances * fatiaCasa);
  const chancesFora = totalChances - chancesCasa;

  const slots: Slot[] = [
    ...Array.from({ length: chancesCasa }, (): SlotDeChance => ({ tipo: "chance", lado: "casa", minuto: 1 + Math.floor(random() * MINUTOS_NA_PARTIDA) })),
    ...Array.from({ length: chancesFora }, (): SlotDeChance => ({ tipo: "chance", lado: "fora", minuto: 1 + Math.floor(random() * MINUTOS_NA_PARTIDA) })),
  ];

  for (let i = 0; i < maxEventosDeContexto; i++) {
    if (random() < PROBABILIDADE_DE_EVENTO_DE_CONTEXTO) {
      slots.push({ tipo: "evento", minuto: 1 + Math.floor(random() * MINUTOS_NA_PARTIDA) });
    }
  }

  slots.sort((a, b) => a.minuto - b.minuto);

  let golsCasa = 0;
  let golsFora = 0;
  const chancesJogador: ChanceJogador[] = [];
  const impactosDeContexto: ImpactoCarreira[] = [];
  let minutoAnterior = 0;

  for (const slot of slots) {
    await dormir((slot.minuto - minutoAnterior) * msPorMinuto);
    minutoAnterior = slot.minuto;

    if (slot.tipo === "evento") {
      const cenario = sortearCenario(EVENTOS_DE_PARTIDA, random);
      const opcaoEscolhida = decidirEventoDeContexto ? await decidirEventoDeContexto(cenario) : cenario.opcoes[0];
      const escolha = resolverEscolha(opcaoEscolhida, random);
      impactosDeContexto.push(escolha.resultado.impacto);
      await onEvento?.({ tipo: "evento_de_contexto", minuto: slot.minuto, cenario, escolha });
      continue;
    }

    const { lado } = slot;
    const perfilAtacante = lado === "casa" ? perfilCasa : perfilFora;
    const perfilDefensor = lado === "casa" ? perfilFora : perfilCasa;
    const pesoJogador = participacaoJogador?.lado === lado ? PESO_ENVOLVIMENTO_ATAQUE[participacaoJogador.jogador.posicao] : 0;
    const ehDoJogador = pesoJogador > 0 && random() < pesoJogador;

    if (ehDoJogador) {
      const subtipo = sortearSubtipo(participacaoJogador!.estiloTecnico, random);
      const atributoUsado = ATRIBUTO_POR_SUBTIPO[subtipo];
      const valorAtributo = participacaoJogador!.jogador.atributos[atributoUsado] ?? 1;
      const forcaJogadorBase = forcaDoAtributo(valorAtributo);
      const forcaDefensivaBase = perfilDefensor.defesa;

      const pausaParaDecisao = decidirChance !== undefined && random() < probabilidadeDePausarChance;
      const decisao = pausaParaDecisao ? await decidirChance!({ minuto: slot.minuto, subtipo, atributoUsado }) : DECISAO_PADRAO;
      const sucesso = resolverDuelo(forcaJogadorBase + decisao.ajusteForcaJogador, forcaDefensivaBase + decisao.ajusteForcaDefensiva, random) === "A";

      const chance: ChanceJogador = { subtipo, sucesso, atributoUsado };
      chancesJogador.push(chance);
      if (sucesso) {
        if (lado === "casa") golsCasa++;
        else golsFora++;
      }
      await onEvento?.({ tipo: "chance_jogador", minuto: slot.minuto, chance });
    } else {
      const gol = resolverDuelo(perfilAtacante.ataque, perfilDefensor.defesa, random) === "A";
      if (gol) {
        if (lado === "casa") golsCasa++;
        else golsFora++;
      }
      await onEvento?.({ tipo: "chance_generica", minuto: slot.minuto, lado, gol });
    }
  }

  await onEvento?.({ tipo: "apito_final", golsCasa, golsFora });

  return {
    resultado: { golsCasa, golsFora, chancesCasa, chancesFora, chancesJogador },
    impactosDeContexto,
  };
}
