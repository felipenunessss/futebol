import { describe, expect, it } from "vitest";
import {
  aplicarMudancasDeDivisao,
  calcularMudancasContinentais,
  calcularMudancasDeDivisao,
  type CompeticaoParaMundoPersistente,
  type CompeticaoParaVagaContinental,
} from "../../src/career/mundo-persistente.js";
import type { LinhaTabela } from "../../src/simulation/season.js";

function linha(clubeId: string): LinhaTabela {
  return { clubeId, pontos: 0, jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, saldoDeGols: 0 };
}

describe("calcularMudancasDeDivisao", () => {
  it("rebaixamento_proxima_divisao manda os N últimos colocados pra divisão de nivel+1 da mesma chave", () => {
    const divisao1: CompeticaoParaMundoPersistente = {
      id: "serie_a",
      chaveDeHierarquia: "nacional:BR",
      nivel: 1,
      premiacao: { rebaixamento_proxima_divisao: 2 },
      tabelaFinal: ["a1", "a2", "a3", "a4"].map(linha),
    };
    const divisao2: CompeticaoParaMundoPersistente = { id: "serie_b", chaveDeHierarquia: "nacional:BR", nivel: 2, premiacao: {}, tabelaFinal: ["b1", "b2"].map(linha) };

    const mudancas = calcularMudancasDeDivisao([divisao1, divisao2]);

    const mudancaA = mudancas.find((m) => m.competicaoId === "serie_a")!;
    const mudancaB = mudancas.find((m) => m.competicaoId === "serie_b")!;
    expect(mudancaA.saem.sort()).toEqual(["a3", "a4"]); // os 2 últimos colocados (rebaixamento: 2)
    expect(mudancaA.entram).toEqual([]);
    expect(mudancaB.entram.sort()).toEqual(["a3", "a4"]);
    expect(mudancaB.saem).toEqual([]);
  });

  it("acesso_proxima_divisao manda os N primeiros colocados pra divisão de nivel-1 da mesma chave", () => {
    const divisao1: CompeticaoParaMundoPersistente = { id: "serie_a", chaveDeHierarquia: "nacional:BR", nivel: 1, premiacao: {}, tabelaFinal: ["a1", "a2"].map(linha) };
    const divisao2: CompeticaoParaMundoPersistente = {
      id: "serie_b",
      chaveDeHierarquia: "nacional:BR",
      nivel: 2,
      premiacao: { acesso_proxima_divisao: 2 },
      tabelaFinal: ["b1", "b2", "b3", "b4"].map(linha),
    };

    const mudancas = calcularMudancasDeDivisao([divisao1, divisao2]);

    const mudancaA = mudancas.find((m) => m.competicaoId === "serie_a")!;
    const mudancaB = mudancas.find((m) => m.competicaoId === "serie_b")!;
    expect(mudancaA.entram.sort()).toEqual(["b1", "b2"]); // os 2 primeiros colocados (acesso: 2)
    expect(mudancaB.saem.sort()).toEqual(["b1", "b2"]);
  });

  it("rebaixamento e acesso coexistem na mesma competição (divisão do meio de uma hierarquia de 3+)", () => {
    const serieA: CompeticaoParaMundoPersistente = { id: "a", chaveDeHierarquia: "x", nivel: 1, premiacao: {}, tabelaFinal: ["a1", "a2"].map(linha) };
    const serieB: CompeticaoParaMundoPersistente = {
      id: "b",
      chaveDeHierarquia: "x",
      nivel: 2,
      premiacao: { acesso_proxima_divisao: 1, rebaixamento_proxima_divisao: 1 },
      tabelaFinal: ["b1", "b2", "b3"].map(linha),
    };
    const serieC: CompeticaoParaMundoPersistente = { id: "c", chaveDeHierarquia: "x", nivel: 3, premiacao: {}, tabelaFinal: ["c1", "c2"].map(linha) };

    const mudancas = calcularMudancasDeDivisao([serieA, serieB, serieC]);

    expect(mudancas.find((m) => m.competicaoId === "a")!.entram).toEqual(["b1"]);
    expect(mudancas.find((m) => m.competicaoId === "b")!.saem.sort()).toEqual(["b1", "b3"]);
    expect(mudancas.find((m) => m.competicaoId === "b")!.entram).toEqual([]);
    expect(mudancas.find((m) => m.competicaoId === "c")!.entram).toEqual(["b3"]);
  });

  it("bug real evitado: não rebaixa/promove num sentido só quando a divisão vizinha não suporta tabelaFinal (evita drenar/inchar 1 lado ao longo de várias temporadas)", () => {
    const serieB: CompeticaoParaMundoPersistente = {
      id: "serie_b",
      chaveDeHierarquia: "nacional:BR",
      nivel: 2,
      premiacao: { acesso_proxima_divisao: 4, rebaixamento_proxima_divisao: 4 },
      tabelaFinal: Array.from({ length: 20 }, (_, i) => linha(`b${i + 1}`)),
    };
    // Série C sem tabelaFinal (formato ainda não suportado, ex: fase_grupos+quadrangular) — mesmo
    // tendo premiação de acesso, não deveria nem promover pra Série B nem receber rebaixados dela.
    const serieC: CompeticaoParaMundoPersistente = { id: "serie_c", chaveDeHierarquia: "nacional:BR", nivel: 3, premiacao: { acesso_proxima_divisao: 4 } };

    const mudancas = calcularMudancasDeDivisao([serieB, serieC]);

    expect(mudancas).toEqual([]);
  });

  it("não promove/rebaixa nada quando não há divisão vizinha na mesma chave (ex: única divisão de um estado pequeno)", () => {
    const unica: CompeticaoParaMundoPersistente = {
      id: "acreano_1",
      chaveDeHierarquia: "estadual:AC",
      nivel: 1,
      premiacao: { rebaixamento_proxima_divisao: 2 },
      tabelaFinal: ["x1", "x2"].map(linha),
    };
    expect(calcularMudancasDeDivisao([unica])).toEqual([]);
  });

  it("ignora competições sem tabelaFinal (formato ainda não suportado — mata-mata, fase suíça, etc)", () => {
    const semTabela: CompeticaoParaMundoPersistente = { id: "a", chaveDeHierarquia: "x", nivel: 1, premiacao: { rebaixamento_proxima_divisao: 2 } };
    const outra: CompeticaoParaMundoPersistente = { id: "b", chaveDeHierarquia: "x", nivel: 2, premiacao: {}, tabelaFinal: ["b1"].map(linha) };
    expect(calcularMudancasDeDivisao([semTabela, outra])).toEqual([]);
  });

  it("competições de chaves diferentes nunca se misturam, mesmo com nivel igual", () => {
    const mgNivel1: CompeticaoParaMundoPersistente = {
      id: "mineiro_1",
      chaveDeHierarquia: "estadual:MG",
      nivel: 1,
      premiacao: { rebaixamento_proxima_divisao: 1 },
      tabelaFinal: ["m1", "m2"].map(linha),
    };
    const spNivel1: CompeticaoParaMundoPersistente = { id: "paulistao_a1", chaveDeHierarquia: "estadual:SP", nivel: 2, premiacao: {}, tabelaFinal: ["s1", "s2"].map(linha) };
    const mudancas = calcularMudancasDeDivisao([mgNivel1, spNivel1]);
    // sem par de nivel 2 na MESMA chave "estadual:MG" — nada acontece com mineiro_1, e paulistao_a1
    // (chave diferente) não recebe nada dele.
    expect(mudancas).toEqual([]);
  });
});

