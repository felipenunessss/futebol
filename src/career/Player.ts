import type { DesempenhoPartida } from "../progression/xp.js";
import { aplicarXpPartidaAoJogador, calcularXpPartida } from "../progression/xp.js";
import { aplicarDeclinioPorIdade } from "../progression/aging.js";
import type { ImpactoCarreira, Reputacao } from "../progression/scenarios.js";
import { aplicarImpacto, criarReputacaoInicial, type EstadoJogadorParaImpacto } from "../progression/scenarios.js";
import { patrociniosDisponiveis } from "./patrocinios.js";
import { ATRIBUTOS_POR_POSICAO, buscarArquetipo, calcularOverall, type Jogador, type Posicao } from "../schemas/player.js";
import type { ChanceJogador } from "../simulation/match.js";
import type { Contrato } from "../schemas/contract.js";
import { statusMinimoPorIdade, type StatusNoClube } from "./status.js";
import { gerarAvaliacaoDeOlheiros, sortearPotencial, type NivelDePotencial } from "../progression/potencial.js";

/**
 * Estado de carreira do jogador — o "save" da carreira. Junta o `Jogador`
 * (atributos/posição/arquétipo, `schemas/player.ts`) com o que só existe em
 * nível de carreira: clube atual, temporada, moral, reputação, relações
 * internas e patrimônio (que não tinham lar antes desta peça — ver
 * `docs/motor-de-partida.md` seção 4, onde `progression/scenarios.ts` só
 * operava num par solto de campos).
 *
 * Sem perks/nível como recurso separado (decisão já registrada em
 * `docs/motor-de-partida.md`) — o overall é sempre derivado dos atributos
 * via `overallAtual`, nunca guardado aqui.
 */
export interface EstadoDeCarreira {
  jogador: Jogador;
  clubeAtualId: string;
  temporada: number;
  /** 0-100. */
  moral: number;
  reputacao: Reputacao;
  /** 0-100 — elenco/comissão técnica/diretoria agregados num número só (ver docs/motor-de-partida.md). Puramente conceitual até existir sistema de minutagem/renovação. */
  relacoesInternas: number;
  /** Renda simples acumulada de patrocínios (`career/patrocinios.ts`) — não é a economia completa da Fase 4 (mercado de transferências), só um contador. */
  patrimonio: number;
  /** Contrato com o clube atual (`market/negotiation.ts`) — ausente quando o jogador ainda não passou por uma negociação de mercado (ex: acabou de criar a carreira, ou foi movido por `transferirParaClube` sem negociação). */
  contratoAtual?: Contrato;
  /** Status no elenco do clube atual (`career/status.ts`) — decide minutos esperados por partida e pesa no valor de mercado/status oferecido em propostas. */
  statusNoClube: StatusNoClube;
  /** Quantas temporadas os olheiros já observaram o jogador — quanto mais alto, mais precisa `avaliacaoDeOlheiros` fica (`progression/potencial.ts` `gerarAvaliacaoDeOlheiros`). Incrementado em `avancarTemporada`. */
  temporadasNaCarreira: number;
  /** Estimativa (pode estar errada) do potencial de desenvolvimento real do jogador (`jogador.potencial`, nunca exposto direto) — o que a UI deve mostrar. Recalculada a cada `avancarTemporada`. */
  avaliacaoDeOlheiros: NivelDePotencial;
}

export interface OpcoesEstadoInicial {
  id: string;
  nome: string;
  posicao: Posicao;
  arquetipoId: string;
  clubeInicialId: string;
  temporadaInicial: number;
  idadeInicial?: number;
  /** Injetável pra determinismo em teste — mesmo padrão do resto do jogo. Decide a amplitude dos atributos iniciais e o potencial de desenvolvimento oculto sorteados aqui. */
  random?: () => number;
}

const IDADE_INICIAL_PADRAO = 18;
/**
 * Centro da distribuição de atributo inicial — antes eram valores FIXOS
 * (45/35, todo jogador novo idêntico). Agora tem 2 fontes de ruído
 * (`amostraTriangular`, ambas em cima desse centro): uma "qualidade
 * geral" sorteada 1x por jogador e aplicada a TODOS os atributos dele
 * junto (`AMPLITUDE_QUALIDADE_GERAL`) — é essa que dá amplitude real ao
 * OVERALL, já que ruído por atributo isolado se cancelaria na média
 * (`calcularOverall` pondera muitos atributos, então ruído independente
 * regride à média); e um ruído menor por atributo individual
 * (`AMPLITUDE_ATRIBUTO_INICIAL`), só pra variar o perfil dentro do mesmo
 * jogador. Concentrado perto de 50-60 na maioria dos casos, com cauda
 * real pra jogadores bem melhores/piores que a média — estimativa de
 * design calibrada à mão com `calcularOverall`, não fórmula validada.
 */
