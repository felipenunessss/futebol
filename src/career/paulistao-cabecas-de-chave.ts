import type { Club } from "../schemas/club.js";
import { obterRating } from "../simulation/rating.js";

/**
 * Os 4 grandes do futebol paulista — cabeças de chave fixas do Paulistão A1, um por pote (`fase_suica`,
 * `times_por_pote: 4`, ver `data/estaduais/paulistao_a1.json`). Pedido explícito do usuário: "os 4
 * grandes devem ser cabeça de chave dos grupos, um em cada — num eventual rebaixamento de algum
 * deles, deve ser preenchido pelo time da Série A com maior rating" (ver `docs/dados-a-verificar.md`
 * — não é fato pesquisado sobre o sorteio real do Paulistão, é regra de design pedida pelo jogador).
 * A ORDEM aqui fixa qual pote (índice 0-3) cada grande lidera — estável entre temporadas mesmo
 * quando um deles é substituído (o substituto assume o pote do grande que caiu, não um pote novo).
 */
export const CABECAS_DE_CHAVE_PAULISTAO_A1 = ["corinthians", "palmeiras", "sao_paulo", "santos"];

const TIMES_POR_POTE = 4;

/**
 * Reordena a composição do Paulistão A1 (16 times, qualquer ordem) garantindo 1 cabeça de chave por
 * pote: os 4 grandes (`CABECAS_DE_CHAVE_PAULISTAO_A1`) quando presentes; se algum caiu pra A2 (não
 * está em `times`), o pote dele é liderado pelo clube paulista de maior rating (`obterRating`) entre
 * os que sobraram que também dispute a Série A nacional (`divisao_nacional.pais === "BR" && nivel
 * === 1`) — critério do próprio pedido do usuário, não qualquer time forte. Sem substituto elegível
 * (nenhum outro paulista na Série A nacional), o pote fica sem cabeça de chave fixa, preenchido
 * normalmente pelo round-robin abaixo (caso extremo, não esperado com o elenco atual).
 *
 * Os outros 12 times se distribuem round-robin pelos potes, ordenados por id (não pela ordem de
 * `times`) — função **idempotente**: depende só do CONJUNTO de 16 times, nunca da ordem de entrada,
 * então aplicar de novo em cima do próprio resultado (ou de qualquer reordenação do mesmo conjunto)
 * sempre reproduz a mesma composição de potes — só muda quando o conjunto de times realmente muda
 * (rebaixamento de verdade). Pura — não muta `times`.
 */
export function ajustarCabecasDeChaveDoPaulistaoA1(times: string[], clubes: Club[]): string[] {
  const clubePorId = new Map(clubes.map((c) => [c.id, c]));
  const presentes = new Set(times);
  const ordenadosPorId = [...times].sort();

  const cabecas: (string | undefined)[] = CABECAS_DE_CHAVE_PAULISTAO_A1.map((id) => (presentes.has(id) ? id : undefined));
  const usados = new Set(cabecas.filter((id): id is string => !!id));

  for (let indice = 0; indice < cabecas.length; indice++) {
    if (cabecas[indice]) continue;
    const candidatos = ordenadosPorId
      .filter((id) => !usados.has(id))
      .map((id) => clubePorId.get(id))
      .filter((clube): clube is Club => !!clube && clube.estado === "SP" && clube.divisao_nacional?.pais === "BR" && clube.divisao_nacional?.nivel === 1)
      .sort((a, b) => obterRating(b) - obterRating(a) || a.id.localeCompare(b.id));
    const substituto = candidatos[0];
    if (substituto) {
      cabecas[indice] = substituto.id;
      usados.add(substituto.id);
    }
  }

  const restantes = ordenadosPorId.filter((id) => !usados.has(id));
  const potes: string[][] = cabecas.map((cabeca) => (cabeca ? [cabeca] : []));
  restantes.forEach((id, indice) => potes[indice % TIMES_POR_POTE].push(id));

  return potes.flat();
}
