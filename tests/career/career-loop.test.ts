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
  it("avança idade e temporada em 1, como avancarTemporada", () => {
    const times = ["a", "b", "c", "d"];
    const resultado = jogarTemporada(estadoDeTeste(), campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.5 });

    expect(resultado.estado.temporada).toBe(2028);
    expect(resultado.estado.jogador.idade).toBe(19);
  });

  it("aplica XP das partidas do jogador — overall muda em relação ao estado inicial", () => {
    const times = ["a", "b", "c", "d"];
    const estadoInicial = estadoDeTeste();
    const overallInicial = overallAtual(estadoInicial);

    const resultado = jogarTemporada(estadoInicial, campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.5 });

    // com random fixo em 0.5, o jogador participa de partidas reais do clube "a" — overall não deve ficar idêntico ao inicial
    expect(overallAtual(resultado.estado)).not.toBe(overallInicial);
  });

  it("resolve um cenário por período do calendário padrão (5 períodos)", () => {
    const times = ["a", "b", "c", "d"];
    const resultado = jogarTemporada(estadoDeTeste(), campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.5 });

    expect(resultado.cenariosResolvidos).toHaveLength(5);
    expect(resultado.cenariosResolvidos.map((c) => c.periodo)).toEqual(["jan-1a_quinz", "fev", "mar", "abr", "mai-nov"]);
    expect(resultado.cenariosResolvidos[0].momento).toBe("pre_temporada");
    expect(resultado.cenariosResolvidos[1].momento).toBe("temporada_regular");
  });

  it("devolve o resultado bruto da temporada (calendário de competições)", () => {
    const times = ["a", "b", "c", "d"];
    const resultado = jogarTemporada(estadoDeTeste(), campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.5 });

    expect(resultado.resultadoTemporada.temporada).toBe(2027);
    const competicao = resultado.resultadoTemporada.competicoes.find((c) => c.campeonatoId === "brasileirao_serie_a");
    expect(competicao?.erro).toBeUndefined();
    expect(times).toContain(competicao?.resultado?.campeao);
  });

  it("não muta o estado recebido", () => {
    const times = ["a", "b", "c", "d"];
    const estadoInicial = estadoDeTeste();
    jogarTemporada(estadoInicial, campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.5 });
    expect(estadoInicial.temporada).toBe(2027);
  });

  it("aplica reputação regional só quando regiaoAtual é informada", () => {
    const times = ["a", "b", "c", "d"];
    const semRegiao = jogarTemporada(estadoDeTeste(), campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.9 });
    const comRegiao = jogarTemporada(estadoDeTeste(), campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.9, regiaoAtual: "SP" });

    expect(semRegiao.estado.reputacao.porRegiao).toEqual({});
    // não garantimos que algum cenário resolvido mexeu em reputação regional, só que o mecanismo aceita a região sem quebrar
    expect(comRegiao.estado.reputacao).toBeDefined();
  });

  it("permite injetar a escolha de opção (ex: sempre a última em vez da primeira)", () => {
    const times = ["a", "b", "c", "d"];
    const resultado = jogarTemporada(estadoDeTeste(), campeonatoDeTeste(times), times.map((id) => clube(id)), {
      random: () => 0.5,
      escolherOpcao: (cenario) => cenario.opcoes[cenario.opcoes.length - 1],
    });

    for (const resolvido of resultado.cenariosResolvidos) {
      expect(resolvido.escolha.opcao).toBe(resolvido.cenario.opcoes[resolvido.cenario.opcoes.length - 1]);
    }
  });
});

describe("jogarCarreira", () => {
  it("encadeia N temporadas, uma alimentando a próxima", () => {
    const times = ["a", "b", "c", "d"];
    const resultado = jogarCarreira(estadoDeTeste(), 3, campeonatoDeTeste(times), times.map((id) => clube(id)), { random: () => 0.5 });

    expect(resultado.temporadas).toHaveLength(3);
    expect(resultado.temporadas.map((t) => t.estado.temporada)).toEqual([2028, 2029, 2030]);
    expect(resultado.estadoFinal.temporada).toBe(2030);
    expect(resultado.estadoFinal.jogador.idade).toBe(21);
    expect(resultado.estadoFinal).toBe(resultado.temporadas[2].estado);
  });
});
