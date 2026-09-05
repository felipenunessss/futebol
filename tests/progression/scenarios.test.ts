import { describe, expect, it } from "vitest";
import {
  CENARIOS,
  aplicarImpacto,
  resolverEscolha,
  sortearCenario,
  type Cenario,
  type EstadoJogadorParaImpacto,
  type Opcao,
} from "../../src/progression/scenarios.js";

describe("catálogo de cenários", () => {
  it("todo cenário tem entre 2 e 3 opções", () => {
    for (const cenario of CENARIOS) {
      expect(cenario.opcoes.length).toBeGreaterThanOrEqual(2);
      expect(cenario.opcoes.length).toBeLessThanOrEqual(3);
    }
  });

  it("toda opção tem resultados cujas probabilidades somam 1", () => {
    for (const cenario of CENARIOS) {
      for (const opcao of cenario.opcoes) {
        const soma = opcao.resultados.reduce((s, r) => s + r.probabilidade, 0);
        expect(soma).toBeCloseTo(1);
      }
    }
  });
});

describe("resolverEscolha", () => {
  const opcaoGarantida: Opcao = {
    id: "garantida",
    texto: "opção com um resultado só",
    resultados: [{ probabilidade: 1, impacto: { narrativa: "sempre isso" } }],
  };

  const opcaoProbabilistica: Opcao = {
    id: "probabilistica",
    texto: "opção com 2 resultados",
    resultados: [
      { probabilidade: 0.3, impacto: { narrativa: "resultado A" } },
      { probabilidade: 0.7, impacto: { narrativa: "resultado B" } },
    ],
  };

  it("opção com um resultado garantido sempre devolve esse resultado", () => {
    const escolha = resolverEscolha(opcaoGarantida, () => Math.random());
    expect(escolha.resultado.impacto.narrativa).toBe("sempre isso");
  });

  it("respeita o random injetado: valor baixo cai no primeiro resultado, valor alto no segundo", () => {
    const baixo = resolverEscolha(opcaoProbabilistica, () => 0.1);
    const alto = resolverEscolha(opcaoProbabilistica, () => 0.9);
    expect(baixo.resultado.impacto.narrativa).toBe("resultado A");
    expect(alto.resultado.impacto.narrativa).toBe("resultado B");
  });

  it("lança erro se as probabilidades da opção não somarem 1", () => {
    const opcaoInvalida: Opcao = {
      id: "invalida",
      texto: "soma errada",
      resultados: [{ probabilidade: 0.5, impacto: { narrativa: "x" } }],
    };
    expect(() => resolverEscolha(opcaoInvalida)).toThrow(/probabilidades/);
  });
});

describe("aplicarImpacto", () => {
  function estadoBase(): EstadoJogadorParaImpacto {
    return {
      atributos: { finalizacao: 50, frieza: 50 },
      moral: 50,
      reputacao: { nacional: 50, porRegiao: {} },
      relacoesInternas: 50,
    };
  }

  it("aplica delta positivo e negativo de atributo", () => {
    const resultado = aplicarImpacto(estadoBase(), { atributos: { finalizacao: 5, frieza: -10 }, narrativa: "x" });
    expect(resultado.atributos.finalizacao).toBe(55);
    expect(resultado.atributos.frieza).toBe(40);
  });

  it("clampa atributo entre 1 e 99", () => {
    const estado: EstadoJogadorParaImpacto = { ...estadoBase(), atributos: { finalizacao: 97 } };
    const comBonusGrande = aplicarImpacto(estado, { atributos: { finalizacao: 20 }, narrativa: "x" });
    expect(comBonusGrande.atributos.finalizacao).toBe(99);

    const estadoBaixo: EstadoJogadorParaImpacto = { ...estadoBase(), atributos: { finalizacao: 3 } };
    const comPenalidadeGrande = aplicarImpacto(estadoBaixo, { atributos: { finalizacao: -20 }, narrativa: "x" });
    expect(comPenalidadeGrande.atributos.finalizacao).toBe(1);
  });

  it("clampa moral e reputação nacional entre 0 e 100", () => {
    const estado: EstadoJogadorParaImpacto = { ...estadoBase(), atributos: {}, moral: 95, reputacao: { nacional: 5, porRegiao: {} } };
    const resultado = aplicarImpacto(estado, { moral: 20, reputacao: -20, narrativa: "x" });
    expect(resultado.moral).toBe(100);
    expect(resultado.reputacao.nacional).toBe(0);
  });

  it("aplica reputação regional só quando regiaoAtual é informada", () => {
    const estado = estadoBase();
    const semRegiao = aplicarImpacto(estado, { reputacaoRegional: 10, narrativa: "x" });
    expect(semRegiao.reputacao.porRegiao).toEqual({});

    const comRegiao = aplicarImpacto(estado, { reputacaoRegional: 10, narrativa: "x" }, "SP");
    expect(comRegiao.reputacao.porRegiao.SP).toBe(10);
  });

  it("clampa reputação regional entre 0 e 100", () => {
    const estado: EstadoJogadorParaImpacto = { ...estadoBase(), reputacao: { nacional: 50, porRegiao: { SP: 95 } } };
    const resultado = aplicarImpacto(estado, { reputacaoRegional: 20, narrativa: "x" }, "SP");
    expect(resultado.reputacao.porRegiao.SP).toBe(100);
  });

  it("aplica delta de relações internas, clampado entre 0 e 100", () => {
    const estado = estadoBase();
    const resultado = aplicarImpacto(estado, { relacoesInternas: 10, narrativa: "x" });
    expect(resultado.relacoesInternas).toBe(60);

    const noTeto = aplicarImpacto({ ...estado, relacoesInternas: 95 }, { relacoesInternas: 20, narrativa: "x" });
    expect(noTeto.relacoesInternas).toBe(100);
  });

  it("não muta o estado original", () => {
    const estado = estadoBase();
    aplicarImpacto(estado, { atributos: { finalizacao: 10 }, moral: 10, reputacaoRegional: 5, narrativa: "x" }, "SP");
    expect(estado.atributos.finalizacao).toBe(50);
    expect(estado.moral).toBe(50);
    expect(estado.reputacao.porRegiao).toEqual({});
  });

  it("impacto sem atributos/moral/reputação/relações não muda nada além da narrativa", () => {
    const estado = estadoBase();
    const resultado = aplicarImpacto(estado, { narrativa: "nada acontece" });
    expect(resultado).toEqual(estado);
  });
});

describe("sortearCenario", () => {
  it("sorteia um cenário da lista", () => {
    const cenarios: Cenario[] = CENARIOS;
    const escolhido = sortearCenario(cenarios, () => 0.5);
    expect(cenarios).toContain(escolhido);
  });

  it("lança erro com lista vazia", () => {
    expect(() => sortearCenario([])).toThrow(/vazia/);
  });

  it("respeita o random injetado", () => {
    const cenarios: Cenario[] = CENARIOS;
    const primeiro = sortearCenario(cenarios, () => 0);
    expect(primeiro).toBe(cenarios[0]);
  });
});
