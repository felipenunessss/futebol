/**
 * Potencial de desenvolvimento — sorteado uma vez na criação da carreira
 * (`career/Player.ts` `criarEstadoInicial`) e guardado OCULTO em
 * `Jogador.potencial`: afeta só a VELOCIDADE de crescimento de atributo
 * (`progression/xp.ts` `aplicarXpPartidaAoJogador`/`aplicarTreino`), nunca
 * o teto máximo (99, igual pra todo mundo) — mesmo espírito "sem perks,
 * só acelera atributo numérico" já usado pro multiplicador de arquétipo.
 *
 * O jogador nunca vê o valor real — só a "avaliação de olheiros"
 * (`gerarAvaliacaoDeOlheiros`), uma estimativa que pode errar bastante no
 * início da carreira e fica exata depois de acompanhar o jogador por
 * algumas temporadas (`career/Player.ts` `EstadoDeCarreira.temporadasNaCarreira`/
 * `avaliacaoDeOlheiros`, atualizada a cada `avancarTemporada`).
 *
 * **Estimativa de design, não fórmula validada** — mesma ressalva de toda
 * constante de progressão/mercado do jogo.
 */

export type NivelDePotencial = "regular" | "acima_da_media" | "talento_raro" | "excepcional" | "geracional";

interface FaixaDePotencial {
  nivel: NivelDePotencial;
  /** Soma 1 entre todas as faixas, ver `sortearPotencial`. */
  probabilidade: number;
  /** Multiplicador aplicado ao ganho de atributo, ao lado do multiplicador de arquétipo (`progression/xp.ts` `multiplicadorDoAtributo`). */
  multiplicador: number;
}

/** Em ordem crescente de raridade/multiplicador — a ordem importa pra `gerarAvaliacaoDeOlheiros` (desvia por ÍNDICE nessa lista). */
const NIVEIS_DE_POTENCIAL: FaixaDePotencial[] = [
  { nivel: "regular", probabilidade: 0.62, multiplicador: 1.0 },
  { nivel: "acima_da_media", probabilidade: 0.23, multiplicador: 1.15 },
  { nivel: "talento_raro", probabilidade: 0.1, multiplicador: 1.3 },
  { nivel: "excepcional", probabilidade: 0.04, multiplicador: 1.5 },
  { nivel: "geracional", probabilidade: 0.01, multiplicador: 1.8 },
];

export const ROTULO_POTENCIAL: Record<NivelDePotencial, string> = {
  regular: "Jogador regular",
  acima_da_media: "Acima da média",
  talento_raro: "Talento raro",
  excepcional: "Excepcional",
  geracional: "Fenômeno geracional",
};

function indiceDoNivel(nivel: NivelDePotencial): number {
  return NIVEIS_DE_POTENCIAL.findIndex((faixa) => faixa.nivel === nivel);
}

/** Sorteia o potencial real do jogador — chamado 1x na criação da carreira, nunca de novo depois. */
export function sortearPotencial(random: () => number = Math.random): NivelDePotencial {
  const alvo = random();
  let acumulado = 0;
  for (const faixa of NIVEIS_DE_POTENCIAL) {
    acumulado += faixa.probabilidade;
    if (alvo < acumulado) return faixa.nivel;
  }
  return NIVEIS_DE_POTENCIAL[NIVEIS_DE_POTENCIAL.length - 1].nivel; // rede de segurança pra erro de ponto flutuante bem no limite
}

/** `undefined` (jogador construído na mão, sem passar por `criarEstadoInicial` — comum em teste) trata como "regular"/1x, mesma convenção de `market/valuation.ts` `multiplicadorStatus`. */
export function multiplicadorDePotencial(nivel: NivelDePotencial | undefined): number {
  if (!nivel) return 1;
  return NIVEIS_DE_POTENCIAL[indiceDoNivel(nivel)].multiplicador;
}

/**
 * Largura máxima do erro (em número de níveis) da avaliação de olheiros,
 * dado quantas temporadas eles já observaram o jogador — erra até 2
 * níveis pra cima ou pra baixo nas 2 primeiras temporadas, até 1 nas 2
 * seguintes, e acerta sempre a partir da 5ª.
 */
function larguraDoErro(temporadasObservadas: number): 0 | 1 | 2 {
  if (temporadasObservadas >= 4) return 0;
  if (temporadasObservadas >= 2) return 1;
  return 2;
}

/** Pesos de desvio pra cada largura — sempre soma 1, sempre mais provável acertar (`desvio 0`) que errar. */
const PESOS_DE_DESVIO: Record<0 | 1 | 2, { desvio: number; peso: number }[]> = {
  0: [{ desvio: 0, peso: 1 }],
  1: [
    { desvio: 0, peso: 0.65 },
    { desvio: -1, peso: 0.175 },
    { desvio: 1, peso: 0.175 },
  ],
  2: [
    { desvio: 0, peso: 0.5 },
    { desvio: -1, peso: 0.2 },
    { desvio: 1, peso: 0.2 },
    { desvio: -2, peso: 0.05 },
    { desvio: 2, peso: 0.05 },
  ],
};

/**
 * Gera a avaliação de olheiros — o que a UI mostra em vez do
 * `potencialReal` (nunca exposto direto). `temporadasObservadas` vem de
 * `EstadoDeCarreira.temporadasNaCarreira`; chamado 1x na criação (0
 * temporadas) e de novo a cada `career/Player.ts` `avancarTemporada`.
 */
export function gerarAvaliacaoDeOlheiros(potencialReal: NivelDePotencial, temporadasObservadas: number, random: () => number = Math.random): NivelDePotencial {
  const largura = larguraDoErro(temporadasObservadas);
  const pesos = PESOS_DE_DESVIO[largura];

  const alvo = random();
  let acumulado = 0;
  let desvioEscolhido = 0;
  for (const { desvio, peso } of pesos) {
    acumulado += peso;
    if (alvo < acumulado) {
      desvioEscolhido = desvio;
      break;
    }
  }

  const indiceReal = indiceDoNivel(potencialReal);
  const indiceEstimado = Math.max(0, Math.min(NIVEIS_DE_POTENCIAL.length - 1, indiceReal + desvioEscolhido));
  return NIVEIS_DE_POTENCIAL[indiceEstimado].nivel;
}
