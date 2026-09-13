import { describe, expect, it } from "vitest";
import type { FaseSuica } from "../../src/schemas/championship.js";
import { construirPotePorTime, gerarConfrontosFaseSuica, selecionarClassificadosFaseSuica, simularFaseSuica } from "../../src/simulation/swiss.js";
import { buscarArquetipo, type Jogador } from "../../src/schemas/player.js";
import type { ParticipacaoJogadorClube } from "../../src/simulation/match.js";
import { linhaVazia, type LinhaTabela } from "../../src/simulation/season.js";

// 8 times, 2 potes de 4 — cada time joga só contra os 4 de FORA do próprio pote (nunca dentro dele).
const times = ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4"];
const formato: FaseSuica = { num_potes: 2, times_por_pote: 4, jogos_por_time: 4, classificam_mata_mata: 4 };
const poteA = new Set(["a1", "a2", "a3", "a4"]);

describe("gerarConfrontosFaseSuica", () => {
  it("nenhum time joga contra outro do próprio pote", () => {
    const confrontos = gerarConfrontosFaseSuica(times, formato, () => Math.random());
    for (const c of confrontos) {
      const mesmoDoPoteA = poteA.has(c.mandante) && poteA.has(c.visitante);
      const mesmoDoPoteB = !poteA.has(c.mandante) && !poteA.has(c.visitante);
      expect(mesmoDoPoteA || mesmoDoPoteB, `${c.mandante} x ${c.visitante} não deveria ser dentro do mesmo pote`).toBe(false);
    }
  });

  it("cada time joga exatamente uma vez contra cada time de fora do próprio pote", () => {
    const confrontos = gerarConfrontosFaseSuica(times, formato, () => Math.random());
    for (const time of times) {
      const adversarios = confrontos.filter((c) => c.mandante === time || c.visitante === time).map((c) => (c.mandante === time ? c.visitante : c.mandante));
      const esperados = times.filter((t) => t !== time && poteA.has(t) !== poteA.has(time));
      expect(new Set(adversarios)).toEqual(new Set(esperados));
    }
  });

  it("nenhum confronto repete o mesmo par de times duas vezes", () => {
    const confrontos = gerarConfrontosFaseSuica(times, formato, () => Math.random());
    const chaves = confrontos.map((c) => [c.mandante, c.visitante].sort().join("|"));
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("nenhum time enfrenta a si mesmo", () => {
    const confrontos = gerarConfrontosFaseSuica(times, formato, () => Math.random());
    for (const c of confrontos) {
      expect(c.mandante).not.toBe(c.visitante);
      expect(times).toContain(c.mandante);
      expect(times).toContain(c.visitante);
    }
  });

  it("lança erro se o número de times não bater com num_potes × times_por_pote", () => {
    expect(() => gerarConfrontosFaseSuica(times.slice(0, 7), formato)).toThrow();
  });

  it("lança erro se jogos_por_time não bater com total_times - times_por_pote (só jogo cruzado)", () => {
    const formatoInvalido: FaseSuica = { ...formato, jogos_por_time: 5 };
    expect(() => gerarConfrontosFaseSuica(times, formatoInvalido)).toThrow(/jogos_por_time/);
  });

  it("nenhum time joga 2 vezes na mesma rodada", () => {
    const confrontos = gerarConfrontosFaseSuica(times, formato, () => Math.random());
    const timesPorRodada = new Map<number, string[]>();
    for (const c of confrontos) {
      const lista = timesPorRodada.get(c.rodada) ?? [];
      lista.push(c.mandante, c.visitante);
      timesPorRodada.set(c.rodada, lista);
    }
    for (const [rodada, timesDaRodada] of timesPorRodada) {
      expect(new Set(timesDaRodada).size, `rodada ${rodada} repete algum time`).toBe(timesDaRodada.length);
    }
  });

  it("fecha no número mínimo de rodadas (= jogos_por_time, 1 jogo por time por rodada)", () => {
    const confrontos = gerarConfrontosFaseSuica(times, formato, () => Math.random());
    const totalRodadas = Math.max(...confrontos.map((c) => c.rodada));
    expect(totalRodadas).toBe(formato.jogos_por_time);
  });

  it("bate com o formato real do Paulistão A1 2025 (4 potes de 4, 12 jogos/time, 12 rodadas mínimas)", () => {
    const times16 = Array.from({ length: 16 }, (_, i) => `t${i}`);
    const formatoPaulistao: FaseSuica = { num_potes: 4, times_por_pote: 4, jogos_por_time: 12, classificam_mata_mata: 8 };
    const confrontos = gerarConfrontosFaseSuica(times16, formatoPaulistao, () => Math.random());
    const totalRodadas = Math.max(...confrontos.map((c) => c.rodada));
    expect(totalRodadas).toBe(12);
    for (const time of times16) {
      const jogos = confrontos.filter((c) => c.mandante === time || c.visitante === time);
      expect(jogos).toHaveLength(12);
    }
  });
});

describe("selecionarClassificadosFaseSuica", () => {
  function linha(clubeId: string, pontos: number): LinhaTabela {
    const l = linhaVazia(clubeId);
    l.pontos = pontos;
    return l;
  }

  it("sem classificacao_por_pote, usa top-N simples da tabela geral (ex: Paraense real)", () => {
    const tabela = [linha("a1", 20), linha("b1", 18), linha("a2", 16), linha("b2", 14)];
    const potePorTime = construirPotePorTime(["a1", "a2", "b1", "b2"], 2, 2);
    const classificados = selecionarClassificadosFaseSuica(tabela, potePorTime, { classificam_mata_mata: 2, classificacao_por_pote: undefined });
    expect(classificados).toEqual(["a1", "b1"]);
  });

  it("com vagas_por_pote (Paulistão real: top-2 de cada um dos 2 grupos)", () => {
    // grupo A domina a tabela geral (top 4), mas só 2 por grupo podem classificar.
    const tabela = [linha("a1", 30), linha("a2", 28), linha("a3", 26), linha("a4", 24), linha("b1", 22), linha("b2", 20)];
    const potePorTime = construirPotePorTime(["a1", "a2", "a3", "a4", "b1", "b2"], 2, 3);
    const classificados = selecionarClassificadosFaseSuica(tabela, potePorTime, {
      classificam_mata_mata: 4,
      classificacao_por_pote: { vagas_por_pote: 2, vagas_extras_melhor_geral: 0 },
    });
    // pote 0 = a1,a2,a3 (todos do grupo A); pote 1 = a4,b1,b2 — top 2 de cada, na ordem da tabela geral.
    expect(classificados).toEqual(["a1", "a2", "a4", "b1"]);
  });

  it("com vagas_extras_melhor_geral (Mineiro/Gauchão reais: líder de cada grupo + melhor 2º geral)", () => {
    const tabela = [linha("a1", 30), linha("b1", 28), linha("c1", 26), linha("a2", 24), linha("b2", 22), linha("c2", 20)];
    const potePorTime = construirPotePorTime(["a1", "a2", "b1", "b2", "c1", "c2"], 3, 2);
    const classificados = selecionarClassificadosFaseSuica(tabela, potePorTime, {
      classificam_mata_mata: 4,
      classificacao_por_pote: { vagas_por_pote: 1, vagas_extras_melhor_geral: 1 },
    });
    // líderes: a1, b1, c1 (1º de cada grupo, na ordem da tabela geral) + melhor 2º geral (a2, à frente de b2/c2)
    expect(classificados).toEqual(["a1", "b1", "c1", "a2"]);
  });
});

describe("simularFaseSuica", () => {
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("gera tabela com uma linha por time e classifica classificam_mata_mata", async () => {
    const resultado = await simularFaseSuica(times, formato, ratings, () => Math.random());
    expect(resultado.tabela).toHaveLength(8);
    expect(resultado.classificados).toHaveLength(4);
  });

  it("sem classificacao_por_pote, classificados vêm do topo da tabela", async () => {
    const resultado = await simularFaseSuica(times, formato, ratings, () => Math.random());
    expect(resultado.classificados).toEqual(resultado.tabela.slice(0, 4).map((l) => l.clubeId));
  });

  it("sem participacaoJogador, partidasDoJogador fica ausente", async () => {
    const resultado = await simularFaseSuica(times, formato, ratings, () => Math.random());
    expect(resultado.partidasDoJogador).toBeUndefined();
  });

  it("com participacaoJogador, retorna uma entrada por partida do clube dele", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: {} };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a1", jogador, estiloTecnico: "equilibrado" };

    const resultado = await simularFaseSuica(times, formato, ratings, () => Math.random(), participacao);
    const jogosDeA1 = resultado.confrontos.filter((c) => c.mandante === "a1" || c.visitante === "a1").length;

    expect(resultado.partidasDoJogador).toHaveLength(jogosDeA1);
    for (const { confronto } of resultado.partidasDoJogador!) {
      expect(confronto.mandante === "a1" || confronto.visitante === "a1").toBe(true);
    }
  });
});
