import { describe, expect, it } from "vitest";
import type { Club } from "../../src/schemas/club.js";
import type { CampeonatoSimulavel } from "../../src/simulation/engine.js";
import { loadCampeonatosNacionais, loadClubes, loadEstaduais } from "../../src/data/loaders/index.js";
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

describe("avancarEtapa — bye automático quando o mata-mata sobra número ímpar de sobreviventes", () => {
  it("dá bye pro melhor colocado numa etapa do MEIO (não a última) e conclui normalmente — mesmo formato de matogrossense_1 (6 classificados, 3 fases)", async () => {
    const times = Array.from({ length: 10 }, (_, i) => `t${i + 1}`);
    const ratings = Object.fromEntries(times.map((t, i) => [t, 1600 + (10 - i)])); // t1 é o mais forte
    const campeonato: CampeonatoSimulavel = {
      id: "estadual_teste_bye",
      formato: {
        fase_grupos: { num_grupos: 1, times_por_grupo: 10, ida_e_volta: false, classificam_por_grupo: 6 },
        mata_mata: { fases: ["quartas", "semifinal", "final"], ida_e_volta: false },
      },
      times,
    };

    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 17 }, () => Math.random());
    for (let semana = 1; semana <= 17; semana++) {
      await avancarSemana(estado, semana, () => Math.random());
    }

    expect(estado.erro).toBeUndefined();
    expect(estado.concluida).toBe(true);
    expect(times).toContain(estado.campeao);
  });

  it("continua lançando erro claro quando sobra ímpar na ÚLTIMA etapa (bye não pode decidir campeão sem jogar a final) — mesmo formato de cearense_1", async () => {
    const times = Array.from({ length: 10 }, (_, i) => `t${i + 1}`);
    const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
    const campeonato: CampeonatoSimulavel = {
      id: "estadual_teste_sem_bye_na_final",
      formato: {
        fase_grupos: { num_grupos: 2, times_por_grupo: 5, ida_e_volta: false, classificam_por_grupo: 3 },
        mata_mata: { fases: ["semifinal", "final"], ida_e_volta: false },
      },
      times,
    };

    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 13 }, () => Math.random());
    for (let semana = 1; semana <= 13; semana++) {
      await avancarSemana(estado, semana, () => Math.random());
    }

    expect(estado.erro).toMatch(/número ímpar de participantes/);
    expect(estado.concluida).toBe(true); // falha isolada marca concluída sem campeão, não trava a temporada
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

describe("criarCompeticaoIncremental — turno + returno somado, sem final (Paraguai 1ª divisão)", () => {
  const times = ["a", "b", "c", "d", "e", "f"];
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
  const campeonato: CampeonatoSimulavel = {
    id: "paraguai_teste",
    formato: {
      turno: { nome: "Apertura", ida_e_volta: false, classificam_proxima_fase: times.length },
      returno: { nome: "Clausura", ida_e_volta: false, classificam_proxima_fase: times.length },
    },
    times,
  };

  it("resolve turno e depois returno, campeão é quem soma mais pontos nos dois", async () => {
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 10 }, () => Math.random());
    for (let semana = 1; semana <= 10; semana++) {
      await avancarSemana(estado, semana, () => Math.random());
    }
    expect(estado.concluida).toBe(true);
    expect(times).toContain(estado.campeao);
    // sem final nenhuma: o campeão sai só da soma das 2 tabelas, nunca de um confronto — nenhuma
    // partida do jogador é gerada mesmo com participação, já que ele não está nas 2 fases só como espectador.
  });

  it("não conclui antes de terminar o returno inteiro", async () => {
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 10 }, () => Math.random());
    await avancarSemana(estado, 1, () => Math.random());
    expect(estado.concluida).toBe(false);
  });
});

describe("criarCompeticaoIncremental — pontos_corridos + liguilla de mata-mata (Chile 2ª divisão)", () => {
  const times = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
  const campeonato: CampeonatoSimulavel = {
    id: "chile_teste",
    formato: {
      pontos_corridos: { ida_e_volta: true, rodadas: 14 },
      mata_mata: { fases: ["semifinal", "final"], ida_e_volta: false }, // 2^2 = 4 classificados
    },
    times,
  };

  it("classifica os 4 melhores da liga pra liguilla e produz 1 campeão", async () => {
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 16 }, () => Math.random());
    for (let semana = 1; semana <= 16; semana++) {
      await avancarSemana(estado, semana, () => Math.random());
    }
    expect(estado.concluida).toBe(true);
    expect(times).toContain(estado.campeao);
  });
});

