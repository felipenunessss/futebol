import { describe, expect, it } from "vitest";
import { loadClubes, loadEstaduais, validarReferenciasDeTimes } from "../../src/data/loaders/index.js";

describe("dados de clubes e estaduais", () => {
  it("carrega os clubes do Brasil", () => {
    const clubes = loadClubes();
    expect(clubes.length).toBeGreaterThan(0);
  });

  it("carrega os campeonatos estaduais", () => {
    const estaduais = loadEstaduais();
    expect(estaduais.length).toBeGreaterThan(0);
  });

  it("ids de clube são únicos", () => {
    const ids = loadClubes().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ids de estadual são únicos", () => {
    const ids = loadEstaduais().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo time e clássico referenciado num estadual existe na base de clubes", () => {
    const clubes = loadClubes();
    const estaduais = loadEstaduais();
    expect(validarReferenciasDeTimes(clubes, estaduais)).toEqual([]);
  });
});
