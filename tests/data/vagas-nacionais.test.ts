import { describe, expect, it } from "vitest";
import { resolverVagasEstaduais } from "../../src/data/loaders/vagas-nacionais.js";

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
});
