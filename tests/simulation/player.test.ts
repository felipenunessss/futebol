import { describe, expect, it } from "vitest";
import { ARQUETIPOS, ATRIBUTOS_POR_POSICAO, buscarArquetipo, calcularOverall, type Jogador } from "../../src/schemas/player.js";

describe("catálogo de arquétipos", () => {
  it("tem pelo menos 2 arquétipos por posição", () => {
    const posicoes = Object.keys(ATRIBUTOS_POR_POSICAO) as (keyof typeof ATRIBUTOS_POR_POSICAO)[];
    for (const posicao of posicoes) {
      const daPosicao = ARQUETIPOS.filter((a) => a.posicao === posicao);
      expect(daPosicao.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("só referencia atributos prioritários relevantes pra própria posição", () => {
    for (const arquetipo of ARQUETIPOS) {
      const relevantes = ATRIBUTOS_POR_POSICAO[arquetipo.posicao];
      for (const atributo of arquetipo.atributos_prioritarios) {
        expect(relevantes).toContain(atributo);
      }
    }
  });

  it("lança erro pra id de arquétipo desconhecido", () => {
    expect(() => buscarArquetipo("nao_existe")).toThrow();
  });
});

describe("calcularOverall", () => {
  it("dá o overall máximo quando todos os atributos relevantes estão em 99", () => {
    const arquetipo = buscarArquetipo("finalizador");
    const jogador: Jogador = {
      id: "j1",
      nome: "Teste",
      posicao: "atacante",
      arquetipo_id: arquetipo.id,
      idade: 22,
      atributos: Object.fromEntries(ATRIBUTOS_POR_POSICAO.atacante.map((a) => [a, 99])),
    };

    expect(calcularOverall(jogador, arquetipo)).toBe(99);
  });

  it("pesa atributos prioritários do arquétipo mais que os demais", () => {
    const arquetipo = buscarArquetipo("finalizador");
    const base: Jogador = {
      id: "j1",
      nome: "Teste",
      posicao: "atacante",
      arquetipo_id: arquetipo.id,
      idade: 22,
      atributos: Object.fromEntries(ATRIBUTOS_POR_POSICAO.atacante.map((a) => [a, 50])),
    };

    const comPrioritarioAlto: Jogador = { ...base, atributos: { ...base.atributos, finalizacao: 99 } };
    const comNaoPrioritarioAlto: Jogador = { ...base, atributos: { ...base.atributos, velocidade: 99 } };

    expect(calcularOverall(comPrioritarioAlto, arquetipo)).toBeGreaterThan(calcularOverall(comNaoPrioritarioAlto, arquetipo));
  });

  it("trata atributo ausente como o mínimo, sem quebrar o cálculo", () => {
    const arquetipo = buscarArquetipo("muralha");
    const jogador: Jogador = {
      id: "g1",
      nome: "Goleiro Teste",
      posicao: "goleiro",
      arquetipo_id: arquetipo.id,
      idade: 25,
      atributos: {},
    };

    expect(calcularOverall(jogador, arquetipo)).toBe(1);
  });
});
