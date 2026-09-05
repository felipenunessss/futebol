import { describe, expect, it } from "vitest";
import { precisaVender } from "../../src/career/club-finances.js";
import type { Club } from "../../src/schemas/club.js";

function clube(extra: Partial<Club> = {}): Club {
  return { id: "a", nome: "a", pais: "BR", cidade: "Cidade", ...extra };
}

describe("precisaVender", () => {
  it("clube muito rico praticamente nunca precisa vender (random baixo ainda recusa)", () => {
    const club = clube({ forca_financeira: "muito_alta" });
    expect(precisaVender(club, () => 0.03)).toBe(false);
  });

  it("clube muito pobre precisa vender com bem mais frequência que um muito rico", () => {
    const clubRico = clube({ forca_financeira: "muito_alta" });
    const clubPobre = clube({ forca_financeira: "muito_baixa" });

    // mesmo valor de random: clube pobre cai na necessidade, rico não
    expect(precisaVender(clubRico, () => 0.1)).toBe(false);
    expect(precisaVender(clubPobre, () => 0.1)).toBe(true);
  });

  it("random abaixo da probabilidade sempre precisa vender, acima nunca", () => {
    const club = clube({ forca_financeira: "media" }); // probabilidade 0.12
    expect(precisaVender(club, () => 0)).toBe(true);
    expect(precisaVender(club, () => 0.99)).toBe(false);
  });

  it("sem forca_financeira, usa a probabilidade padrão (nem tão raro nem tão comum)", () => {
    const club = clube();
    expect(precisaVender(club, () => 0.1)).toBe(true);
    expect(precisaVender(club, () => 0.9)).toBe(false);
  });
});
