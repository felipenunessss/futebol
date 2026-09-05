import type { Reputacao } from "../progression/scenarios.js";

/**
 * Patrocínios pessoais — desbloqueados por reputação, não negociados como
 * mercado (isso é Fase 4). Aqui é só "reputação alta o bastante libera
 * quais ofertas aparecem" + renda simples somada ao patrimônio do jogador
 * (`career/Player.ts` `patrimonio`), não uma simulação econômica completa.
 */
export interface Patrocinio {
  id: string;
  nome: string;
  tipo: "regional" | "nacional";
  /** Reputação mínima (regional ou nacional, conforme `tipo`) pra essa oferta aparecer. */
  reputacaoMinima: number;
  /** Só relevante pra `tipo: "regional"` — chave de região (ex: UF do clube). */
  regiao?: string;
  valorPorTemporada: number;
}

export const PATROCINIOS: Patrocinio[] = [
  { id: "loja_do_bairro", nome: "Loja do bairro", tipo: "regional", reputacaoMinima: 15, valorPorTemporada: 5_000 },
  { id: "emissora_local", nome: "Emissora de rádio local", tipo: "regional", reputacaoMinima: 35, valorPorTemporada: 20_000 },
  { id: "marca_esportiva_nacional", nome: "Marca esportiva nacional", tipo: "nacional", reputacaoMinima: 40, valorPorTemporada: 80_000 },
  { id: "marca_global", nome: "Marca global", tipo: "nacional", reputacaoMinima: 75, valorPorTemporada: 500_000 },
];

/**
 * Patrocínios regionais são filtrados pela região informada (região sem
 * entrada em `reputacao.porRegiao` conta como 0, mesma regra de
 * `progression/scenarios.ts` `aplicarImpacto`). Sem `regiaoAtual`, nenhum
 * patrocínio regional é considerado disponível.
 */
export function patrociniosDisponiveis(reputacao: Reputacao, regiaoAtual?: string): Patrocinio[] {
  return PATROCINIOS.filter((patrocinio) => {
    if (patrocinio.tipo === "nacional") return reputacao.nacional >= patrocinio.reputacaoMinima;
    if (!regiaoAtual) return false;
    return (reputacao.porRegiao[regiaoAtual] ?? 0) >= patrocinio.reputacaoMinima;
  });
}
