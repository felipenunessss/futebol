import type { DesempenhoPartida, FocoDeTreino } from "../progression/xp.js";
import { ATRIBUTOS_POR_FOCO, calcularXpPartida, GANHO_DIRETO_POR_ATRIBUTO_NO_TREINO, ganhoPorPonto, PONTOS_POR_NIVEL, xpParaProximoNivel } from "../progression/xp.js";
import { aplicarDeclinioPorIdade } from "../progression/aging.js";
import type { ImpactoCarreira, Reputacao } from "../progression/scenarios.js";
import { aplicarImpacto, criarReputacaoInicial, type EstadoJogadorParaImpacto } from "../progression/scenarios.js";
import { patrociniosDisponiveis } from "./patrocinios.js";
import { ATRIBUTOS_POR_POSICAO, buscarArquetipo, calcularOverall, type Atributo, type Jogador, type Posicao } from "../schemas/player.js";
import type { Contrato } from "../schemas/contract.js";
import { statusMinimoPorIdade, type StatusNoClube } from "./status.js";
import { gerarAvaliacaoDeOlheiros, multiplicadorDePotencial, sortearPotencial, type NivelDePotencial } from "../progression/potencial.js";

/**
 * Estado de carreira do jogador — o "save" da carreira. Junta o `Jogador`
 * (atributos/posição/arquétipo, `schemas/player.ts`) com o que só existe em
 * nível de carreira: clube atual, temporada, moral, reputação, relações
 * internas e patrimônio (que não tinham lar antes desta peça — ver
 * `docs/motor-de-partida.md` seção 4, onde `progression/scenarios.ts` só
 * operava num par solto de campos).
 *
 * `overall` continua sempre derivado dos atributos via `overallAtual`,
 * nunca guardado aqui — mas desde a seção 5.16 existe sim um `nivel`
 * separado dele: XP de partida/treino sobe `nivel` (`ganharXp`), e cada
 * level-up dá `pontosDisponiveis` pra investir manualmente em qualquer
 * atributo da posição (`investirPontos`, estilo Pro Clubs) — ainda "sem
 * perks" no sentido de nunca desbloquear efeito especial, só acelera
 * atributo numérico.
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
  /** Nível do jogador — começa em 1, sobe conforme `xpAcumulado` cruza `progression/xp.ts` `xpParaProximoNivel` (`ganharXp`). Separado do overall (que continua vindo só dos atributos, `overallAtual`). */
  nivel: number;
  /** XP acumulado rumo ao próximo nível — zera (com o resto sobrando) a cada level-up, não é cumulativo desde o início da carreira. */
  xpAcumulado: number;
  /** Pontos de atributo ganhos em level-ups e ainda não gastos (`investirPontos`) — não precisa gastar tudo de uma vez, fica acumulado. */
  pontosDisponiveis: number;
  /** Memória narrativa persistente entre cenários (ex: `"lesionado"`) — ver `progression/scenarios.ts` `Gatilho.requerBandeiras`/`excluiSeBandeiras` e `ImpactoCarreira.ativarBandeiras`/`desativarBandeiras`. */
  bandeirasNarrativas: string[];
  /**
   * Suspensão (cartão vermelho) ou lesão sofrida numa partida — ver `simulation/match.ts`/
   * `simulation/live-match.ts` `IncidenteDeJogador`. Enquanto `partidasRestantes > 0`, o jogador não
   * participa das partidas do clube atual (nenhuma chance/decisão pessoal — a partida roda como se
   * fosse de qualquer outro clube, só com o placar valendo); `career/career-loop.ts` decrementa 1 a
   * cada partida do clube que se passa (jogada ou não), até zerar. Ausente = nenhuma pendência.
   * Sobrescreve (não soma) uma pendência anterior — uma nova lesão/suspensão substitui a anterior.
   */
  foraDeCombate?: { motivo: "suspensao" | "lesao"; partidasRestantes: number };
}

