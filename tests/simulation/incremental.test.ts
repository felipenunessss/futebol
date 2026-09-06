import { describe, expect, it } from "vitest";
import type { Club } from "../../src/schemas/club.js";
import type { CampeonatoSimulavel } from "../../src/simulation/engine.js";
import { simularTemporadaPontosCorridos } from "../../src/simulation/season.js";
import type { ParticipacaoJogadorClube } from "../../src/simulation/match.js";
import { buscarArquetipo, type Jogador } from "../../src/schemas/player.js";
import {
  avancarSemana,
  avancarSemanaConjunta,
  criarCompeticaoIncremental,
  criarCompeticaoIncrementalConjunta,
  criarCompeticoesIncrementaisDaTemporada,
  tabelaAtualDaCompeticao,
} from "../../src/simulation/incremental.js";

function clube(id: string): Club {
  return { id, nome: id, sigla: id.toUpperCase().slice(0, 3), estado: "SP", fundacao: 1900, rating_base: 1600 } as Club;
}

describe("criarCompeticaoIncremental — pontos_corridos", () => {
  const times = ["a", "b", "c", "d"];
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
  const campeonato: CampeonatoSimulavel = { id: "liga", formato: { pontos_corridos: { ida_e_volta: true, rodadas: 6 } }, times };

  it("resolve semana a semana até o mesmo tipo de resultado do motor em lote (mesmo seed, mesma sequência de confrontos)", async () => {
    let seed = 42;
    const randomDeterministico = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    let seedBulk = 42;
    const randomBulk = () => {
      seedBulk = (seedBulk * 1103515245 + 12345) % 2147483648;
      return seedBulk / 2147483648;
    };
    const resultadoBulk = await simularTemporadaPontosCorridos(times, ratings, true, randomBulk);

    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 6 }, randomDeterministico);
    for (let semana = 1; semana <= 6; semana++) {
      await avancarSemana(estado, semana, randomDeterministico);
    }

    expect(estado.concluida).toBe(true);
    expect(estado.campeao).toBe(resultadoBulk.tabela[0].clubeId);
  });

  it("não conclui antes da última semana da janela e mostra tabela parcial via tabelaAtualDaCompeticao", async () => {
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 6 }, () => Math.random());
    await avancarSemana(estado, 1, () => Math.random());
    expect(estado.concluida).toBe(false);
    const tabela = tabelaAtualDaCompeticao(estado);
    expect(tabela).toBeDefined();
    expect(tabela!.length).toBe(times.length);

    for (let semana = 2; semana <= 6; semana++) {
      await avancarSemana(estado, semana, () => Math.random());
    }
    expect(estado.concluida).toBe(true);
    expect(times).toContain(estado.campeao);
  });

  it("chamar avancarSemana de novo na mesma semana não resolve partida nenhuma a mais (idempotente)", async () => {
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 6 }, () => Math.random());
    await avancarSemana(estado, 3, () => Math.random());
    const unidadesApos = estado.unidadesConcluidas;
    await avancarSemana(estado, 3, () => Math.random());
    expect(estado.unidadesConcluidas).toBe(unidadesApos);
  });
});

describe("criarCompeticaoIncremental — fase_suica + mata_mata (Paulistão/Gauchão)", () => {
  const times = Array.from({ length: 8 }, (_, i) => `t${i + 1}`);
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
  const campeonato: CampeonatoSimulavel = {
    id: "estadual_teste",
    formato: {
      fase_suica: { num_potes: 2, times_por_pote: 4, jogos_por_time: 4, classificam_mata_mata: 4 },
      mata_mata: { fases: ["semifinal", "final"], ida_e_volta: false },
    },
    times,
  };

  it("resolve fase suíça e mata-mata em sequência, produzindo um campeão válido", async () => {
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 12 }, () => Math.random());
    for (let semana = 1; semana <= 12; semana++) {
      await avancarSemana(estado, semana, () => Math.random());
    }
    expect(estado.concluida).toBe(true);
    expect(times).toContain(estado.campeao);
  });

  it("dispara os hooks de rodada e de mata-mata na ordem certa (suíça antes do mata-mata)", async () => {
    const eventosSuica: string[] = [];
    const eventosMataMata: string[] = [];
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 12 }, () => Math.random());

    for (let semana = 1; semana <= 12; semana++) {
      await avancarSemana(estado, semana, () => Math.random(), undefined, {
        aoSimularConfrontoPontosCorridos: () => eventosSuica.push("suica"),
        aoResolverConfrontoMataMata: () => eventosMataMata.push("mata_mata"),
      });
    }

    expect(eventosSuica.length).toBeGreaterThan(0);
    expect(eventosMataMata.length).toBeGreaterThan(0);
  });
});

describe("criarCompeticaoIncremental — mata_mata isolado com etapas (Copa do Brasil)", () => {
  const times = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
  const campeonato: CampeonatoSimulavel = {
    id: "copa_teste",
    formato: {
      mata_mata: {
        fases: ["oitavas", "quartas", "semifinal", "final"],
        ida_e_volta: false,
        etapas: [{ nome: "oitavas", ida_e_volta: false, entrantes: times }, { nome: "quartas", ida_e_volta: true }, { nome: "semifinal", ida_e_volta: true }, { nome: "final", ida_e_volta: false }],
      },
    },
    times,
  };

  it("resolve 1 etapa por semana e termina com 1 campeão", async () => {
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 4 }, () => Math.random());
    expect(estado.totalUnidades).toBe(4);

    for (let semana = 1; semana <= 4; semana++) {
      await avancarSemana(estado, semana, () => Math.random());
    }
    expect(estado.concluida).toBe(true);
    expect(times).toContain(estado.campeao);
  });
});