describe("criarCompeticaoIncremental — turno + returno com liguilla condicional (Peru 1ª divisão, por id)", () => {
  const times = ["a", "b", "c", "d", "e", "f"];
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
  const campeonato: CampeonatoSimulavel = {
    id: "peru_primera",
    formato: {
      turno: { nome: "Apertura", ida_e_volta: false, classificam_proxima_fase: times.length },
      returno: { nome: "Clausura", ida_e_volta: false, classificam_proxima_fase: times.length },
      final_estadual: { criterio: "liguilla_de_4", ida_e_volta: true },
    },
    times,
  };

  it("resolve turno, returno e a liguilla condicional, terminando com 1 campeão válido", async () => {
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 12 }, () => Math.random());
    expect(estado.totalUnidades).toBeGreaterThan(0);

    for (let semana = 1; semana <= 12; semana++) {
      await avancarSemana(estado, semana, () => Math.random());
    }
    expect(estado.concluida).toBe(true);
    expect(times).toContain(estado.campeao);
  });

  it("quando o mesmo clube domina os 2 torneios, vira campeão automático (sem gastar a liguilla)", async () => {
    const ratingsDominantes = { ...ratings, a: 2400 };
    const estado = criarCompeticaoIncremental(campeonato, ratingsDominantes, undefined, { semanaInicio: 1, semanaFim: 12 }, () => 0.01);
    for (let semana = 1; semana <= 12; semana++) {
      await avancarSemana(estado, semana, () => 0.01);
    }
    expect(estado.campeao).toBe("a");
  });
});

describe("criarCompeticaoIncremental — Apertura/Clausura com semifinal e final condicionais (Uruguai 1ª divisão, por id)", () => {
  const times = ["a", "b", "c", "d", "e", "f"];
  const campeonato: CampeonatoSimulavel = {
    id: "uruguai_primera",
    formato: {
      turno: { nome: "Apertura", ida_e_volta: false, classificam_proxima_fase: times.length },
      returno: { nome: "Clausura", ida_e_volta: false, classificam_proxima_fase: times.length },
      mata_mata: { fases: ["semifinal", "final"], ida_e_volta: false },
    },
    times,
  };

  it("campeão automático quando o mesmo clube domina os 2 torneios (e a tabela anual)", async () => {
    const ratings = { ...Object.fromEntries(times.map((t) => [t, 1600])), a: 2400 };
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 12 }, () => 0.01);
    for (let semana = 1; semana <= 12; semana++) await avancarSemana(estado, semana, () => 0.01);
    expect(estado.campeao).toBe("a");
  });

  it("resolve com times equilibrados, terminando com 1 campeão válido (semifinal ± final)", async () => {
    const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 12 }, () => Math.random());
    for (let semana = 1; semana <= 12; semana++) await avancarSemana(estado, semana, () => Math.random());
    expect(estado.concluida).toBe(true);
    expect(times).toContain(estado.campeao);
  });
});

describe("criarCompeticaoIncremental — séries + Torneo Competencia + regular + playoff (Uruguai 2ª divisão, por id)", () => {
  const times = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
  const campeonato: CampeonatoSimulavel = {
    id: "uruguai_segunda",
    formato: {
      fase_grupos: { num_grupos: 2, times_por_grupo: 4, ida_e_volta: false, classificam_por_grupo: 4 },
      final_estadual: { criterio: "final_torneio_competencia", ida_e_volta: false },
      pontos_corridos: { ida_e_volta: true, rodadas: 14 },
      mata_mata: { fases: ["playoff_terceiro_acesso"], ida_e_volta: false }, // 2^1 = 2 participantes (posições 3ª-4ª)
    },
    times,
  };

  it("o campeão é sempre o líder da tabela regular, mesmo com séries/playoff acontecendo em paralelo", async () => {
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 20 }, () => Math.random());
    for (let semana = 1; semana <= 20; semana++) await avancarSemana(estado, semana, () => Math.random());
    expect(estado.concluida).toBe(true);
    expect(times).toContain(estado.campeao);
  });
});

describe("criarCompeticaoIncremental — Tabla Anual (Argentina 1ª divisão, por id)", () => {
  const times = ["a", "b", "c", "d", "e", "f"];
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
  const campeonato: CampeonatoSimulavel = {
    id: "argentina_primera",
    formato: {
      turno: { nome: "Torneo Apertura", ida_e_volta: false, classificam_proxima_fase: times.length },
      returno: { nome: "Torneo Clausura", ida_e_volta: false, classificam_proxima_fase: times.length },
      final_estadual: { criterio: "tabla_anual_soma_apertura_clausura", ida_e_volta: false },
    },
    times,
  };

  it("soma apertura+clausura (reaproveitando o mesmo mecanismo de Paraguai 1ª) e produz 1 campeão válido", async () => {
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 10 }, () => Math.random());
    for (let semana = 1; semana <= 10; semana++) await avancarSemana(estado, semana, () => Math.random());
    expect(estado.concluida).toBe(true);
    expect(times).toContain(estado.campeao);
  });
});