describe("calcularMudancasContinentais", () => {
  const paisPorClube = new Map([
    ["cl1", "CL"],
    ["cl2", "CL"],
    ["cl3", "CL"],
    ["cl4", "CL"],
    ["cl5", "CL"],
    ["cl6", "CL"],
    ["cl_novo1", "CL"],
    ["cl_novo2", "CL"],
    ["br1", "BR"],
    ["br2", "BR"],
    ["br_campeao_copa", "BR"],
  ]);

  it("substitui a fatia de um país quando a soma das vagas resolvidas bate com o tamanho atual dela na competição continental", () => {
    const chile: CompeticaoParaVagaContinental = {
      id: "chile_primera",
      pais: "CL",
      premiacao: { vaga_libertadores: 2, vaga_sulamericana: 2 },
      tabelaFinal: ["cl_novo1", "cl_novo2", "cl3", "cl4"].map(linha),
    };
    const libertadores = { id: "libertadores", timesAtuais: ["cl1", "cl2"] }; // CL já tem 2 vagas hoje
    const sulamericana = { id: "sulamericana", timesAtuais: ["cl5", "cl6"] }; // CL já tem 2 vagas hoje

    const mudancas = calcularMudancasContinentais([chile], paisPorClube, libertadores, sulamericana);

    const mudancaLib = mudancas.find((m) => m.competicaoId === "libertadores")!;
    const mudancaSula = mudancas.find((m) => m.competicaoId === "sulamericana")!;
    expect(mudancaLib.entram.sort()).toEqual(["cl_novo1", "cl_novo2"]);
    expect(mudancaLib.saem.sort()).toEqual(["cl1", "cl2"]);
    // Sul-Americana pega os PRÓXIMOS colocados da mesma tabela, depois dos que foram pra Libertadores.
    expect(mudancaSula.entram.sort()).toEqual(["cl3", "cl4"]);
    expect(mudancaSula.saem.sort()).toEqual(["cl5", "cl6"]);
  });

  it("NÃO toca no país quando a cobertura é parcial (soma resolvida não bate com o tamanho atual da fatia) — evita encolher a representação por acidente", () => {
    // Brasil tem 2 vagas de Libertadores hoje, mas só a Copa do Brasil (1 vaga, pro campeão) está
    // modelada — a Série A (que também dá vaga) não tem `vaga_libertadores` ainda (pendência real
    // documentada em docs/dados-a-verificar.md). 1 ≠ 2, então não mexe no Brasil.
    const copaDoBrasil: CompeticaoParaVagaContinental = {
      id: "copa_do_brasil",
      pais: "BR",
      premiacao: { vaga_libertadores: 1 },
      campeao: "br_campeao_copa",
    };
    const libertadores = { id: "libertadores", timesAtuais: ["br1", "br2"] };
    const sulamericana = { id: "sulamericana", timesAtuais: [] };

    const mudancas = calcularMudancasContinentais([copaDoBrasil], paisPorClube, libertadores, sulamericana);

    expect(mudancas).toEqual([]);
  });

  it("mata-mata sem tabelaFinal: campeão leva a vaga só quando vaga_libertadores é exatamente 1", () => {
    const copaDoBrasil: CompeticaoParaVagaContinental = {
      id: "copa_do_brasil",
      pais: "BR",
      premiacao: { vaga_libertadores: 1 },
      campeao: "br_campeao_copa",
    };
    const libertadores = { id: "libertadores", timesAtuais: ["br1"] }; // Brasil tem só 1 vaga hoje, bate com a soma resolvida (1)
    const sulamericana = { id: "sulamericana", timesAtuais: [] };

    const mudancas = calcularMudancasContinentais([copaDoBrasil], paisPorClube, libertadores, sulamericana);

    const mudancaLib = mudancas.find((m) => m.competicaoId === "libertadores")!;
    expect(mudancaLib.entram).toEqual(["br_campeao_copa"]);
    expect(mudancaLib.saem).toEqual(["br1"]);
    expect(mudancas.find((m) => m.competicaoId === "sulamericana")).toBeUndefined();
  });

  it("mata-mata sem tabelaFinal não resolve vaga_sulamericana (sem tabela pra saber quem é o 'vice')", () => {
    const copaComVagaDupla: CompeticaoParaVagaContinental = {
      id: "copa_x",
      pais: "BR",
      premiacao: { vaga_libertadores: 1, vaga_sulamericana: 1 },
      campeao: "br_campeao_copa",
    };
    const libertadores = { id: "libertadores", timesAtuais: ["br1"] };
    const sulamericana = { id: "sulamericana", timesAtuais: ["br2"] };

    const mudancas = calcularMudancasContinentais([copaComVagaDupla], paisPorClube, libertadores, sulamericana);

    expect(mudancas.find((m) => m.competicaoId === "libertadores")?.entram).toEqual(["br_campeao_copa"]);
    expect(mudancas.find((m) => m.competicaoId === "sulamericana")).toBeUndefined();
  });

  it("soma vagas de MAIS DE UMA competição do mesmo país antes de comparar com a fatia atual", () => {
    const liga: CompeticaoParaVagaContinental = { id: "liga_x", pais: "CL", premiacao: { vaga_libertadores: 1 }, tabelaFinal: ["cl_novo1"].map(linha) };
    const copa: CompeticaoParaVagaContinental = { id: "copa_x", pais: "CL", premiacao: { vaga_libertadores: 1 }, campeao: "cl_novo2" };
    const libertadores = { id: "libertadores", timesAtuais: ["cl1", "cl2"] }; // 2 vagas hoje = 1 (liga) + 1 (copa)
    const sulamericana = { id: "sulamericana", timesAtuais: [] };

    const mudancas = calcularMudancasContinentais([liga, copa], paisPorClube, libertadores, sulamericana);

    expect(mudancas.find((m) => m.competicaoId === "libertadores")?.entram.sort()).toEqual(["cl_novo1", "cl_novo2"]);
  });

  it("não gera mudança nenhuma quando não há vagas resolvidas em país nenhum", () => {
    const semVaga: CompeticaoParaVagaContinental = { id: "x", pais: "AR", premiacao: {}, tabelaFinal: [linha("ar1")] };
    const mudancas = calcularMudancasContinentais([semVaga], paisPorClube, { id: "libertadores", timesAtuais: [] }, { id: "sulamericana", timesAtuais: [] });
    expect(mudancas).toEqual([]);
  });
});

