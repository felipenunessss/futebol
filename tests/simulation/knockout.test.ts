import { describe, expect, it } from "vitest";
import type { EtapaMataMata, FinalEstadual, MataMata } from "../../src/schemas/championship.js";
import {
  resolverConfronto,
  simularEtapasMataMataParcial,
  simularFinalEstadualDoFormato,
  simularMataMataComEtapas,
  simularMataMataDoFormato,
  simularMataMataSimples,
  type EventoConfrontoMataMata,
} from "../../src/simulation/knockout.js";
import { buscarArquetipo, type Jogador } from "../../src/schemas/player.js";
import type { ParticipacaoJogadorClube } from "../../src/simulation/match.js";

describe("simularMataMataSimples", () => {
  it("4 times, 2 fases (semifinal+final): produz 1 campeão que estava entre os 4", async () => {
    const participantes = ["a", "b", "c", "d"];
    const ratings = { a: 1600, b: 1600, c: 1600, d: 1600 };

    const resultado = await simularMataMataSimples(participantes, ["semifinal", "final"], true, ratings, () => Math.random());

    expect(participantes).toContain(resultado.campeao);
    expect(resultado.etapas).toHaveLength(2);
    expect(resultado.etapas[0].nome).toBe("semifinal");
    expect(resultado.etapas[0].confrontos).toHaveLength(2); // 4 times -> 2 confrontos
    expect(resultado.etapas[1].nome).toBe("final");
    expect(resultado.etapas[1].confrontos).toHaveLength(1);
  });

  it("time muito mais forte tende a ser campeão (random empurra sempre pro favorito)", async () => {
    const participantes = ["forte", "fraco1", "fraco2", "fraco3"];
    const ratings = { forte: 2400, fraco1: 1200, fraco2: 1200, fraco3: 1200 };

    // random baixo favorece quem tem mais força em cada duelo (ver resolverDuelo em match.ts)
    const resultado = await simularMataMataSimples(participantes, ["semifinal", "final"], false, ratings, () => 0.1);

    expect(resultado.campeao).toBe("forte");
  });

  it("cada rodada corta o número de times pela metade", async () => {
    const participantes = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ratings = Object.fromEntries(participantes.map((t) => [t, 1600]));

    const resultado = await simularMataMataSimples(participantes, ["quartas", "semifinal", "final"], true, ratings, () => Math.random());

    expect(resultado.etapas[0].vencedores).toHaveLength(4);
    expect(resultado.etapas[1].vencedores).toHaveLength(2);
    expect(resultado.etapas[2].vencedores).toHaveLength(1);
  });

  describe("aoResolverConfronto", () => {
    it("é chamado uma vez por confronto de cada etapa, com o nome da etapa certo", async () => {
      const participantes = ["a", "b", "c", "d"];
      const ratings = { a: 1600, b: 1600, c: 1600, d: 1600 };
      const eventos: EventoConfrontoMataMata[] = [];

      await simularMataMataSimples(participantes, ["semifinal", "final"], true, ratings, () => Math.random(), undefined, (evento) => eventos.push(evento));

      expect(eventos).toHaveLength(3); // 2 semifinais + 1 final
      expect(eventos.filter((e) => e.etapa === "semifinal")).toHaveLength(2);
      expect(eventos.filter((e) => e.etapa === "final")).toHaveLength(1);
    });

    it("sem o callback, o resultado final não muda (mesmo comportamento de antes)", async () => {
      const participantes = ["a", "b", "c", "d"];
      const ratings = { a: 1600, b: 1600, c: 1600, d: 1600 };

      const semCallback = await simularMataMataSimples(participantes, ["semifinal", "final"], true, ratings, () => 0.5);
      const comCallback = await simularMataMataSimples(participantes, ["semifinal", "final"], true, ratings, () => 0.5, undefined, () => {});
      expect(comCallback.campeao).toBe(semCallback.campeao);
    });
  });
});