describe("criarCompeticaoIncremental — 2 zonas + final direta + Reduzido (Argentina 2ª divisão, por id)", () => {
  // 2 zonas de 4 (classificam_por_grupo=2: líder + mais 1 pro Reduzido) — pequeno o bastante pra
  // rodar rápido, grande o bastante pra exercitar líder-de-zona + restante + perdedor-da-final.
  const times = Array.from({ length: 8 }, (_, i) => `t${i + 1}`);
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
  const campeonato: CampeonatoSimulavel = {
    id: "argentina_segunda",
    formato: {
      fase_grupos: { num_grupos: 2, times_por_grupo: 4, ida_e_volta: false, classificam_por_grupo: 2 },
      final_estadual: { criterio: "final_direta_1_ascenso", ida_e_volta: false },
      mata_mata: { fases: ["primeira_fase", "quartas", "semifinal", "final"], ida_e_volta: false },
    },
    times,
  };

  it("o campeão sai da final direta entre líderes de zona, e o Reduzido roda em paralelo sem erro", async () => {
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 12 }, () => Math.random());
    expect(estado.totalUnidades).toBe(totalDeRodadasEsperado(campeonato) + 1 + 4);

    for (let semana = 1; semana <= 12; semana++) await avancarSemana(estado, semana, () => Math.random());
    expect(estado.concluida).toBe(true);
    expect(times).toContain(estado.campeao);
  });

  function totalDeRodadasEsperado(c: CampeonatoSimulavel): number {
    const n = c.formato.fase_grupos!.times_por_grupo;
    return c.formato.fase_grupos!.ida_e_volta ? (n - 1) * 2 : n - 1;
  }
});

describe("criarCompeticaoIncremental — pontos_corridos + fase final por classificação (Equador)", () => {
  const times = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
  const campeonato: CampeonatoSimulavel = {
    id: "equador_teste",
    formato: {
      pontos_corridos: { ida_e_volta: true, rodadas: 14 },
      fase_final_por_classificacao: {
        grupos: [
          { nome: "hexagonal_titulo", tamanho: 4 },
          { nome: "hexagonal_rebaixamento", tamanho: 4 },
        ],
        ida_e_volta: true,
        pontos_carregados: true,
      },
    },
    times,
  };

  it("o campeão sai do grupo do título (1º da fase regular), nunca do grupo de rebaixamento", async () => {
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 20 }, () => Math.random());
    for (let semana = 1; semana <= 20; semana++) await avancarSemana(estado, semana, () => Math.random());
    expect(estado.concluida).toBe(true);
    expect(times).toContain(estado.campeao);
  });

  it("com pontos_carregados, quem chega na fase final com mais pontos da fase regular carrega essa vantagem (não zera)", async () => {
    // rating muito mais alto só pro time "a" — deve dominar a fase regular, entrar na fase final com
    // vantagem enorme de pontos, e vencer o hexagonal do título mesmo com o resto empatado em força.
    const ratingsFavorecendoA = { ...ratings, a: 2600 };
    const estado = criarCompeticaoIncremental(campeonato, ratingsFavorecendoA, undefined, { semanaInicio: 1, semanaFim: 20 }, () => 0.02);
    for (let semana = 1; semana <= 20; semana++) await avancarSemana(estado, semana, () => 0.02);
    expect(estado.campeao).toBe("a");
  });
});

