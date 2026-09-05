import { describe, expect, it } from "vitest";
import { aplicarDeclinioPorIdade, CATEGORIA_POR_ATRIBUTO } from "../../src/progression/aging.js";
import { ATRIBUTOS_POR_POSICAO, type Atributo } from "../../src/schemas/player.js";

describe("CATEGORIA_POR_ATRIBUTO", () => {
  it("categoriza todos os atributos usados por alguma posição", () => {
    const todosOsAtributosUsados = new Set(Object.values(ATRIBUTOS_POR_POSICAO).flat());
    for (const atributo of todosOsAtributosUsados) {
      expect(CATEGORIA_POR_ATRIBUTO[atributo as Atributo]).toBeDefined();
    }
  });

  it("liderança nunca decai", () => {
    expect(CATEGORIA_POR_ATRIBUTO.lideranca).toBe("sem_declinio");
  });

  it("velocidade e força física são físicos (declinam cedo)", () => {
    expect(CATEGORIA_POR_ATRIBUTO.velocidade).toBe("fisico");
    expect(CATEGORIA_POR_ATRIBUTO.forca_fisica).toBe("fisico");
  });

  it("visão de jogo e frieza são mentais (declinam tarde)", () => {
    expect(CATEGORIA_POR_ATRIBUTO.visao_de_jogo).toBe("mental");
    expect(CATEGORIA_POR_ATRIBUTO.frieza).toBe("mental");
  });
});

describe("aplicarDeclinioPorIdade", () => {
  it("antes do pico, nenhum atributo muda", () => {
    const atributos = { velocidade: 80, visao_de_jogo: 70, lideranca: 50 };
    const resultado = aplicarDeclinioPorIdade(atributos, 20);
    expect(resultado).toEqual(atributos);
  });

  it("depois do pico físico (26), atributo físico decai", () => {
    const atributos = { velocidade: 80 };
    const resultado = aplicarDeclinioPorIdade(atributos, 27);
    expect(resultado.velocidade!).toBeLessThan(80);
  });

  it("logo depois do pico físico, atributo mental ainda não decai (pico mental é mais tarde)", () => {
    const atributos = { velocidade: 80, visao_de_jogo: 70 };
    const resultado = aplicarDeclinioPorIdade(atributos, 27);
    expect(resultado.visao_de_jogo).toBe(70);
  });

  it("depois do pico mental (30), atributo mental também decai", () => {
    const atributos = { visao_de_jogo: 70 };
    const resultado = aplicarDeclinioPorIdade(atributos, 31);
    expect(resultado.visao_de_jogo!).toBeLessThan(70);
  });

  it("físico decai mais rápido que mental na mesma idade avançada", () => {
    const atributos = { velocidade: 80, visao_de_jogo: 80 };
    const resultado = aplicarDeclinioPorIdade(atributos, 35);
    const perdaFisico = 80 - resultado.velocidade!;
    const perdaMental = 80 - resultado.visao_de_jogo!;
    expect(perdaFisico).toBeGreaterThan(perdaMental);
  });

  it("liderança nunca decai, mesmo em idade avançada", () => {
    const atributos = { lideranca: 60 };
    const resultado = aplicarDeclinioPorIdade(atributos, 40);
    expect(resultado.lideranca).toBe(60);
  });

  it("nunca deixa o atributo abaixo de 1", () => {
    const atributos = { velocidade: 2 };
    const resultado = aplicarDeclinioPorIdade(atributos, 45);
    expect(resultado.velocidade!).toBeGreaterThanOrEqual(1);
  });

  it("não muta o objeto de atributos original", () => {
    const atributos = { velocidade: 80 };
    aplicarDeclinioPorIdade(atributos, 30);
    expect(atributos.velocidade).toBe(80);
  });
});