const ATRIBUTO_PRIORITARIO_CENTRO = 58;
const ATRIBUTO_NAO_PRIORITARIO_CENTRO = 48;
/** Amplitude da qualidade geral do jogador (1 sorteio por jogador, aplicado a todos os atributos) — a fonte principal de amplitude no overall. */
const AMPLITUDE_QUALIDADE_GERAL = 16;
/** Amplitude do ruído específico de CADA atributo, em cima da qualidade geral do jogador. */
const AMPLITUDE_ATRIBUTO_INICIAL = 8;
const ATRIBUTO_INICIAL_MINIMO = 20;
const ATRIBUTO_INICIAL_MAXIMO = 85;
const MORAL_INICIAL = 50;
const RELACOES_INTERNAS_INICIAL = 50;
const PATRIMONIO_INICIAL = 0;

/**
 * Amostra triangular: soma de 2 sorteios uniformes, mais concentrada no
 * `centro` que uma distribuição uniforme pura (o mesmo truque de "rolar 2
 * dados" fica mais perto da média que rolar 1 só) — sem precisar de
 * biblioteca de distribuição normal de verdade. Resultado sempre dentro
 * de `[centro - amplitude, centro + amplitude]` antes do clamp externo.
 */
function amostraTriangular(centro: number, amplitude: number, random: () => number): number {
  return centro + (random() + random() - 1) * amplitude;
}

function atributoInicialAleatorio(centro: number, qualidadeGeral: number, random: () => number): number {
  const bruto = centro + qualidadeGeral + amostraTriangular(0, AMPLITUDE_ATRIBUTO_INICIAL, random);
  return Math.round(Math.max(ATRIBUTO_INICIAL_MINIMO, Math.min(ATRIBUTO_INICIAL_MAXIMO, bruto)));
}

/**
 * Cria o estado de carreira de um jogador novo — promessa jovem, não
 * craque pronto: atributos prioritários do arquétipo começam um pouco
 * acima dos demais, com uma amplitude real (não mais um valor fixo —
 * `atributoInicialAleatorio`) pra dar variedade de ponto de partida entre
 * carreiras. O potencial de desenvolvimento (`progression/potencial.ts`)
 * é sorteado aqui e nunca mais muda — só a `avaliacaoDeOlheiros` (a
 * estimativa que a UI mostra) é recalculada depois, em `avancarTemporada`.
 */
export function criarEstadoInicial(opcoes: OpcoesEstadoInicial): EstadoDeCarreira {
  const arquetipo = buscarArquetipo(opcoes.arquetipoId);
  if (arquetipo.posicao !== opcoes.posicao) {
    throw new Error(
      `criarEstadoInicial: arquétipo "${opcoes.arquetipoId}" é da posição "${arquetipo.posicao}", não "${opcoes.posicao}"`,
    );
  }

  const random = opcoes.random ?? Math.random;

  // 1 sorteio só, aplicado a todos os atributos do jogador — é o que dá amplitude real ao overall
  // (ver comentário de AMPLITUDE_QUALIDADE_GERAL).
  const qualidadeGeral = amostraTriangular(0, AMPLITUDE_QUALIDADE_GERAL, random);
  const atributos = Object.fromEntries(
    ATRIBUTOS_POR_POSICAO[opcoes.posicao].map((atributo) => [
      atributo,
      atributoInicialAleatorio(arquetipo.atributos_prioritarios.includes(atributo) ? ATRIBUTO_PRIORITARIO_CENTRO : ATRIBUTO_NAO_PRIORITARIO_CENTRO, qualidadeGeral, random),
    ]),
  );

  const potencial = sortearPotencial(random);

  return {
    jogador: {
      id: opcoes.id,
      nome: opcoes.nome,
      posicao: opcoes.posicao,
      arquetipo_id: opcoes.arquetipoId,
      idade: opcoes.idadeInicial ?? IDADE_INICIAL_PADRAO,
      atributos,
      potencial,
    },
    clubeAtualId: opcoes.clubeInicialId,
    temporada: opcoes.temporadaInicial,
    temporadasNaCarreira: 0,
    avaliacaoDeOlheiros: gerarAvaliacaoDeOlheiros(potencial, 0, random),
    moral: MORAL_INICIAL,
    reputacao: criarReputacaoInicial(),
    relacoesInternas: RELACOES_INTERNAS_INICIAL,
    patrimonio: PATRIMONIO_INICIAL,
    // "promessa" pro caso comum (jovem estreante); começando mais velho (idadeInicial customizada
    // acima de 22), o piso por idade já entra em vigor desde a criação (ver career/status.ts).
    statusNoClube: statusMinimoPorIdade(opcoes.idadeInicial ?? IDADE_INICIAL_PADRAO),
  };
}

/** Overall atual (derivado dos atributos + arquétipo, nunca guardado). */
export function overallAtual(estado: EstadoDeCarreira): number {
  const arquetipo = buscarArquetipo(estado.jogador.arquetipo_id);
  return calcularOverall(estado.jogador, arquetipo);
}

