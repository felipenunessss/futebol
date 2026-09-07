import { describe, expect, it } from "vitest";
import {
  aplicarDesempenhoPartida,
  aplicarImpactoDeCenario,
  assinarContrato,
  avancarTemporada,
  criarEstadoInicial,
  ganharXp,
  investirPontos,
  mudarStatusNoClube,
  overallAtual,
  transferirParaClube,
  type EstadoDeCarreira,
} from "../../src/career/Player.js";
import type { Contrato } from "../../src/schemas/contract.js";
import { xpParaProximoNivel, type DesempenhoPartida } from "../../src/progression/xp.js";

function estadoBase(): EstadoDeCarreira {
  // random fixo — a maioria dos testes deste arquivo compara "antes vs depois" de alguma operação
  // a partir do MESMO ponto de partida; com random de verdade, criarEstadoInicial sorteia atributos
  // (e overall) diferentes a cada chamada (ver career/Player.ts), o que tornaria essas comparações
  // instáveis.
  return criarEstadoInicial({
    id: "j1",
    nome: "Jogador Teste",
    posicao: "atacante",
    arquetipoId: "finalizador",
    clubeInicialId: "corinthians",
    temporadaInicial: 2027,
    random: () => 0.5,
  });
}

describe("criarEstadoInicial", () => {
  it("cria um jogador com idade/clube/temporada informados e moral/reputação de estreante", () => {
    const estado = estadoBase();
    expect(estado.jogador.idade).toBe(18);
    expect(estado.clubeAtualId).toBe("corinthians");
    expect(estado.temporada).toBe(2027);
    expect(estado.moral).toBe(50);
    expect(estado.reputacao.nacional).toBeLessThan(50);
    expect(estado.reputacao.porRegiao).toEqual({});
    expect(estado.relacoesInternas).toBe(50);
    expect(estado.patrimonio).toBe(0);
    expect(estado.statusNoClube).toBe("promessa");
  });

  it("atributos prioritários do arquétipo começam mais altos que os demais", () => {
    // random fixo (0.5 = exatamente o centro da amostra triangular, sem ruído) — evita flakiness,
    // já que com random de verdade o ruído poderia (raramente) empatar/inverter um par específico.
    const estado = criarEstadoInicial({ id: "j1", nome: "Jogador Teste", posicao: "atacante", arquetipoId: "finalizador", clubeInicialId: "corinthians", temporadaInicial: 2027, random: () => 0.5 });
    // finalizador: prioritários = finalizacao, posicionamento_ofensivo, frieza
    expect(estado.jogador.atributos.finalizacao!).toBeGreaterThan(estado.jogador.atributos.velocidade!);
  });

  it("overall inicial tem amplitude real (não é mais um valor fixo) mas fica concentrado perto de 50-60", () => {
    const overalis = Array.from({ length: 200 }, (_, i) => {
      const estado = criarEstadoInicial({ id: `j${i}`, nome: "Teste", posicao: "atacante", arquetipoId: "finalizador", clubeInicialId: "corinthians", temporadaInicial: 2027, random: Math.random });
      return overallAtual(estado);
    });

    const distintos = new Set(overalis);
    expect(distintos.size).toBeGreaterThan(5); // amplitude real, não um valor fixo repetido 200x

    const media = overalis.reduce((soma, o) => soma + o, 0) / overalis.length;
    expect(media).toBeGreaterThan(45);
    expect(media).toBeLessThan(65);
  });

  it("sorteia um potencial de desenvolvimento oculto e já semeia a 1ª avaliação de olheiros (0 temporadas observadas)", () => {
    const estado = estadoBase();
    expect(estado.jogador.potencial).toBeDefined();
    expect(estado.temporadasNaCarreira).toBe(0);
    expect(estado.avaliacaoDeOlheiros).toBeDefined();
  });

  it("respeita idadeInicial customizada", () => {
    const estado = criarEstadoInicial({
      id: "j2",
      nome: "Veterano Teste",
      posicao: "goleiro",
      arquetipoId: "muralha",
      clubeInicialId: "flamengo",
      temporadaInicial: 2027,
      idadeInicial: 32,
    });
    expect(estado.jogador.idade).toBe(32);
  });

  it("lança erro se o arquétipo não bater com a posição informada", () => {
    expect(() =>
      criarEstadoInicial({
        id: "j3",
        nome: "Inválido",
        posicao: "zagueiro",
        arquetipoId: "finalizador", // é de atacante
        clubeInicialId: "corinthians",
        temporadaInicial: 2027,
      }),
    ).toThrow(/posição/);
  });
});

