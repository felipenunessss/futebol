import { describe, expect, it } from "vitest";
import { patrociniosDisponiveis, PATROCINIOS } from "../../src/career/patrocinios.js";
import type { Reputacao } from "../../src/progression/scenarios.js";

describe("patrociniosDisponiveis", () => {
  it("sem reputação nenhuma, nenhum patrocínio disponível", () => {
    const reputacao: Reputacao = { nacional: 0, porRegiao: {} };
    expect(patrociniosDisponiveis(reputacao)).toEqual([]);
  });

  it("patrocínio nacional aparece quando reputação nacional bate o mínimo", () => {
    const reputacao: Reputacao = { nacional: 40, porRegiao: {} };
    const disponiveis = patrociniosDisponiveis(reputacao);
    expect(disponiveis.map((p) => p.id)).toContain("marca_esportiva_nacional");
    expect(disponiveis.map((p) => p.id)).not.toContain("marca_global");
  });

  it("patrocínio regional só aparece se a região informada bater o mínimo", () => {
    const reputacao: Reputacao = { nacional: 0, porRegiao: { SP: 20 } };
    expect(patrociniosDisponiveis(reputacao, "SP").map((p) => p.id)).toContain("loja_do_bairro");
    expect(patrociniosDisponiveis(reputacao, "RJ")).toEqual([]);
  });

  it("sem regiaoAtual informada, nenhum patrocínio regional é considerado, mesmo com reputação regional alta", () => {
    const reputacao: Reputacao = { nacional: 0, porRegiao: { SP: 100 } };
    expect(patrociniosDisponiveis(reputacao)).toEqual([]);
  });

  it("reputação máxima em tudo libera o catálogo inteiro", () => {
    const reputacao: Reputacao = { nacional: 100, porRegiao: { SP: 100 } };
    expect(patrociniosDisponiveis(reputacao, "SP").length).toBe(PATROCINIOS.length);
  });
});
