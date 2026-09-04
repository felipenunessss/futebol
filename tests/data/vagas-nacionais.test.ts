import { describe, expect, it } from "vitest";
import { loadClubes, loadEstaduais } from "../../src/data/loaders/index.js";
import {
  listarCandidatosSerieD,
  listarCandidatosVagasEstaduais,
  resolverVagasEstaduais,
  sortearCandidatosSerieDTemporadaInicial,
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

  it("na primeira temporada preenche vagas faltantes aleatoriamente entre candidatos elegíveis brasileiros", () => {
    const classificacao = ["clube_a", "clube_b", "clube_c"];
    const resultado = resolverVagasEstaduais(3, classificacao, new Set(["clube_a"]), {
      temporada: 1,
      candidatosExtras: ["clube_x", "clube_y", "clube_z"],
      clubesBrasileiros: new Set(["clube_a", "clube_b", "clube_c", "clube_x", "clube_y", "clube_z"]),
      random: () => 0.1,
    });

    expect(resultado).toHaveLength(3);
    expect(resultado).toContain("clube_a");
    expect(resultado).toContain("clube_b");
    expect(resultado).toContain("clube_x");
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
  });

  it("sorteia candidatos reais para a temporada inicial da Série D", () => {
    const clubes = loadClubes();
    const clubesBrasileiros = new Set(clubes.filter((clube) => clube.pais === "BR").map((clube) => clube.id));
    const emCompeticaoNacional = new Set(["palmeiras", "gremio", "flamengo", "corinthians", "fortaleza", "atletico_mg"]);

    const selecionados = sortearCandidatosSerieDTemporadaInicial(
      3,
      emCompeticaoNacional,
      clubesBrasileiros,
      loadEstaduais(),
      () => 0,
    );

    expect(selecionados).toHaveLength(3);
    expect(selecionados.every((id) => clubesBrasileiros.has(id))).toBe(true);
    expect(selecionados.every((id) => !emCompeticaoNacional.has(id))).toBe(true);
  });
});