/**
 * Aplica o desempenho de uma partida (via `chancesJogador` de
 * `simularPartida` convertidas em `DesempenhoPartida` por
 * `converterChancesEmDesempenho`) ao estado — XP total da partida
 * (`calcularXpPartida`) distribuído pelos atributos usados nas chances +
 * crescimento geral (`aplicarXpPartidaAoJogador`).
 */
export function aplicarDesempenhoPartida(
  estado: EstadoDeCarreira,
  chances: ChanceJogador[],
  desempenho: DesempenhoPartida,
): EstadoDeCarreira {
  const arquetipo = buscarArquetipo(estado.jogador.arquetipo_id);
  const xpTotal = calcularXpPartida(desempenho);
  const atributos = aplicarXpPartidaAoJogador(estado.jogador, arquetipo, chances, xpTotal);

  return { ...estado, jogador: { ...estado.jogador, atributos } };
}

/**
 * Aplica o impacto de um resultado de cenário de carreira
 * (`progression/scenarios.ts`) ao estado. `regiaoAtual` (normalmente a UF
 * do clube atual) decide onde eventuais deltas de reputação regional
 * caem — sem ela, esses deltas ficam sem efeito (ver `aplicarImpacto`).
 */
export function aplicarImpactoDeCenario(
  estado: EstadoDeCarreira,
  impacto: ImpactoCarreira,
  regiaoAtual?: string,
): EstadoDeCarreira {
  const parcial: EstadoJogadorParaImpacto = {
    atributos: estado.jogador.atributos,
    moral: estado.moral,
    reputacao: estado.reputacao,
    relacoesInternas: estado.relacoesInternas,
  };
  const atualizado = aplicarImpacto(parcial, impacto, regiaoAtual);

  return {
    ...estado,
    jogador: { ...estado.jogador, atributos: atualizado.atributos },
    moral: atualizado.moral,
    reputacao: atualizado.reputacao,
    relacoesInternas: atualizado.relacoesInternas,
  };
}

/** Move o jogador pra outro clube sem negociação (`contratoAtual` não muda) — pra movimentações puramente narrativas. Pra uma transferência com contrato de verdade, ver `assinarContrato`. */
export function transferirParaClube(estado: EstadoDeCarreira, novoClubeId: string): EstadoDeCarreira {
  return { ...estado, clubeAtualId: novoClubeId };
}

/** Move o jogador pro clube do `Contrato`, registra o contrato como `contratoAtual` e atualiza o status no elenco — resultado de uma negociação de mercado bem-sucedida (`market/negotiation.ts` `negociarTransferencia`, `career/status.ts` `statusOferecido`). */
export function assinarContrato(estado: EstadoDeCarreira, contrato: Contrato, statusNoClube: StatusNoClube): EstadoDeCarreira {
  return { ...estado, clubeAtualId: contrato.clubeId, contratoAtual: contrato, statusNoClube };
}

/** Atualiza só o status no elenco do clube atual (ex: revisão de fim de temporada, `career/status.ts` `evoluirStatus`) — não mexe em clube/contrato. */
export function mudarStatusNoClube(estado: EstadoDeCarreira, statusNoClube: StatusNoClube): EstadoDeCarreira {
  return { ...estado, statusNoClube };
}

/**
 * Avança pra próxima temporada — idade e temporada +1, aplica a curva de
 * pico/declínio por idade (`progression/aging.ts`: atributo físico decai
 * cedo e rápido depois do pico, mental decai tarde e devagar, liderança
 * nunca decai — não afeta quem ainda não passou da idade de pico da
 * categoria) e soma ao patrimônio a renda de todos os patrocínios
 * disponíveis pra reputação/região atuais (`career/patrocinios.ts`) — não
 * é negociação de contrato, só uma renda simples por temporada. Também
 * reavalia `avaliacaoDeOlheiros` (`progression/potencial.ts`
 * `gerarAvaliacaoDeOlheiros`) com mais uma temporada de observação — a
 * estimativa vai ficando mais precisa, nunca revela `jogador.potencial`
 * direto.
 */
export function avancarTemporada(estado: EstadoDeCarreira, regiaoAtual?: string, random: () => number = Math.random): EstadoDeCarreira {
  const novaIdade = estado.jogador.idade + 1;
  const atributos = aplicarDeclinioPorIdade(estado.jogador.atributos, novaIdade);
  const rendaPatrocinios = patrociniosDisponiveis(estado.reputacao, regiaoAtual).reduce(
    (soma, patrocinio) => soma + patrocinio.valorPorTemporada,
    0,
  );
  const temporadasNaCarreira = estado.temporadasNaCarreira + 1;
  const potencialReal = estado.jogador.potencial ?? "regular";

  return {
    ...estado,
    temporada: estado.temporada + 1,
    jogador: { ...estado.jogador, idade: novaIdade, atributos },
    patrimonio: estado.patrimonio + rendaPatrocinios,
    temporadasNaCarreira,
    avaliacaoDeOlheiros: gerarAvaliacaoDeOlheiros(potencialReal, temporadasNaCarreira, random),
  };
}
