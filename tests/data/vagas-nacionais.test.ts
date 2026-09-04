import { describe, expect, it } from "vitest";
import { loadClubes, loadEstaduais } from "../../src/data/loaders/index.js";
import {
  listarCandidatosSerieD,
  listarCandidatosVagasEstaduais,
  resolverVagasEstaduais,
} from "../../src/data/loaders/vagas-nacionais.js";

describe("resolverVagasEstaduais", () => {
  it("dá a vaga ao campeão quando ele não joga competição nacional", () => {
    const classificacao = ["clube_a", "clube_b", "clube_c"];
    const resultado = resolverVagasEstaduais(1, classificacao, new Set());
    expect(resultado).toEqual(["clube_a"]);
  });

  it("pula clubes que já disputam competição nacional", () => {
    const classificacao = ["clube_a", "clube_b", "clube_c"];
    const emCompeticaoNacional = new Set(["clube_a"]);
    const resultado = resolverVagasEstaduais(1, classificacao, emCompeticaoNacional);
    expect(resultado).toEqual(["clube_b"]);
  });

  it("preenche múltiplas vagas (ex: campeão e vice) na ordem da tabela", () => {
    const classificacao = ["clube_a", "clube_b", "clube_c", "clube_d"];
    const resultado = resolverVagasEstaduais(2, classificacao, new Set());
    expect(resultado).toEqual(["clube_a", "clube_b"]);
  });

  it("retorna menos vagas que o pedido se a tabela acabar antes", () => {
    const classificacao = ["clube_a", "clube_b"];
    const emCompeticaoNacional = new Set(["clube_a", "clube_b"]);
    const resultado = resolverVagasEstaduais(2, classificacao, emCompeticaoNacional);
    expect(resultado).toEqual([]);
  });

  it("não retorna mais vagas do que a quantidade pedida", () => {
    const classificacao = ["clube_a", "clube_b", "clube_c"];
    const resultado = resolverVagasEstaduais(1, classificacao, new Set());
    expect(resultado.length).toBe(1);
  });

  it("lista times estaduais elegíveis para preencher vagas faltantes da temporada 1, só brasileiros", () => {
    const candidatos = listarCandidatosVagasEstaduais(
      new Set(["palmeiras", "corinthians", "sao_paulo", "santos"]),
      [
        { id: "paulistao_a1", times: ["corinthians", "palmeiras", "sao_paulo", "santos", "botafogo_sp", "primavera", "river_plate"] },
      ],
      new Set(["corinthians", "palmeiras", "sao_paulo", "santos", "botafogo_sp", "primavera"]),
    );

    expect(candidatos).toContain("botafogo_sp");
    expect(candidatos).toContain("primavera");
    expect(candidatos).not.toContain("palmeiras");
    expect(candidatos).not.toContain("river_plate");
  });

  it("monta candidatos reais da Série D usando apenas clubes brasileiros fora de competição nacional", () => {
    const clubes = loadClubes();
    const clubesBrasileiros = new Set(clubes.filter((clube) => clube.pais === "BR").map((clube) => clube.id));
    const emCompeticaoNacional = new Set([
      "palmeiras",
      "gremio",
      "flamengo",
      "corinthians",
      "fortaleza",
      "atletico_mg",
    ]);

    const candidatos = listarCandidatosSerieD(emCompeticaoNacional, clubesBrasileiros, loadEstaduais());

    expect(candidatos.length).toBeGreaterThan(0);
    expect(candidatos.every((id) => clubesBrasileiros.has(id))).toBe(true);
    expect(candidatos.some((id) => id === "palmeiras")).toBe(false);
    expect(candidatos.some((id) => id === "botafogo_sp")).toBe(true);
    expect(candidatos.some((id) => id === "atletico_alagoinhas")).toBe(true);
  });
});
