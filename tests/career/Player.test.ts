import { describe, expect, it } from "vitest";
import {
  aplicarDesempenhoPartida,
  aplicarImpactoDeCenario,
  avancarTemporada,
  criarEstadoInicial,
  overallAtual,
  transferirParaClube,
  type EstadoDeCarreira,
} from "../../src/career/Player.js";
import type { ChanceJogador } from "../../src/simulation/match.js";
import type { DesempenhoPartida } from "../../src/progression/xp.js";

function estadoBase(): EstadoDeCarreira {
  return criarEstadoInicial({
    id: "j1",
    nome: "Jogador Teste",
    posicao: "atacante",
    arquetipoId: "finalizador",
    clubeInicialId: "corinthians",
    temporadaInicial: 2027,
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
  });

  it("atributos prioritários do arquétipo começam mais altos que os demais", () => {
    const estado = estadoBase();
    // finalizador: prioritários = finalizacao, posicionamento_ofensivo, frieza
    expect(estado.jogador.atributos.finalizacao!).toBeGreaterThan(estado.jogador.atributos.velocidade!);
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

describe("aplicarDesempenhoPartida", () => {
  it("aumenta o overall depois de uma partida com bom desempenho", () => {
    const estado = estadoBase();
    const overallAntes = overallAtual(estado);

    const chances: ChanceJogador[] = [{ subtipo: "voleio", sucesso: true, atributoUsado: "finalizacao" }];
    const desempenho: DesempenhoPartida = { gols: 1, assistencias: 0, desarmesBemSucedidos: 0, chancesPerdidas: 0, minutosJogados: 90, importancia: 1 };

    const depois = aplicarDesempenhoPartida(estado, chances, desempenho);
    expect(overallAtual(depois)).toBeGreaterThan(overallAntes);
  });

  it("não muta o estado original", () => {
    const estado = estadoBase();
    const valorOriginal = estado.jogador.atributos.finalizacao;
    aplicarDesempenhoPartida(
      estado,
      [{ subtipo: "voleio", sucesso: true, atributoUsado: "finalizacao" }],
      { gols: 1, assistencias: 0, desarmesBemSucedidos: 0, chancesPerdidas: 0, minutosJogados: 90, importancia: 1 },
    );
    expect(estado.jogador.atributos.finalizacao).toBe(valorOriginal);
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
});
