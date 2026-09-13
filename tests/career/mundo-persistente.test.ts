import { describe, expect, it } from "vitest";
import { aplicarMudancasDeDivisao, calcularMudancasDeDivisao, type CompeticaoParaMundoPersistente } from "../../src/career/mundo-persistente.js";
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
