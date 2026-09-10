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

/**
 * Teto/piso aplicado só à conversão de UMA chance pontual (uma finalização,
 * um desarme) — `probabilidadeDeVencer` satura perto de 0/1 pra gaps de
 * rating comuns entre divisões diferentes (ex: ~450+ de diferença já chega a
 * ~99%), o que fazia cada uma das ~10-14 chances de uma partida virar quase
 * certeza pro time forte e produzia placares tipo 10-0/11-0 rotineiros
 * mesmo com bastante ruído de perfil (`VARIANCIA_PERFIL`). Calibrado junto
 * com `CHANCES_BASE_POR_PARTIDA`/`VANTAGEM_MAXIMA_DE_MEIO` (ver histórico do
 * commit) pra times de divisões bem distantes (~900 de gap de rating)
 * ficarem em torno de 4x1 na média, com goleada de 6+ gols de diferença
 * numa fração pequena (~4%) das partidas, não na maioria delas. Não se
 * aplica ao duelo de meio-campo que decide a FATIA de chances de cada time
 * (`simularPartida`/`live-match.ts` continuam usando `probabilidadeDeVencer`
 * puro ali) — só limita a conversão de cada chance já distribuída, pra
 * manter zebra pontual possível mesmo entre times muito desiguais.
 */
const PROBABILIDADE_MINIMA_POR_DUELO = 0.3;
const PROBABILIDADE_MAXIMA_POR_DUELO = 0.55;

/** `probabilidadeDeVencer` com o teto/piso de `resolverDuelo` já aplicado — exportado pra quem quiser EXIBIR a chance de um duelo pontual (ex: UI de partida ao vivo) mostrar o número que de fato vale, não a probabilidade bruta saturada. */
export function probabilidadeDeDuelo(forcaA: number, forcaB: number): number {
  return Math.min(PROBABILIDADE_MAXIMA_POR_DUELO, Math.max(PROBABILIDADE_MINIMA_POR_DUELO, probabilidadeDeVencer(forcaA, forcaB)));
}

/** Exportado pra `simulation/live-match.ts` reaproveitar o mesmo duelo sem duplicar a fórmula. */
export function resolverDuelo(forcaA: number, forcaB: number, random: () => number): "A" | "B" {
  return random() < probabilidadeDeDuelo(forcaA, forcaB) ? "A" : "B";
}

export interface ChanceJogador {
  subtipo: SubtipoChance;
  sucesso: boolean;
  atributoUsado: Atributo;
}

/**
 * Um incidente sério com o jogador durante a partida — cartão (amarelo é só narrativo, sem
 * consequência real; vermelho tira o jogador de campo e rende suspensão) ou lesão (também tira o
 * jogador de campo, com tempo de recuperação variando por gravidade). Ver `career/Player.ts`
 * `EstadoDeCarreira.foraDeCombate` pra como isso vira uma pendência real de partidas fora.
 */
export type IncidenteDeJogador =
  | { tipo: "cartao_amarelo" }
  | { tipo: "cartao_vermelho" }
  | { tipo: "lesao"; gravidade: "leve" | "media" | "grave"; partidasFora: number };

/** Cartão vermelho e lesão tiram o jogador do resto da partida (ver `IncidenteDeJogador`) — usado por
 * `simularPartida`/`live-match.ts` pra saber se um incidente encerra a participação dele. */
export function incidenteEncerraParticipacao(incidente: IncidenteDeJogador): boolean {
  return incidente.tipo === "cartao_vermelho" || incidente.tipo === "lesao";
}

/** Suspensão de cartão vermelho é sempre 1 partida (regra fixa) — lesão varia por gravidade. */
const PARTIDAS_DE_SUSPENSAO_CARTAO_VERMELHO = 1;

/** Probabilidade de CADA incidente, por partida em que o jogador participa (checado uma vez por
 * partida, não por chance) — estimativas de design: cartão amarelo comum o bastante pra aparecer de
 * vez em quando sem virar rotina; vermelho e lesão bem mais raros, já que ambos tiram o jogador de
 * partidas futuras (consequência real, não só narrativa). Mutuamente exclusivos entre si (um só
 * incidente por partida, o mais grave prevalece no sorteio). */
export const PROBABILIDADE_CARTAO_VERMELHO = 0.015;
export const PROBABILIDADE_LESAO = 0.02;
export const PROBABILIDADE_CARTAO_AMARELO = 0.12;

/** Faixas de gravidade de lesão — pesos relativos (não precisam somar 1) e intervalo de partidas fora
 * (inclusivo) por faixa. A maioria das lesões é leve; grave é raro de propósito. */
const FAIXAS_DE_GRAVIDADE_DE_LESAO: { gravidade: "leve" | "media" | "grave"; peso: number; min: number; max: number }[] = [
  { gravidade: "leve", peso: 0.6, min: 1, max: 3 },
  { gravidade: "media", peso: 0.3, min: 4, max: 8 },
  { gravidade: "grave", peso: 0.1, min: 9, max: 16 },
];

function sortearGravidadeDeLesao(random: () => number): { gravidade: "leve" | "media" | "grave"; partidasFora: number } {
  const totalPeso = FAIXAS_DE_GRAVIDADE_DE_LESAO.reduce((soma, faixa) => soma + faixa.peso, 0);
  let alvo = random() * totalPeso;
  for (const faixa of FAIXAS_DE_GRAVIDADE_DE_LESAO) {
    if (alvo < faixa.peso) return { gravidade: faixa.gravidade, partidasFora: faixa.min + Math.floor(random() * (faixa.max - faixa.min + 1)) };
    alvo -= faixa.peso;
  }
  const ultima = FAIXAS_DE_GRAVIDADE_DE_LESAO[FAIXAS_DE_GRAVIDADE_DE_LESAO.length - 1];
  return { gravidade: ultima.gravidade, partidasFora: ultima.min };
}

