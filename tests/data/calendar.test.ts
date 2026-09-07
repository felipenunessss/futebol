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

  it("ativa as ligas de outros países CONMEBOL, sem contar como ponto de treino a mais", () => {
    const calendario = construirCalendarioPadrao(2027);
    const outrosPaises = calendario.calendario.find((p) => p.periodo === "temporada-conmebol");

    expect(outrosPaises).toBeDefined();
    expect(outrosPaises?.pontoDeTreino).toBe(false);
    expect(outrosPaises?.competicoes_ativas).toEqual(
      expect.arrayContaining([
        "argentina_primera",
        "argentina_segunda",
        "bolivia_primera",
        "chile_primera",
        "chile_segunda",
        "colombia_primera_a",
        "colombia_segunda",
        "equador_primera",
        "equador_segunda",
        "paraguai_primera",
        "paraguai_segunda",
        "peru_primera",
        "peru_segunda",
        "uruguai_primera",
        "uruguai_segunda",
        "venezuela_primera",
      ]),
    );
    // venezuela_segunda fica de fora de propósito (dado incompatível conhecido, ver docs/dados-a-verificar.md)
    expect(outrosPaises?.competicoes_ativas).not.toContain("venezuela_segunda");

    // só os períodos de treino de verdade contam (os 5 originais) — a janela nova não soma mais um.
    const pontosDeTreino = calendario.calendario.filter((p) => p.pontoDeTreino !== false);
    expect(pontosDeTreino).toHaveLength(5);
  });
});
