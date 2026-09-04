import { describe, expect, it } from "vitest";
import { pesosDeSubtipo, sortearSubtipo } from "../../src/simulation/tactics.js";

describe("pesosDeSubtipo", () => {
  it("estilo equilibrado dá o mesmo peso pra todos os subtipos", () => {
    const pesos = pesosDeSubtipo("equilibrado");
    const valores = Object.values(pesos);
    expect(new Set(valores).size).toBe(1);
  });

  it("técnico de jogo aéreo pondera cabeceio bem mais que o estilo equilibrado", () => {
    const aereo = pesosDeSubtipo("jogo_aereo");
    const equilibrado = pesosDeSubtipo("equilibrado");
    expect(aereo.cabeceio).toBeGreaterThan(equilibrado.cabeceio);
  });
});

describe("sortearSubtipo", () => {
  it("random no início da faixa (0) sempre cai no primeiro subtipo da lista (voleio)", () => {
    expect(sortearSubtipo("equilibrado", () => 0)).toBe("voleio");
    expect(sortearSubtipo("jogo_aereo", () => 0)).toBe("voleio");
  });

  it("respeita o random injetado (determinístico)", () => {
    const primeiro = sortearSubtipo("posse", () => 0.42);
    const segundo = sortearSubtipo("posse", () => 0.42);
    expect(primeiro).toBe(segundo);
  });

  it("o peso extra de jogo_aereo faz cabeceio cobrir uma faixa maior do sorteio que no estilo equilibrado", () => {
    // ordem de TODOS_SUBTIPOS: voleio, cabeceio, ... — cabeceio começa logo após o peso do voleio.
    const pesosAereo = pesosDeSubtipo("jogo_aereo");
    const totalAereo = Object.values(pesosAereo).reduce((a, b) => a + b, 0);
    const inicioCabeceio = pesosAereo.voleio / totalAereo;
    const meioDaFaixaDeCabeceio = inicioCabeceio + (pesosAereo.cabeceio / totalAereo) / 2;

    expect(sortearSubtipo("jogo_aereo", () => meioDaFaixaDeCabeceio)).toBe("cabeceio");
  });
});