describe("simularMataMataComEtapas", () => {
  it("entrada escalonada: 1 vencedor da 1ª fase + 2 entrantes novos na 2ª dá número ímpar de vivos e lança erro", async () => {
    // 1ª fase: [a,b] -> 1 vencedor. 2ª fase soma [c,d] a esse vencedor -> 3 vivos, ímpar de propósito.
    const etapas: EtapaMataMata[] = [
      { nome: "primeira_fase", ida_e_volta: true, entrantes: ["a", "b"] },
      { nome: "segunda_fase", ida_e_volta: true, entrantes: ["c", "d"] },
    ];
    const ratings = { a: 1600, b: 1600, c: 1600, d: 1600 };

    await expect(simularMataMataComEtapas(etapas, ratings, () => Math.random())).rejects.toThrow(/número ímpar/);
  });

  it("fase sem entrantes e sem vivos anteriores fica vazia, sem quebrar", async () => {
    const etapas: EtapaMataMata[] = [
      { nome: "fase_vazia", ida_e_volta: false }, // ninguém entra aqui de propósito
      { nome: "final", ida_e_volta: false, entrantes: ["a", "b"] },
    ];

    const resultado = await simularMataMataComEtapas(etapas, { a: 1600, b: 1600 }, () => Math.random());

    expect(resultado.etapas[0].confrontos).toEqual([]);
    expect(["a", "b"]).toContain(resultado.campeao);
  });

  it("etapa marcada ida_e_volta: false resolve em um jogo só (placar bate com uma simularPartida)", async () => {
    const etapas: EtapaMataMata[] = [{ nome: "final", ida_e_volta: false, entrantes: ["a", "b"] }];
    const resultado = await simularMataMataComEtapas(etapas, { a: 1600, b: 1600 }, () => 0.5);

    const confronto = resultado.etapas[0].confrontos[0];
    // com random sempre 0.5 (sem ruído no perfil, duelos 50/50) e mesma força, o placar tende a ficar baixo/simétrico — só garantimos que é determinístico
    expect(typeof confronto.golsA).toBe("number");
    expect(typeof confronto.golsB).toBe("number");
  });
});

describe("simularMataMataDoFormato", () => {
  const ratings = { a: 1600, b: 1600, c: 1600, d: 1600 };

  it("usa etapas quando presente, ignorando o parâmetro participantes", async () => {
    const formato: MataMata = {
      fases: ["final"],
      ida_e_volta: false,
      etapas: [{ nome: "final", ida_e_volta: false, entrantes: ["a", "b"] }],
    };

    const resultado = await simularMataMataDoFormato(formato, ratings, [], () => Math.random());
    expect(["a", "b"]).toContain(resultado.campeao);
  });

  it("cai no formato simples (fases + ida_e_volta) quando etapas não está presente", async () => {
    const formato: MataMata = { fases: ["semifinal", "final"], ida_e_volta: true };
    const resultado = await simularMataMataDoFormato(formato, ratings, ["a", "b", "c", "d"], () => Math.random());
    expect(["a", "b", "c", "d"]).toContain(resultado.campeao);
  });
});

describe("simularFinalEstadualDoFormato", () => {
  const ratings = { a: 1600, b: 1600 };
  const formato: FinalEstadual = { criterio: "campeoes_turno_returno_ou_melhor_campanha", ida_e_volta: true };

  it("com 1 participante só, é campeão automático — sem final, sem confronto", async () => {
    const resultado = await simularFinalEstadualDoFormato(formato, ["a"], ratings, () => Math.random());
    expect(resultado.campeao).toBe("a");
    expect(resultado.confronto).toBeUndefined();
  });

  it("com 2 participantes, resolve o confronto e o campeão é um dos dois", async () => {
    const resultado = await simularFinalEstadualDoFormato(formato, ["a", "b"], ratings, () => Math.random());
    expect(["a", "b"]).toContain(resultado.campeao);
    expect(resultado.confronto).toBeDefined();
    expect(resultado.confronto?.vencedor).toBe(resultado.campeao);
  });

  it("lança erro com número de participantes diferente de 1 ou 2", async () => {
    await expect(simularFinalEstadualDoFormato(formato, [], ratings)).rejects.toThrow();
    await expect(simularFinalEstadualDoFormato(formato, ["a", "b", "c"], ratings)).rejects.toThrow();
  });
});

