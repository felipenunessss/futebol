import { describe, expect, it } from "vitest";
import type { Club } from "../../src/schemas/club.js";
import { atualizarElo, calcularRatingFallback, calcularResultadoEsperado, obterRating } from "../../src/simulation/rating.js";

function clube(overrides: Partial<Club> = {}): Club {
  return { id: "x", nome: "Clube X", pais: "BR", cidade: "Cidade X", ...overrides };
}

describe("calcularRatingFallback", () => {
  it("dá rating maior pra divisão de nível mais alto", () => {
    const nivel1 = clube({ divisao_nacional: { pais: "BR", nivel: 1 } });
    const nivel4 = clube({ divisao_nacional: { pais: "BR", nivel: 4 } });

    expect(calcularRatingFallback(nivel1)).toBeGreaterThan(calcularRatingFallback(nivel4));
  });

  it("usa força financeira como desempate na mesma divisão", () => {
    const forte = clube({ divisao_nacional: { pais: "BR", nivel: 1 }, forca_financeira: "muito_alta" });
    const fraco = clube({ divisao_nacional: { pais: "BR", nivel: 1 }, forca_financeira: "muito_baixa" });

    expect(calcularRatingFallback(forte)).toBeGreaterThan(calcularRatingFallback(fraco));
  });

  it("clube só estadual (sem divisao_nacional) recebe fallback mais baixo que um de elite nacional", () => {
    const soEstadual = clube();
    const elite = clube({ divisao_nacional: { pais: "BR", nivel: 1 } });

    expect(calcularRatingFallback(soEstadual)).toBeLessThan(calcularRatingFallback(elite));
  });
});

describe("obterRating", () => {
  it("usa rating_inicial quando presente, em vez do fallback", () => {
    const club = clube({ rating_inicial: 1850 });
    expect(obterRating(club)).toBe(1850);
  });

  it("cai no fallback quando rating_inicial está ausente", () => {
    const club = clube({ divisao_nacional: { pais: "BR", nivel: 1 } });
    expect(obterRating(club)).toBe(calcularRatingFallback(club));
  });
});

describe("calcularResultadoEsperado", () => {
  it("dá 0.5 pra ratings iguais", () => {
    expect(calcularResultadoEsperado(1600, 1600)).toBeCloseTo(0.5);
  });

  it("favorece o time de rating maior", () => {
    expect(calcularResultadoEsperado(1800, 1500)).toBeGreaterThan(0.5);
  });
});

describe("atualizarElo", () => {
  it("vitória em casa aumenta o rating de casa e reduz o de fora", () => {
    const { ratingCasa, ratingFora } = atualizarElo(1600, 1600, "casa");
    expect(ratingCasa).toBeGreaterThan(1600);
    expect(ratingFora).toBeLessThan(1600);
  });

  it("vencer um favorito move o rating mais que vencer um azarão (k maior de propósito não muda isso)", () => {
    const zebra = atualizarElo(1400, 1900, "casa"); // fraco vence forte
    const esperado = atualizarElo(1900, 1400, "casa"); // forte vence fraco

    const deltaZebra = zebra.ratingCasa - 1400;
    const deltaEsperado = esperado.ratingCasa - 1900;

    expect(deltaZebra).toBeGreaterThan(deltaEsperado);
  });

  it("soma dos ratings se conserva (soma-zero)", () => {
    const { ratingCasa, ratingFora } = atualizarElo(1600, 1550, "empate");
    expect(ratingCasa + ratingFora).toBeCloseTo(1600 + 1550);
  });
});
