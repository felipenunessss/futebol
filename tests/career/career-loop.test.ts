import { describe, expect, it } from "vitest";
import { jogarCarreira, jogarTemporada } from "../../src/career/career-loop.js";
import { criarEstadoInicial, overallAtual } from "../../src/career/Player.js";
import type { Club } from "../../src/schemas/club.js";
import type { CampeonatoSimulavel } from "../../src/simulation/engine.js";

function clube(id: string, rating = 1600): Club {
  return { id, nome: id, pais: "BR", cidade: "Cidade", rating_inicial: rating };
}

// "brasileirao_serie_a" é referenciado pelo calendário padrão de verdade (data/loaders/calendario.ts),
// então simularTemporada (via jogarTemporada) vai considerá-lo ativo — mesmo padrão de tests/simulation/engine.test.ts.
function campeonatoDeTeste(times: string[]): CampeonatoSimulavel[] {
  return [{ id: "brasileirao_serie_a", formato: { pontos_corridos: { ida_e_volta: true, rodadas: 6 } }, times }];
}

function estadoDeTeste() {
  return criarEstadoInicial({
    id: "j1",
    nome: "Jogador Teste",
    posicao: "atacante",
    arquetipoId: "finalizador",
    clubeInicialId: "a",
    temporadaInicial: 2027,
  });
}

describe("jogarTemporada", () => {
  it("avança idade e temporada em 1, como avancarTemporada", async () => {
    const times = ["a", "b", "c", "d"];
    const resultado = await jogarTemporada(estadoDeTeste(), campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.5 });

    expect(resultado.estado.temporada).toBe(2028);
    expect(resultado.estado.jogador.idade).toBe(19);
  });

  it("aplica XP das partidas do jogador — overall muda em relação ao estado inicial", async () => {
    const times = ["a", "b", "c", "d"];
    const estadoInicial = estadoDeTeste();
    const overallInicial = overallAtual(estadoInicial);

    const resultado = await jogarTemporada(estadoInicial, campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.5 });

    // com random fixo em 0.5, o jogador participa de partidas reais do clube "a" — overall não deve ficar idêntico ao inicial
    expect(overallAtual(resultado.estado)).not.toBe(overallInicial);
  });

  it("resolve um cenário por período do calendário padrão (5 períodos)", async () => {
    const times = ["a", "b", "c", "d"];
    const resultado = await jogarTemporada(estadoDeTeste(), campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.5 });

    expect(resultado.cenariosResolvidos).toHaveLength(5);
    expect(resultado.cenariosResolvidos.map((c) => c.periodo)).toEqual(["jan-1a_quinz", "fev", "mar", "abr", "mai-nov"]);
    expect(resultado.cenariosResolvidos[0].momento).toBe("pre_temporada");
    expect(resultado.cenariosResolvidos[1].momento).toBe("temporada_regular");
  });

  it("devolve resumoPartidas com overall antes/depois e gols/assistências/campeão por competição", async () => {
    const times = ["a", "b", "c", "d"];
    const overallInicial = overallAtual(estadoDeTeste());
    const resultado = await jogarTemporada(estadoDeTeste(), campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.5 });

    expect(resultado.resumoPartidas.overallAntes).toBe(overallInicial);
    expect(resultado.resumoPartidas.overallDepois).toBe(overallAtual(resultado.estado));

    const resumoBrasileirao = resultado.resumoPartidas.competicoes.find((c) => c.campeonatoId === "brasileirao_serie_a")!;
    expect(resumoBrasileirao.erro).toBeUndefined();
    expect(times).toContain(resumoBrasileirao.campeao);
    expect(resumoBrasileirao.partidasDoJogador).toBeGreaterThan(0);
    expect(resumoBrasileirao.golsDoJogador).toBeGreaterThanOrEqual(0);
    expect(resumoBrasileirao.assistenciasDoJogador).toBeGreaterThanOrEqual(0);
  });

  it("chama onPartidasResumidas uma vez, antes do primeiro onCenarioResolvido", async () => {
    const times = ["a", "b", "c", "d"];
    const ordemDeChamadas: string[] = [];

    await jogarTemporada(estadoDeTeste(), campeonatoDeTeste(times), times.map((id) => clube(id)), {
      random: () => 0.5,
      onPartidasResumidas: () => {
        ordemDeChamadas.push("partidas");
      },
      onCenarioResolvido: () => {
        ordemDeChamadas.push("cenario");
      },
    });

    expect(ordemDeChamadas[0]).toBe("partidas");
    expect(ordemDeChamadas.filter((c) => c === "partidas")).toHaveLength(1);
    expect(ordemDeChamadas.filter((c) => c === "cenario")).toHaveLength(5);
  });

  it("devolve o resultado bruto da temporada (calendário de competições)", async () => {
    const times = ["a", "b", "c", "d"];
    const resultado = await jogarTemporada(estadoDeTeste(), campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.5 });

    expect(resultado.resultadoTemporada.temporada).toBe(2027);
    const competicao = resultado.resultadoTemporada.competicoes.find((c) => c.campeonatoId === "brasileirao_serie_a");
    expect(competicao?.erro).toBeUndefined();
    expect(times).toContain(competicao?.resultado?.campeao);
  });

  it("não muta o estado recebido", async () => {
    const times = ["a", "b", "c", "d"];
    const estadoInicial = estadoDeTeste();
    await jogarTemporada(estadoInicial, campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.5 });
    expect(estadoInicial.temporada).toBe(2027);
  });

  it("aplica reputação regional só quando regiaoAtual é informada", async () => {
    const times = ["a", "b", "c", "d"];
    const semRegiao = await jogarTemporada(estadoDeTeste(), campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.9 });
    const comRegiao = await jogarTemporada(estadoDeTeste(), campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.9, regiaoAtual: "SP" });

    expect(semRegiao.estado.reputacao.porRegiao).toEqual({});
    // não garantimos que algum cenário resolvido mexeu em reputação regional, só que o mecanismo aceita a região sem quebrar
    expect(comRegiao.estado.reputacao).toBeDefined();
  });

  it("permite injetar a escolha de opção (ex: sempre a última em vez da primeira)", async () => {
    const times = ["a", "b", "c", "d"];
    const resultado = await jogarTemporada(estadoDeTeste(), campeonatoDeTeste(times), times.map((id) => clube(id)), {
      random: () => 0.5,
      escolherOpcao: (cenario) => cenario.opcoes[cenario.opcoes.length - 1],
    });

    for (const resolvido of resultado.cenariosResolvidos) {
      expect(resolvido.escolha.opcao).toBe(resolvido.cenario.opcoes[resolvido.cenario.opcoes.length - 1]);
    }
  });

  it("aceita escolherOpcao assíncrono (ex: prompt interativo) e chama onCenarioResolvido/onNegociacaoResolvida", async () => {
    const times = ["a", "b", "c", "d"];
    const cenariosVistos: string[] = [];

    const resultado = await jogarTemporada(estadoDeTeste(), campeonatoDeTeste(times), times.map((id) => clube(id)), {
      random: () => 0.5,
      escolherOpcao: async (cenario) => {
        await Promise.resolve(); // simula um await real, tipo esperar entrada do usuário
        return cenario.opcoes[0];
      },
      onCenarioResolvido: (resolvido) => {
        cenariosVistos.push(resolvido.periodo);
      },
    });

    expect(cenariosVistos).toEqual(resultado.cenariosResolvidos.map((c) => c.periodo));
  });
});

