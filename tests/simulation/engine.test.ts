import { describe, expect, it } from "vitest";
import { receitaArgentina, simularTemporada, type CampeonatoSimulavel } from "../../src/simulation/engine.js";
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
    // "carioca_a" tem a MESMA combinação de blocos que "argentina_primera" (final_estadual+returno+turno),
    // mas não tem receita por id registrada — confirma que a receita da Argentina é por id, não por formato.
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

  it("receitaArgentina simula como Tabla Anual (soma turno+returno), não como final de jogo isolada", () => {
    // "argentina_primera" ainda não é referenciada pelo calendário padrão (ver comentário da receita
    // em engine.ts), então testamos a função diretamente em vez de passar por simularTemporada.
    const times = ["a", "b", "c", "d"];
    const campeonato: CampeonatoSimulavel = {
      id: "argentina_primera",
      formato: {
        turno: { ida_e_volta: false, classificam_proxima_fase: 0 },
        returno: { ida_e_volta: false, classificam_proxima_fase: 0 },
        final_estadual: { criterio: "tabela_anual_soma_pontos_apertura_e_clausura_define_campeao_de_liga", ida_e_volta: false },
      },
      times,
    };
    const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

    const resultado = receitaArgentina(campeonato, ratings, undefined, () => Math.random());

    expect(times).toContain(resultado.campeao);
    expect(resultado.partidasDoJogador).toEqual([]);
  });

  it("receitaArgentina propaga partidasDoJogador do Apertura e do Clausura combinados", () => {
    const times = ["a", "b", "c", "d"];
    const campeonato: CampeonatoSimulavel = {
      id: "argentina_primera",
      formato: {
        turno: { ida_e_volta: false, classificam_proxima_fase: 0 },
        returno: { ida_e_volta: false, classificam_proxima_fase: 0 },
        final_estadual: { criterio: "tabela_anual_soma_pontos_apertura_e_clausura_define_campeao_de_liga", ida_e_volta: false },
      },
      times,
    };
    const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: {} };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a", jogador, estiloTecnico: "equilibrado" };

    const resultado = receitaArgentina(campeonato, ratings, participacao, () => Math.random());

    // "a" joga contra os outros 3, uma vez no turno e uma no returno = 6 partidas
    expect(resultado.partidasDoJogador).toHaveLength(2 * (times.length - 1));
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

  it("aoSimularConfrontoPontosCorridos é chamado com o campeonatoId certo, uma vez por confronto", () => {
    const times = ["a", "b", "c", "d"];
    const campeonatos = [{ id: "brasileirao_serie_a", formato: { pontos_corridos: { ida_e_volta: true, rodadas: 6 } }, times }];
    const clubes = times.map((id) => clube(id));
    const campeonatoIds = new Set<string>();
    let contagem = 0;

    simularTemporada(2027, campeonatos, clubes, undefined, () => Math.random(), {
      aoSimularConfrontoPontosCorridos: (campeonatoId) => {
        campeonatoIds.add(campeonatoId);
        contagem++;
      },
    });

    expect([...campeonatoIds]).toEqual(["brasileirao_serie_a"]);
    expect(contagem).toBe((times.length - 1) * times.length); // ida e volta, 4 times: 12 confrontos
  });

  it("aoResolverConfrontoMataMata é chamado com o campeonatoId certo, uma vez por confronto", () => {
    const times = ["a", "b", "c", "d"];
    const campeonatos = [{ id: "copa_do_brasil", formato: { mata_mata: { fases: ["semifinal", "final"], ida_e_volta: false } }, times }];
    const clubes = times.map((id) => clube(id));
    const campeonatoIds = new Set<string>();
    let contagem = 0;

    simularTemporada(2027, campeonatos, clubes, undefined, () => Math.random(), {
      aoResolverConfrontoMataMata: (campeonatoId) => {
        campeonatoIds.add(campeonatoId);
        contagem++;
      },
    });

    expect([...campeonatoIds]).toEqual(["copa_do_brasil"]);
    expect(contagem).toBe(3); // 2 semifinais + 1 final
  });
});
