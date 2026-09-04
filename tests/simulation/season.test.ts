import { describe, expect, it } from "vitest";
import { gerarConfrontosPontosCorridos, simularTemporadaPontosCorridos } from "../../src/simulation/season.js";

describe("gerarConfrontosPontosCorridos", () => {
  it("turno único com número par de times: cada time joga contra todos os outros exatamente uma vez", () => {
    const times = ["a", "b", "c", "d"];
    const confrontos = gerarConfrontosPontosCorridos(times, false);

    expect(confrontos).toHaveLength((4 * 3) / 2); // 6 jogos
    for (const time of times) {
      const jogosDoTime = confrontos.filter((c) => c.mandante === time || c.visitante === time);
      expect(jogosDoTime).toHaveLength(3); // joga contra os outros 3, uma vez
    }
  });

  it("ida e volta dobra o número de confrontos e inverte mando de campo", () => {
    const times = ["a", "b", "c", "d"];
    const turnoUnico = gerarConfrontosPontosCorridos(times, false);
    const idaEVolta = gerarConfrontosPontosCorridos(times, true);

    expect(idaEVolta).toHaveLength(turnoUnico.length * 2);
  });

  it("número ímpar de times: ninguém joga contra o BYE fantasma, e cada time folga uma rodada", () => {
    const times = ["a", "b", "c"];
    const confrontos = gerarConfrontosPontosCorridos(times, false);

    for (const confronto of confrontos) {
      expect(times).toContain(confronto.mandante);
      expect(times).toContain(confronto.visitante);
    }
    // 3 times, turno único: cada um joga contra os outros 2 = 3 jogos no total
    expect(confrontos).toHaveLength(3);
  });

  it("menos de 2 times não gera confronto nenhum", () => {
    expect(gerarConfrontosPontosCorridos(["a"], true)).toEqual([]);
    expect(gerarConfrontosPontosCorridos([], true)).toEqual([]);
  });

  it("nenhum time enfrenta a si mesmo", () => {
    const confrontos = gerarConfrontosPontosCorridos(["a", "b", "c", "d", "e"], true);
    for (const confronto of confrontos) {
      expect(confronto.mandante).not.toBe(confronto.visitante);
    }
  });
});

describe("simularTemporadaPontosCorridos", () => {
  const times = ["a", "b", "c", "d"];
  const ratingsIguais = Object.fromEntries(times.map((t) => [t, 1600]));

  it("tabela tem uma linha por time, todas com o mesmo número de jogos", () => {
    const { tabela } = simularTemporadaPontosCorridos(times, ratingsIguais, true, () => 0.5);
    expect(tabela).toHaveLength(4);
    const jogosPorTime = new Set(tabela.map((l) => l.jogos));
    expect(jogosPorTime.size).toBe(1); // todo mundo jogou o mesmo número de partidas
  });

  it("tabela vem ordenada por pontos (decrescente)", () => {
    const { tabela } = simularTemporadaPontosCorridos(times, ratingsIguais, true, () => Math.random());
    for (let i = 1; i < tabela.length; i++) {
      expect(tabela[i - 1].pontos).toBeGreaterThanOrEqual(tabela[i].pontos);
    }
  });

  it("time com rating muito mais alto tende a terminar em 1º", () => {
    const ratings = { ...ratingsIguais, a: 2200 };
    const { tabela } = simularTemporadaPontosCorridos(times, ratings, true, () => 0.4);
    expect(tabela[0].clubeId).toBe("a");
  });

  it("pontos = 3×vitórias + 1×empates, consistente com jogos = vitórias+empates+derrotas", () => {
    const { tabela } = simularTemporadaPontosCorridos(times, ratingsIguais, true, () => Math.random());
    for (const linha of tabela) {
      expect(linha.pontos).toBe(linha.vitorias * 3 + linha.empates);
      expect(linha.jogos).toBe(linha.vitorias + linha.empates + linha.derrotas);
      expect(linha.saldoDeGols).toBe(linha.golsPro - linha.golsContra);
    }
  });
});
