import { describe, expect, it } from "vitest";
import {
  aplicarTreino,
  aplicarXpAtributo,
  aplicarXpPartidaAoJogador,
  ATRIBUTOS_POR_FOCO,
  calcularNotaPartida,
  calcularXpPartida,
  converterChancesEmDesempenho,
  type DesempenhoPartida,
} from "../../src/progression/xp.js";
import { ATRIBUTOS_POR_POSICAO, buscarArquetipo, type Jogador } from "../../src/schemas/player.js";
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

describe("aplicarXpPartidaAoJogador", () => {
  const finalizador = buscarArquetipo("finalizador"); // prioritários: finalizacao, posicionamento_ofensivo, frieza

  function jogadorBase(): Jogador {
    return {
      id: "j1",
      nome: "Teste",
      posicao: "atacante",
      arquetipo_id: finalizador.id,
      idade: 22,
      atributos: Object.fromEntries(ATRIBUTOS_POR_POSICAO.atacante.map((a) => [a, 50])),
    };
  }

  it("sobe o atributo usado numa chance específica", () => {
    const jogador = jogadorBase();
    const chances: ChanceJogador[] = [chance({ subtipo: "cabeceio", sucesso: true, atributoUsado: "cabeceio" })];

    const atributos = aplicarXpPartidaAoJogador(jogador, finalizador, chances, 100);

    expect(atributos.cabeceio!).toBeGreaterThan(jogador.atributos.cabeceio!);
  });

  it("chance sem sucesso ainda rende XP pro atributo, só que menos que uma bem-sucedida", () => {
    const jogador = jogadorBase();
    const comSucesso = aplicarXpPartidaAoJogador(jogador, finalizador, [chance({ atributoUsado: "cabeceio", sucesso: true })], 100);
    const semSucesso = aplicarXpPartidaAoJogador(jogador, finalizador, [chance({ atributoUsado: "cabeceio", sucesso: false })], 100);

    expect(comSucesso.cabeceio!).toBeGreaterThan(semSucesso.cabeceio!);
    expect(semSucesso.cabeceio!).toBeGreaterThan(jogador.atributos.cabeceio!); // ainda aprende algo com o erro
  });

  it("atributo prioritário do arquétipo cresce mais que um não-prioritário com o mesmo XP de chance", () => {
    const jogador = jogadorBase();
    const chancesPrioritario: ChanceJogador[] = [chance({ atributoUsado: "finalizacao" })]; // prioritário do Finalizador
    const chancesNaoPrioritario: ChanceJogador[] = [chance({ atributoUsado: "velocidade" })]; // não é prioritário

    const comPrioritario = aplicarXpPartidaAoJogador(jogador, finalizador, chancesPrioritario, 100);
    const comNaoPrioritario = aplicarXpPartidaAoJogador(jogador, finalizador, chancesNaoPrioritario, 100);

    const ganhoPrioritario = comPrioritario.finalizacao! - jogador.atributos.finalizacao!;
    const ganhoNaoPrioritario = comNaoPrioritario.velocidade! - jogador.atributos.velocidade!;

    expect(ganhoPrioritario).toBeGreaterThan(ganhoNaoPrioritario);
  });

  it("mesmo sem nenhuma chance, o XP geral ainda distribui crescimento pelos atributos da posição", () => {
    const jogador = jogadorBase();
    const atributos = aplicarXpPartidaAoJogador(jogador, finalizador, [], 100);

    for (const atributo of ATRIBUTOS_POR_POSICAO.atacante) {
      expect(atributos[atributo]!).toBeGreaterThan(jogador.atributos[atributo]!);
    }
  });

  it("não muta o objeto de atributos original do jogador", () => {
    const jogador = jogadorBase();
    const valorOriginal = jogador.atributos.finalizacao;
    aplicarXpPartidaAoJogador(jogador, finalizador, [chance({ atributoUsado: "finalizacao" })], 100);
    expect(jogador.atributos.finalizacao).toBe(valorOriginal);
  });
});

describe("aplicarTreino", () => {
  const finalizador = buscarArquetipo("finalizador"); // prioritários: finalizacao, posicionamento_ofensivo, frieza

  function jogadorBase(): Jogador {
    return {
      id: "j1",
      nome: "Teste",
      posicao: "atacante",
      arquetipo_id: finalizador.id,
      idade: 22,
      atributos: Object.fromEntries(ATRIBUTOS_POR_POSICAO.atacante.map((a) => [a, 50])),
    };
  }

  it("foco físico sobe só os atributos físicos relevantes pra posição, não os técnicos/táticos", () => {
    const jogador = jogadorBase();
    const atributos = aplicarTreino(jogador, finalizador, "fisico");

    for (const atributo of ATRIBUTOS_POR_FOCO.fisico) {
      if (ATRIBUTOS_POR_POSICAO.atacante.includes(atributo)) {
        expect(atributos[atributo]!).toBeGreaterThan(jogador.atributos[atributo]!);
      }
    }
    for (const atributo of ATRIBUTOS_POR_FOCO.tatico) {
      if (ATRIBUTOS_POR_POSICAO.atacante.includes(atributo)) {
        expect(atributos[atributo]!).toBe(jogador.atributos[atributo]!);
      }
    }
  });

  it("foco técnico sobe atributos técnicos relevantes, não mexe nos físicos", () => {
    const jogador = jogadorBase();
    const atributos = aplicarTreino(jogador, finalizador, "tecnico");

    expect(atributos.finalizacao!).toBeGreaterThan(jogador.atributos.finalizacao!);
    expect(atributos.velocidade!).toBe(jogador.atributos.velocidade!);
  });

  it("atributo prioritário do arquétipo cresce mais que um não-prioritário no mesmo foco", () => {
    const jogador = jogadorBase();
    const atributos = aplicarTreino(jogador, finalizador, "tecnico"); // finalizacao é prioritário, drible não é

    const ganhoPrioritario = atributos.finalizacao! - jogador.atributos.finalizacao!;
    const ganhoNaoPrioritario = atributos.drible! - jogador.atributos.drible!;
    expect(ganhoPrioritario).toBeGreaterThan(ganhoNaoPrioritario);
  });

  it("foco descanso não muda nenhum atributo", () => {
    const jogador = jogadorBase();
    const atributos = aplicarTreino(jogador, finalizador, "descanso");
    expect(atributos).toEqual(jogador.atributos);
  });

  it("posição sem nenhum atributo no foco escolhido não quebra, só não tem efeito", () => {
    const goleiro: Jogador = {
      id: "g1",
      nome: "Goleiro Teste",
      posicao: "goleiro",
      arquetipo_id: "muralha",
      idade: 25,
      atributos: Object.fromEntries(ATRIBUTOS_POR_POSICAO.goleiro.map((a) => [a, 50])),
    };
    const muralha = buscarArquetipo("muralha");
    // goleiro não tem nenhum atributo tático na lista de ATRIBUTOS_POR_POSICAO.goleiro
    const atributos = aplicarTreino(goleiro, muralha, "tatico");
    expect(atributos).toEqual(goleiro.atributos);
  });

  it("não muta o objeto de atributos original do jogador", () => {
    const jogador = jogadorBase();
    const valorOriginal = jogador.atributos.finalizacao;
    aplicarTreino(jogador, finalizador, "tecnico");
    expect(jogador.atributos.finalizacao).toBe(valorOriginal);
  });
});