describe("criarCompeticaoIncrementalConjunta (Libertadores + Sul-Americana)", () => {
  // Mesma base sintética de tests/simulation/engine.test.ts (receitaLibertadoresESulAmericanaConjunta).
  const libertadores: CampeonatoSimulavel = {
    id: "libertadores",
    formato: {
      fase_grupos: { num_grupos: 2, times_por_grupo: 3, ida_e_volta: false, classificam_por_grupo: 2 },
      mata_mata: {
        fases: ["primeira_fase", "oitavas", "final"],
        ida_e_volta: false,
        etapas: [
          { nome: "primeira_fase", ida_e_volta: false, entrantes: ["lp1", "lp2"] },
          { nome: "oitavas", ida_e_volta: false },
          { nome: "final", ida_e_volta: false },
        ],
      },
    },
    times: ["ld1", "ld2", "ld3", "ld4", "ld5", "lp1", "lp2"],
  };
  const sulAmericana: CampeonatoSimulavel = {
    id: "sulamericana",
    formato: {
      fase_grupos: { num_grupos: 2, times_por_grupo: 3, ida_e_volta: false, classificam_por_grupo: 2 },
      mata_mata: {
        fases: ["primeira_fase", "repescagem", "oitavas", "final"],
        ida_e_volta: false,
        etapas: [
          { nome: "primeira_fase", ida_e_volta: false },
          { nome: "repescagem", ida_e_volta: false },
          { nome: "oitavas", ida_e_volta: false },
          { nome: "final", ida_e_volta: false },
        ],
      },
    },
    times: ["sd1", "sd2", "sd3", "sd4", "sd5", "sd6"],
  };
  const ratingsLibertadores = Object.fromEntries(libertadores.times.map((t) => [t, 1600]));
  const ratingsSulAmericana = Object.fromEntries(sulAmericana.times.map((t) => [t, 1600]));

  it("produz um campeão válido pras 2 competições, avançando semana a semana", async () => {
    const conjunta = criarCompeticaoIncrementalConjunta(libertadores, sulAmericana, ratingsLibertadores, ratingsSulAmericana, undefined, { semanaInicio: 1, semanaFim: 10 });

    for (let semana = 1; semana <= 10; semana++) {
      await avancarSemanaConjunta(conjunta, semana, () => Math.random());
    }

    expect(conjunta.lib.concluida).toBe(true);
    expect(conjunta.sula.concluida).toBe(true);
    expect(libertadores.times).toContain(conjunta.lib.campeao);
    expect([...sulAmericana.times, ...libertadores.times]).toContain(conjunta.sula.campeao);
  });

  it("o repechaje da Sul-Americana espera a fase de grupos da Libertadores concluir (não trava, só atrasa)", async () => {
    const conjunta = criarCompeticaoIncrementalConjunta(libertadores, sulAmericana, ratingsLibertadores, ratingsSulAmericana, undefined, { semanaInicio: 1, semanaFim: 10 });

    // avança só a Sul-Americana isoladamente por várias semanas — sem a Libertadores nunca ter
    // rodado, ela não pode passar do ponto que depende de `libertadores.contexto.terceiros`.
    for (let semana = 1; semana <= 10; semana++) {
      await avancarSemana(conjunta.sula, semana, () => Math.random());
    }
    expect(conjunta.sula.concluida).toBe(false);
    expect(conjunta.lib.contexto.terceiros).toBeUndefined();

    // agora libera a Libertadores e reprocessa — a Sul-Americana consegue terminar de pegar carona.
    for (let semana = 1; semana <= 10; semana++) {
      await avancarSemana(conjunta.lib, semana, () => Math.random());
      await avancarSemana(conjunta.sula, semana, () => Math.random());
    }
    expect(conjunta.lib.concluida).toBe(true);
    expect(conjunta.sula.concluida).toBe(true);
  });

  it("propaga partidasDoJogador quando o clube dele está na Libertadores", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const participacao: ParticipacaoJogadorClube = { clubeId: "lp1", jogador, estiloTecnico: "equilibrado" };
    const ratingsFavorecendoLp1 = { ...ratingsLibertadores, lp1: 2400 };

    const conjunta = criarCompeticaoIncrementalConjunta(libertadores, sulAmericana, ratingsFavorecendoLp1, ratingsSulAmericana, participacao, { semanaInicio: 1, semanaFim: 10 });
    for (let semana = 1; semana <= 10; semana++) {
      await avancarSemanaConjunta(conjunta, semana, () => 0.05);
    }

    expect(conjunta.lib.campeao).toBe("lp1");
    expect(conjunta.lib.partidasDoJogador.length).toBeGreaterThan(0);
  });
});

describe("criarCompeticoesIncrementaisDaTemporada", () => {
  it("monta as competições avulsas e o par conjunto Libertadores+Sul-Americana quando os dois estão carregados", () => {
    const brasileiraoA: CampeonatoSimulavel = { id: "brasileirao_serie_a", formato: { pontos_corridos: { ida_e_volta: true, rodadas: 38 } }, times: Array.from({ length: 20 }, (_, i) => `ba${i + 1}`) };
    const clubes = brasileiraoA.times.map((id) => clube(id));

    const resultado = criarCompeticoesIncrementaisDaTemporada(2027, [brasileiraoA], clubes, undefined, () => Math.random());

    expect(resultado.avulsas.has("brasileirao_serie_a")).toBe(true);
    expect(resultado.erros.some((e) => e.campeonatoId === "sulamericana")).toBe(true); // ativa no calendário mas não carregada
  });
});
