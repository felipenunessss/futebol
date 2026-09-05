/**
 * Motor de valorização de mercado — ver `docs/game-design.md` seção 4 e
 * `docs/motor-de-partida.md`. Sem perks (decisão já registrada pro resto
 * do jogo): o valor vem de overall (derivado, `career/Player.ts`
 * `overallAtual`) + idade + reputação nacional, não de nível/perk.
 *
 * **Estimativa de design, não fórmula validada** — mesma ressalva das
 * constantes de Elo/XP em `docs/motor-de-partida.md`: os números abaixo
 * foram calibrados só pra dar uma progressão que "sente" certa (rookie
 * sem valor, jovem promissor na casa das centenas de milhares, estrela
 * na casa dos milhões), não a partir de dado real de mercado.
 */

export interface PerfilDeMercado {
  overall: number;
  idade: number;
  reputacaoNacional: number;
}

const OVERALL_MINIMO_COM_VALOR = 40;
const EXPOENTE_VALOR_BASE = 3;
const CONSTANTE_VALOR_BASE = 20;

function valorBasePorOverall(overall: number): number {
  return Math.max(0, overall - OVERALL_MINIMO_COM_VALOR) ** EXPOENTE_VALOR_BASE * CONSTANTE_VALOR_BASE;
}

const IDADE_INICIO_PLATO = 24;
const IDADE_FIM_PLATO = 29;
const MULTIPLICADOR_MINIMO_JOVEM = 0.7;
const MULTIPLICADOR_MINIMO_VETERANO = 0.1;
const QUEDA_POR_ANO_APOS_PLATO = 0.12;

/** Curva de valorização por idade: sobe até um platô (24-29), depois cai — mesmo espírito das curvas de pico/declínio de atributo em `progression/aging.ts`, mas aplicada ao valor de mercado, não ao atributo em si. */
function multiplicadorPorIdade(idade: number): number {
  if (idade >= IDADE_INICIO_PLATO && idade <= IDADE_FIM_PLATO) return 1;

  if (idade < IDADE_INICIO_PLATO) {
    const progresso = Math.max(0, idade - 16) / (IDADE_INICIO_PLATO - 16);
    return MULTIPLICADOR_MINIMO_JOVEM + progresso * (1 - MULTIPLICADOR_MINIMO_JOVEM);
  }

  const anosApósPlato = idade - IDADE_FIM_PLATO;
  return Math.max(MULTIPLICADOR_MINIMO_VETERANO, 1 - anosApósPlato * QUEDA_POR_ANO_APOS_PLATO);
}

const BONUS_MAXIMO_POR_REPUTACAO = 0.5;

/** Valor de mercado estimado em reais fictícios — mesma escala usada em `career/patrocinios.ts` e no exemplo de `docs/game-design.md` seção 4. */
export function calcularValorDeMercado(perfil: PerfilDeMercado): number {
  const base = valorBasePorOverall(perfil.overall);
  const multiplicadorIdade = multiplicadorPorIdade(perfil.idade);
  const multiplicadorReputacao = 1 + (perfil.reputacaoNacional / 100) * BONUS_MAXIMO_POR_REPUTACAO;

  return Math.round(base * multiplicadorIdade * multiplicadorReputacao);
}

const RATING_BASE = 1000;
const PONTOS_DE_RATING_POR_OVERALL = 11;
const PONTOS_DE_RATING_POR_REPUTACAO = 2;

/**
 * Rating "equivalente" do jogador, na mesma escala tipo Elo dos clubes
 * (`simulation/rating.ts`, ~1000-2100) — usado por
 * `market/transfers.ts` `selecionarClubesInteressados` pra garantir que o
 * interesse de um clube (comprando ou vendendo) seja plausível com o
 * **desempenho real do jogador** (overall, que é derivado de XP de
 * partida — não um número solto), não só com o rating do clube atual
 * dele. Sem isso, um jogador fraco num clube fraco atrairia qualquer
 * clube "melhor que o atual", incluindo gigantes — o que não faz
 * sentido. Reputação nacional soma pontos à parte (joga mais visibilidade
 * pro jogador, mesmo sem uma final de mercado tão alta). Estimativa de
 * design (mesma ressalva de `calcularValorDeMercado`), calibrada pra ficar
 * na mesma faixa numérica do rating de clube: rookie overall 39/reputação
 * 10 fica em ~1449 (nível 2-3), um `overall` 85/reputação 70 fica em
 * ~2075 (patamar de clube de elite).
 */
export function calcularRatingDeInteresse(perfil: PerfilDeMercado): number {
  return RATING_BASE + perfil.overall * PONTOS_DE_RATING_POR_OVERALL + perfil.reputacaoNacional * PONTOS_DE_RATING_POR_REPUTACAO;
}
