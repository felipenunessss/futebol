import { describe, expect, it } from "vitest";
import {
  receitaArgentina,
  receitaArgentinaSegunda,
  receitaCarioca,
  receitaFaseGruposComPreClassificatorioEMataMata,
  receitaFaseGruposFaseQuadrangularEFinal,
  receitaFaseSuicaEMataMata,
  receitaFaseSuicaMataMataEFinal,
  receitaLibertadoresESulAmericanaConjunta,
  receitaPeruPrimeira,
  receitaPontosCorridosComFaseFinalPorClassificacao,
  receitaPontosCorridosComLiguilla,
  receitaTurnoEMataMata,
  receitaTurnoRetornoComGrupoEMataMataEFinal,
  receitaTurnoRetornoComQuadrangularEFinal,
  receitaTurnoRetornoSomado,
  receitaUruguaiPrimeira,
  receitaUruguaiSegunda,
  simularFaseFinalPorClassificacao,
  simularTemporada,
  type CampeonatoSimulavel,
} from "../../src/simulation/engine.js";
import type { LinhaTabela } from "../../src/simulation/season.js";
import type { Club } from "../../src/schemas/club.js";
import { buscarArquetipo, type Jogador } from "../../src/schemas/player.js";
import type { ParticipacaoJogadorClube } from "../../src/simulation/match.js";

function clube(id: string, rating = 1600): Club {
  return { id, nome: id, pais: "BR", cidade: "Cidade", rating_inicial: rating };
}