export interface OpcoesEstadoInicial {
  id: string;
  nome: string;
  posicao: Posicao;
  arquetipoId: string;
  clubeInicialId: string;
  temporadaInicial: number;
  idadeInicial?: number;
  /** Ver `schemas/player.ts` `NACIONALIDADES_CONMEBOL`/`Jogador.nacionalidade` — opcional, sem valor default (a criação real sempre passa um). */
  nacionalidade?: string;
  /** Ver `schemas/player.ts` `Jogador.numero` — opcional, sem valor default. */
  numero?: number;
  /** Ver `schemas/player.ts` `Jogador.pe_dominante` — opcional, sem valor default, puramente decorativo. */
  peDominante?: "destro" | "canhoto";
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
      nacionalidade: opcoes.nacionalidade,
      numero: opcoes.numero,
      pe_dominante: opcoes.peDominante,
      atributos,
      potencial,
    },
    clubeAtualId: opcoes.clubeInicialId,
    temporada: opcoes.temporadaInicial,
    temporadasNaCarreira: 0,
    avaliacaoDeOlheiros: gerarAvaliacaoDeOlheiros(potencial, 0, random),
    nivel: 1,
    xpAcumulado: 0,
    pontosDisponiveis: 0,
    bandeirasNarrativas: [],
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

export interface ResultadoGanhoDeXp {
  estado: EstadoDeCarreira;
  /** `true` se esse ganho de XP cruzou 1+ limiar de nível (`xpParaProximoNivel`) — uma partida/treino muito bom pode subir mais de 1 nível de uma vez. */
  subiuDeNivel: boolean;
  nivelAnterior: number;
  nivelNovo: number;
  /** `PONTOS_POR_NIVEL × quantos níveis subiram nesse ganho — 0 se `subiuDeNivel` for `false`. */
  pontosGanhos: number;
}

/**
 * Aplica um ganho de XP (partida, `aplicarDesempenhoPartida`, ou treino,
 * `career/career-loop.ts` `resolverPeriodoDaCarreira`) ao **nível** do
 * jogador — desde a seção 5.16, XP não sobe atributo nenhum direto, só
 * acumula rumo ao próximo nível (`progression/xp.ts` `xpParaProximoNivel`);
 * cada nível dá `PONTOS_POR_NIVEL` pontos pra investir depois
 * (`investirPontos`). O multiplicador de potencial de desenvolvimento
 * oculto (`progression/potencial.ts` `multiplicadorDePotencial` — trata
 * `jogador.potencial` ausente como "regular"/1x) acelera esse ganho, não
 * o investimento de ponto em si. Processa quantos níveis forem
 * necessários numa chamada só (XP muito alto pode cruzar 2+ limiares).
 */
export function ganharXp(estado: EstadoDeCarreira, xpBruto: number): ResultadoGanhoDeXp {
  const xpComPotencial = xpBruto * multiplicadorDePotencial(estado.jogador.potencial);
  const nivelAnterior = estado.nivel;

  let nivel = estado.nivel;
  let xpAcumulado = estado.xpAcumulado + xpComPotencial;
  let pontosGanhos = 0;

  while (xpAcumulado >= xpParaProximoNivel(nivel)) {
    xpAcumulado -= xpParaProximoNivel(nivel);
    nivel++;
    pontosGanhos += PONTOS_POR_NIVEL;
  }

  return {
    estado: { ...estado, nivel, xpAcumulado, pontosDisponiveis: estado.pontosDisponiveis + pontosGanhos },
    subiuDeNivel: pontosGanhos > 0,
    nivelAnterior,
    nivelNovo: nivel,
    pontosGanhos,
  };
}

/**
 * Investe `quantidade` pontos disponíveis num único atributo — soma
 * `progression/xp.ts` `ganhoPorPonto` por ponto (mais se o atributo for
 * prioritário do arquétipo, arquétipo aqui é multiplicador, nunca
 * restrição: dá pra investir em qualquer atributo da posição), capado em
 * 99. Lança erro se pedir mais pontos do que `estado.pontosDisponiveis`
 * (mesmo padrão de validação de `criarEstadoInicial`).
 */
const ATRIBUTO_MAXIMO = 99;

export function investirPontos(estado: EstadoDeCarreira, atributo: Atributo, quantidade: number): EstadoDeCarreira {
  if (quantidade <= 0) {
    throw new Error(`investirPontos: quantidade precisa ser positiva, recebeu ${quantidade}`);
  }
  if (quantidade > estado.pontosDisponiveis) {
    throw new Error(`investirPontos: pediu ${quantidade} pontos em "${atributo}", só tem ${estado.pontosDisponiveis} disponíveis`);
  }

  const arquetipo = buscarArquetipo(estado.jogador.arquetipo_id);
  const valorAtual = estado.jogador.atributos[atributo] ?? 1;
  const novoValor = Math.min(ATRIBUTO_MAXIMO, valorAtual + quantidade * ganhoPorPonto(atributo, arquetipo.atributos_prioritarios));

  return {
    ...estado,
    jogador: { ...estado.jogador, atributos: { ...estado.jogador.atributos, [atributo]: novoValor } },
    pontosDisponiveis: estado.pontosDisponiveis - quantidade,
  };
}