/**
 * Sorteia se ALGUM incidente acontece com o jogador nesta partida — chamado no máximo 1 vez por
 * partida (não por chance), só quando o jogador está participando. `undefined` é o caso comum (nenhum
 * incidente). Cartão vermelho e lesão competem entre si (o sorteio resolve os dois num intervalo só,
 * como fatias mutuamente exclusivas) antes de cartão amarelo, mas a ORDEM não importa pra quem chama —
 * só o resultado final, com no máximo 1 incidente por partida.
 *
 * De propósito, `random()` BAIXO (perto de 0) sempre cai em "nada aconteceu" — mesma convenção do
 * resto do motor (`resolverDuelo`: `random()` baixo favorece o lado "A"/sucesso), inclusive em vários
 * testes que usam `() => 0` como "sempre dá certo, sem surpresa". Só valores ALTOS (perto de 1) caem
 * nos incidentes de verdade, do mais raro (vermelho) ao mais comum (amarelo).
 */
export function sortearIncidenteDeJogador(random: () => number = Math.random): IncidenteDeJogador | undefined {
  const r = random();
  if (r >= 1 - PROBABILIDADE_CARTAO_VERMELHO) return { tipo: "cartao_vermelho" };
  if (r >= 1 - PROBABILIDADE_CARTAO_VERMELHO - PROBABILIDADE_LESAO) return { tipo: "lesao", ...sortearGravidadeDeLesao(random) };
  if (r >= 1 - PROBABILIDADE_CARTAO_VERMELHO - PROBABILIDADE_LESAO - PROBABILIDADE_CARTAO_AMARELO) return { tipo: "cartao_amarelo" };
  return undefined;
}

/** Converte um `IncidenteDeJogador` na pendência de `career/Player.ts` `EstadoDeCarreira.foraDeCombate`
 * — `undefined` pra cartão amarelo (sem consequência real, só narrativo). */
export function foraDeCombatePorIncidente(incidente: IncidenteDeJogador): { motivo: "suspensao" | "lesao"; partidasRestantes: number } | undefined {
  if (incidente.tipo === "cartao_vermelho") return { motivo: "suspensao", partidasRestantes: PARTIDAS_DE_SUSPENSAO_CARTAO_VERMELHO };
  if (incidente.tipo === "lesao") return { motivo: "lesao", partidasRestantes: incidente.partidasFora };
  return undefined;
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
export const CHANCES_BASE_POR_PARTIDA = 6;
/** Quanto o time que vence o duelo de meio pode esticar a fatia de chances a seu favor (0.2 = até 70%/30% num duelo muito dominante). Exportado pelo mesmo motivo que `CHANCES_BASE_POR_PARTIDA`. */
export const VANTAGEM_MAXIMA_DE_MEIO = 0.2;

export interface ResultadoPartida {
  golsCasa: number;
  golsFora: number;
  chancesCasa: number;
  chancesFora: number;
  /** Só as chances de ataque resolvidas individualmente pelo jogador (vazio se `participacaoJogador` não foi passado, ou nenhuma chance caiu pra ele). */
  chancesJogador: ChanceJogador[];
  /** Incidente sorteado com o jogador nesta partida (ver `sortearIncidenteDeJogador`) — `undefined` no caso comum (nada aconteceu), sempre `undefined` se `participacaoJogador` não foi passado. */
  incidenteJogador?: IncidenteDeJogador;
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

  // Incidente (cartão/lesão) sorteado no máximo 1 vez por partida, só quando o jogador participa —
  // cartão vermelho/lesão escolhem um índice aleatório (dentre as chances do lado dele) a partir do
  // qual ele já não recebe mais chance pessoal nenhuma (saiu de campo); as chances daquele ponto em
  // diante do time dele voltam a ser resolvidas de forma anônima, como se fosse qualquer outro clube.
  let incidenteJogador: IncidenteDeJogador | undefined;
  let indiceDeSaidaDoJogador: number | undefined;
  if (participacaoJogador) {
    incidenteJogador = sortearIncidenteDeJogador(random);
    if (incidenteJogador && incidenteEncerraParticipacao(incidenteJogador)) {
      const quantidadeDoLado = participacaoJogador.lado === "casa" ? chancesCasa : chancesFora;
      indiceDeSaidaDoJogador = Math.floor(random() * quantidadeDoLado);
    }
  }

  function resolverChancesDoTime(quantidade: number, perfilAtacante: PerfilTime, perfilDefensor: PerfilTime, lado: "casa" | "fora"): number {
    const ehLadoDoJogador = participacaoJogador?.lado === lado;
    const pesoJogador = ehLadoDoJogador ? PESO_ENVOLVIMENTO_ATAQUE[participacaoJogador!.jogador.posicao] : 0;

    let gols = 0;
    for (let i = 0; i < quantidade; i++) {
      const aindaEmCampo = !ehLadoDoJogador || indiceDeSaidaDoJogador === undefined || i < indiceDeSaidaDoJogador;
      if (pesoJogador > 0 && aindaEmCampo && random() < pesoJogador) {
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

  return { golsCasa, golsFora, chancesCasa, chancesFora, chancesJogador, incidenteJogador };
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
