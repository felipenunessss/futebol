import { describe, expect, it } from "vitest";
import {
  evoluirStatus,
  indiceDoStatus,
  minutosEsperadosPorStatus,
  multiplicadorDeValorizacaoPorStatus,
  statusOferecido,
} from "../../src/career/status.js";

describe("indiceDoStatus", () => {
  it("ordena promessa < reserva < titular < idolo", () => {
    expect(indiceDoStatus("promessa")).toBeLessThan(indiceDoStatus("reserva"));
    expect(indiceDoStatus("reserva")).toBeLessThan(indiceDoStatus("titular"));
    expect(indiceDoStatus("titular")).toBeLessThan(indiceDoStatus("idolo"));
  });
});

describe("minutosEsperadosPorStatus", () => {
  it("cresce com o status (promessa joga menos que titular)", () => {
    expect(minutosEsperadosPorStatus("promessa")).toBeLessThan(minutosEsperadosPorStatus("reserva"));
    expect(minutosEsperadosPorStatus("reserva")).toBeLessThan(minutosEsperadosPorStatus("titular"));
    expect(minutosEsperadosPorStatus("titular")).toBeLessThanOrEqual(90);
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
    expect(evoluirStatus("reserva", 8)).toBe("titular");
  });

  it("nota média baixa rebaixa 1 degrau", () => {
    expect(evoluirStatus("titular", 3)).toBe("reserva");
  });

  it("nota média intermediária mantém o status", () => {
    expect(evoluirStatus("reserva", 6)).toBe("reserva");
  });

  it("não promove além de idolo nem rebaixa abaixo de promessa", () => {
    expect(evoluirStatus("idolo", 9)).toBe("idolo");
    expect(evoluirStatus("promessa", 2)).toBe("promessa");
  });
});

describe("statusOferecido", () => {
  it("clube bem mais forte que o atual oferece status igual ou 1 degrau abaixo", () => {
    expect(statusOferecido("titular", 1500, 1700)).toBe("reserva");
  });

  it("clube bem mais fraco que o atual oferece status igual ou 1 degrau acima", () => {
    expect(statusOferecido("reserva", 1900, 1500)).toBe("titular");
  });

  it("clube parecido mantém o mesmo status", () => {
    expect(statusOferecido("titular", 1600, 1650)).toBe("titular");
  });

  it("não passa de idolo nem cai abaixo de promessa mesmo com diferença grande", () => {
    expect(statusOferecido("idolo", 1500, 2000)).toBe("titular"); // 1 degrau abaixo de idolo
    expect(statusOferecido("promessa", 1500, 1000)).toBe("reserva"); // 1 degrau acima de promessa
  });

  it("início de carreira (ratingClubeAtual 0) sempre mantém promessa, mesmo clube fraco", () => {
    expect(statusOferecido("promessa", 0, 1200)).toBe("promessa");
    expect(statusOferecido("promessa", 0, 900)).toBe("promessa");
  });
});
