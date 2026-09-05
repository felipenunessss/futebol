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
