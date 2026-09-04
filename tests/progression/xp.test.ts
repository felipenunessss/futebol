import { describe, expect, it } from "vitest";
import { aplicarXpAtributo, calcularNotaPartida, calcularXpPartida, type DesempenhoPartida } from "../../src/progression/xp.js";

function desempenho(overrides: Partial<DesempenhoPartida> = {}): DesempenhoPartida {
  return {
    gols: 0,
    assistencias: 0,
    desarmesBemSucedidos: 0,
    chancesPerdidas: 0,
    minutosJogados: 90,
    importancia: 1,
    ...overrides,
  };
}

describe("calcularNotaPartida", () => {
  it("nota base (sem eventos, 90 minutos) fica no meio da escala", () => {
    expect(calcularNotaPartida(desempenho())).toBe(6);
  });

  it("gols e assistências aumentam a nota", () => {
    const nota = calcularNotaPartida(desempenho({ gols: 2, assistencias: 1 }));
    expect(nota).toBeGreaterThan(6);
  });

  it("chances perdidas reduzem a nota", () => {
    const nota = calcularNotaPartida(desempenho({ chancesPerdidas: 3 }));
    expect(nota).toBeLessThan(6);
  });

  it("fica limitada entre 0 e 10 mesmo com desempenho extremo", () => {
    expect(calcularNotaPartida(desempenho({ gols: 20 }))).toBeLessThanOrEqual(10);
    expect(calcularNotaPartida(desempenho({ chancesPerdidas: 50 }))).toBeGreaterThanOrEqual(0);
  });

  it("jogar menos minutos reduz o efeito dos eventos na nota", () => {
    const notaCompleta = calcularNotaPartida(desempenho({ gols: 2, minutosJogados: 90 }));
    const notaEntrandoNoFim = calcularNotaPartida(desempenho({ gols: 2, minutosJogados: 10 }));
    expect(notaEntrandoNoFim).toBeLessThan(notaCompleta);
  });
});

describe("calcularXpPartida", () => {
  it("partida mais importante (clássico/final) rende mais XP com o mesmo desempenho", () => {
    const normal = calcularXpPartida(desempenho({ gols: 1, importancia: 1 }));
    const classico = calcularXpPartida(desempenho({ gols: 1, importancia: 2 }));
    expect(classico).toBeGreaterThan(normal);
  });
});

describe("aplicarXpAtributo", () => {
  it("aumenta o valor do atributo", () => {
    expect(aplicarXpAtributo(50, 100)).toBeGreaterThan(50);
  });

  it("nunca ultrapassa 99", () => {
    expect(aplicarXpAtributo(98, 100000)).toBeLessThanOrEqual(99);
  });

  it("tem retorno decrescente: o mesmo XP rende menos ganho perto do teto", () => {
    const ganhoBaixo = aplicarXpAtributo(40, 100) - 40;
    const ganhoAlto = aplicarXpAtributo(90, 100) - 90;
    expect(ganhoAlto).toBeLessThan(ganhoBaixo);
  });

  it("multiplicador de arquétipo acelera o crescimento no atributo prioritário", () => {
    const semMultiplicador = aplicarXpAtributo(50, 100, 1);
    const comMultiplicador = aplicarXpAtributo(50, 100, 2);
    expect(comMultiplicador).toBeGreaterThan(semMultiplicador);
  });
});
