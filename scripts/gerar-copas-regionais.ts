/**
 * Gera os arquivos de campeonato nacional das 3 copas regionais (Copa do
 * Nordeste, Copa Verde, Copa Sul-Sudeste) a partir de:
 *   1. clubes já cadastrados em src/data/clubes/ (nenhum clube novo aqui);
 *   2. um seed de vagas resolvidas com base em resultados REAIS dos
 *      estaduais 2025 (pesquisado — fontes nos comentários de cada bloco),
 *      já que o motor de simulação (Fase 2) ainda não existe pra gerar
 *      essa classificação sozinho.
 *
 * Rodar com: npx tsx scripts/gerar-copas-regionais.ts
 *
 * Quando a Fase 2 existir, o seed abaixo pode ser trocado pela
 * classificação real simulada sem mudar a lógica de geração
 * (gerarTimesDaCopa só valida e monta a lista a partir de vagas já
 * resolvidas).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadClubes } from "../src/data/loaders/index.js";
import { gerarTimesDaCopa, type VagaCopaRegional } from "../src/data/loaders/gerar-copa-regional.js";
import type { CampeonatoNacional } from "../src/schemas/national-championship.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "src", "data", "campeonatos-nacionais");

const clubesValidos = new Set(loadClubes().map((c) => c.id));

function gerarOuFalhar(nome: string, vagas: VagaCopaRegional[]): string[] {
  const { times, erros } = gerarTimesDaCopa(vagas, clubesValidos);
  if (erros.length > 0) {
    throw new Error(`${nome}: ${erros.join("; ")}`);
  }
  return times;
}

// Fonte: Wikipédia PT "Copa do Nordeste de Futebol de 2026", olympics.com.
// Critério real: 9 vagas pra campeões estaduais 2025, 9 pra vices, 2 vagas
// extras pras federações mais bem colocadas no Ranking CBF (Bahia e Ceará
// receberam a 3ª vaga cada — não sei distinguir qual dos 3 é a extra).
const vagasNordeste: VagaCopaRegional[] = [
  { origem: "AL", clubeId: "crb", criterio: "campeão ou vice-campeão estadual 2025" },
  { origem: "AL", clubeId: "asa", criterio: "campeão ou vice-campeão estadual 2025" },
  { origem: "BA", clubeId: "vitoria", criterio: "campeão, vice ou vaga extra (Ranking CBF) 2025" },
  { origem: "BA", clubeId: "juazeirense", criterio: "campeão, vice ou vaga extra (Ranking CBF) 2025" },
  { origem: "BA", clubeId: "jacuipense", criterio: "campeão, vice ou vaga extra (Ranking CBF) 2025" },
  { origem: "CE", clubeId: "ceara", criterio: "campeão, vice ou vaga extra (Ranking CBF) 2025" },
  { origem: "CE", clubeId: "fortaleza", criterio: "campeão, vice ou vaga extra (Ranking CBF) 2025" },
  { origem: "CE", clubeId: "ferroviario_ce", criterio: "campeão, vice ou vaga extra (Ranking CBF) 2025" },
  { origem: "MA", clubeId: "mac", criterio: "campeão ou vice-campeão estadual 2025" },
  { origem: "MA", clubeId: "imperatriz", criterio: "campeão ou vice-campeão estadual 2025" },
  { origem: "PB", clubeId: "sousa", criterio: "campeão ou vice-campeão estadual 2025" },
  { origem: "PB", clubeId: "botafogo_pb", criterio: "campeão ou vice-campeão estadual 2025" },
  { origem: "PE", clubeId: "sport_recife", criterio: "campeão ou vice-campeão estadual 2025" },
  { origem: "PE", clubeId: "retro", criterio: "campeão ou vice-campeão estadual 2025" },
  { origem: "PI", clubeId: "piaui_ec", criterio: "campeão ou vice-campeão estadual 2025" },
  { origem: "PI", clubeId: "fluminense_pi", criterio: "campeão ou vice-campeão estadual 2025" },
  { origem: "RN", clubeId: "abc_rn", criterio: "campeão ou vice-campeão estadual 2025" },
  { origem: "RN", clubeId: "america_rn", criterio: "campeão ou vice-campeão estadual 2025" },
  { origem: "SE", clubeId: "itabaiana", criterio: "campeão ou vice-campeão estadual 2025" },
  { origem: "SE", clubeId: "confianca", criterio: "campeão ou vice-campeão estadual 2025" },
];

// Fonte: CNN Brasil, RDM Online, Wikipédia PT "Copa Verde de Futebol de
// 2026". Critério real: 12 vagas pra campeões, 10 pra vices, 2 extras por
// ranking regional. Lista de clubes já veio pronta das fontes (não dá pra
// distinguir campeão/vice/extra clube a clube com o que encontrei).
const vagasCopaNorte: VagaCopaRegional[] = [
  { origem: "PA", clubeId: "remo", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "PA", clubeId: "paysandu", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "PA", clubeId: "aguia_de_maraba", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "AM", clubeId: "amazonas_fc", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "AM", clubeId: "nacional_am", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "RO", clubeId: "porto_velho_ec", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "RO", clubeId: "guapore_fc", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "AC", clubeId: "independencia_ac", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "AC", clubeId: "galvez", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "RR", clubeId: "gas", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "RR", clubeId: "monte_roraima", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "AP", clubeId: "trem", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
];

const vagasCopaCentroOeste: VagaCopaRegional[] = [
  { origem: "GO", clubeId: "vila_nova", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "GO", clubeId: "anapolis_fc", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "GO", clubeId: "atletico_goianiense", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "MT", clubeId: "primavera_ac", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "MT", clubeId: "cuiaba", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "DF", clubeId: "gama", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "DF", clubeId: "capital_cf", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "TO", clubeId: "araguaina", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "TO", clubeId: "tocantinopolis", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "ES", clubeId: "rio_branco_es", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "ES", clubeId: "porto_vitoria", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
  { origem: "MS", clubeId: "operario_ms", criterio: "campeão, vice ou vaga extra (ranking regional) 2025" },
];

// Fonte: Avaí F.C., Olympics.com, ESPN "Copa Sul-Sudeste de Futebol de
// 2026". Critério real: 2 vagas por estado (campeão + vice, ou melhor
// colocado sem CONMEBOL), 6 estados do Sul/Sudeste.
const vagasSulSudeste: VagaCopaRegional[] = [
  { origem: "RJ", clubeId: "volta_redonda", criterio: "campeão ou vice-campeão estadual 2025, sem CONMEBOL" },
  { origem: "RJ", clubeId: "sampaio_correa_rj", criterio: "campeão ou vice-campeão estadual 2025, sem CONMEBOL" },
  { origem: "SP", clubeId: "sao_bernardo", criterio: "campeão ou vice-campeão estadual 2025, sem CONMEBOL" },
  { origem: "SP", clubeId: "novorizontino", criterio: "campeão ou vice-campeão estadual 2025, sem CONMEBOL" },
  { origem: "MG", clubeId: "america_mg", criterio: "melhor time do estadual 2025 sem CONMEBOL" },
  { origem: "MG", clubeId: "tombense", criterio: "2º melhor time do estadual 2025 sem CONMEBOL" },
  { origem: "PR", clubeId: "operario_ferroviario", criterio: "campeão estadual 2025" },
  { origem: "PR", clubeId: "cianorte", criterio: "campeão da Taça FPF 2025" },
  { origem: "SC", clubeId: "avai", criterio: "campeão estadual 2025" },
  { origem: "SC", clubeId: "chapecoense", criterio: "vice-campeão estadual 2025" },
  { origem: "RS", clubeId: "caxias", criterio: "campeão ou vice-campeão estadual 2025, sem CONMEBOL" },
  { origem: "RS", clubeId: "juventude", criterio: "campeão ou vice-campeão estadual 2025, sem CONMEBOL" },
];

const copaDoNordeste: CampeonatoNacional = {
  id: "copa_do_nordeste",
  nome: "Copa do Nordeste",
  nivel: 0,
  ano_referencia: 2026,
  formato: {
    // Aproximação: o real são 4 grupos de 5 pareados (A×B, C×D — um time só
    // enfrenta o grupo par ao seu, não os outros dois) — fase_suica não
    // representa esse pareamento, só o número de jogos bate (5 por time,
    // 50 no total). Continuação após a fase de grupos não confirmada.
    fase_suica: { num_potes: 4, times_por_pote: 5, jogos_por_time: 5, classificam_mata_mata: 8 },
  },
  premiacao: { vaga_copa_do_brasil: 1 },
  classicos: [],
  times: gerarOuFalhar("Copa do Nordeste", vagasNordeste),
};

const copaVerde: CampeonatoNacional = {
  id: "copa_verde",
  nome: "Copa Verde",
  nivel: 0,
  ano_referencia: 2026,
  formato: {
    dupla_chave_regional: {
      nome_chave_a: "Copa Norte",
      nome_chave_b: "Copa Centro-Oeste",
      fase_suica: { num_potes: 2, times_por_pote: 6, jogos_por_time: 6, classificam_mata_mata: 4 },
    },
    final_estadual: { criterio: "campeoes_das_duas_chaves_regionais", ida_e_volta: true },
  },
  premiacao: { vaga_copa_do_brasil: 1 },
  classicos: [],
  times: [
    ...gerarOuFalhar("Copa Verde - Copa Norte", vagasCopaNorte),
    ...gerarOuFalhar("Copa Verde - Copa Centro-Oeste", vagasCopaCentroOeste),
  ],
};

const copaSulSudeste: CampeonatoNacional = {
  id: "copa_sul_sudeste",
  nome: "Copa Sul-Sudeste",
  nivel: 0,
  ano_referencia: 2026,
  formato: {
    fase_suica: { num_potes: 2, times_por_pote: 6, jogos_por_time: 6, classificam_mata_mata: 4 },
    mata_mata: { fases: ["semifinal", "final"], ida_e_volta: true },
  },
  premiacao: { vaga_copa_do_brasil: 1 },
  classicos: [],
  times: gerarOuFalhar("Copa Sul-Sudeste", vagasSulSudeste),
};

for (const copa of [copaDoNordeste, copaVerde, copaSulSudeste]) {
  const path = join(OUT_DIR, `${copa.id}.json`);
  writeFileSync(path, JSON.stringify(copa, null, 2) + "\n", "utf-8");
  console.log(`Gerado ${path} (${copa.times.length} times)`);
}