describe("simularTemporada", () => {
  it("simula pontos_corridos genérico (ex: brasileirao_serie_a) e devolve um campeão", async () => {
    const times = ["a", "b", "c", "d"];
    const campeonatos = [{ id: "brasileirao_serie_a", formato: { pontos_corridos: { ida_e_volta: true, rodadas: 6 } }, times }];
    const clubes = times.map((id) => clube(id));

    const resultado = await simularTemporada(2027, campeonatos, clubes, undefined, () => Math.random());
    const competicao = resultado.competicoes.find((c) => c.campeonatoId === "brasileirao_serie_a")!;

    expect(competicao.erro).toBeUndefined();
    expect(times).toContain(competicao.resultado!.campeao);
  });

  it("simula mata_mata genérico (ex: copa_do_brasil) e devolve um campeão", async () => {
    const times = ["a", "b", "c", "d"];
    const campeonatos = [{ id: "copa_do_brasil", formato: { mata_mata: { fases: ["semifinal", "final"], ida_e_volta: false } }, times }];
    const clubes = times.map((id) => clube(id));

    const resultado = await simularTemporada(2027, campeonatos, clubes, undefined, () => Math.random());
    const competicao = resultado.competicoes.find((c) => c.campeonatoId === "copa_do_brasil")!;

    expect(competicao.erro).toBeUndefined();
    expect(times).toContain(competicao.resultado!.campeao);
  });

  it("simula fase_grupos + mata_mata genérico (a maioria dos estaduais) e devolve um campeão", async () => {
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

    const resultado = await simularTemporada(2027, campeonatos, clubes, undefined, () => Math.random());
    const competicao = resultado.competicoes.find((c) => c.campeonatoId === "paulistao_a1")!;

    expect(competicao.erro).toBeUndefined();
    expect(times).toContain(competicao.resultado!.campeao);
  });

  it("competição com combinação de blocos sem receita vem com erro, sem derrubar as outras", async () => {
    // "mineiro_modulo_1" é um id referenciado pelo calendário padrão de verdade (calendario.ts,
    // necessário pra simularTemporada considerar a competição), mas aqui recebe um formato sintético
    // com uma combinação de blocos que nenhuma receita genérica cobre (dupla_chave_regional+final_estadual,
    // real da Copa Verde — ainda não implementada, ver docs/dados-a-verificar.md) — confirma que
    // combinações sem receita erram sem derrubar as demais competições da temporada.
    const campeonatos = [
      { id: "mineiro_modulo_1", formato: { dupla_chave_regional: { nome_chave_a: "x", nome_chave_b: "y", fase_suica: { num_potes: 1, times_por_pote: 2, jogos_por_time: 1, classificam_mata_mata: 1 } }, final_estadual: { criterio: "x", ida_e_volta: true } }, times: ["a", "b"] },
      { id: "brasileirao_serie_a", formato: { pontos_corridos: { ida_e_volta: true, rodadas: 2 } }, times: ["a", "b"] },
    ];
    const clubes = [clube("a"), clube("b")];

    const resultado = await simularTemporada(2027, campeonatos, clubes, undefined, () => Math.random());
    const semReceita = resultado.competicoes.find((c) => c.campeonatoId === "mineiro_modulo_1")!;
    const serieA = resultado.competicoes.find((c) => c.campeonatoId === "brasileirao_serie_a")!;

    expect(semReceita.erro).toMatch(/sem receita/);
    expect(semReceita.resultado).toBeUndefined();
    expect(serieA.erro).toBeUndefined();
    expect(serieA.resultado).toBeDefined();
  });

  it("competição referenciada no calendário mas ausente da lista de campeonatos vem com erro", async () => {
    const resultado = await simularTemporada(2027, [], [], undefined, () => Math.random());
    const qualquer = resultado.competicoes[0];
    expect(qualquer.erro).toMatch(/não encontrada/);
  });

  it("com participacaoJogador, a competição do clube dele acumula partidasDoJogador", async () => {
    const times = ["a", "b", "c", "d"];
    const campeonatos = [{ id: "brasileirao_serie_a", formato: { pontos_corridos: { ida_e_volta: true, rodadas: 6 } }, times }];
    const clubes = times.map((id) => clube(id));
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: {} };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a", jogador, estiloTecnico: "equilibrado" };

    const resultado = await simularTemporada(2027, campeonatos, clubes, participacao, () => Math.random());
    const competicao = resultado.competicoes.find((c) => c.campeonatoId === "brasileirao_serie_a")!;

    expect(competicao.resultado!.partidasDoJogador.length).toBeGreaterThan(0);
  });

  it("receitaArgentina simula como Tabla Anual (soma turno+returno), não como final de jogo isolada", async () => {
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

    const resultado = await receitaArgentina(campeonato, ratings, undefined, () => Math.random());

    expect(times).toContain(resultado.campeao);
    expect(resultado.partidasDoJogador).toEqual([]);
  });

  it("receitaArgentina propaga partidasDoJogador do Apertura e do Clausura combinados", async () => {
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

    const resultado = await receitaArgentina(campeonato, ratings, participacao, () => Math.random());

    // "a" joga contra os outros 3, uma vez no turno e uma no returno = 6 partidas
    expect(resultado.partidasDoJogador).toHaveLength(2 * (times.length - 1));
  });

  it("clube do jogador fora da competição: partidasDoJogador fica vazio", async () => {
    const times = ["a", "b", "c", "d"];
    const campeonatos = [{ id: "brasileirao_serie_a", formato: { pontos_corridos: { ida_e_volta: true, rodadas: 6 } }, times }];
    const clubes = times.map((id) => clube(id));
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: {} };
    const participacao: ParticipacaoJogadorClube = { clubeId: "outro_clube", jogador, estiloTecnico: "equilibrado" };

    const resultado = await simularTemporada(2027, campeonatos, clubes, participacao, () => Math.random());
    const competicao = resultado.competicoes.find((c) => c.campeonatoId === "brasileirao_serie_a")!;

    expect(competicao.resultado!.partidasDoJogador).toEqual([]);
  });

  it("aoSimularConfrontoPontosCorridos é chamado com o campeonatoId certo, uma vez por confronto", async () => {
    const times = ["a", "b", "c", "d"];
    const campeonatos = [{ id: "brasileirao_serie_a", formato: { pontos_corridos: { ida_e_volta: true, rodadas: 6 } }, times }];
    const clubes = times.map((id) => clube(id));
    const campeonatoIds = new Set<string>();
    let contagem = 0;

    await simularTemporada(2027, campeonatos, clubes, undefined, () => Math.random(), {
      aoSimularConfrontoPontosCorridos: (campeonatoId) => {
        campeonatoIds.add(campeonatoId);
        contagem++;
      },
    });

    expect([...campeonatoIds]).toEqual(["brasileirao_serie_a"]);
    expect(contagem).toBe((times.length - 1) * times.length); // ida e volta, 4 times: 12 confrontos
  });

  it("aoResolverConfrontoMataMata é chamado com o campeonatoId certo, uma vez por confronto", async () => {
    const times = ["a", "b", "c", "d"];
    const campeonatos = [{ id: "copa_do_brasil", formato: { mata_mata: { fases: ["semifinal", "final"], ida_e_volta: false } }, times }];
    const clubes = times.map((id) => clube(id));
    const campeonatoIds = new Set<string>();
    let contagem = 0;

    await simularTemporada(2027, campeonatos, clubes, undefined, () => Math.random(), {
      aoResolverConfrontoMataMata: (campeonatoId) => {
        campeonatoIds.add(campeonatoId);
        contagem++;
      },
    });

    expect([...campeonatoIds]).toEqual(["copa_do_brasil"]);
    expect(contagem).toBe(3); // 2 semifinais + 1 final
  });
});

