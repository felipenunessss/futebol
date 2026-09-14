/** Formata um valor monetário com separador de milhar ao padrão brasileiro (ponto, ex: 12500 -> "12.500") — pedido do usuário, chame com o número puro (sem "R$", quem chama já prefixa isso). */
export function formatarMoeda(valor: number): string {
  return Math.round(valor).toLocaleString("pt-BR");
}
