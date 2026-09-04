import { describe, expect, it } from "vitest";
import { aplicarXpAtributo, calcularNotaPartida, calcularXpPartida, converterChancesEmDesempenho, type DesempenhoPartida } from "../../src/progression/xp.js";
import type { ChanceJogador } from "../../src/simulation/match.js";

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

function chance(overrides: Partial<ChanceJogador>): ChanceJogador {
  return { subtipo: "voleio", sucesso: true, atributoUsado: "finalizacao", ...overrides };
}

describe("converterChancesEmDesempenho", () => {
  it("finalização bem-sucedida (voleio/cabeceio/chute de fora/jogada individual) vira gol", () => {
    const chances: ChanceJogador[] = [
      chance({ subtipo: "voleio", sucesso: true }),
      chance({ subtipo: "cabeceio", sucesso: true }),
      chance({ subtipo: "chute_de_fora", sucesso: true }),
      chance({ subtipo: "jogada_individual", sucesso: true }),
    ];

    const desempenho = converterChancesEmDesempenho(chances, 90, 1);
    expect(desempenho.gols).toBe(4);
    expect(desempenho.chancesPerdidas).toBe(0);
  });

  it("finalização sem sucesso vira chance perdida, não gol", () => {
    const desempenho = converterChancesEmDesempenho([chance({ subtipo: "voleio", sucesso: false })], 90, 1);
    expect(desempenho.gols).toBe(0);
    expect(desempenho.chancesPerdidas).toBe(1);
  });

  it("passe decisivo bem-sucedido vira assistência; sem sucesso vira chance perdida", () => {
    const comSucesso = converterChancesEmDesempenho([chance({ subtipo: "passe_decisivo", sucesso: true })], 90, 1);
    expect(comSucesso.assistencias).toBe(1);
    expect(comSucesso.chancesPerdidas).toBe(0);

    const semSucesso = converterChancesEmDesempenho([chance({ subtipo: "passe_decisivo", sucesso: false })], 90, 1);
    expect(semSucesso.assistencias).toBe(0);
    expect(semSucesso.chancesPerdidas).toBe(1);
  });

  it("desarme decisivo só soma quando bem-sucedido, e uma falha não conta como chance perdida", () => {
    const comSucesso = converterChancesEmDesempenho([chance({ subtipo: "desarme_decisivo", sucesso: true })], 90, 1);
    expect(comSucesso.desarmesBemSucedidos).toBe(1);

    const semSucesso = converterChancesEmDesempenho([chance({ subtipo: "desarme_decisivo", sucesso: false })], 90, 1);
    expect(semSucesso.desarmesBemSucedidos).toBe(0);
    expect(semSucesso.chancesPerdidas).toBe(0);
  });

  it("preserva minutosJogados e importancia passados", () => {
    const desempenho = converterChancesEmDesempenho([], 63, 2.5);
    expect(desempenho.minutosJogados).toBe(63);
    expect(desempenho.importancia).toBe(2.5);
  });

  it("compõe direto com calcularXpPartida", () => {
    const chances: ChanceJogador[] = [chance({ subtipo: "voleio", sucesso: true })];
    const desempenho = converterChancesEmDesempenho(chances, 90, 1);
    expect(calcularXpPartida(desempenho)).toBeGreaterThan(0);
  });
});

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