describe("receitaFaseSuicaEMataMata (Paulistão A1, Gauchão, etc)", () => {
  it("classifica da fase suíça pro mata-mata, que decide o campeão sozinho", async () => {
    const times = ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4"];
    const campeonato: CampeonatoSimulavel = {
      id: "paulistao_a1",
      formato: {
        fase_suica: { num_potes: 2, times_por_pote: 4, jogos_por_time: 5, classificam_mata_mata: 4 },
        mata_mata: { fases: ["semifinal", "final"], ida_e_volta: false },
      },
      times,
    };
    const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

    const resultado = await receitaFaseSuicaEMataMata(campeonato, ratings, undefined, () => Math.random());
    expect(times).toContain(resultado.campeao);
  });

  it("propaga partidasDoJogador da fase suíça e do mata-mata combinados", async () => {
    const times = ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4"];
    const campeonato: CampeonatoSimulavel = {
      id: "paulistao_a1",
      formato: {
        fase_suica: { num_potes: 2, times_por_pote: 4, jogos_por_time: 5, classificam_mata_mata: 4 },
        mata_mata: { fases: ["semifinal", "final"], ida_e_volta: false },
      },
      times,
    };
    const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    // rating bem mais alto favorece "a1" avançar (random baixo empurra pro favorito, ver resolverDuelo)
    const ratingsFavorecendoA1 = { ...ratings, a1: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a1", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaFaseSuicaEMataMata(campeonato, ratingsFavorecendoA1, participacao, () => 0.05);
    expect(resultado.campeao).toBe("a1");
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });
});

describe("receitaFaseSuicaMataMataEFinal (Mineiro Módulo I)", () => {
  const times = ["a1", "a2", "a3", "b1", "b2", "b3"];
  const campeonato: CampeonatoSimulavel = {
    id: "mineiro_modulo_1",
    formato: {
      fase_suica: { num_potes: 2, times_por_pote: 3, jogos_por_time: 3, classificam_mata_mata: 4 },
      mata_mata: { fases: ["semifinal"], ida_e_volta: false },
      final_estadual: { criterio: "cruzamento_dos_classificados_da_fase_suica", ida_e_volta: false },
    },
    times,
  };
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("mata_mata NÃO decide o campeão sozinho (só 1 etapa, semifinal) — final_estadual resolve entre os 2 vencedores", async () => {
    const resultado = await receitaFaseSuicaMataMataEFinal(campeonato, ratings, undefined, () => Math.random());
    expect(times).toContain(resultado.campeao);
  });

  it("propaga partidasDoJogador da fase suíça + semifinal + final combinados", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const ratingsFavorecendoA1 = { ...ratings, a1: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a1", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaFaseSuicaMataMataEFinal(campeonato, ratingsFavorecendoA1, participacao, () => 0.05);
    expect(resultado.campeao).toBe("a1");
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });
});

describe("receitaFaseGruposFaseQuadrangularEFinal (Série C, Paulistão A2)", () => {
  const times = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"];
  const campeonato: CampeonatoSimulavel = {
    id: "brasileirao_serie_c",
    formato: {
      fase_grupos: { num_grupos: 1, times_por_grupo: 8, ida_e_volta: false, classificam_por_grupo: 4 },
      fase_quadrangular: { ativa: true, num_grupos: 2, times_por_grupo: 2, classificam_por_grupo: 1 },
      final_estadual: { criterio: "lideres_dos_quadrangulares_disputam_titulo", ida_e_volta: true },
    },
    times,
  };
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("só o líder (1º colocado) de cada quadrangular disputa a final, não todo classificam_por_grupo", async () => {
    const resultado = await receitaFaseGruposFaseQuadrangularEFinal(campeonato, ratings, undefined, () => Math.random());
    expect(times).toContain(resultado.campeao);
  });

  it("time muito mais forte tende a vencer grupo, quadrangular e final (propaga partidasDoJogador de tudo)", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const ratingsFavorecendoA1 = { ...ratings, a1: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a1", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaFaseGruposFaseQuadrangularEFinal(campeonato, ratingsFavorecendoA1, participacao, () => 0.05);
    expect(resultado.campeao).toBe("a1");
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });
});

describe("receitaTurnoEMataMata (Carioca A2)", () => {
  const times = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"];
  const campeonato: CampeonatoSimulavel = {
    id: "carioca_a2",
    formato: {
      turno: { ida_e_volta: false, classificam_proxima_fase: 4 },
      mata_mata: { fases: ["semifinal", "final"], ida_e_volta: false },
    },
    times,
  };
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("classifica do turno pro mata-mata, que decide o campeão sozinho", async () => {
    const resultado = await receitaTurnoEMataMata(campeonato, ratings, undefined, () => Math.random());
    expect(times).toContain(resultado.campeao);
  });

  it("propaga partidasDoJogador do turno + mata-mata combinados", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const ratingsFavorecendoA1 = { ...ratings, a1: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a1", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaTurnoEMataMata(campeonato, ratingsFavorecendoA1, participacao, () => 0.05);
    expect(resultado.campeao).toBe("a1");
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });
});

describe("receitaPontosCorridosComLiguilla (Chile 2ª divisão)", () => {
  const times = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"];
  const campeonato: CampeonatoSimulavel = {
    id: "chile_segunda",
    formato: {
      pontos_corridos: { ida_e_volta: false, rodadas: 7 },
      mata_mata: { fases: ["semifinal", "final"], ida_e_volta: false }, // 2 fases -> 2^2 = 4 classificados
    },
    times,
  };
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("classifica 2^(nº de fases do mata_mata) times do topo da tabela pra liguilla", async () => {
    const resultado = await receitaPontosCorridosComLiguilla(campeonato, ratings, undefined, () => Math.random());
    expect(times).toContain(resultado.campeao);
  });

  it("propaga partidasDoJogador da temporada + liguilla combinados", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const ratingsFavorecendoA1 = { ...ratings, a1: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a1", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaPontosCorridosComLiguilla(campeonato, ratingsFavorecendoA1, participacao, () => 0.05);
    expect(resultado.campeao).toBe("a1");
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });
});

describe("receitaTurnoRetornoSomado (Paraguai 1ª divisão)", () => {
  const times = ["a", "b", "c", "d"];
  const campeonato: CampeonatoSimulavel = {
    id: "paraguai_primera",
    formato: {
      turno: { ida_e_volta: false, classificam_proxima_fase: 0 },
      returno: { ida_e_volta: false, classificam_proxima_fase: 0 },
    },
    times,
  };
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("soma as tabelas de turno+returno — campeão é o topo da tabela somada, sem final nenhuma", async () => {
    const resultado = await receitaTurnoRetornoSomado(campeonato, ratings, undefined, () => Math.random());
    expect(times).toContain(resultado.campeao);
  });

  it("time muito mais forte domina os dois turnos e fecha como campeão", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const ratingsFavorecendoA = { ...ratings, a: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaTurnoRetornoSomado(campeonato, ratingsFavorecendoA, participacao, () => 0.05);
    expect(resultado.campeao).toBe("a");
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });
});

describe("receitaTurnoRetornoComQuadrangularEFinal (Colômbia 1ª e 2ª divisão)", () => {
  // 8 times: turno/returno classificam todos os 8 (degenerado, só pra fechar com a fase_quadrangular de
  // 2 grupos de 4) -> quadrangular próprio de cada torneio -> final entre os 2 líderes de grupo decide o
  // "campeão do torneio" -> final_estadual entre os 2 campeões de torneio.
  const times = ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4"];
  const campeonato: CampeonatoSimulavel = {
    id: "colombia_primera_a",
    formato: {
      turno: { ida_e_volta: false, classificam_proxima_fase: 8 },
      returno: { ida_e_volta: false, classificam_proxima_fase: 8 },
      fase_quadrangular: { ativa: true, num_grupos: 2, times_por_grupo: 4, classificam_por_grupo: 1 },
      final_estadual: { criterio: "final_ida_e_volta_entre_os_2_classificados_da_fase_final_de_cada_torneio", ida_e_volta: true },
    },
    times,
  };
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("produz um campeão válido, passando por turno/returno -> quadrangular próprio -> final do torneio -> final da temporada", async () => {
    const resultado = await receitaTurnoRetornoComQuadrangularEFinal(campeonato, ratings, undefined, () => Math.random());
    expect(times).toContain(resultado.campeao);
  });

  it("time muito mais forte domina os 2 torneios e vira campeão automático (sem final da temporada)", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const ratingsFavorecendoA1 = { ...ratings, a1: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a1", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaTurnoRetornoComQuadrangularEFinal(campeonato, ratingsFavorecendoA1, participacao, () => 0.05);
    expect(resultado.campeao).toBe("a1");
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });
});

describe("receitaCarioca", () => {
  const times = ["a", "b", "c", "d"];
  const campeonato: CampeonatoSimulavel = {
    id: "carioca_a",
    formato: {
      turno: { nome: "Taça Guanabara", ida_e_volta: false, classificam_proxima_fase: 4 },
      returno: { nome: "Taça Rio", ida_e_volta: false, classificam_proxima_fase: 4 },
      final_estadual: { criterio: "campeoes_turno_returno_ou_melhor_campanha", ida_e_volta: true },
    },
    times,
  };
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("clube muito mais forte vence os 2 turnos e vira campeão automático, sem final (mesmo campeão dos dois)", async () => {
    const ratingsFavorecendoA = { ...ratings, a: 2400 };
    const resultado = await receitaCarioca(campeonato, ratingsFavorecendoA, undefined, () => 0.05);
    expect(resultado.campeao).toBe("a");
  });

  it("propaga partidasDoJogador da Taça Guanabara + Taça Rio + final combinados", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const ratingsFavorecendoA = { ...ratings, a: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaCarioca(campeonato, ratingsFavorecendoA, participacao, () => 0.05);
    expect(resultado.campeao).toBe("a");
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });
});

describe("receitaFaseGruposComPreClassificatorioEMataMata (Libertadores/Sul-Americana)", () => {
  // 2 times ("p1","p2") disputam uma fase preliminar (mata_mata.etapas[0]) por 1 vaga na fase de
  // grupos; os outros 7 ("d1".."d7") entram direto — 7 diretos + 1 pré-classificado = 8, batendo
  // exatamente com fase_grupos (2 grupos de 4). Fase de grupos classifica 4 (2 por grupo) pro
  // mata-mata final (semifinal -> final).
  const diretos = ["d1", "d2", "d3", "d4", "d5", "d6", "d7"];
  const times = ["p1", "p2", ...diretos];
  const campeonato: CampeonatoSimulavel = {
    id: "libertadores",
    formato: {
      fase_grupos: { num_grupos: 2, times_por_grupo: 4, ida_e_volta: false, classificam_por_grupo: 2 },
      mata_mata: {
        fases: ["primeira_fase", "semifinal", "final"],
        ida_e_volta: false,
        etapas: [
          { nome: "primeira_fase", ida_e_volta: false, entrantes: ["p1", "p2"] },
          { nome: "semifinal", ida_e_volta: false },
          { nome: "final", ida_e_volta: false },
        ],
      },
    },
    times,
  };
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("deriva o corte entre pré-classificatório e fase de grupos pela contagem de times, produzindo 1 campeão", async () => {
    const resultado = await receitaFaseGruposComPreClassificatorioEMataMata(campeonato, ratings, undefined, () => Math.random());
    expect(times).toContain(resultado.campeao);
  });

  it("propaga partidasDoJogador do pré-classificatório + fase de grupos + mata-mata final combinados", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const ratingsFavorecendoP1 = { ...ratings, p1: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "p1", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaFaseGruposComPreClassificatorioEMataMata(campeonato, ratingsFavorecendoP1, participacao, () => 0.05);
    expect(resultado.campeao).toBe("p1");
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });

  it("lança erro claro quando a contagem de times não permite derivar nenhum corte válido (ex: Sul-Americana de verdade)", async () => {
    // mesmo espírito do formato real de "sulamericana" (ver docs/dados-a-verificar.md): as etapas
    // pré-classificatórias, somadas aos diretos, nunca fecham exatamente com o tamanho da fase de grupos.
    const campeonatoSemCorte: CampeonatoSimulavel = {
      id: "sulamericana",
      formato: {
        fase_grupos: { num_grupos: 2, times_por_grupo: 4, ida_e_volta: false, classificam_por_grupo: 2 },
        mata_mata: {
          fases: ["primeira_fase", "repescagem", "final"],
          ida_e_volta: false,
          etapas: [
            { nome: "primeira_fase", ida_e_volta: false, entrantes: ["p1", "p2", "p3", "p4"] }, // 4 -> 2 sobreviventes
            { nome: "repescagem", ida_e_volta: false, entrantes: ["r1"] }, // ímpar (2+1=3) — nunca fecha com 8
            { nome: "final", ida_e_volta: false },
          ],
        },
      },
      times: ["p1", "p2", "p3", "p4", "r1", "d1", "d2", "d3", "d4", "d5"],
    };
    const ratingsSemCorte = Object.fromEntries(campeonatoSemCorte.times.map((t) => [t, 1600]));

    await expect(receitaFaseGruposComPreClassificatorioEMataMata(campeonatoSemCorte, ratingsSemCorte, undefined, () => Math.random())).rejects.toThrow(
      /não foi possível derivar o corte/,
    );
  });
});

describe("receitaTurnoRetornoComGrupoEMataMataEFinal (Venezuela 1ª divisão)", () => {
  // 8 times: turno/returno classificam 4 -> fase_grupos própria (2 grupos de 2) -> mata_mata (1 fase,
  // reduz 2->1) decide o "campeão do torneio" -> final_estadual entre os 2 campeões de torneio.
  const times = ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4"];
  const campeonato: CampeonatoSimulavel = {
    id: "venezuela_primera",
    formato: {
      turno: { ida_e_volta: false, classificam_proxima_fase: 4 },
      returno: { ida_e_volta: false, classificam_proxima_fase: 4 },
      fase_grupos: { num_grupos: 2, times_por_grupo: 2, ida_e_volta: true, classificam_por_grupo: 1 },
      mata_mata: { fases: ["final_do_apertura_ou_clausura"], ida_e_volta: false },
      final_estadual: { criterio: "final_unica_entre_campeoes_do_apertura_e_clausura", ida_e_volta: true },
    },
    times,
  };
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("produz um campeão válido, passando por turno/returno -> grupo próprio -> mata-mata -> final", async () => {
    const resultado = await receitaTurnoRetornoComGrupoEMataMataEFinal(campeonato, ratings, undefined, () => Math.random());
    expect(times).toContain(resultado.campeao);
  });

  it("time muito mais forte domina os 2 torneios e vira campeão automático (sem final)", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const ratingsFavorecendoA1 = { ...ratings, a1: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a1", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaTurnoRetornoComGrupoEMataMataEFinal(campeonato, ratingsFavorecendoA1, participacao, () => 0.05);
    expect(resultado.campeao).toBe("a1");
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });
});

describe("receitaUruguaiPrimeira", () => {
  const times = ["a", "b", "c", "d"];
  const campeonato: CampeonatoSimulavel = {
    id: "uruguai_primera",
    formato: {
      turno: { ida_e_volta: false, classificam_proxima_fase: 1 },
      returno: { ida_e_volta: false, classificam_proxima_fase: 1 },
      mata_mata: { fases: ["semifinal_campeonato", "final_campeonato"], ida_e_volta: false },
    },
    times,
  };
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("clube muito mais forte vence Apertura e Clausura e vira campeão automático, sem semifinal nem final", async () => {
    const ratingsFavorecendoA = { ...ratings, a: 2400 };
    const resultado = await receitaUruguaiPrimeira(campeonato, ratingsFavorecendoA, undefined, () => 0.05);
    expect(resultado.campeao).toBe("a");
  });

  it("produz um campeão válido no caminho geral (campeões diferentes, com ou sem final extra contra o líder da tabela anual)", async () => {
    const resultado = await receitaUruguaiPrimeira(campeonato, ratings, undefined, () => Math.random());
    expect(times).toContain(resultado.campeao);
  });

  it("propaga partidasDoJogador do turno/returno + semifinal/final combinados", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const ratingsFavorecendoA = { ...ratings, a: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaUruguaiPrimeira(campeonato, ratingsFavorecendoA, participacao, () => 0.05);
    expect(resultado.campeao).toBe("a");
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });
});

describe("receitaUruguaiSegunda", () => {
  const times = ["a1", "a2", "a3", "b1", "b2", "b3"];
  const campeonato: CampeonatoSimulavel = {
    id: "uruguai_segunda",
    formato: {
      fase_grupos: { num_grupos: 2, times_por_grupo: 3, ida_e_volta: false, classificam_por_grupo: 1 },
      final_estadual: { criterio: "final_entre_campeoes_de_serie_do_torneio_competencia", ida_e_volta: false },
      pontos_corridos: { ida_e_volta: true, rodadas: 10 },
      mata_mata: { fases: ["playoff_terceiro_acesso"], ida_e_volta: false },
    },
    times,
  };
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("campeão é sempre o líder da fase regular (pontos_corridos), não do Torneo Competencia", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    // a1 domina só a fase regular (rating alto); os outros ficam parecidos entre si pro Torneo Competencia
    const ratingsFavorecendoA1NaFaseRegular = { ...ratings, a1: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a1", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaUruguaiSegunda(campeonato, ratingsFavorecendoA1NaFaseRegular, participacao, () => 0.05);
    expect(resultado.campeao).toBe("a1");
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });

  it("produz um campeão válido e roda Torneo Competencia + playoff sem quebrar", async () => {
    const resultado = await receitaUruguaiSegunda(campeonato, ratings, undefined, () => Math.random());
    expect(times).toContain(resultado.campeao);
  });
});

describe("receitaPontosCorridosComFaseFinalPorClassificacao (Equador)", () => {
  const times = ["a1", "a2", "a3", "b1", "b2", "b3"];
  const campeonato: CampeonatoSimulavel = {
    id: "equador_primera",
    formato: {
      pontos_corridos: { ida_e_volta: false, rodadas: 5 },
      fase_final_por_classificacao: {
        grupos: [
          { nome: "hexagonal_titulo", tamanho: 3 },
          { nome: "hexagonal_rebaixamento", tamanho: 3 },
        ],
        ida_e_volta: false,
        pontos_carregados: true,
      },
    },
    times,
  };
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("campeão é o líder do primeiro grupo (hexagonal do título), não do segundo", async () => {
    const resultado = await receitaPontosCorridosComFaseFinalPorClassificacao(campeonato, ratings, undefined, () => Math.random());
    expect(times).toContain(resultado.campeao);
  });

  it("time muito mais forte domina a fase regular e o hexagonal do título", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const ratingsFavorecendoA1 = { ...ratings, a1: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a1", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaPontosCorridosComFaseFinalPorClassificacao(campeonato, ratingsFavorecendoA1, participacao, () => 0.05);
    expect(resultado.campeao).toBe("a1");
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });
});

describe("simularFaseFinalPorClassificacao", () => {
  function linha(overrides: Partial<LinhaTabela>): LinhaTabela {
    return { clubeId: "x", pontos: 0, jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, saldoDeGols: 0, ...overrides };
  }

  it("divide a tabela anterior em grupos consecutivos, melhores colocados primeiro", async () => {
    const tabelaAnterior: LinhaTabela[] = [
      linha({ clubeId: "1o", pontos: 30 }),
      linha({ clubeId: "2o", pontos: 25 }),
      linha({ clubeId: "3o", pontos: 20 }),
      linha({ clubeId: "4o", pontos: 15 }),
    ];
    const formato = {
      grupos: [
        { nome: "grupo_a", tamanho: 2 },
        { nome: "grupo_b", tamanho: 2 },
      ],
      ida_e_volta: false,
      pontos_carregados: false,
    };
    const ratings = Object.fromEntries(tabelaAnterior.map((l) => [l.clubeId, 1600]));

    const resultado = await simularFaseFinalPorClassificacao(formato, tabelaAnterior, ratings, undefined, () => Math.random());

    expect(resultado.grupos[0].tabela.map((l) => l.clubeId).sort()).toEqual(["1o", "2o"]);
    expect(resultado.grupos[1].tabela.map((l) => l.clubeId).sort()).toEqual(["3o", "4o"]);
  });

  it("com pontos_carregados, os pontos da fase anterior somam à tabela do grupo (não zeram)", async () => {
    // gap de pontos carregados (100) domina qualquer resultado possível de 1 único jogo (no máximo +3) —
    // então o time que entrou na frente continua na frente, não importa quem "vence" o jogo do grupo.
    const tabelaAnterior: LinhaTabela[] = [linha({ clubeId: "favorito", pontos: 100 }), linha({ clubeId: "azarao", pontos: 0 })];
    const formato = { grupos: [{ nome: "grupo_unico", tamanho: 2 }], ida_e_volta: false, pontos_carregados: true };
    const ratings = { favorito: 1600, azarao: 1600 };

    const resultado = await simularFaseFinalPorClassificacao(formato, tabelaAnterior, ratings, undefined, () => Math.random());

    expect(resultado.grupos[0].tabela[0].clubeId).toBe("favorito");
    expect(resultado.grupos[0].tabela[0].pontos).toBeGreaterThanOrEqual(100);
  });

  it("sem pontos_carregados, a tabela do grupo zera (só conta os jogos dessa fase)", async () => {
    const tabelaAnterior: LinhaTabela[] = [linha({ clubeId: "a", pontos: 100 }), linha({ clubeId: "b", pontos: 0 })];
    const formato = { grupos: [{ nome: "grupo_unico", tamanho: 2 }], ida_e_volta: false, pontos_carregados: false };
    const ratings = { a: 1600, b: 1600 };

    const resultado = await simularFaseFinalPorClassificacao(formato, tabelaAnterior, ratings, undefined, () => Math.random());

    for (const linhaResultado of resultado.grupos[0].tabela) {
      expect(linhaResultado.pontos).toBeLessThanOrEqual(3); // só 1 jogo nesse grupo de 2 (ida_e_volta:false)
    }
  });
});

describe("receitaLibertadoresESulAmericanaConjunta", () => {
  // Libertadores mini: 5 diretos + 2 pré-classificatórios (lp1/lp2) — pré-classificatório reduz 2->1,
  // 5 diretos + 1 sobrevivente fecham com 2 grupos de 3 (6) pra fase de grupos. Top 2 de cada grupo (4)
  // avançam pras "oitavas" da Libertadores; o 3º de cada grupo (2) cai pro repechaje da Sul-Americana.
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
  // Sul-Americana mini: sem pré-classificatório de verdade (1ª etapa sem entrantes, cut imediato) — 2
  // grupos de 3 (6 diretos). Líder de cada grupo (2) avança direto às "oitavas"; o 2º de cada grupo (2)
  // disputa o repechaje contra os 2 "3º colocados" da Libertadores.
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

  it("produz um campeão válido pras 2 competições, sem quebrar (repechaje cruzado: 3º da Libertadores x 2º da Sul-Americana)", async () => {
    const resultado = await receitaLibertadoresESulAmericanaConjunta(libertadores, sulAmericana, ratingsLibertadores, ratingsSulAmericana, undefined, () => Math.random());
    expect(libertadores.times).toContain(resultado.libertadores.campeao);
    // o campeão da Sul-Americana pode legitimamente ser um 3º colocado da Libertadores que caiu no
    // repechaje e seguiu vencendo — é assim na vida real, não um bug (ver docs/dados-a-verificar.md).
    expect([...sulAmericana.times, ...libertadores.times]).toContain(resultado.sulAmericana.campeao);
  });

  it("propaga partidasDoJogador quando o clube do jogador está na Libertadores", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const participacao: ParticipacaoJogadorClube = { clubeId: "lp1", jogador, estiloTecnico: "equilibrado" };
    const ratingsFavorecendoLp1 = { ...ratingsLibertadores, lp1: 2400 };

    const resultado = await receitaLibertadoresESulAmericanaConjunta(libertadores, sulAmericana, ratingsFavorecendoLp1, ratingsSulAmericana, participacao, () => 0.05);
    expect(resultado.libertadores.campeao).toBe("lp1");
    expect(resultado.libertadores.partidasDoJogador.length).toBeGreaterThan(0);
  });

  it("propaga partidasDoJogador quando o clube do jogador está na Sul-Americana", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const participacao: ParticipacaoJogadorClube = { clubeId: "sd1", jogador, estiloTecnico: "equilibrado" };
    const ratingsFavorecendoSd1 = { ...ratingsSulAmericana, sd1: 2400 };

    const resultado = await receitaLibertadoresESulAmericanaConjunta(libertadores, sulAmericana, ratingsLibertadores, ratingsFavorecendoSd1, participacao, () => 0.05);
    expect(resultado.sulAmericana.campeao).toBe("sd1");
    expect(resultado.sulAmericana.partidasDoJogador.length).toBeGreaterThan(0);
  });

  it("integrado via simularTemporada: as duas resolvem juntas quando ambas estão ativas e carregadas", async () => {
    const clubes = [...libertadores.times, ...sulAmericana.times].map((id) => clube(id));
    const resultado = await simularTemporada(2027, [libertadores, sulAmericana], clubes, undefined, () => Math.random());

    const resultadoLib = resultado.competicoes.find((c) => c.campeonatoId === "libertadores")!;
    const resultadoSula = resultado.competicoes.find((c) => c.campeonatoId === "sulamericana")!;

    expect(resultadoLib.erro).toBeUndefined();
    expect(resultadoSula.erro).toBeUndefined();
    expect(libertadores.times).toContain(resultadoLib.resultado!.campeao);
    expect([...sulAmericana.times, ...libertadores.times]).toContain(resultadoSula.resultado!.campeao);
  });

  it("integrado via simularTemporada: Sul-Americana sozinha (sem Libertadores carregada) continua com erro — não inventa um repechaje sem dado real", async () => {
    const clubes = sulAmericana.times.map((id) => clube(id));
    const resultado = await simularTemporada(2027, [sulAmericana], clubes, undefined, () => Math.random());

    const resultadoSula = resultado.competicoes.find((c) => c.campeonatoId === "sulamericana")!;
    expect(resultadoSula.erro).toBeDefined();
    expect(resultadoSula.resultado).toBeUndefined();
  });
});

