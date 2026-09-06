import type { Atributo, Jogador, Posicao } from "../schemas/player.js";
import { type EstiloTecnico, type SubtipoChance, ATRIBUTO_POR_SUBTIPO, sortearSubtipo } from "./tactics.js";

/**
 * Motor de partida por duelo de zona — ver docs/motor-de-partida.md seção 2.
 * Nenhum clube (fora o do jogador) tem elenco persistido: a força de cada
 * zona é gerada por partida a partir do rating do clube (`simulation/rating.ts`).
 */

export interface PerfilTime {
  defesa: number;
  meio: number;
  ataque: number;
}

/** Desvio (pra mais ou pra menos) aplicado ao rating do clube ao gerar cada zona — é o que permite zebra. */
const VARIANCIA_PERFIL = 80;

/** Gera o perfil de zonas de um time pra uma partida, com variância em torno do rating do clube. */
export function gerarPerfilTime(rating: number, random: () => number = Math.random): PerfilTime {
  const ruido = () => (random() - 0.5) * 2 * VARIANCIA_PERFIL;
  return {
    defesa: rating + ruido(),
    meio: rating + ruido(),
    ataque: rating + ruido(),
  };
}

/** Probabilidade de A vencer um duelo contra B — mesma fórmula logística do Elo, reaproveitada pra qualquer comparação de força. */
export function probabilidadeDeVencer(forcaA: number, forcaB: number): number {
  return 1 / (1 + Math.pow(10, (forcaB - forcaA) / 400));
}

/** Exportado pra `simulation/live-match.ts` reaproveitar o mesmo duelo sem duplicar a fórmula. */
export function resolverDuelo(forcaA: number, forcaB: number, random: () => number): "A" | "B" {
  return random() < probabilidadeDeVencer(forcaA, forcaB) ? "A" : "B";
}

export interface ChanceJogador {
  subtipo: SubtipoChance;
  sucesso: boolean;
  atributoUsado: Atributo;
}

/** Converte um atributo (0-99) numa força comparável à escala de rating dos times (~1000-2000). Exportado pra `simulation/live-match.ts` reaproveitar. */
export function forcaDoAtributo(valor: number): number {
  return 1000 + valor * 10;
}

/**
 * Resolve uma chance específica do jogador (Camada 2) — sorteia o subtipo
 * (ponderado pelo estilo do técnico) e resolve com o atributo
 * correspondente contra a força defensiva do adversário naquele momento.
 */
export function resolverChanceJogador(
  jogador: Jogador,
  estiloTecnico: EstiloTecnico,
  forcaDefensivaAdversario: number,
  random: () => number = Math.random,
): ChanceJogador {
  const subtipo = sortearSubtipo(estiloTecnico, random);
  const atributo = ATRIBUTO_POR_SUBTIPO[subtipo];
  const valorAtributo = jogador.atributos[atributo] ?? 1;
  const forcaJogador = forcaDoAtributo(valorAtributo);
  const sucesso = resolverDuelo(forcaJogador, forcaDefensivaAdversario, random) === "A";

  return { subtipo, sucesso, atributoUsado: atributo };
}

/**
 * Probabilidade de uma chance de ataque do time ser "do jogador" em vez de
 * um companheiro anônimo — pondera por quanto a posição normalmente se
 * envolve em jogadas de ataque. Goleiro nunca participa de chance de gol
 * (fica de fora da rotação ofensiva por completo).
 */
export const PESO_ENVOLVIMENTO_ATAQUE: Record<Posicao, number> = {
  atacante: 0.4,
  meia: 0.25,
  lateral: 0.12,
  volante: 0.08,
  zagueiro: 0.03,
  goleiro: 0,
};

export interface ParticipacaoJogador {
  /** De qual lado o clube do jogador está jogando nesta partida. */
  lado: "casa" | "fora";
  jogador: Jogador;
  estiloTecnico: EstiloTecnico;
}

/**
 * Mesma ideia de `ParticipacaoJogador`, mas em nível de clube (sem "lado"
 * fixo) — usada por quem orquestra várias partidas do mesmo clube ao longo
 * de uma competição (`season.ts`, `groups.ts`, `knockout.ts`, `swiss.ts`),
 * que só sabem o lado de cada confronto específico na hora de montá-lo.
 */
export interface ParticipacaoJogadorClube {
  clubeId: string;
  jogador: Jogador;
  estiloTecnico: EstiloTecnico;
}

/** Deriva a `ParticipacaoJogador` (com lado) de um confronto específico, ou `undefined` se o clube do jogador não está nesse confronto. */
export function participacaoNoConfronto(
  participacao: ParticipacaoJogadorClube | undefined,
  mandante: string,
  visitante: string,
): ParticipacaoJogador | undefined {
  if (!participacao) return undefined;
  if (participacao.clubeId === mandante) return { lado: "casa", jogador: participacao.jogador, estiloTecnico: participacao.estiloTecnico };
  if (participacao.clubeId === visitante) return { lado: "fora", jogador: participacao.jogador, estiloTecnico: participacao.estiloTecnico };
  return undefined;
}

