import { describe, expect, it } from "vitest";
import { ajustarCabecasDeChaveDoPaulistaoA1, CABECAS_DE_CHAVE_PAULISTAO_A1 } from "../../src/career/paulistao-cabecas-de-chave.js";
import type { Club } from "../../src/schemas/club.js";

function clube(id: string, opcoes: { estado?: string; nivel?: number; rating?: number } = {}): Club {
  return {
    id,
    nome: id,
    pais: "BR",
    cidade: "Cidade",
    estado: opcoes.estado ?? "SP",
    rating_inicial: opcoes.rating,
    divisao_nacional: opcoes.nivel !== undefined ? { pais: "BR", nivel: opcoes.nivel } : undefined,
  };
}

/** 16 times realistas o bastante pra exercitar potes de 4 — 4 grandes (Série A) + 12 outros paulistas. */
function elencoPadrao(): Club[] {
  return [
    clube("corinthians", { nivel: 1, rating: 1718 }),
    clube("palmeiras", { nivel: 1, rating: 1826 }),
    clube("sao_paulo", { nivel: 1, rating: 1696 }),
    clube("santos", { nivel: 1, rating: 1675 }),
    clube("red_bull_bragantino", { nivel: 1, rating: 1674 }),
    clube("mirassol", { nivel: 1, rating: 1687 }),
    clube("novorizontino", { nivel: 2, rating: 1695 }),
    clube("ponte_preta", { nivel: 2, rating: 1463 }),
    clube("guarani", { nivel: 3, rating: 1547 }),
    clube("sao_bernardo", { rating: 1594 }),
    clube("botafogo_sp", { rating: 1568 }),
    clube("velo_clube"),
    clube("portuguesa"),
    clube("primavera"),
    clube("noroeste"),
    clube("capivariano"),
  ];
}

const TIMES_PADRAO = [
  "corinthians",
  "palmeiras",
  "sao_paulo",
  "santos",
  "sao_bernardo",
  "novorizontino",
  "red_bull_bragantino",
  "mirassol",
  "guarani",
  "ponte_preta",
  "velo_clube",
  "portuguesa",
  "botafogo_sp",
  "primavera",
  "noroeste",
  "capivariano",
];

describe("ajustarCabecasDeChaveDoPaulistaoA1", () => {
  it("com os 4 grandes presentes, cada um lidera um pote diferente (índices 0, 4, 8, 12)", () => {
    const resultado = ajustarCabecasDeChaveDoPaulistaoA1(TIMES_PADRAO, elencoPadrao());
    const lideres = [resultado[0], resultado[4], resultado[8], resultado[12]];
    expect(new Set(lideres)).toEqual(new Set(CABECAS_DE_CHAVE_PAULISTAO_A1));
  });

  it("mantém os 16 times, sem duplicar nem perder nenhum", () => {
    const resultado = ajustarCabecasDeChaveDoPaulistaoA1(TIMES_PADRAO, elencoPadrao());
    expect(resultado.length).toBe(16);
    expect(new Set(resultado)).toEqual(new Set(TIMES_PADRAO));
  });

  it("é idempotente: aplicar de novo sobre o próprio resultado não muda nada", () => {
    const resultado = ajustarCabecasDeChaveDoPaulistaoA1(TIMES_PADRAO, elencoPadrao());
    const resultado2 = ajustarCabecasDeChaveDoPaulistaoA1(resultado, elencoPadrao());
    expect(resultado2).toEqual(resultado);
  });

  it("é indiferente à ordem de entrada: embaralhar `times` produz a mesma composição de potes", () => {
    const embaralhado = [...TIMES_PADRAO].reverse();
    const resultado1 = ajustarCabecasDeChaveDoPaulistaoA1(TIMES_PADRAO, elencoPadrao());
    const resultado2 = ajustarCabecasDeChaveDoPaulistaoA1(embaralhado, elencoPadrao());
    expect(resultado2).toEqual(resultado1);
  });

  it("quando um grande cai (ausente de `times`), o pote dele é assumido pelo paulista de maior rating na Série A nacional entre os que sobraram", () => {
    // santos caiu; entra um clube fictício sem presença nacional no lugar dele.
    const times = TIMES_PADRAO.filter((id) => id !== "santos").concat("clube_promovido_a2");
    const clubes = elencoPadrao().concat(clube("clube_promovido_a2", { rating: 1200 }));

    const resultado = ajustarCabecasDeChaveDoPaulistaoA1(times, clubes);

    // mirassol (1687) tem rating maior que red_bull_bragantino (1674) entre os paulistas de Série A
    // que sobraram — deve assumir o pote que era do Santos (índice 3, posição 12).
    expect(resultado[12]).toBe("mirassol");
    expect(resultado).toContain("clube_promovido_a2");
    expect(resultado).not.toContain("santos");
  });

  it("substituto assume o pote específico do grande que caiu, não um pote qualquer", () => {
    // palmeiras (pote 1, índice 4) caiu — o substituto deve liderar o índice 4, não outro.
    const times = TIMES_PADRAO.filter((id) => id !== "palmeiras").concat("clube_promovido_a2");
    const clubes = elencoPadrao().concat(clube("clube_promovido_a2", { rating: 1200 }));

    const resultado = ajustarCabecasDeChaveDoPaulistaoA1(times, clubes);

    expect(resultado[0]).toBe("corinthians");
    expect(resultado[4]).toBe("mirassol"); // maior rating paulista de Série A restante
    expect(resultado[8]).toBe("sao_paulo");
    expect(resultado[12]).toBe("santos");
  });

  it("sem nenhum substituto elegível (nenhum outro paulista na Série A nacional), não quebra — só não preenche cabeça de chave fixa pro pote", () => {
    const clubesSemSubstituto = [
      clube("corinthians", { nivel: 1 }),
      clube("palmeiras", { nivel: 1 }),
      clube("sao_paulo", { nivel: 1 }),
      ...Array.from({ length: 13 }, (_, i) => clube(`clube_${i}`)), // nenhum na Série A nacional
    ];
    const times = ["corinthians", "palmeiras", "sao_paulo", ...Array.from({ length: 13 }, (_, i) => `clube_${i}`)];

    expect(() => ajustarCabecasDeChaveDoPaulistaoA1(times, clubesSemSubstituto)).not.toThrow();
    const resultado = ajustarCabecasDeChaveDoPaulistaoA1(times, clubesSemSubstituto);
    expect(resultado.length).toBe(16);
    expect(new Set(resultado)).toEqual(new Set(times));
  });
});
