import { describe, expect, it } from "vitest";
import { EVENTOS_DE_PARTIDA } from "../../src/progression/match-events.js";

describe("catálogo de eventos de partida", () => {
  it("todo id é único", () => {
    expect(new Set(EVENTOS_DE_PARTIDA.map((e) => e.id)).size).toBe(EVENTOS_DE_PARTIDA.length);
  });

  it("todo evento tem 2 opções", () => {
    for (const evento of EVENTOS_DE_PARTIDA) {
      expect(evento.opcoes.length).toBe(2);
    }
  });

  it("toda opção tem resultados cujas probabilidades somam 1", () => {
    for (const evento of EVENTOS_DE_PARTIDA) {
      for (const opcao of evento.opcoes) {
        const soma = opcao.resultados.reduce((s, r) => s + r.probabilidade, 0);
        expect(soma).toBeCloseTo(1);
      }
    }
  });

  it("nenhum impacto mexe em atributos (só moral/relacoesInternas, universais pra qualquer posição)", () => {
    for (const evento of EVENTOS_DE_PARTIDA) {
      for (const opcao of evento.opcoes) {
        for (const resultado of opcao.resultados) {
          expect(resultado.impacto.atributos).toBeUndefined();
        }
      }
    }
  });

  it("nenhum evento declara gatilho (elegível sempre, motor de partida não tem contexto de carreira)", () => {
    for (const evento of EVENTOS_DE_PARTIDA) {
      expect(evento.gatilho).toBeUndefined();
    }
  });
});