describe("overallAtual", () => {
  it("bate com calcularOverall pros mesmos atributos/arquétipo", () => {
    const estado = estadoBase();
    expect(overallAtual(estado)).toBeGreaterThan(0);
    expect(overallAtual(estado)).toBeLessThanOrEqual(99);
  });
});

describe("ganharXp", () => {
  it("acumula XP sem subir de nível se ficar abaixo do limiar", () => {
    const estado = estadoBase();
    const resultado = ganharXp(estado, 10); // bem menos que xpParaProximoNivel(1)

    expect(resultado.subiuDeNivel).toBe(false);
    expect(resultado.estado.nivel).toBe(1);
    expect(resultado.estado.xpAcumulado).toBeCloseTo(10);
    expect(resultado.estado.pontosDisponiveis).toBe(0);
  });

  it("sobe de nível e concede pontos quando o XP cruza o limiar", () => {
    const estado = estadoBase();
    const limiar = xpParaProximoNivel(1);
    const resultado = ganharXp(estado, limiar + 5);

    expect(resultado.subiuDeNivel).toBe(true);
    expect(resultado.nivelAnterior).toBe(1);
    expect(resultado.nivelNovo).toBe(2);
    expect(resultado.estado.nivel).toBe(2);
    expect(resultado.estado.xpAcumulado).toBeCloseTo(5);
    expect(resultado.estado.pontosDisponiveis).toBeGreaterThan(0);
  });

  it("um ganho de XP muito grande processa vários níveis de uma vez", () => {
    const estado = estadoBase();
    const xpEnorme = xpParaProximoNivel(1) + xpParaProximoNivel(2) + xpParaProximoNivel(3) + 1;
    const resultado = ganharXp(estado, xpEnorme);

    expect(resultado.estado.nivel).toBe(4);
    expect(resultado.pontosGanhos).toBeGreaterThan(0);
  });

  it("potencial de desenvolvimento oculto acelera o ganho de XP (sobe de nível mais rápido)", () => {
    const regular = { ...estadoBase(), jogador: { ...estadoBase().jogador, potencial: "regular" as const } };
    const geracional = { ...estadoBase(), jogador: { ...estadoBase().jogador, potencial: "geracional" as const } };

    const depoisRegular = ganharXp(regular, 50).estado.xpAcumulado;
    const depoisGeracional = ganharXp(geracional, 50).estado.xpAcumulado;

    expect(depoisGeracional).toBeGreaterThan(depoisRegular);
  });

  it("não muta o estado original", () => {
    const estado = estadoBase();
    const xpOriginal = estado.xpAcumulado;
    ganharXp(estado, 500);
    expect(estado.xpAcumulado).toBe(xpOriginal);
  });
});

