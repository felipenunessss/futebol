import { describe, expect, it } from "vitest";
import { calcularRatingDeInteresse, calcularValorDeMercado } from "../../src/market/valuation.js";

describe("calcularValorDeMercado", () => {
  it("jogador com overall muito baixo vale zero", () => {
    expect(calcularValorDeMercado({ overall: 39, idade: 18, reputacaoNacional: 10 })).toBe(0);
  });

  it("overall maior gera valor maior, tudo mais igual", () => {
    const menor = calcularValorDeMercado({ overall: 60, idade: 27, reputacaoNacional: 30 });
    const maior = calcularValorDeMercado({ overall: 80, idade: 27, reputacaoNacional: 30 });
    expect(maior).toBeGreaterThan(menor);
  });

  it("jogador no platô de idade (24-29) vale mais que jovem demais ou velho demais, mesmo overall", () => {
    const jovem = calcularValorDeMercado({ overall: 75, idade: 18, reputacaoNacional: 30 });
    const platô = calcularValorDeMercado({ overall: 75, idade: 27, reputacaoNacional: 30 });
    const veterano = calcularValorDeMercado({ overall: 75, idade: 37, reputacaoNacional: 30 });

    expect(platô).toBeGreaterThan(jovem);
    expect(platô).toBeGreaterThan(veterano);
  });

  it("reputação nacional maior aumenta o valor, tudo mais igual", () => {
    const semReputacao = calcularValorDeMercado({ overall: 75, idade: 27, reputacaoNacional: 0 });
    const comReputacao = calcularValorDeMercado({ overall: 75, idade: 27, reputacaoNacional: 100 });
    expect(comReputacao).toBeGreaterThan(semReputacao);
    expect(comReputacao).toBeCloseTo(semReputacao * 1.5, -1);
  });

  it("nunca devolve valor negativo", () => {
    expect(calcularValorDeMercado({ overall: 1, idade: 45, reputacaoNacional: 0 })).toBeGreaterThanOrEqual(0);
  });

  it("multiplicadorStatus escala o valor (titular vale mais que reserva com o mesmo overall)", () => {
    const perfilBase = { overall: 75, idade: 27, reputacaoNacional: 30 };
    const comoReserva = calcularValorDeMercado({ ...perfilBase, multiplicadorStatus: 0.85 });
    const comoTitular = calcularValorDeMercado({ ...perfilBase, multiplicadorStatus: 1 });
    expect(comoTitular).toBeGreaterThan(comoReserva);
  });

  it("sem multiplicadorStatus informado, se comporta como multiplicador 1 (retrocompatível)", () => {
    const perfilBase = { overall: 75, idade: 27, reputacaoNacional: 30 };
    expect(calcularValorDeMercado(perfilBase)).toBe(calcularValorDeMercado({ ...perfilBase, multiplicadorStatus: 1 }));
  });
});

describe("calcularRatingDeInteresse", () => {
  it("overall maior gera rating de interesse maior, tudo mais igual", () => {
    const menor = calcularRatingDeInteresse({ overall: 40, idade: 20, reputacaoNacional: 10 });
    const maior = calcularRatingDeInteresse({ overall: 80, idade: 20, reputacaoNacional: 10 });
    expect(maior).toBeGreaterThan(menor);
  });

  it("reputação nacional maior também aumenta o rating de interesse", () => {
    const semReputacao = calcularRatingDeInteresse({ overall: 60, idade: 25, reputacaoNacional: 0 });
    const comReputacao = calcularRatingDeInteresse({ overall: 60, idade: 25, reputacaoNacional: 100 });
    expect(comReputacao).toBeGreaterThan(semReputacao);
  });

  it("fica na mesma ordem de grandeza do rating de clube (simulation/rating.ts, ~1000-2100)", () => {
    const rookie = calcularRatingDeInteresse({ overall: 39, idade: 18, reputacaoNacional: 10 });
    const estrela = calcularRatingDeInteresse({ overall: 90, idade: 27, reputacaoNacional: 90 });
    expect(rookie).toBeGreaterThan(1000);
    expect(rookie).toBeLessThan(1600);
    expect(estrela).toBeGreaterThan(1900);
  });

  it("multiplicadorStatus reduz o rating de interesse sem derrubar abaixo do piso base", () => {
    const perfilBase = { overall: 75, idade: 27, reputacaoNacional: 30 };
    const comoTitular = calcularRatingDeInteresse({ ...perfilBase, multiplicadorStatus: 1 });
    const comoPromessa = calcularRatingDeInteresse({ ...perfilBase, multiplicadorStatus: 0.7 });

    expect(comoPromessa).toBeLessThan(comoTitular);
    expect(comoPromessa).toBeGreaterThanOrEqual(1000);
  });
});