describe("jogarTemporada — negociação de transferência", () => {
  it("clube mais forte financeiramente pode fazer proposta e o jogador assinar (clubeAtualId e contratoAtual mudam)", async () => {
    const clubes: Club[] = [
      { id: "a", nome: "a", pais: "BR", cidade: "Cidade", estado: "SP", rating_inicial: 1600, forca_financeira: "baixa" },
      { id: "b", nome: "b", pais: "BR", cidade: "Cidade", estado: "RJ", rating_inicial: 1800, forca_financeira: "muito_alta" },
      { id: "c", nome: "c", pais: "BR", cidade: "Cidade", estado: "SP", rating_inicial: 1600, forca_financeira: "baixa" },
      { id: "d", nome: "d", pais: "BR", cidade: "Cidade", estado: "SP", rating_inicial: 1600, forca_financeira: "baixa" },
    ];
    const campeonatos = campeonatoDeTeste(clubes.map((c) => c.id));

    const resultado = await jogarTemporada(estadoDeTeste(), campeonatos, clubes, { random: () => 0 });

    expect(resultado.negociacoesResolvidas.length).toBeGreaterThan(0);
    const negociacaoAceita = resultado.negociacoesResolvidas.find((n) => n.resultado.aceito);
    expect(negociacaoAceita).toBeDefined();
    expect(resultado.estado.clubeAtualId).toBe(negociacaoAceita!.clubeOfertanteId);
    expect(resultado.estado.contratoAtual).toBeDefined();
    expect(resultado.estado.contratoAtual!.clubeId).toBe(resultado.estado.clubeAtualId);
  });

  it("negociação recusada (random alto) não muda o clube nem gera contratoAtual", async () => {
    const clubes: Club[] = [
      { id: "a", nome: "a", pais: "BR", cidade: "Cidade", rating_inicial: 1600, forca_financeira: "baixa" },
      { id: "b", nome: "b", pais: "BR", cidade: "Cidade", rating_inicial: 1800, forca_financeira: "muito_alta" },
      { id: "c", nome: "c", pais: "BR", cidade: "Cidade", rating_inicial: 1600, forca_financeira: "baixa" },
      { id: "d", nome: "d", pais: "BR", cidade: "Cidade", rating_inicial: 1600, forca_financeira: "baixa" },
    ];
    const campeonatos = campeonatoDeTeste(clubes.map((c) => c.id));

    const resultado = await jogarTemporada(estadoDeTeste(), campeonatos, clubes, { random: () => 0.999 });

    expect(resultado.negociacoesResolvidas.every((n) => !n.resultado.aceito)).toBe(true);
    expect(resultado.estado.clubeAtualId).toBe("a");
    expect(resultado.estado.contratoAtual).toBeUndefined();
  });

  it("com interesse real de mercado, o cenário do período de pré-temporada é um cenário de transferência (unificação cenário/mercado)", async () => {
    const clubes: Club[] = [
      { id: "a", nome: "a", pais: "BR", cidade: "Cidade", estado: "SP", rating_inicial: 1600, forca_financeira: "baixa" },
      { id: "b", nome: "b", pais: "BR", cidade: "Cidade", estado: "RJ", rating_inicial: 1800, forca_financeira: "muito_alta" },
      { id: "c", nome: "c", pais: "BR", cidade: "Cidade", estado: "SP", rating_inicial: 1600, forca_financeira: "baixa" },
      { id: "d", nome: "d", pais: "BR", cidade: "Cidade", estado: "SP", rating_inicial: 1600, forca_financeira: "baixa" },
    ];
    const campeonatos = campeonatoDeTeste(clubes.map((c) => c.id));

    const resultado = await jogarTemporada(estadoDeTeste(), campeonatos, clubes, { random: () => 0.5 });

    const cenarioDePreTemporada = resultado.cenariosResolvidos.find((c) => c.momento === "pre_temporada")!;
    expect(cenarioDePreTemporada.cenario.opcoes.some((o) => o.disparaNegociacaoReal)).toBe(true);
  });

  it("sem nenhum clube interessado (todos com rating menor), nenhum cenário de transferência é sorteado e nenhuma negociação acontece", async () => {
    const clubes: Club[] = [
      { id: "a", nome: "a", pais: "BR", cidade: "Cidade", rating_inicial: 1800, forca_financeira: "muito_alta" },
      { id: "b", nome: "b", pais: "BR", cidade: "Cidade", rating_inicial: 1200, forca_financeira: "muito_baixa" },
      { id: "c", nome: "c", pais: "BR", cidade: "Cidade", rating_inicial: 1200, forca_financeira: "muito_baixa" },
      { id: "d", nome: "d", pais: "BR", cidade: "Cidade", rating_inicial: 1200, forca_financeira: "muito_baixa" },
    ];
    const campeonatos = campeonatoDeTeste(clubes.map((c) => c.id));

    const resultado = await jogarTemporada(estadoDeTeste(), campeonatos, clubes, { random: () => 0.5 });

    expect(resultado.negociacoesResolvidas).toEqual([]);
    expect(resultado.cenariosResolvidos.some((c) => c.cenario.opcoes.some((o) => o.disparaNegociacaoReal))).toBe(false);
    expect(resultado.estado.clubeAtualId).toBe("a");
  });
});

describe("jogarCarreira", () => {
  it("encadeia N temporadas, uma alimentando a próxima", async () => {
    const times = ["a", "b", "c", "d"];
    const resultado = await jogarCarreira(estadoDeTeste(), 3, campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.5 });

    expect(resultado.temporadas).toHaveLength(3);
    expect(resultado.temporadas.map((t) => t.estado.temporada)).toEqual([2028, 2029, 2030]);
    expect(resultado.estadoFinal.temporada).toBe(2030);
    expect(resultado.estadoFinal.jogador.idade).toBe(21);
    expect(resultado.estadoFinal).toBe(resultado.temporadas[2].estado);
  });
});
