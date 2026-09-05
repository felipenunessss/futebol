import { describe, expect, it } from "vitest";
import { simularTemporada } from "../../src/simulation/engine.js";
import type { Club } from "../../src/schemas/club.js";
import { buscarArquetipo, type Jogador } from "../../src/schemas/player.js";
import type { ParticipacaoJogadorClube } from "../../src/simulation/match.js";

function clube(id: string, rating = 1600): Club {
  return { id, nome: id, pais: "BR", cidade: "Cidade", rating_inicial: rating };
}

describe("simularTemporada", () => {
  it("simula pontos_corridos genérico (ex: brasileirao_serie_a) e devolve um campeão", () => {
    const times = ["a", "b", "c", "d"];
    const campeonatos = [{ id: "brasileirao_serie_a", formato: { pontos_corridos: { ida_e_volta: true, rodadas: 6 } }, times }];
    const clubes = times.map((id) => clube(id));

    const resultado = simularTemporada(2027, campeonatos, clubes, undefined, () => Math.random());
    const competicao = resultado.competicoes.find((c) => c.campeonatoId === "brasileirao_serie_a")!;

    expect(competicao.erro).toBeUndefined();
    expect(times).toContain(competicao.resultado!.campeao);
  });

  it("simula mata_mata genérico (ex: copa_do_brasil) e devolve um campeão", () => {
    const times = ["a", "b", "c", "d"];
    const campeonatos = [{ id: "copa_do_brasil", formato: { mata_mata: { fases: ["semifinal", "final"], ida_e_volta: false } }, times }];
    const clubes = times.map((id) => clube(id));

    const resultado = simularTemporada(2027, campeonatos, clubes, undefined, () => Math.random());
    const competicao = resultado.competicoes.find((c) => c.campeonatoId === "copa_do_brasil")!;

    expect(competicao.erro).toBeUndefined();
    expect(times).toContain(competicao.resultado!.campeao);
  });

  it("simula fase_grupos + mata_mata genérico (a maioria dos estaduais) e devolve um campeão", () => {
    const times = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const campeonatos = [
      {
        id: "paulistao_a1",
        formato: {
          fase_grupos: { num_grupos: 2, times_por_grupo: 4, ida_e_volta: true, classificam_por_grupo: 2 },
          mata_mata: { fases: ["semifinal", "final"], ida_e_volta: false },
        },
        times,
      },
    ];
    const clubes = times.map((id) => clube(id));

    const resultado = simularTemporada(2027, campeonatos, clubes, undefined, () => Math.random());
    const competicao = resultado.competicoes.find((c) => c.campeonatoId === "paulistao_a1")!;

    expect(competicao.erro).toBeUndefined();
    expect(times).toContain(competicao.resultado!.campeao);
  });

  it("competição com combinação de blocos sem receita vem com erro, sem derrubar as outras", () => {
    // "carioca_a" e "brasileirao_serie_a" são ids referenciados pelo calendário padrão de verdade (calendario.ts)
    const campeonatos = [
      { id: "carioca_a", formato: { turno: { ida_e_volta: false, classificam_proxima_fase: 0 }, returno: { ida_e_volta: false, classificam_proxima_fase: 0 }, final_estadual: { criterio: "x", ida_e_volta: true } }, times: ["a", "b"] },
      { id: "brasileirao_serie_a", formato: { pontos_corridos: { ida_e_volta: true, rodadas: 2 } }, times: ["a", "b"] },
    ];
    const clubes = [clube("a"), clube("b")];

    const resultado = simularTemporada(2027, campeonatos, clubes, undefined, () => Math.random());
    const carioca = resultado.competicoes.find((c) => c.campeonatoId === "carioca_a")!;
    const serieA = resultado.competicoes.find((c) => c.campeonatoId === "brasileirao_serie_a")!;

    expect(carioca.erro).toMatch(/sem receita/);
    expect(carioca.resultado).toBeUndefined();
    expect(serieA.erro).toBeUndefined();
    expect(serieA.resultado).toBeDefined();
  });

  it("competição referenciada no calendário mas ausente da lista de campeonatos vem com erro", () => {
    const resultado = simularTemporada(2027, [], [], undefined, () => Math.random());
    const qualquer = resultado.competicoes[0];
    expect(qualquer.erro).toMatch(/não encontrada/);
  });

  it("com participacaoJogador, a competição do clube dele acumula partidasDoJogador", () => {
    const times = ["a", "b", "c", "d"];
    const campeonatos = [{ id: "brasileirao_serie_a", formato: { pontos_corridos: { ida_e_volta: true, rodadas: 6 } }, times }];
    const clubes = times.map((id) => clube(id));
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: {} };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a", jogador, estiloTecnico: "equilibrado" };

    const resultado = simularTemporada(2027, campeonatos, clubes, participacao, () => Math.random());
    const competicao = resultado.competicoes.find((c) => c.campeonatoId === "brasileirao_serie_a")!;

    expect(competicao.resultado!.partidasDoJogador.length).toBeGreaterThan(0);
  });

  it("clube do jogador fora da competição: partidasDoJogador fica vazio", () => {
    const times = ["a", "b", "c", "d"];
    const campeonatos = [{ id: "brasileirao_serie_a", formato: { pontos_corridos: { ida_e_volta: true, rodadas: 6 } }, times }];
    const clubes = times.map((id) => clube(id));
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: {} };
    const participacao: ParticipacaoJogadorClube = { clubeId: "outro_clube", jogador, estiloTecnico: "equilibrado" };

    const resultado = simularTemporada(2027, campeonatos, clubes, participacao, () => Math.random());
    const competicao = resultado.competicoes.find((c) => c.campeonatoId === "brasileirao_serie_a")!;

    expect(competicao.resultado!.partidasDoJogador).toEqual([]);
  });
});
