import { describe, expect, it } from "vitest";
import { gerarAvaliacaoDeOlheiros, multiplicadorDePotencial, sortearPotencial, type NivelDePotencial } from "../../src/progression/potencial.js";

describe("sortearPotencial", () => {
  it("sempre devolve um nível válido nos extremos do random (0 e quase 1)", () => {
    expect(sortearPotencial(() => 0)).toBe("regular");
    expect(sortearPotencial(() => 0.999999)).toBe("geracional");
  });

  it("distribuição ao longo de muitos sorteios bate aproximadamente com as probabilidades da tabela (regular ~62%, geracional ~1%)", () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    const contagem: Record<string, number> = {};
    const N = 20_000;
    for (let i = 0; i < N; i++) {
      const nivel = sortearPotencial(random);
      contagem[nivel] = (contagem[nivel] ?? 0) + 1;
    }

    expect(contagem.regular! / N).toBeCloseTo(0.62, 1);
    expect(contagem.geracional! / N).toBeCloseTo(0.01, 1);
  });
});

describe("multiplicadorDePotencial", () => {
  it("regular = 1x, geracional > excepcional > talento_raro > acima_da_media > regular", () => {
    expect(multiplicadorDePotencial("regular")).toBe(1);
    expect(multiplicadorDePotencial("geracional")).toBeGreaterThan(multiplicadorDePotencial("excepcional"));
    expect(multiplicadorDePotencial("excepcional")).toBeGreaterThan(multiplicadorDePotencial("talento_raro"));
    expect(multiplicadorDePotencial("talento_raro")).toBeGreaterThan(multiplicadorDePotencial("acima_da_media"));
    expect(multiplicadorDePotencial("acima_da_media")).toBeGreaterThan(multiplicadorDePotencial("regular"));
  });

  it("undefined (jogador sem o campo) se comporta como 'regular'", () => {
    expect(multiplicadorDePotencial(undefined)).toBe(multiplicadorDePotencial("regular"));
  });
});

describe("gerarAvaliacaoDeOlheiros", () => {
  const niveis: NivelDePotencial[] = ["regular", "acima_da_media", "talento_raro", "excepcional", "geracional"];

  it("nunca foge do catálogo de níveis válidos, qualquer que seja o desvio sorteado", () => {
    for (const real of niveis) {
      for (let temporadas = 0; temporadas <= 5; temporadas++) {
        const estimativa = gerarAvaliacaoDeOlheiros(real, temporadas, Math.random);
        expect(niveis).toContain(estimativa);
      }
    }
  });

  it("com 4+ temporadas de observação, acerta sempre (largura de erro zero)", () => {
    for (const real of niveis) {
      for (let i = 0; i < 20; i++) {
        expect(gerarAvaliacaoDeOlheiros(real, 4, Math.random)).toBe(real);
        expect(gerarAvaliacaoDeOlheiros(real, 10, Math.random)).toBe(real);
      }
    }
  });

  it("nas 2 primeiras temporadas, pode errar (não trava sempre no valor real)", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    const estimativas = new Set<NivelDePotencial>();
    for (let i = 0; i < 200; i++) estimativas.add(gerarAvaliacaoDeOlheiros("talento_raro", 0, random));

    expect(estimativas.size).toBeGreaterThan(1); // varia — não é sempre exata logo de cara
  });
});