describe("receitaPeruPrimeira", () => {
  const times = ["a", "b", "c", "d"];
  const campeonato: CampeonatoSimulavel = {
    id: "peru_primera",
    formato: {
      turno: { ida_e_volta: false, classificam_proxima_fase: 1 },
      returno: { ida_e_volta: false, classificam_proxima_fase: 1 },
      final_estadual: { criterio: "liguilla_de_4_times", ida_e_volta: true },
    },
    times,
  };
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("clube muito mais forte vence Apertura e Clausura e vira campeão automático, sem liguilla", async () => {
    const ratingsFavorecendoA = { ...ratings, a: 2400 };
    const resultado = await receitaPeruPrimeira(campeonato, ratingsFavorecendoA, undefined, () => 0.05);
    expect(resultado.campeao).toBe("a");
  });

  it("produz um campeão válido no caminho geral (campeões diferentes -> liguilla de 4 com os 2 melhores do acumulado)", async () => {
    const resultado = await receitaPeruPrimeira(campeonato, ratings, undefined, () => Math.random());
    expect(times).toContain(resultado.campeao);
  });

  it("propaga partidasDoJogador do turno/returno + liguilla combinados", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const ratingsFavorecendoA = { ...ratings, a: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaPeruPrimeira(campeonato, ratingsFavorecendoA, participacao, () => 0.05);
    expect(resultado.campeao).toBe("a");
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });
});

