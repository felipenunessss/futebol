import { describe, expect, it } from "vitest";
import {
  calcularNotaPartida,
  calcularXpPartida,
  converterChancesEmDesempenho,
  ganhoPorPonto,
  GANHO_POR_PONTO_PADRAO,
  GANHO_POR_PONTO_PRIORITARIO,
  PONTOS_POR_NIVEL,
  xpDeSessaoDeTreino,
  xpParaProximoNivel,
  type DesempenhoPartida,
} from "../../src/progression/xp.js";
import { buscarArquetipo } from "../../src/schemas/player.js";
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

describe("xpParaProximoNivel", () => {
  it("cresce conforme o nível sobe (cada nível fica mais caro que o anterior)", () => {
    expect(xpParaProximoNivel(2)).toBeGreaterThan(xpParaProximoNivel(1));
    expect(xpParaProximoNivel(10)).toBeGreaterThan(xpParaProximoNivel(2));
  });

  it("nunca é zero ou negativo", () => {
    expect(xpParaProximoNivel(1)).toBeGreaterThan(0);
  });
});

describe("ganhoPorPonto", () => {
  const finalizador = buscarArquetipo("finalizador"); // prioritários: finalizacao, posicionamento_ofensivo, frieza

  it("atributo prioritário do arquétipo rende mais por ponto que um não-prioritário", () => {
    expect(ganhoPorPonto("finalizacao", finalizador.atributos_prioritarios)).toBe(GANHO_POR_PONTO_PRIORITARIO);
    expect(ganhoPorPonto("velocidade", finalizador.atributos_prioritarios)).toBe(GANHO_POR_PONTO_PADRAO);
  });

  it("arquétipo é multiplicador, não restrição — atributo fora da prioridade ainda rende algo", () => {
    expect(ganhoPorPonto("velocidade", finalizador.atributos_prioritarios)).toBeGreaterThan(0);
  });
});

describe("xpDeSessaoDeTreino", () => {
  it("descanso não gera XP", () => {
    expect(xpDeSessaoDeTreino("descanso")).toBe(0);
  });

  it("físico/técnico/tático geram a mesma quantidade de XP — a diferença hoje é só narrativa, quem decide ONDE aplicar os pontos é o jogador (career/Player.ts investirPontos)", () => {
    const fisico = xpDeSessaoDeTreino("fisico");
    const tecnico = xpDeSessaoDeTreino("tecnico");
    const tatico = xpDeSessaoDeTreino("tatico");

    expect(fisico).toBeGreaterThan(0);
    expect(fisico).toBe(tecnico);
    expect(tecnico).toBe(tatico);
  });
});

describe("PONTOS_POR_NIVEL", () => {
  it("é um número positivo (pontos concedidos por level-up, ver career/Player.ts ganharXp)", () => {
    expect(PONTOS_POR_NIVEL).toBeGreaterThan(0);
  });
});