describe("aplicarMudancasDeDivisao", () => {
  it("remove quem saiu e adiciona quem entrou, mantendo o resto igual", () => {
    const composicaoAtual = new Map([
      ["serie_a", ["a1", "a2", "a3"]],
      ["serie_b", ["b1", "b2"]],
    ]);
    const mudancas = [
      { competicaoId: "serie_a", entram: ["b1"], saem: ["a3"] },
      { competicaoId: "serie_b", entram: ["a3"], saem: ["b1"] },
    ];

    const nova = aplicarMudancasDeDivisao(composicaoAtual, mudancas);

    expect(nova.get("serie_a")!.sort()).toEqual(["a1", "a2", "b1"]);
    expect(nova.get("serie_b")!.sort()).toEqual(["a3", "b2"]);
  });

  it("é pura — não muta o mapa recebido", () => {
    const composicaoAtual = new Map([["serie_a", ["a1", "a2"]]]);
    aplicarMudancasDeDivisao(composicaoAtual, [{ competicaoId: "serie_a", entram: ["x"], saem: ["a1"] }]);
    expect(composicaoAtual.get("serie_a")).toEqual(["a1", "a2"]);
  });

  it("competição sem entrada prévia na composição (nunca override antes) começa de uma lista vazia", () => {
    const nova = aplicarMudancasDeDivisao(new Map(), [{ competicaoId: "serie_b", entram: ["a3"], saem: [] }]);
    expect(nova.get("serie_b")).toEqual(["a3"]);
  });
});
