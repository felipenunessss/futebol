import { describe, expect, it } from "vitest";
import { calcularConfiancaDoClube, contrapropostaPadrao, negociarTransferencia, type FatoresConfianca } from "../../src/market/negotiation.js";
import type { PropostaTransferencia, TermosDeContrato } from "../../src/market/transfers.js";

function fatores(extra: Partial<FatoresConfianca> = {}): FatoresConfianca {
  return { overall: 50, reputacaoNacional: 0, concorrentes: 0, ...extra };
}

describe("contrapropostaPadrao", () => {
  it("pede mais salário e luvas que a proposta inicial, mantendo os anos", () => {
    const proposta: PropostaTransferencia = { clubeOfertanteId: "x", propostaInicial: { salarioMensal: 10_000, luvas: 50_000, anos: 3 } };
    const contra = contrapropostaPadrao(proposta);
    expect(contra.salarioMensal).toBeGreaterThan(proposta.propostaInicial.salarioMensal);
    expect(contra.luvas).toBeGreaterThan(proposta.propostaInicial.luvas);
    expect(contra.anos).toBe(3);
  });
});

describe("calcularConfiancaDoClube", () => {
  it("contraproposta igual à proposta inicial tem confiança mais alta que uma contraproposta bem maior", () => {
    const propostaClube: TermosDeContrato = { salarioMensal: 10_000, luvas: 30_000, anos: 3 };
    const contraIgual: TermosDeContrato = { ...propostaClube };
    const contraAlta: TermosDeContrato = { ...propostaClube, salarioMensal: 30_000 };

    const confiancaIgual = calcularConfiancaDoClube(propostaClube, contraIgual, fatores());
    const confiancaAlta = calcularConfiancaDoClube(propostaClube, contraAlta, fatores());

    expect(confiancaIgual).toBeGreaterThan(confiancaAlta);
  });

  it("overall mais alto aumenta a confiança, tudo mais igual", () => {
    const propostaClube: TermosDeContrato = { salarioMensal: 10_000, luvas: 30_000, anos: 3 };
    const contra: TermosDeContrato = { ...propostaClube, salarioMensal: 12_000 };

    const baixo = calcularConfiancaDoClube(propostaClube, contra, fatores({ overall: 40 }));
    const alto = calcularConfiancaDoClube(propostaClube, contra, fatores({ overall: 90 }));

    expect(alto).toBeGreaterThan(baixo);
  });

  it("mais concorrentes reduz a confiança, tudo mais igual", () => {
    const propostaClube: TermosDeContrato = { salarioMensal: 10_000, luvas: 30_000, anos: 3 };
    const contra: TermosDeContrato = { ...propostaClube, salarioMensal: 12_000 };

    const semConcorrencia = calcularConfiancaDoClube(propostaClube, contra, fatores({ concorrentes: 0 }));
    const comConcorrencia = calcularConfiancaDoClube(propostaClube, contra, fatores({ concorrentes: 3 }));

    expect(comConcorrencia).toBeLessThan(semConcorrencia);
  });

  it("fica sempre entre 0 e 100", () => {
    const propostaClube: TermosDeContrato = { salarioMensal: 10_000, luvas: 30_000, anos: 3 };
    const contraAbsurda: TermosDeContrato = { salarioMensal: 10_000_000, luvas: 1, anos: 1 };
    const contraModesta: TermosDeContrato = { salarioMensal: 10_000, luvas: 30_000, anos: 3 };

    expect(calcularConfiancaDoClube(propostaClube, contraAbsurda, fatores({ overall: 99, reputacaoNacional: 100 }))).toBeGreaterThanOrEqual(0);
    expect(calcularConfiancaDoClube(propostaClube, contraModesta, fatores({ overall: 99, reputacaoNacional: 100 }))).toBeLessThanOrEqual(100);
  });
});

describe("negociarTransferencia", () => {
  const proposta: PropostaTransferencia = { clubeOfertanteId: "novo_clube", propostaInicial: { salarioMensal: 10_000, luvas: 30_000, anos: 3 } };
  const contraproposta: TermosDeContrato = { salarioMensal: 11_000, luvas: 32_000, anos: 3 };

  it("random baixo (abaixo da confiança) aceita, e monta o contrato com os termos da contraproposta", () => {
    const resultado = negociarTransferencia(proposta, contraproposta, fatores({ overall: 80 }), 2027, () => 0);
    expect(resultado.aceito).toBe(true);
    expect(resultado.contrato).toBeDefined();
    expect(resultado.contrato!.clubeId).toBe("novo_clube");
    expect(resultado.contrato!.salarioMensal).toBe(11_000);
    expect(resultado.contrato!.luvas).toBe(32_000);
    expect(resultado.contrato!.anos).toBe(3);
    expect(resultado.contrato!.temporadaAssinatura).toBe(2027);
  });

  it("random alto (acima da confiança) recusa, sem contrato", () => {
    const resultado = negociarTransferencia(proposta, contraproposta, fatores({ overall: 30 }), 2027, () => 0.99);
    expect(resultado.aceito).toBe(false);
    expect(resultado.contrato).toBeUndefined();
  });

  it("cláusula de rescisão é derivada do salário e dos anos de contrato", () => {
    const resultado = negociarTransferencia(proposta, contraproposta, fatores({ overall: 80 }), 2027, () => 0);
    expect(resultado.contrato!.clausulaRescisao).toBe(11_000 * 12 * (3 + 1));
  });
});