/** Exportado pra `simulation/live-match.ts` calcular o mesmo total de chances de uma partida sem duplicar a conta. */
export const CHANCES_BASE_POR_PARTIDA = 10;
/** Quanto o time que vence o duelo de meio pode esticar a fatia de chances a seu favor (0.3 = até 80%/20% num duelo muito dominante). Exportado pelo mesmo motivo que `CHANCES_BASE_POR_PARTIDA`. */
export const VANTAGEM_MAXIMA_DE_MEIO = 0.3;

export interface ResultadoPartida {
  golsCasa: number;
  golsFora: number;
  chancesCasa: number;
  chancesFora: number;
  /** Só as chances de ataque resolvidas individualmente pelo jogador (vazio se `participacaoJogador` não foi passado, ou nenhuma chance caiu pra ele). */
  chancesJogador: ChanceJogador[];
}

/**
 * Resolve uma partida por duelo de zona. O duelo de meio decide quantas
 * chances a partida tem e como elas se distribuem entre os dois times;
 * cada chance individual é ataque vs defesa do adversário.
 *
 * Se `participacaoJogador` for passado, uma fração das chances do lado dele
 * (ponderada por `PESO_ENVOLVIMENTO_ATAQUE` da posição) é resolvida
 * individualmente via `resolverChanceJogador` em vez do duelo agregado do
 * time — é assim que a Camada 2 (partida do clube do jogador) se conecta à
 * Camada 1 (motor agregado, usado pra todo o resto do calendário).
 */
export function simularPartida(
  perfilCasa: PerfilTime,
  perfilFora: PerfilTime,
  random: () => number = Math.random,
  participacaoJogador?: ParticipacaoJogador,
): ResultadoPartida {
  const probabilidadeMeioCasa = probabilidadeDeVencer(perfilCasa.meio, perfilFora.meio);
  const margemMeio = Math.abs(probabilidadeMeioCasa - 0.5) * 2; // 0 (equilibrado) a 1 (duelo dominado)

  const totalChances = Math.max(2, Math.round(CHANCES_BASE_POR_PARTIDA + margemMeio * 4));
  const fatiaCasa = probabilidadeMeioCasa >= 0.5
    ? 0.5 + margemMeio * VANTAGEM_MAXIMA_DE_MEIO
    : 0.5 - margemMeio * VANTAGEM_MAXIMA_DE_MEIO;

  const chancesCasa = Math.round(totalChances * fatiaCasa);
  const chancesFora = totalChances - chancesCasa;
  const chancesJogador: ChanceJogador[] = [];

  function resolverChancesDoTime(quantidade: number, perfilAtacante: PerfilTime, perfilDefensor: PerfilTime, lado: "casa" | "fora"): number {
    const pesoJogador =
      participacaoJogador?.lado === lado ? PESO_ENVOLVIMENTO_ATAQUE[participacaoJogador.jogador.posicao] : 0;

    let gols = 0;
    for (let i = 0; i < quantidade; i++) {
      if (pesoJogador > 0 && random() < pesoJogador) {
        const chance = resolverChanceJogador(participacaoJogador!.jogador, participacaoJogador!.estiloTecnico, perfilDefensor.defesa, random);
        chancesJogador.push(chance);
        if (chance.sucesso) gols++;
      } else if (resolverDuelo(perfilAtacante.ataque, perfilDefensor.defesa, random) === "A") {
        gols++;
      }
    }
    return gols;
  }

  const golsCasa = resolverChancesDoTime(chancesCasa, perfilCasa, perfilFora, "casa");
  const golsFora = resolverChancesDoTime(chancesFora, perfilFora, perfilCasa, "fora");

  return { golsCasa, golsFora, chancesCasa, chancesFora, chancesJogador };
}

/**
 * Resolve uma partida específica dado o perfil dos dois times — ponto de
 * injeção usado por `season.ts`/`knockout.ts`/`groups.ts` em vez de chamar
 * `simularPartida` direto, pra permitir um resolvedor alternativo (ex:
 * `simulation/live-match.ts` `jogarPartidaAoVivo`, que narra a partida em
 * tempo real e pausa em chances do jogador pra decisão real) sem duplicar
 * nem reescrever a lógica de agendamento de rodadas/chaveamento em cada
 * módulo. Pode ser assíncrono (por isso o retorno aceita `Promise`) —
 * `resolverPartidaPadrao` (o default usado quando ninguém injeta nada) é
 * síncrono, então nenhum consumidor existente muda de comportamento, só de
 * assinatura (`async`/`await` a mais, ver `docs/motor-de-partida.md`).
 */
export type ResolverPartida = (
  perfilCasa: PerfilTime,
  perfilFora: PerfilTime,
  random: () => number,
  participacaoJogador?: ParticipacaoJogador,
  contexto?: ContextoConfronto,
) => Promise<ResultadoPartida> | ResultadoPartida;

/**
 * Quem manda/visita nesse confronto específico — meramente informativo
 * (não influencia a simulação em si, que já usa `perfilCasa`/`perfilFora`);
 * serve pra um resolvedor interativo saber contra quem é o jogo antes de
 * perguntar o modo de simulação pro jogador (`career/career-loop.ts`).
 */
export interface ContextoConfronto {
  mandanteId: string;
  visitanteId: string;
}

/** Resolvedor padrão — só chama `simularPartida` normalmente, sem narração/pausa nenhuma. */
export const resolverPartidaPadrao: ResolverPartida = (perfilCasa, perfilFora, random, participacaoJogador) =>
  simularPartida(perfilCasa, perfilFora, random, participacaoJogador);
