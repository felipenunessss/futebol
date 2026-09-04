import { describe, expect, it } from "vitest";
import {
  dividirEmGruposPorForca,
  dividirEmGruposSequencial,
  simularFaseDeGrupos,
  simularFaseDeGruposDoFormato,
  simularFaseQuadrangularDoFormato,
} from "../../src/simulation/groups.js";
import type { FaseGrupos, FaseQuadrangular } from "../../src/schemas/championship.js";

describe("dividirEmGruposPorForca", () => {
  const times = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ratings = { a: 2000, b: 1900, c: 1800, d: 1700, e: 1600, f: 1500, g: 1400, h: 1300 };

  it("gera o número certo de grupos, cada um com o tamanho certo", () => {
    const grupos = dividirEmGruposPorForca(times, 2, ratings);
    expect(grupos).toHaveLength(2);
    for (const grupo of grupos) expect(grupo.times).toHaveLength(4);
  });

  it("não perde nem duplica nenhum time", () => {
    const grupos = dividirEmGruposPorForca(times, 4, ratings);
    const todos = grupos.flatMap((g) => g.times);
    expect(new Set(todos).size).toBe(times.length);
    expect(todos).toHaveLength(times.length);
  });

  it("distribui os times mais fortes entre grupos diferentes (sorteio serpentina), não todos no mesmo", () => {
    const grupos = dividirEmGruposPorForca(times, 2, ratings);
    const grupoDoMaisForte = grupos.find((g) => g.times.includes("a"))!;
    const grupoDoSegundoMaisForte = grupos.find((g) => g.times.includes("b"))!;
    expect(grupoDoMaisForte.nome).not.toBe(grupoDoSegundoMaisForte.nome);
  });
});

describe("dividirEmGruposSequencial", () => {
  it("preserva a ordem original dos times, sem reordenar por rating", () => {
    const times = ["z", "y", "x", "w"];
    const grupos = dividirEmGruposSequencial(times, 2);
    expect(grupos[0].times).toEqual(["z", "y"]);
    expect(grupos[1].times).toEqual(["x", "w"]);
  });
});

describe("simularFaseDeGrupos", () => {
  const grupos = [
    { nome: "Grupo A", times: ["a", "b", "c", "d"] },
    { nome: "Grupo B", times: ["e", "f", "g", "h"] },
  ];
  const ratings = Object.fromEntries(grupos.flatMap((g) => g.times).map((t) => [t, 1600]));

  it("classifica exatamente classificamPorGrupo times de cada grupo", () => {
    const resultado = simularFaseDeGrupos(grupos, ratings, true, 2, () => Math.random());
    expect(resultado.grupos).toHaveLength(2);
    for (const grupo of resultado.grupos) expect(grupo.classificados).toHaveLength(2);
    expect(resultado.classificados).toHaveLength(4);
  });

  it("só classifica times que realmente jogaram naquele grupo", () => {
    const resultado = simularFaseDeGrupos(grupos, ratings, true, 2, () => Math.random());
    const classificadosGrupoA = resultado.grupos[0].classificados;
    for (const time of classificadosGrupoA) expect(grupos[0].times).toContain(time);
  });
});

describe("simularFaseDeGruposDoFormato", () => {
  const times = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
  const formato: FaseGrupos = { num_grupos: 2, times_por_grupo: 4, ida_e_volta: true, classificam_por_grupo: 2 };

  it("lê num_grupos/times_por_grupo/classificam_por_grupo do bloco de formato", () => {
    const resultado = simularFaseDeGruposDoFormato(formato, times, ratings, () => Math.random());
    expect(resultado.grupos).toHaveLength(2);
    expect(resultado.classificados).toHaveLength(4);
  });

  it("lança erro se o número de times não bater com num_grupos × times_por_grupo", () => {
    expect(() => simularFaseDeGruposDoFormato(formato, times.slice(0, 7), ratings)).toThrow();
    expect(() => simularFaseDeGruposDoFormato(formato, [...times, "i"], ratings)).toThrow();
  });
});

describe("simularFaseQuadrangularDoFormato", () => {
  const times = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ratings = Object.fromEntries(times.map((t) => [t, 1600]));
  const formato: FaseQuadrangular = { ativa: true, num_grupos: 2, times_por_grupo: 4, classificam_por_grupo: 2 };

  it("funciona igual a simularFaseDeGruposDoFormato (mesma estrutura, sem campo ida_e_volta próprio)", () => {
    const resultado = simularFaseQuadrangularDoFormato(formato, times, ratings, () => Math.random());
    expect(resultado.grupos).toHaveLength(2);
    expect(resultado.classificados).toHaveLength(4);
  });

  it("lança erro se formato.ativa for false", () => {
    const inativo: FaseQuadrangular = { ...formato, ativa: false };
    expect(() => simularFaseQuadrangularDoFormato(inativo, times, ratings)).toThrow(/ativa/);
  });
});
