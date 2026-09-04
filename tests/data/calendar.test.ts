import { describe, expect, it } from "vitest";
import { construirCalendarioPadrao } from "../../src/data/loaders/calendario.js";

describe("calendario mestre", () => {
  it("gera um calendário padrão com períodos e competições ativas", () => {
    const calendario = construirCalendarioPadrao(2027);

    expect(calendario.temporada).toBe(2027);
    expect(calendario.calendario.length).toBeGreaterThan(0);
    expect(calendario.calendario[0]).toMatchObject({
      periodo: "jan-1a_quinz",
      competicoes_ativas: expect.arrayContaining(["paulistao_a1", "carioca_a", "brasileirao_serie_a"]),
    });
  });

  it("mantém as competições nacionais ativas na fase principal da temporada", () => {
    const calendario = construirCalendarioPadrao(2027);
    const fasePrincipal = calendario.calendario.find((p) => p.periodo === "mai-nov");

    expect(fasePrincipal).toBeDefined();
    expect(fasePrincipal?.competicoes_ativas).toEqual(
      expect.arrayContaining([
        "brasileirao_serie_a",
        "brasileirao_serie_b",
        "copa_do_brasil",
        "libertadores",
      ]),
    );
  });
});
