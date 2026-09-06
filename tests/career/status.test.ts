import { describe, expect, it } from "vitest";
import {
  evoluirStatus,
  indiceDoStatus,
  minutosEsperadosPorStatus,
  multiplicadorDeValorizacaoPorStatus,
  statusMinimoPorIdade,
  statusOferecido,
  type FatoresDeOferta,
} from "../../src/career/status.js";

describe("indiceDoStatus", () => {
  it("ordena promessa < reserva < titular < idolo", () => {
    expect(indiceDoStatus("promessa")).toBeLessThan(indiceDoStatus("reserva"));
    expect(indiceDoStatus("reserva")).toBeLessThan(indiceDoStatus("titular"));
    expect(indiceDoStatus("titular")).toBeLessThan(indiceDoStatus("idolo"));
  });
});

describe("statusMinimoPorIdade", () => {
  it("até 22 anos, promessa é permitida", () => {
    expect(statusMinimoPorIdade(18)).toBe("promessa");
    expect(statusMinimoPorIdade(22)).toBe("promessa");
  });

  it("acima de 22 anos, o piso sobe pra reserva", () => {
    expect(statusMinimoPorIdade(23)).toBe("reserva");
    expect(statusMinimoPorIdade(35)).toBe("reserva");
  });
});

describe("minutosEsperadosPorStatus", () => {
  it("cresce com o status, em média (promessa < reserva < titular)", () => {
    const media = (status: Parameters<typeof minutosEsperadosPorStatus>[0], n = 500) => {
      let soma = 0;
      for (let i = 0; i < n; i++) soma += minutosEsperadosPorStatus(status, () => i / n);
      return soma / n;
    };

    expect(media("promessa")).toBeLessThan(media("reserva"));
    expect(media("reserva")).toBeLessThan(media("titular"));
  });

  it("varia dentro da faixa conforme o random injetado (não é mais um valor fixo)", () => {
    const minimo = minutosEsperadosPorStatus("reserva", () => 0);
    const maximo = minutosEsperadosPorStatus("reserva", () => 0.999);
    expect(maximo).toBeGreaterThan(minimo);
  });

  it("titular pode variar (não é sempre exatamente 90)", () => {
    const baixo = minutosEsperadosPorStatus("titular", () => 0);
    const alto = minutosEsperadosPorStatus("titular", () => 1);
    expect(alto).toBeGreaterThan(baixo);
  });
});

describe("multiplicadorDeValorizacaoPorStatus", () => {
  it("titular vale mais que reserva/promessa, idolo vale mais que titular", () => {
    expect(multiplicadorDeValorizacaoPorStatus("titular")).toBeGreaterThan(multiplicadorDeValorizacaoPorStatus("reserva"));
    expect(multiplicadorDeValorizacaoPorStatus("reserva")).toBeGreaterThan(multiplicadorDeValorizacaoPorStatus("promessa"));
    expect(multiplicadorDeValorizacaoPorStatus("idolo")).toBeGreaterThan(multiplicadorDeValorizacaoPorStatus("titular"));
  });
});

describe("evoluirStatus", () => {
  it("nota média alta promove 1 degrau", () => {
    expect(evoluirStatus("reserva", 8, 20)).toBe("titular");
  });

  it("nota média baixa rebaixa 1 degrau", () => {
    expect(evoluirStatus("titular", 3, 25)).toBe("reserva");
  });

  it("nota média intermediária mantém o status", () => {
    expect(evoluirStatus("reserva", 6, 20)).toBe("reserva");
  });

  it("não promove além de idolo nem rebaixa abaixo de promessa", () => {
    expect(evoluirStatus("idolo", 9, 25)).toBe("idolo");
    expect(evoluirStatus("promessa", 2, 20)).toBe("promessa");
  });

  it("acima de 22 anos, nunca fica 'promessa' mesmo com nota baixa", () => {
    expect(evoluirStatus("reserva", 2, 25)).toBe("reserva"); // rebaixaria pra promessa, mas o piso por idade impede
    expect(evoluirStatus("promessa", 8, 25)).toBe("reserva"); // promoveria só pra reserva mesmo (não pula pra titular)
  });
});

describe("statusOferecido", () => {
  function fatores(overrides: Partial<FatoresDeOferta> = {}): FatoresDeOferta {
    return { idadeJogador: 20, ratingClubeAtual: 1600, ratingClubeOfertante: 1600, faseDaEquipe: 0, ...overrides };
  }

  it("clube bem mais forte que o atual (rating), tudo mais neutro, oferece 1 degrau abaixo", () => {
    expect(statusOferecido("titular", fatores({ ratingClubeAtual: 1500, ratingClubeOfertante: 1700 }))).toBe("reserva");
  });

  it("clube bem mais fraco que o atual, tudo mais neutro, oferece 1 degrau acima", () => {
    expect(statusOferecido("reserva", fatores({ ratingClubeAtual: 1900, ratingClubeOfertante: 1500 }))).toBe("titular");
  });

  it("clube parecido em rating, sem concorrência nem fase, mantém o mesmo status", () => {
    expect(statusOferecido("titular", fatores())).toBe("titular");
  });

  it("concorrência alta (clube muito rico) sozinha pode empurrar o status pra baixo", () => {
    expect(statusOferecido("titular", fatores({ concorrenciaDoClube: "muito_alta" }))).toBe("reserva");
  });

  it("concorrência baixa (clube modesto) sozinha pode empurrar o status pra cima", () => {
    expect(statusOferecido("reserva", fatores({ concorrenciaDoClube: "muito_baixa" }))).toBe("titular");
  });

  it("fase ruim do clube ofertante (crise) sozinha pode empurrar o status pra cima", () => {
    expect(statusOferecido("reserva", fatores({ faseDaEquipe: -1 }))).toBe("titular");
  });

  it("fase ótima do clube ofertante sozinha pode empurrar o status pra baixo", () => {
    expect(statusOferecido("titular", fatores({ faseDaEquipe: 1 }))).toBe("reserva");
  });

  it("fatores podem se contrabalançar (rating levemente desfavorável + concorrência baixa cancelando)", () => {
    // clube um pouco mais forte (sozinho já rebaixaria) mas concorrência baixa (sozinha promoveria) — cancelam, mantém
    expect(statusOferecido("titular", fatores({ ratingClubeAtual: 1600, ratingClubeOfertante: 1750, concorrenciaDoClube: "muito_baixa" }))).toBe("titular");
  });

  it("nunca passa de idolo nem cai abaixo de promessa mesmo com score extremo", () => {
    expect(statusOferecido("idolo", fatores({ ratingClubeAtual: 1500, ratingClubeOfertante: 2200 }))).toBe("titular");
    expect(statusOferecido("promessa", fatores({ ratingClubeAtual: 1900, ratingClubeOfertante: 900 }))).toBe("reserva");
  });

  it("início de carreira (ratingClubeAtual 0) sempre mantém promessa pra jogador jovem, mesmo clube fraco", () => {
    expect(statusOferecido("promessa", fatores({ idadeJogador: 18, ratingClubeAtual: 0, ratingClubeOfertante: 900 }))).toBe("promessa");
  });

  it("piso por idade também vale na oferta: jogador com mais de 22 anos nunca recebe oferta de promessa", () => {
    expect(statusOferecido("promessa", fatores({ idadeJogador: 25, ratingClubeAtual: 0, ratingClubeOfertante: 900 }))).toBe("reserva");
  });
});