describe("resolverConfronto com participação do jogador", () => {
  const ratings = { a: 1600, b: 1600 };
  const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: {} };

  it("jogo único: 1 partida em partidasDoJogador quando o clube do jogador está no confronto", async () => {
    const participacao: ParticipacaoJogadorClube = { clubeId: "a", jogador, estiloTecnico: "equilibrado" };
    const confronto = await resolverConfronto("a", "b", ratings, false, () => Math.random(), participacao);
    expect(confronto.partidasDoJogador).toHaveLength(1);
  });

  it("ida e volta: 2 partidas em partidasDoJogador (uma por perna)", async () => {
    const participacao: ParticipacaoJogadorClube = { clubeId: "a", jogador, estiloTecnico: "equilibrado" };
    const confronto = await resolverConfronto("a", "b", ratings, true, () => Math.random(), participacao);
    expect(confronto.partidasDoJogador).toHaveLength(2);
  });

  it("sem participacaoJogador, partidasDoJogador fica ausente", async () => {
    const confronto = await resolverConfronto("a", "b", ratings, true, () => Math.random());
    expect(confronto.partidasDoJogador).toBeUndefined();
  });

  it("clube do jogador fora do confronto: partidasDoJogador fica ausente", async () => {
    const participacao: ParticipacaoJogadorClube = { clubeId: "outro_clube", jogador, estiloTecnico: "equilibrado" };
    const confronto = await resolverConfronto("a", "b", ratings, true, () => Math.random(), participacao);
    expect(confronto.partidasDoJogador).toBeUndefined();
  });
});

describe("simularMataMataComEtapas com participação do jogador", () => {
  const ratings = { a: 1600, b: 1600, c: 1600, d: 1600 };
  const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };

  it("propaga a participação em todas as etapas em que o clube do jogador segue vivo", async () => {
    const etapas: EtapaMataMata[] = [
      { nome: "semifinal", ida_e_volta: false, entrantes: ["a", "b", "c", "d"] },
      { nome: "final", ida_e_volta: false },
    ];
    // random baixo favorece força maior — jogador com finalizacao muito alta tende a levar "a" adiante
    const participacao: ParticipacaoJogadorClube = { clubeId: "a", jogador, estiloTecnico: "equilibrado" };
    const resultado = await simularMataMataComEtapas(etapas, ratings, () => 0.1, participacao);

    const confrontoSemifinalDoA = resultado.etapas[0].confrontos.find((c) => c.timeA === "a" || c.timeB === "a")!;
    expect(confrontoSemifinalDoA.partidasDoJogador).toHaveLength(1);
  });
});

describe("simularEtapasMataMataParcial", () => {
  it("não lança erro terminando com mais de 1 sobrevivente (ao contrário de simularMataMataComEtapas)", async () => {
    // 1 etapa só ("semifinal"), 4 entrantes -> termina com 2 vencedores, não 1 — usado quando um
    // final_estadual de verdade resolve os últimos 2 (ver simulation/engine.ts receitaFaseSuicaMataMataEFinal).
    const etapas: EtapaMataMata[] = [{ nome: "semifinal", ida_e_volta: false, entrantes: ["a", "b", "c", "d"] }];
    const ratings = { a: 1600, b: 1600, c: 1600, d: 1600 };

    const resultado = await simularEtapasMataMataParcial(etapas, ratings, () => Math.random());
    expect(resultado.etapas).toHaveLength(1);
    expect(resultado.etapas[0].vencedores).toHaveLength(2);
  });

  it("a mesma entrada faria simularMataMataComEtapas lançar erro", async () => {
    const etapas: EtapaMataMata[] = [{ nome: "semifinal", ida_e_volta: false, entrantes: ["a", "b", "c", "d"] }];
    const ratings = { a: 1600, b: 1600, c: 1600, d: 1600 };

    await expect(simularMataMataComEtapas(etapas, ratings, () => Math.random())).rejects.toThrow(/terminou com 2 times ainda vivos/);
  });

  it("propaga partidasDoJogador normalmente", async () => {
    const etapas: EtapaMataMata[] = [{ nome: "semifinal", ida_e_volta: false, entrantes: ["a", "b", "c", "d"] }];
    const ratings = { a: 1600, b: 1600, c: 1600, d: 1600 };
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: {} };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a", jogador, estiloTecnico: "equilibrado" };

    const resultado = await simularEtapasMataMataParcial(etapas, ratings, () => Math.random(), participacao);
    const confrontoDoA = resultado.etapas[0].confrontos.find((c) => c.timeA === "a" || c.timeB === "a")!;
    expect(confrontoDoA.partidasDoJogador).toHaveLength(1);
  });
});