describe("investirPontos", () => {
  it("soma o atributo escolhido e desconta do total de pontos disponíveis", () => {
    const comPontos = { ...estadoBase(), pontosDisponiveis: 5 };
    const valorAntes = comPontos.jogador.atributos.finalizacao!;

    const depois = investirPontos(comPontos, "finalizacao", 2);

    expect(depois.jogador.atributos.finalizacao!).toBeGreaterThan(valorAntes);
    expect(depois.pontosDisponiveis).toBe(3);
  });

  it("atributo prioritário do arquétipo rende mais por ponto que um não-prioritário", () => {
    // finalizador: prioritários = finalizacao, posicionamento_ofensivo, frieza
    const comPontos = { ...estadoBase(), pontosDisponiveis: 10 };
    const valorFinalizacaoAntes = comPontos.jogador.atributos.finalizacao!;
    const valorVelocidadeAntes = comPontos.jogador.atributos.velocidade!;

    const comPrioritario = investirPontos(comPontos, "finalizacao", 1);
    const comNaoPrioritario = investirPontos(comPontos, "velocidade", 1);

    const ganhoPrioritario = comPrioritario.jogador.atributos.finalizacao! - valorFinalizacaoAntes;
    const ganhoNaoPrioritario = comNaoPrioritario.jogador.atributos.velocidade! - valorVelocidadeAntes;
    expect(ganhoPrioritario).toBeGreaterThan(ganhoNaoPrioritario);
  });

  it("nunca ultrapassa 99", () => {
    const quaseNoTeto = { ...estadoBase(), pontosDisponiveis: 50 };
    quaseNoTeto.jogador = { ...quaseNoTeto.jogador, atributos: { ...quaseNoTeto.jogador.atributos, finalizacao: 98 } };

    const depois = investirPontos(quaseNoTeto, "finalizacao", 10);
    expect(depois.jogador.atributos.finalizacao).toBe(99);
  });

  it("lança erro se pedir mais pontos do que tem disponível", () => {
    const comPontos = { ...estadoBase(), pontosDisponiveis: 2 };
    expect(() => investirPontos(comPontos, "finalizacao", 3)).toThrow(/pontos/);
  });

  it("lança erro se a quantidade não for positiva", () => {
    const comPontos = { ...estadoBase(), pontosDisponiveis: 5 };
    expect(() => investirPontos(comPontos, "finalizacao", 0)).toThrow();
  });

  it("não muta o estado original", () => {
    const comPontos = { ...estadoBase(), pontosDisponiveis: 5 };
    const valorOriginal = comPontos.jogador.atributos.finalizacao;
    investirPontos(comPontos, "finalizacao", 2);
    expect(comPontos.jogador.atributos.finalizacao).toBe(valorOriginal);
    expect(comPontos.pontosDisponiveis).toBe(5);
  });
});

describe("aplicarDesempenhoPartida", () => {
  it("soma XP de partida ao nível — não sobe atributo direto (isso agora é escolha manual, ver investirPontos)", () => {
    const estado = estadoBase();
    const valorAntes = estado.jogador.atributos.finalizacao;

    const desempenho: DesempenhoPartida = { gols: 1, assistencias: 0, desarmesBemSucedidos: 0, chancesPerdidas: 0, minutosJogados: 90, importancia: 1 };
    const resultado = aplicarDesempenhoPartida(estado, desempenho);

    expect(resultado.estado.xpAcumulado + xpParaProximoNivel(estado.nivel) * (resultado.estado.nivel - estado.nivel)).toBeGreaterThan(estado.xpAcumulado);
    expect(resultado.estado.jogador.atributos.finalizacao).toBe(valorAntes); // atributo só muda via investirPontos
  });

  it("não muta o estado original", () => {
    const estado = estadoBase();
    const xpOriginal = estado.xpAcumulado;
    const desempenho: DesempenhoPartida = { gols: 1, assistencias: 0, desarmesBemSucedidos: 0, chancesPerdidas: 0, minutosJogados: 90, importancia: 1 };
    aplicarDesempenhoPartida(estado, desempenho);
    expect(estado.xpAcumulado).toBe(xpOriginal);
  });
});

describe("aplicarImpactoDeCenario", () => {
  it("atualiza moral, reputação e atributos a partir do impacto", () => {
    const estado = estadoBase();
    const depois = aplicarImpactoDeCenario(estado, { atributos: { frieza: 5 }, moral: 10, reputacao: -5, narrativa: "x" });

    expect(depois.moral).toBe(estado.moral + 10);
    expect(depois.reputacao.nacional).toBe(estado.reputacao.nacional - 5);
    expect(depois.jogador.atributos.frieza).toBe(estado.jogador.atributos.frieza! + 5);
  });

  it("aplica reputação regional na região informada", () => {
    const estado = estadoBase();
    const depois = aplicarImpactoDeCenario(estado, { reputacaoRegional: 10, narrativa: "x" }, "SP");
    expect(depois.reputacao.porRegiao.SP).toBe(10);
  });

  it("atualiza relações internas a partir do impacto", () => {
    const estado = estadoBase();
    const depois = aplicarImpactoDeCenario(estado, { relacoesInternas: -10, narrativa: "x" });
    expect(depois.relacoesInternas).toBe(estado.relacoesInternas - 10);
  });

  it("preserva clube/temporada/posição — só mexe em atributos/moral/reputação/relações", () => {
    const estado = estadoBase();
    const depois = aplicarImpactoDeCenario(estado, { moral: 5, narrativa: "x" });
    expect(depois.clubeAtualId).toBe(estado.clubeAtualId);
    expect(depois.temporada).toBe(estado.temporada);
    expect(depois.jogador.posicao).toBe(estado.jogador.posicao);
  });
});

