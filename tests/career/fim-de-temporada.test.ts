import { describe, expect, it } from "vitest";
import { criarEstadoInicial } from "../../src/career/Player.js";
import { aplicarEscolhaDeFimDeTemporada, gerarPropostasDeFimDeTemporada } from "../../src/career/fim-de-temporada.js";
import type { Club } from "../../src/schemas/club.js";

function clube(id: string, rating = 1600, forcaFinanceira: Club["forca_financeira"] = "media"): Club {
  return { id, nome: id, pais: "BR", cidade: "Cidade", estado: "SP", rating_inicial: rating, forca_financeira: forcaFinanceira };
}

function estadoDeTeste() {
  return criarEstadoInicial({
    id: "j1",
    nome: "Jogador Teste",
    posicao: "atacante",
    arquetipoId: "finalizador",
    clubeInicialId: "a",
    temporadaInicial: 2027,
    random: () => 0.5,
  });
}

describe("gerarPropostasDeFimDeTemporada", () => {
  it("sempre gera uma proposta de renovação do clube atual", () => {
    const clubes = [clube("a"), clube("b", 1800, "muito_alta"), clube("c"), clube("d")];
    const propostas = gerarPropostasDeFimDeTemporada(estadoDeTeste(), clubes, () => 0.5);

    expect(propostas.renovacao).toBeDefined();
    expect(propostas.renovacao!.clubeOfertanteId).toBe("a");
  });

  it("gera propostas de outros clubes interessados, no máximo 3", () => {
    const clubes = [clube("a", 1600, "baixa"), clube("b", 1800, "muito_alta"), clube("c", 1800, "muito_alta"), clube("d", 1800, "muito_alta"), clube("e", 1800, "muito_alta"), clube("f", 1800, "muito_alta")];
    const propostas = gerarPropostasDeFimDeTemporada({ ...estadoDeTeste(), statusNoClube: "titular" }, clubes, () => 0.5);

    expect(propostas.propostas.length).toBeLessThanOrEqual(3);
    for (const p of propostas.propostas) {
      expect(p.clubeOfertanteId).not.toBe("a");
    }
  });

  it("sem clube atual reconhecível na lista de clubes, não gera renovação", () => {
    const clubes = [clube("b"), clube("c"), clube("d")]; // "a" (clube atual do estado de teste) não está na lista
    const propostas = gerarPropostasDeFimDeTemporada(estadoDeTeste(), clubes, () => 0.5);
    expect(propostas.renovacao).toBeUndefined();
  });
});

describe("aplicarEscolhaDeFimDeTemporada", () => {
  it("'renovar' assina contrato com o próprio clube atual", () => {
    const clubes = [clube("a"), clube("b", 1800, "muito_alta")];
    const estado = estadoDeTeste();
    const propostas = gerarPropostasDeFimDeTemporada(estado, clubes, () => 0.5);

    const depois = aplicarEscolhaDeFimDeTemporada(estado, propostas, { tipo: "renovar" });

    expect(depois.clubeAtualId).toBe("a");
    expect(depois.contratoAtual).toBeDefined();
    expect(depois.contratoAtual!.clubeId).toBe("a");
    expect(depois.contratoAtual!.salarioMensal).toBe(propostas.renovacao!.propostaInicial.salarioMensal);
  });

  it("'transferir' assina contrato com o clube ofertante escolhido e muda clubeAtualId", () => {
    const clubes = [clube("a", 1600, "baixa"), clube("b", 1800, "muito_alta"), clube("c", 1600, "baixa"), clube("d", 1600, "baixa")];
    const estado = { ...estadoDeTeste(), statusNoClube: "titular" as const };
    const propostas = gerarPropostasDeFimDeTemporada(estado, clubes, () => 0.5);
    expect(propostas.propostas.length).toBeGreaterThan(0);
    const alvo = propostas.propostas[0];

    const depois = aplicarEscolhaDeFimDeTemporada(estado, propostas, { tipo: "transferir", clubeOfertanteId: alvo.clubeOfertanteId });

    expect(depois.clubeAtualId).toBe(alvo.clubeOfertanteId);
    expect(depois.contratoAtual?.clubeId).toBe(alvo.clubeOfertanteId);
  });

  it("'ficar_sem_assinar' não muda nada no estado", () => {
    const clubes = [clube("a"), clube("b", 1800, "muito_alta")];
    const estado = estadoDeTeste();
    const propostas = gerarPropostasDeFimDeTemporada(estado, clubes, () => 0.5);

    const depois = aplicarEscolhaDeFimDeTemporada(estado, propostas, { tipo: "ficar_sem_assinar" });

    expect(depois).toBe(estado);
  });

  it("'transferir' com clubeOfertanteId que não está nas propostas não muda nada", () => {
    const clubes = [clube("a"), clube("b", 1800, "muito_alta")];
    const estado = estadoDeTeste();
    const propostas = gerarPropostasDeFimDeTemporada(estado, clubes, () => 0.5);

    const depois = aplicarEscolhaDeFimDeTemporada(estado, propostas, { tipo: "transferir", clubeOfertanteId: "clube_inexistente" });

    expect(depois).toBe(estado);
  });
});
