import { describe, expect, it } from "vitest";
import {
  encontrarIdsDuplicados,
  loadCampeonatosNacionais,
  loadClubes,
  loadEstaduais,
  validarReferenciasDeTimes,
} from "../../src/data/loaders/index.js";

describe("dados de clubes e estaduais", () => {
  it("carrega os clubes do Brasil", () => {
    const clubes = loadClubes();
    expect(clubes.length).toBeGreaterThan(0);
  });

  it("carrega os campeonatos estaduais", () => {
    const estaduais = loadEstaduais();
    expect(estaduais.length).toBeGreaterThan(0);
  });

  it("ids de clube são únicos entre todos os arquivos de clubes/", () => {
    expect(encontrarIdsDuplicados(loadClubes())).toEqual([]);
  });

  it("ids de estadual são únicos", () => {
    const ids = loadEstaduais().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo time e clássico referenciado num estadual existe na base de clubes", () => {
    const clubes = loadClubes();
    const estaduais = loadEstaduais();
    expect(validarReferenciasDeTimes(clubes, estaduais)).toEqual([]);
  });
});

describe("campeonatos nacionais", () => {
  it("carrega os campeonatos nacionais", () => {
    expect(loadCampeonatosNacionais().length).toBeGreaterThan(0);
  });

  it("ids de campeonato nacional são únicos", () => {
    const ids = loadCampeonatosNacionais().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo time e clássico referenciado num campeonato nacional existe na base de clubes", () => {
    const clubes = loadClubes();
    const nacionais = loadCampeonatosNacionais();
    expect(validarReferenciasDeTimes(clubes, nacionais)).toEqual([]);
  });

  it("times de cada liga nacional têm o divisao_nacional correspondente", () => {
    // nivel 0 é reservado para copas de mata-mata puro (ex: Copa do Brasil),
    // que misturam clubes de várias séries de propósito — não entram nessa checagem.
    const clubes = loadClubes();
    const clubePorId = new Map(clubes.map((c) => [c.id, c]));
    const nivelParaDivisao: Record<number, string> = {
      1: "serie_a",
      2: "serie_b",
      3: "serie_c",
      4: "serie_d",
    };

    for (const nacional of loadCampeonatosNacionais()) {
      const divisaoEsperada = nivelParaDivisao[nacional.nivel];
      if (!divisaoEsperada) continue;
      for (const timeId of nacional.times) {
        expect(clubePorId.get(timeId)?.divisao_nacional).toBe(divisaoEsperada);
      }
    }
  });
});