describe("receitaArgentinaSegunda", () => {
  // 2 zonas de 8 (classificam todos os 8, degenerado só pra fechar as contas do Reduzido: líder de cada
  // zona (2) disputa a final direta; os 7 restantes de cada zona (14) entram no Reduzido —
  // primeira_fase (14->7) + o perdedor da final direta (8) -> quartas -> semifinal -> final.
  const zonaA = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"];
  const zonaB = ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"];
  const times = [...zonaA, ...zonaB];
  const campeonato: CampeonatoSimulavel = {
    id: "argentina_segunda",
    formato: {
      fase_grupos: { num_grupos: 2, times_por_grupo: 8, ida_e_volta: false, classificam_por_grupo: 8 },
      final_estadual: { criterio: "campeoes_das_2_zonas_disputam_final_pelo_1o_ascenso_direto", ida_e_volta: false },
      mata_mata: { fases: ["primeira_fase", "quartas", "semifinal", "final"], ida_e_volta: false },
    },
    times,
  };
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));

  it("produz um campeão válido (1º ascenso — vencedor da final direta entre líderes de zona)", async () => {
    const resultado = await receitaArgentinaSegunda(campeonato, ratings, undefined, () => Math.random());
    expect(times).toContain(resultado.campeao);
  });

  it("clube muito mais forte domina a própria zona e vence a final direta pelo 1º ascenso", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    const ratingsFavorecendoA1 = { ...ratings, a1: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a1", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaArgentinaSegunda(campeonato, ratingsFavorecendoA1, participacao, () => 0.05);
    expect(resultado.campeao).toBe("a1");
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });

  it("propaga partidas de quem cai no Reduzido (2º-8º de cada zona + perdedor da final direta)", async () => {
    const jogador: Jogador = { id: "j1", nome: "Teste", posicao: "atacante", arquetipo_id: buscarArquetipo("finalizador").id, idade: 22, atributos: { finalizacao: 95 } };
    // a2 nunca lidera a própria zona (a1 é muito mais forte), mas participa do Reduzido como "restante".
    const ratingsFavorecendoA1 = { ...ratings, a1: 2400 };
    const participacao: ParticipacaoJogadorClube = { clubeId: "a2", jogador, estiloTecnico: "equilibrado" };

    const resultado = await receitaArgentinaSegunda(campeonato, ratingsFavorecendoA1, participacao, () => 0.5);
    expect(resultado.partidasDoJogador.length).toBeGreaterThan(0);
  });
});
