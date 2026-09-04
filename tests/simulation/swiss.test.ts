import { describe, expect, it } from "vitest";
import type { FaseSuica } from "../../src/schemas/championship.js";
import { gerarConfrontosFaseSuica, simularFaseSuica } from "../../src/simulation/swiss.js";

// 8 times, 2 potes de 4 — dentro do pote: 3 jogos garantidos; fora: até completar jogos_por_time.
const times = ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4"];
const formato: FaseSuica = { num_potes: 2, times_por_pote: 4, jogos_por_time: 5, classificam_mata_mata: 4 };

describe("gerarConfrontosFaseSuica", () => {
  it("cada time do mesmo pote enfrenta todos os outros do próprio pote", () => {
    const confrontos = gerarConfrontosFaseSuica(times, formato, () => Math.random());
    const poteA = new Set(["a1", "a2", "a3", "a4"]);

    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const a = [...poteA][i];
        const b = [...poteA][j];
        const jogaram = confrontos.some(
          (c) => (c.mandante === a && c.visitante === b) || (c.mandante === b && c.visitante === a),
        );
        expect(jogaram).toBe(true);
      }
    }
  });

  it("nenhum confronto repete o mesmo par de times duas vezes", () => {
    const confrontos = gerarConfrontosFaseSuica(times, formato, () => Math.random());
    const chaves = confrontos.map((c) => [c.mandante, c.visitante].sort().join("|"));
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("nenhum time enfrenta a si mesmo, e todo confronto cruzado é entre potes diferentes ou dentro do mesmo (nunca inválido)", () => {
    const confrontos = gerarConfrontosFaseSuica(times, formato, () => Math.random());
    for (const c of confrontos) {
      expect(c.mandante).not.toBe(c.visitante);
      expect(times).toContain(c.mandante);
      expect(times).toContain(c.visitante);
    }
  });

  it("lança erro se o número de times não bater com num_potes × times_por_pote", () => {
    expect(() => gerarConfrontosFaseSuica(times.slice(0, 7), formato)).toThrow();
  });

  it("lança erro se jogos_por_time for menor que os jogos garantidos dentro do pote", () => {
    const formatoInvalido: FaseSuica = { ...formato, jogos_por_time: 2 }; // pote já garante 3
    expect(() => gerarConfrontosFaseSuica(times, formatoInvalido)).toThrow(/jogos_por_time/);
  });
});

describe("simularFaseSuica", () => {
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("gera tabela com uma linha por time e classifica classificam_mata_mata", () => {
    const resultado = simularFaseSuica(times, formato, ratings, () => Math.random());
    expect(resultado.tabela).toHaveLength(8);
    expect(resultado.classificados).toHaveLength(4);
  });

  it("classificados vêm do topo da tabela", () => {
    const resultado = simularFaseSuica(times, formato, ratings, () => Math.random());
    expect(resultado.classificados).toEqual(resultado.tabela.slice(0, 4).map((l) => l.clubeId));
  });
});
