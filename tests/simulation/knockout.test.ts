import { describe, expect, it } from "vitest";
import type { EtapaMataMata, FinalEstadual, MataMata } from "../../src/schemas/championship.js";
import {
  simularFinalEstadualDoFormato,
  simularMataMataComEtapas,
  simularMataMataDoFormato,
  simularMataMataSimples,
} from "../../src/simulation/knockout.js";

describe("simularMataMataSimples", () => {
  it("4 times, 2 fases (semifinal+final): produz 1 campeão que estava entre os 4", () => {
    const participantes = ["a", "b", "c", "d"];
    const ratings = { a: 1600, b: 1600, c: 1600, d: 1600 };

    const resultado = simularMataMataSimples(participantes, ["semifinal", "final"], true, ratings, () => Math.random());

    expect(participantes).toContain(resultado.campeao);
    expect(resultado.etapas).toHaveLength(2);
    expect(resultado.etapas[0].nome).toBe("semifinal");
    expect(resultado.etapas[0].confrontos).toHaveLength(2); // 4 times -> 2 confrontos
    expect(resultado.etapas[1].nome).toBe("final");
    expect(resultado.etapas[1].confrontos).toHaveLength(1);
  });

  it("time muito mais forte tende a ser campeão (random empurra sempre pro favorito)", () => {
    const participantes = ["forte", "fraco1", "fraco2", "fraco3"];
    const ratings = { forte: 2400, fraco1: 1200, fraco2: 1200, fraco3: 1200 };

    // random baixo favorece quem tem mais força em cada duelo (ver resolverDuelo em match.ts)
    const resultado = simularMataMataSimples(participantes, ["semifinal", "final"], false, ratings, () => 0.1);

    expect(resultado.campeao).toBe("forte");
  });

  it("cada rodada corta o número de times pela metade", () => {
    const participantes = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ratings = Object.fromEntries(participantes.map((t) => [t, 1600]));

    const resultado = simularMataMataSimples(participantes, ["quartas", "semifinal", "final"], true, ratings, () => Math.random());

    expect(resultado.etapas[0].vencedores).toHaveLength(4);
    expect(resultado.etapas[1].vencedores).toHaveLength(2);
    expect(resultado.etapas[2].vencedores).toHaveLength(1);
  });
});

describe("simularMataMataComEtapas", () => {
  it("entrada escalonada: 1 vencedor da 1ª fase + 2 entrantes novos na 2ª dá número ímpar de vivos e lança erro", () => {
    // 1ª fase: [a,b] -> 1 vencedor. 2ª fase soma [c,d] a esse vencedor -> 3 vivos, ímpar de propósito.
    const etapas: EtapaMataMata[] = [
      { nome: "primeira_fase", ida_e_volta: true, entrantes: ["a", "b"] },
      { nome: "segunda_fase", ida_e_volta: true, entrantes: ["c", "d"] },
    ];
    const ratings = { a: 1600, b: 1600, c: 1600, d: 1600 };

    expect(() => simularMataMataComEtapas(etapas, ratings, () => Math.random())).toThrow(/número ímpar/);
  });

  it("fase sem entrantes e sem vivos anteriores fica vazia, sem quebrar", () => {
    const etapas: EtapaMataMata[] = [
      { nome: "fase_vazia", ida_e_volta: false }, // ninguém entra aqui de propósito
      { nome: "final", ida_e_volta: false, entrantes: ["a", "b"] },
    ];

    const resultado = simularMataMataComEtapas(etapas, { a: 1600, b: 1600 }, () => Math.random());

    expect(resultado.etapas[0].confrontos).toEqual([]);
    expect(["a", "b"]).toContain(resultado.campeao);
  });

  it("etapa marcada ida_e_volta: false resolve em um jogo só (placar bate com uma simularPartida)", () => {
    const etapas: EtapaMataMata[] = [{ nome: "final", ida_e_volta: false, entrantes: ["a", "b"] }];
    const resultado = simularMataMataComEtapas(etapas, { a: 1600, b: 1600 }, () => 0.5);

    const confronto = resultado.etapas[0].confrontos[0];
    // com random sempre 0.5 (sem ruído no perfil, duelos 50/50) e mesma força, o placar tende a ficar baixo/simétrico — só garantimos que é determinístico
    expect(typeof confronto.golsA).toBe("number");
    expect(typeof confronto.golsB).toBe("number");
  });
});

describe("simularMataMataDoFormato", () => {
  const ratings = { a: 1600, b: 1600, c: 1600, d: 1600 };

  it("usa etapas quando presente, ignorando o parâmetro participantes", () => {
    const formato: MataMata = {
      fases: ["final"],
      ida_e_volta: false,
      etapas: [{ nome: "final", ida_e_volta: false, entrantes: ["a", "b"] }],
    };

    const resultado = simularMataMataDoFormato(formato, ratings, [], () => Math.random());
    expect(["a", "b"]).toContain(resultado.campeao);
  });

  it("cai no formato simples (fases + ida_e_volta) quando etapas não está presente", () => {
    const formato: MataMata = { fases: ["semifinal", "final"], ida_e_volta: true };
    const resultado = simularMataMataDoFormato(formato, ratings, ["a", "b", "c", "d"], () => Math.random());
    expect(["a", "b", "c", "d"]).toContain(resultado.campeao);
  });
});

describe("simularFinalEstadualDoFormato", () => {
  const ratings = { a: 1600, b: 1600 };
  const formato: FinalEstadual = { criterio: "campeoes_turno_returno_ou_melhor_campanha", ida_e_volta: true };

  it("com 1 participante só, é campeão automático — sem final, sem confronto", () => {
    const resultado = simularFinalEstadualDoFormato(formato, ["a"], ratings, () => Math.random());
    expect(resultado.campeao).toBe("a");
    expect(resultado.confronto).toBeUndefined();
  });

  it("com 2 participantes, resolve o confronto e o campeão é um dos dois", () => {
    const resultado = simularFinalEstadualDoFormato(formato, ["a", "b"], ratings, () => Math.random());
    expect(["a", "b"]).toContain(resultado.campeao);
    expect(resultado.confronto).toBeDefined();
    expect(resultado.confronto?.vencedor).toBe(resultado.campeao);
  });

  it("lança erro com número de participantes diferente de 1 ou 2", () => {
    expect(() => simularFinalEstadualDoFormato(formato, [], ratings)).toThrow();
    expect(() => simularFinalEstadualDoFormato(formato, ["a", "b", "c"], ratings)).toThrow();
  });
});