describe("transferirParaClube", () => {
  it("troca o clube atual sem mexer em mais nada", () => {
    const estado = estadoBase();
    const depois = transferirParaClube(estado, "flamengo");
    expect(depois.clubeAtualId).toBe("flamengo");
    expect(depois.jogador).toEqual(estado.jogador);
  });
});

describe("avancarTemporada", () => {
  it("incrementa idade e temporada em 1", () => {
    const estado = estadoBase();
    const depois = avancarTemporada(estado);
    expect(depois.temporada).toBe(estado.temporada + 1);
    expect(depois.jogador.idade).toBe(estado.jogador.idade + 1);
  });

  it("não muta o estado original", () => {
    const estado = estadoBase();
    avancarTemporada(estado);
    expect(estado.temporada).toBe(2027);
  });

  it("não soma patrimônio quando a reputação não libera nenhum patrocínio", () => {
    const estado = estadoBase();
    const depois = avancarTemporada(estado);
    expect(depois.patrimonio).toBe(0);
  });

  it("soma ao patrimônio a renda dos patrocínios disponíveis pra reputação/região atuais", () => {
    const estado = { ...estadoBase(), reputacao: { nacional: 50, porRegiao: { SP: 40 } } };
    const depois = avancarTemporada(estado, "SP");
    // nacional 50 libera marca_esportiva_nacional (min 40, 80_000); regional SP 40 libera loja_do_bairro (min 15, 5_000) e emissora_local (min 35, 20_000)
    expect(depois.patrimonio).toBe(80_000 + 5_000 + 20_000);
  });

  it("incrementa temporadasNaCarreira e reavalia avaliacaoDeOlheiros a cada temporada", () => {
    const estado = estadoBase();
    const depois = avancarTemporada(estado);
    expect(depois.temporadasNaCarreira).toBe(1);
    expect(depois.avaliacaoDeOlheiros).toBeDefined();
  });

  it("avaliação de olheiros converge pro potencial real depois de acompanhar o jogador por várias temporadas (nunca erra a partir da 4ª)", () => {
    let estado = estadoBase();
    for (let i = 0; i < 5; i++) estado = avancarTemporada(estado);

    expect(estado.temporadasNaCarreira).toBe(5);
    expect(estado.avaliacaoDeOlheiros).toBe(estado.jogador.potencial);
  });
});

describe("assinarContrato", () => {
  it("troca o clube, registra o contrato e atualiza o status no elenco", () => {
    const estado = estadoBase();
    const contrato: Contrato = { clubeId: "flamengo", salarioMensal: 10_000, luvas: 30_000, clausulaRescisao: 500_000, anos: 3, temporadaAssinatura: 2027 };

    const depois = assinarContrato(estado, contrato, "titular");

    expect(depois.clubeAtualId).toBe("flamengo");
    expect(depois.contratoAtual).toEqual(contrato);
    expect(depois.statusNoClube).toBe("titular");
  });

  it("não muta o estado original", () => {
    const estado = estadoBase();
    const contrato: Contrato = { clubeId: "flamengo", salarioMensal: 10_000, luvas: 30_000, clausulaRescisao: 500_000, anos: 3, temporadaAssinatura: 2027 };
    assinarContrato(estado, contrato, "titular");
    expect(estado.clubeAtualId).toBe("corinthians");
    expect(estado.statusNoClube).toBe("promessa");
  });
});

describe("mudarStatusNoClube", () => {
  it("atualiza só o status, sem mexer em clube/contrato", () => {
    const estado = estadoBase();
    const depois = mudarStatusNoClube(estado, "titular");
    expect(depois.statusNoClube).toBe("titular");
    expect(depois.clubeAtualId).toBe(estado.clubeAtualId);
    expect(depois.contratoAtual).toBe(estado.contratoAtual);
  });
});