/**
 * Aplica o ganho direto de atributo de uma sessão de treino com foco
 * (`foco !== "descanso"`, ver `progression/xp.ts` `ATRIBUTOS_POR_FOCO`) —
 * só nos atributos dessa categoria que também sejam relevantes pra
 * posição do jogador (`ATRIBUTOS_POR_POSICAO`); é automático (não é
 * escolha do jogador) e sempre nos mesmos atributos daquele foco, ao
 * contrário de `investirPontos` (escolha livre, alimentada por
 * `pontosDisponiveis`, que continua existindo e sendo alimentada
 * igualmente pelos 3 focos — este ganho é complementar, não substitui).
 * Sem interseção foco×posição (não deveria acontecer, todo foco cobre
 * pelo menos 1 atributo de cada posição), não faz nada.
 */
export function aplicarGanhoDeTreino(estado: EstadoDeCarreira, foco: FocoDeTreino): EstadoDeCarreira {
  if (foco === "descanso") return estado;

  const atributosDaPosicao = ATRIBUTOS_POR_POSICAO[estado.jogador.posicao];
  const atributosRelevantes = ATRIBUTOS_POR_FOCO[foco].filter((atributo) => atributosDaPosicao.includes(atributo));
  if (atributosRelevantes.length === 0) return estado;

  const arquetipo = buscarArquetipo(estado.jogador.arquetipo_id);
  let atributos = estado.jogador.atributos;
  for (const atributo of atributosRelevantes) {
    const valorAtual = atributos[atributo] ?? 1;
    const ganho = GANHO_DIRETO_POR_ATRIBUTO_NO_TREINO * ganhoPorPonto(atributo, arquetipo.atributos_prioritarios);
    atributos = { ...atributos, [atributo]: Math.min(ATRIBUTO_MAXIMO, valorAtual + ganho) };
  }

  return { ...estado, jogador: { ...estado.jogador, atributos } };
}

/**
 * Aplica o desempenho de uma partida (via `DesempenhoPartida` já
 * calculado por `converterChancesEmDesempenho`) ao estado — todo o XP da
 * partida (`calcularXpPartida`) vai pro nível (`ganharXp`). Devolve o
 * `ResultadoGanhoDeXp` completo (não só `estado`) pra quem chama saber se
 * subiu de nível e notificar a UI (`career/career-loop.ts`
 * `onNivelAlcancado`).
 */
export function aplicarDesempenhoPartida(estado: EstadoDeCarreira, desempenho: DesempenhoPartida): ResultadoGanhoDeXp {
  return ganharXp(estado, calcularXpPartida(desempenho));
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
    bandeirasNarrativas: estado.bandeirasNarrativas,
  };
  const atualizado = aplicarImpacto(parcial, impacto, regiaoAtual);

  return {
    ...estado,
    jogador: { ...estado.jogador, atributos: atualizado.atributos },
    moral: atualizado.moral,
    reputacao: atualizado.reputacao,
    relacoesInternas: atualizado.relacoesInternas,
    bandeirasNarrativas: atualizado.bandeirasNarrativas,
    foraDeCombate: impacto.foraDeCombate ?? estado.foraDeCombate,
  };
}

/**
 * Consome 1 partida da suspensão/lesão ativa (`EstadoDeCarreira.foraDeCombate`) — chamado por
 * `career/career-loop.ts` a cada partida do clube atual que se passa, jogada ou não pelo jogador (uma
 * suspensão/lesão vale por partida do clube, não por partida assistida ao vivo). Sem pendência ativa,
 * não faz nada; ao chegar a 0, remove a pendência (jogador liberado).
 */
export function consumirPartidaForaDeCombate(estado: EstadoDeCarreira): EstadoDeCarreira {
  if (!estado.foraDeCombate) return estado;
  const partidasRestantes = estado.foraDeCombate.partidasRestantes - 1;
  return { ...estado, foraDeCombate: partidasRestantes > 0 ? { ...estado.foraDeCombate, partidasRestantes } : undefined };
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
