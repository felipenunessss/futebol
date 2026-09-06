import { describe, expect, it } from "vitest";
import { estaNaJanelaDeTransferencia, gerarProposta, gerarPropostasIniciais, selecionarClubesInteressados, tetoSalarialMensal } from "../../src/market/transfers.js";
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
    const proposta = gerarProposta(club, 10_000_000, "titular", 1600, () => 0.99);
    expect(proposta.propostaInicial.salarioMensal).toBeLessThanOrEqual(tetoSalarialMensal(club));
  });

  it("com valor de mercado zero, ainda gera termos válidos (sem negativos)", () => {
    const proposta = gerarProposta(clube("a", { forca_financeira: "alta" }), 0, "titular", 1600, () => 0.5);
    expect(proposta.propostaInicial.salarioMensal).toBeGreaterThanOrEqual(1);
    expect(proposta.propostaInicial.luvas).toBeGreaterThanOrEqual(0);
    expect(proposta.propostaInicial.anos).toBeGreaterThanOrEqual(2);
  });

  it("respeita o random injetado (determinístico)", () => {
    const club = clube("a", { forca_financeira: "media" });
    const a = gerarProposta(club, 1_000_000, "titular", 1600, () => 0.5);
    const b = gerarProposta(club, 1_000_000, "titular", 1600, () => 0.5);
    expect(a).toEqual(b);
  });

  it("clube bem mais forte que o clube atual oferece status um degrau abaixo do atual", () => {
    const clubeGigante = clube("gigante", { forca_financeira: "muito_alta", rating_inicial: 2000 });
    const proposta = gerarProposta(clubeGigante, 1_000_000, "titular", 1500, () => 0.5);
    expect(proposta.statusOferecido).toBe("reserva");
  });

  it("clube bem mais fraco que o clube atual oferece status um degrau acima do atual", () => {
    const clubePequeno = clube("pequeno", { forca_financeira: "media", rating_inicial: 1200 });
    const proposta = gerarProposta(clubePequeno, 1_000_000, "reserva", 1600, () => 0.5);
    expect(proposta.statusOferecido).toBe("titular");
  });

  it("ratingClubeAtual 0 (início de carreira) sempre mantém status promessa", () => {
    const clubePequeno = clube("pequeno", { forca_financeira: "baixa", rating_inicial: 1200 });
    const proposta = gerarProposta(clubePequeno, 0, "promessa", 0, () => 0.5);
    expect(proposta.statusOferecido).toBe("promessa");
  });
});

describe("gerarPropostasIniciais", () => {
  const perfilNovato = { overall: 39, idade: 18, reputacaoNacional: 10 };

  it("gera até a quantidade pedida de propostas, todas com status promessa", () => {
    const clubes = ["a", "b", "c", "d", "e"].map((id) => clube(id, { forca_financeira: "media", rating_inicial: 1400 }));
    const propostas = gerarPropostasIniciais(clubes, perfilNovato, 3, () => 0.5);

    expect(propostas.length).toBeLessThanOrEqual(3);
    expect(propostas.length).toBeGreaterThan(0);
    expect(propostas.every((p) => p.statusOferecido === "promessa")).toBe(true);
  });

  it("não inclui clube fora do alcance de um jogador novato (rating muito acima do que o overall sustenta)", () => {
    const clubeGigante = clube("gigante", { forca_financeira: "muito_alta", rating_inicial: 2000 });
    const propostas = gerarPropostasIniciais([clubeGigante], perfilNovato, 3, () => 0.5);
    expect(propostas.map((p) => p.clubeOfertanteId)).not.toContain("gigante");
  });
});

