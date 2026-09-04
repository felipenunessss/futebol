import { describe, expect, it } from "vitest";
import { gerarTimesDaCopa } from "../../src/data/loaders/gerar-copa-regional.js";

describe("gerarTimesDaCopa", () => {
  const clubesValidos = new Set(["flamengo", "palmeiras", "gremio"]);

  it("monta a lista de times a partir de vagas válidas", () => {
    const resultado = gerarTimesDaCopa(
      [
        { origem: "RJ", clubeId: "flamengo", criterio: "campeão estadual 2025" },
        { origem: "SP", clubeId: "palmeiras", criterio: "vice-campeão estadual 2025" },
      ],
      clubesValidos,
    );
    expect(resultado.times).toEqual(["flamengo", "palmeiras"]);
    expect(resultado.erros).toEqual([]);
  });

  it("reporta erro e não inclui clube que não existe na base", () => {
    const resultado = gerarTimesDaCopa(
      [{ origem: "XX", clubeId: "clube_inexistente", criterio: "campeão estadual 2025" }],
      clubesValidos,
    );
    expect(resultado.times).toEqual([]);
    expect(resultado.erros).toHaveLength(1);
  });

  it("reporta erro em vaga duplicada e não duplica no resultado", () => {
    const resultado = gerarTimesDaCopa(
      [
        { origem: "RJ", clubeId: "flamengo", criterio: "campeão estadual 2025" },
        { origem: "RJ", clubeId: "flamengo", criterio: "vaga extra" },
      ],
      clubesValidos,
    );
    expect(resultado.times).toEqual(["flamengo"]);
    expect(resultado.erros).toHaveLength(1);
  });
});
