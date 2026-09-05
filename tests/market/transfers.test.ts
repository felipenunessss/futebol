import { describe, expect, it } from "vitest";
import { estaNaJanelaDeTransferencia, gerarProposta, selecionarClubesInteressados, tetoSalarialMensal } from "../../src/market/transfers.js";
import type { Club } from "../../src/schemas/club.js";

function clube(id: string, extra: Partial<Club> = {}): Club {
  return { id, nome: id, pais: "BR", cidade: "Cidade", ...extra };
}

describe("estaNaJanelaDeTransferencia", () => {
  it("só pre_temporada conta como janela aberta", () => {
    expect(estaNaJanelaDeTransferencia("pre_temporada")).toBe(true);
    expect(estaNaJanelaDeTransferencia("temporada_regular")).toBe(false);
    expect(estaNaJanelaDeTransferencia("reta_final")).toBe(false);
    expect(estaNaJanelaDeTransferencia("pos_temporada")).toBe(false);
  });
});

describe("tetoSalarialMensal", () => {
  it("usa forca_financeira quando disponível", () => {
    expect(tetoSalarialMensal(clube("a", { forca_financeira: "muito_alta" }))).toBe(500_000);
    expect(tetoSalarialMensal(clube("b", { forca_financeira: "muito_baixa" }))).toBe(5_000);
  });

  it("sem forca_financeira, cai no fallback por nível de divisão — nível melhor rende teto maior", () => {
    const nivel1 = tetoSalarialMensal(clube("a", { divisao_nacional: { pais: "BR", nivel: 1 } }));
    const nivel4 = tetoSalarialMensal(clube("b", { divisao_nacional: { pais: "BR", nivel: 4 } }));
    expect(nivel1).toBeGreaterThan(nivel4);
  });
});

describe("gerarProposta", () => {
  it("nunca ultrapassa o teto salarial do clube", () => {
    const club = clube("a", { forca_financeira: "baixa" });
    const proposta = gerarProposta(club, 10_000_000, () => 0.99);
    expect(proposta.propostaInicial.salarioMensal).toBeLessThanOrEqual(tetoSalarialMensal(club));
  });

  it("com valor de mercado zero, ainda gera termos válidos (sem negativos)", () => {
    const proposta = gerarProposta(clube("a", { forca_financeira: "alta" }), 0, () => 0.5);
    expect(proposta.propostaInicial.salarioMensal).toBeGreaterThanOrEqual(1);
    expect(proposta.propostaInicial.luvas).toBeGreaterThanOrEqual(0);
    expect(proposta.propostaInicial.anos).toBeGreaterThanOrEqual(2);
  });

  it("respeita o random injetado (determinístico)", () => {
    const club = clube("a", { forca_financeira: "media" });
    const a = gerarProposta(club, 1_000_000, () => 0.5);
    const b = gerarProposta(club, 1_000_000, () => 0.5);
    expect(a).toEqual(b);
  });
});

describe("selecionarClubesInteressados", () => {
  it("nunca inclui o próprio clube atual", () => {
    const clubes = [clube("atual", { forca_financeira: "alta", rating_inicial: 1600 }), clube("b", { forca_financeira: "alta", rating_inicial: 1600 })];
    const interessados = selecionarClubesInteressados(clubes, "atual", 100_000, { random: () => 0.5 });
    expect(interessados.map((c) => c.id)).not.toContain("atual");
  });

  it("não inclui clube com rating menor que o atual", () => {
    const clubeAtual = clube("atual", { rating_inicial: 1800 });
    const clubeFraco = clube("fraco", { rating_inicial: 1200, forca_financeira: "muito_alta" });
    const interessados = selecionarClubesInteressados([clubeAtual, clubeFraco], "atual", 0, { random: () => 0.5 });
    expect(interessados.map((c) => c.id)).not.toContain("fraco");
  });

  it("não inclui clube que não pode bancar o valor de mercado do jogador", () => {
    const clubeAtual = clube("atual", { rating_inicial: 1600 });
    const clubePobre = clube("pobre", { rating_inicial: 1600, forca_financeira: "muito_baixa" });
    const interessados = selecionarClubesInteressados([clubeAtual, clubePobre], "atual", 100_000_000, { random: () => 0.5 });
    expect(interessados.map((c) => c.id)).not.toContain("pobre");
  });

  it("respeita quantidadeMaxima", () => {
    const clubeAtual = clube("atual", { rating_inicial: 1600 });
    const candidatos = ["b", "c", "d", "e", "f"].map((id) => clube(id, { rating_inicial: 1600, forca_financeira: "alta" }));
    const interessados = selecionarClubesInteressados([clubeAtual, ...candidatos], "atual", 0, { random: () => 0.5, quantidadeMaxima: 2 });
    expect(interessados.length).toBeLessThanOrEqual(2);
  });
});