describe("selecionarClubesInteressados", () => {
  const jogadorDecente = { overall: 70, idade: 27, reputacaoNacional: 30 }; // ratingDeInteresse ~1830, alcança até ~1980

  it("nunca inclui o próprio clube atual", () => {
    const clubes = [clube("atual", { forca_financeira: "alta", rating_inicial: 1600 }), clube("b", { forca_financeira: "alta", rating_inicial: 1600 })];
    const interessados = selecionarClubesInteressados(clubes, "atual", jogadorDecente, { random: () => 0.5 });
    expect(interessados.map((c) => c.id)).not.toContain("atual");
  });

  it("não inclui clube com rating menor que o atual", () => {
    const clubeAtual = clube("atual", { rating_inicial: 1800 });
    const clubeFraco = clube("fraco", { rating_inicial: 1200, forca_financeira: "muito_alta" });
    const interessados = selecionarClubesInteressados([clubeAtual, clubeFraco], "atual", jogadorDecente, { random: () => 0.5 });
    expect(interessados.map((c) => c.id)).not.toContain("fraco");
  });

  it("não inclui clube que não pode bancar o valor de mercado do jogador", () => {
    const jogadorCaro = { overall: 90, idade: 27, reputacaoNacional: 80 };
    const clubeAtual = clube("atual", { rating_inicial: 1600 });
    const clubePobre = clube("pobre", { rating_inicial: 1600, forca_financeira: "muito_baixa" });
    const interessados = selecionarClubesInteressados([clubeAtual, clubePobre], "atual", jogadorCaro, { random: () => 0.5 });
    expect(interessados.map((c) => c.id)).not.toContain("pobre");
  });

  it("respeita quantidadeMaxima", () => {
    const clubeAtual = clube("atual", { rating_inicial: 1600 });
    const candidatos = ["b", "c", "d", "e", "f"].map((id) => clube(id, { rating_inicial: 1600, forca_financeira: "alta" }));
    const interessados = selecionarClubesInteressados([clubeAtual, ...candidatos], "atual", jogadorDecente, { random: () => 0.5, quantidadeMaxima: 2 });
    expect(interessados.length).toBeLessThanOrEqual(2);
  });

  it("jogador fraco não atrai clube muito mais forte, mesmo sendo upgrade e financeiramente capaz (interesse factível com o desempenho)", () => {
    const jogadorFraco = { overall: 39, idade: 18, reputacaoNacional: 10 }; // ratingDeInteresse ~1449, alcança até ~1599
    const clubeAtual = clube("atual", { rating_inicial: 1400 });
    const clubeGigante = clube("gigante", { rating_inicial: 2000, forca_financeira: "muito_alta" });
    const interessados = selecionarClubesInteressados([clubeAtual, clubeGigante], "atual", jogadorFraco, { random: () => 0.5 });
    expect(interessados.map((c) => c.id)).not.toContain("gigante");
  });

  it("jogador bom o bastante atrai clube dentro do alcance, mesmo clube atual sendo fraco", () => {
    const clubeAtual = clube("atual", { rating_inicial: 1400 });
    const clubeAlcancavel = clube("alcancavel", { rating_inicial: 1900, forca_financeira: "muito_alta" }); // dentro de ~1980 pro jogadorDecente
    const interessados = selecionarClubesInteressados([clubeAtual, clubeAlcancavel], "atual", jogadorDecente, { random: () => 0.5 });
    expect(interessados.map((c) => c.id)).toContain("alcancavel");
  });

  it("exigirUpgrade: false permite clube com rating menor que o atual (venda forçada)", () => {
    const clubeAtual = clube("atual", { rating_inicial: 1800 });
    const clubeMenor = clube("menor", { rating_inicial: 1200, forca_financeira: "muito_alta" });

    const comExigencia = selecionarClubesInteressados([clubeAtual, clubeMenor], "atual", jogadorDecente, { random: () => 0.5 });
    expect(comExigencia.map((c) => c.id)).not.toContain("menor");

    const semExigencia = selecionarClubesInteressados([clubeAtual, clubeMenor], "atual", jogadorDecente, { random: () => 0.5, exigirUpgrade: false });
    expect(semExigencia.map((c) => c.id)).toContain("menor");
  });
});