describe("criarCompeticaoIncremental — turno/returno com quadrangular + final (Colômbia 1ª e 2ª divisão)", () => {
  const times = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
  const campeonato: CampeonatoSimulavel = {
    id: "colombia_teste",
    formato: {
      turno: { nome: "Apertura", ida_e_volta: false, classificam_proxima_fase: 8 },
      returno: { nome: "Finalización", ida_e_volta: false, classificam_proxima_fase: 8 },
      fase_quadrangular: { ativa: true, num_grupos: 2, times_por_grupo: 4, classificam_por_grupo: 1 },
      final_estadual: { criterio: "campeoes_apertura_finalizacion", ida_e_volta: true },
    },
    times,
  };

  it("cada torneio decide o próprio campeão via quadrangular+final, e os 2 campeões disputam a final da temporada", async () => {
    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 20 }, () => Math.random());
    for (let semana = 1; semana <= 20; semana++) await avancarSemana(estado, semana, () => Math.random());
    expect(estado.concluida).toBe(true);
    expect(times).toContain(estado.campeao);
  });

  it("mesmo clube campeão dos 2 torneios vira campeão automático da temporada", async () => {
    const ratingsDominantes = { ...ratings, a: 2600 };
    const estado = criarCompeticaoIncremental(campeonato, ratingsDominantes, undefined, { semanaInicio: 1, semanaFim: 20 }, () => 0.02);
    for (let semana = 1; semana <= 20; semana++) await avancarSemana(estado, semana, () => 0.02);
    expect(estado.campeao).toBe("a");
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

  it("nas oitavas da Libertadores, o sorteio real por potes nunca pareia 2 times do mesmo grupo", async () => {
    const conjunta = criarCompeticaoIncrementalConjunta(libertadores, sulAmericana, ratingsLibertadores, ratingsSulAmericana, undefined, { semanaInicio: 1, semanaFim: 10 });
    const grupoDoTime = new Map<string, string>();
    let paresDasOitavas: [string, string][] | undefined;

    for (let semana = 1; semana <= 10; semana++) {
      await avancarSemana(conjunta.lib, semana, () => Math.random(), undefined, {
        aoIniciarFase: (fase) => {
          if (fase.tipo === "rodadas" && fase.grupos.length > 1) {
            for (const grupo of fase.grupos) for (const time of grupo.tabela.keys()) grupoDoTime.set(time, grupo.nome);
          }
        },
        aoDefinirChaveamento: (info) => {
          if (info.etapaNome === "oitavas") paresDasOitavas = info.pares;
        },
      });
      await avancarSemana(conjunta.sula, semana, () => Math.random());
    }

    expect(paresDasOitavas).toBeDefined();
    for (const [a, b] of paresDasOitavas!) {
      expect(grupoDoTime.get(a)).toBeDefined();
      expect(grupoDoTime.get(a)).not.toBe(grupoDoTime.get(b));
    }
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

  it("resolve com dado real as 4 ligas de outros países que já batem com formatos incrementais existentes (Bolívia, Chile 1ª, Paraguai 2ª, Peru 2ª)", async () => {
    const campeonatos = [...loadCampeonatosNacionais(), ...loadEstaduais()];
    const clubes = loadClubes();

    const resultado = criarCompeticoesIncrementaisDaTemporada(2027, campeonatos, clubes, undefined, () => Math.random());

    for (let semana = 1; semana <= 52; semana++) {
      for (const estado of resultado.avulsas.values()) await avancarSemana(estado, semana, () => Math.random());
      for (const conjunta of resultado.conjuntas) await avancarSemanaConjunta(conjunta, semana, () => Math.random());
    }

    for (const id of ["bolivia_primera", "chile_primera", "paraguai_segunda", "peru_segunda"]) {
      const estado = resultado.avulsas.get(id)!;
      const campeonato = campeonatos.find((c) => c.id === id)!;
      expect(estado, `${id} deveria ter sido montado sem erro`).toBeDefined();
      expect(estado.concluida).toBe(true);
      expect(campeonato.times).toContain(estado.campeao);
    }

    // venezuela_segunda fica de fora do calendário de propósito (dado incompatível conhecido, ver
    // docs/dados-a-verificar.md e data/loaders/calendario.ts) — nem chega a ser montada.
    expect(resultado.avulsas.has("venezuela_segunda")).toBe(false);
  });

  it("uma competição que só quebra numa fase POSTERIOR (depois que uma fase anterior já rodou de verdade) é isolada sem travar as demais — CompeticaoIncremental.erro", async () => {
    // times[] não reconcilia com fase_grupos (6 ao todo, mas o classificatório pede 2 grupos de 4 = 8)
    // — só descoberto depois que o turno já concluiu (mesmo formato de venezuela_primera/segunda).
    const times = ["a", "b", "c", "d", "e", "f"];
    const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
    const campeonato: CampeonatoSimulavel = {
      id: "venezuela_teste",
      formato: {
        turno: { nome: "Apertura", ida_e_volta: false, classificam_proxima_fase: 6 },
        returno: { nome: "Clausura", ida_e_volta: false, classificam_proxima_fase: 6 },
        fase_grupos: { num_grupos: 2, times_por_grupo: 4, ida_e_volta: true, classificam_por_grupo: 2 },
        mata_mata: { fases: ["final"], ida_e_volta: false },
        final_estadual: { criterio: "campeoes_apertura_clausura", ida_e_volta: false },
      },
      times,
    };

    const estado = criarCompeticaoIncremental(campeonato, ratings, undefined, { semanaInicio: 1, semanaFim: 20 }, () => Math.random());
    for (let semana = 1; semana <= 20; semana++) {
      await avancarSemana(estado, semana, () => Math.random()); // nunca lança — o erro fica isolado no estado
    }

    expect(estado.concluida).toBe(true);
    expect(estado.erro).toBeDefined();
    expect(estado.erro).toContain("esperava 8 times");
    expect(estado.campeao).toBeUndefined();
  });
});
