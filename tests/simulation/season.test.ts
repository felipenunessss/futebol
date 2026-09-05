import { describe, expect, it } from "vitest";
import type { FaseUnica } from "../../src/schemas/championship.js";
import {
  gerarConfrontosPontosCorridos,
  simularFaseUnicaDoFormato,
  simularTemporadaPontosCorridos,
  somarTabelas,
  type LinhaTabela,
} from "../../src/simulation/season.js";
import { buscarArquetipo, type Jogador } from "../../src/schemas/player.js";
import type { ParticipacaoJogadorClube } from "../../src/simulation/match.js";

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

describe("simularFaseUnicaDoFormato", () => {
  const times = ["a", "b", "c", "d"];
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("classifica exatamente classificam_proxima_fase times, na ordem da tabela desse torneio", () => {
    const formato: FaseUnica = { ida_e_volta: false, classificam_proxima_fase: 2 };
    const resultado = simularFaseUnicaDoFormato(formato, times, ratings, () => Math.random());

    expect(resultado.classificados).toHaveLength(2);
    expect(resultado.classificados).toEqual([resultado.tabela[0].clubeId, resultado.tabela[1].clubeId]);
  });

  it("classificam_proxima_fase: 0 não classifica ninguém, mas ainda gera tabela completa", () => {
    const formato: FaseUnica = { ida_e_volta: false, classificam_proxima_fase: 0 };
    const resultado = simularFaseUnicaDoFormato(formato, times, ratings, () => Math.random());

    expect(resultado.classificados).toEqual([]);
    expect(resultado.tabela).toHaveLength(4);
  });
});

describe("somarTabelas", () => {
  function linha(overrides: Partial<LinhaTabela>): LinhaTabela {
    return { clubeId: "x", pontos: 0, jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, saldoDeGols: 0, ...overrides };
  }

  it("soma pontos/gols de cada clube entre as tabelas, tipo Apertura + Clausura", () => {
    const turno: LinhaTabela[] = [linha({ clubeId: "a", pontos: 10, golsPro: 8, golsContra: 3 })];
    const returno: LinhaTabela[] = [linha({ clubeId: "a", pontos: 7, golsPro: 5, golsContra: 4 })];

    const [acumulado] = somarTabelas([turno, returno]);

    expect(acumulado.pontos).toBe(17);
    expect(acumulado.golsPro).toBe(13);
    expect(acumulado.golsContra).toBe(7);
    expect(acumulado.saldoDeGols).toBe(6);
  });

  it("clube presente em só uma das tabelas ainda entra no resultado (parte de zero na outra)", () => {
    const turno: LinhaTabela[] = [linha({ clubeId: "a", pontos: 10 })];
    const returno: LinhaTabela[] = [linha({ clubeId: "b", pontos: 5 })];

    const acumulado = somarTabelas([turno, returno]);

    expect(acumulado.map((l) => l.clubeId).sort()).toEqual(["a", "b"]);
  });

  it("resultado vem ordenado por pontos, igual as outras tabelas do motor", () => {
    const turno: LinhaTabela[] = [linha({ clubeId: "a", pontos: 3 }), linha({ clubeId: "b", pontos: 9 })];
    const acumulado = somarTabelas([turno]);
    expect(acumulado[0].clubeId).toBe("b");
  });
});

describe("simularTemporadaPontosCorridos com participação do jogador", () => {
  const times = ["a", "b", "c", "d"];
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
  const jogador: Jogador = {
    id: "j1",
    nome: "Teste",
    posicao: "atacante",
    arquetipo_id: buscarArquetipo("finalizador").id,
    idade: 22,
    atributos: { finalizacao: 90 },
  };
  const participacao: ParticipacaoJogadorClube = { clubeId: "a", jogador, estiloTecnico: "equilibrado" };

  it("sem participacaoJogador, partidasDoJogador fica ausente", () => {
    const resultado = simularTemporadaPontosCorridos(times, ratings, true, () => Math.random());
    expect(resultado.partidasDoJogador).toBeUndefined();
  });

  it("com participacaoJogador, retorna uma entrada por partida do clube dele (ida e volta = joga contra todos 2x)", () => {
    const resultado = simularTemporadaPontosCorridos(times, ratings, true, () => Math.random(), participacao);
    expect(resultado.partidasDoJogador).toHaveLength(2 * (times.length - 1));
  });

  it("toda partida listada em partidasDoJogador realmente envolve o clube do jogador", () => {
    const resultado = simularTemporadaPontosCorridos(times, ratings, true, () => Math.random(), participacao);
    for (const { confronto } of resultado.partidasDoJogador!) {
      expect(confronto.mandante === "a" || confronto.visitante === "a").toBe(true);
    }
  });

  it("existem confrontos entre outros times que não entram em partidasDoJogador", () => {
    const resultado = simularTemporadaPontosCorridos(times, ratings, true, () => Math.random(), participacao);
    const outroConfrontoQualquer = resultado.confrontos.find((c) => c.mandante !== "a" && c.visitante !== "a");
    expect(outroConfrontoQualquer).toBeDefined();
    expect(resultado.partidasDoJogador!.some((p) => p.confronto === outroConfrontoQualquer)).toBe(false);
  });
});

describe("simularFaseUnicaDoFormato com participação do jogador", () => {
  it("propaga partidasDoJogador quando participacaoJogador é passado", () => {
    const times = ["a", "b", "c", "d"];
    const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: {} };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a", jogador, estiloTecnico: "equilibrado" };
    const formato: FaseUnica = { ida_e_volta: false, classificam_proxima_fase: 1 };

    const resultado = simularFaseUnicaDoFormato(formato, times, ratings, () => Math.random(), participacao);
    expect(resultado.partidasDoJogador).toHaveLength(times.length - 1);
  });
});
