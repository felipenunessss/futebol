import { describe, expect, it } from "vitest";
import { buscarArquetipo, type Jogador } from "../../src/schemas/player.js";
import { gerarPerfilTime, probabilidadeDeVencer, resolverChanceJogador, simularPartida, type PerfilTime } from "../../src/simulation/match.js";

describe("gerarPerfilTime", () => {
  it("com random determinístico em 0.5 (sem ruído), as 3 zonas ficam exatamente no rating", () => {
    const perfil = gerarPerfilTime(1600, () => 0.5);
    expect(perfil).toEqual({ defesa: 1600, meio: 1600, ataque: 1600 });
  });

  it("varia as zonas em torno do rating quando o random não é sempre 0.5", () => {
    let chamada = 0;
    const sequencia = [0.9, 0.1, 0.5];
    const perfil = gerarPerfilTime(1600, () => sequencia[chamada++]);
    expect(perfil.defesa).toBeGreaterThan(1600);
    expect(perfil.meio).toBeLessThan(1600);
    expect(perfil.ataque).toBe(1600);
  });
});

describe("probabilidadeDeVencer", () => {
  it("dá 0.5 pra forças iguais", () => {
    expect(probabilidadeDeVencer(1600, 1600)).toBeCloseTo(0.5);
  });

  it("favorece quem tem mais força", () => {
    expect(probabilidadeDeVencer(1800, 1500)).toBeGreaterThan(0.5);
  });
});

describe("simularPartida", () => {
  const perfilNeutro: PerfilTime = { defesa: 1600, meio: 1600, ataque: 1600 };

  it("times com perfis idênticos dividem as chances igualmente", () => {
    const resultado = simularPartida(perfilNeutro, perfilNeutro, () => 0.5);
    expect(resultado.chancesCasa).toBe(resultado.chancesFora);
  });

  it("time com ataque muito mais forte tende a marcar mais gols com o mesmo random", () => {
    const casaForte: PerfilTime = { defesa: 1600, meio: 1600, ataque: 2200 };
    const foraFraco: PerfilTime = { defesa: 1000, meio: 1600, ataque: 1600 };

    // random baixo favorece o "A" de cada duelo (ver resolverDuelo) — aqui "A" é sempre o time de ataque em avaliação
    const resultado = simularPartida(casaForte, foraFraco, () => 0.3);
    expect(resultado.golsCasa).toBeGreaterThan(0);
  });

  it("nunca gera número negativo de chances ou gols", () => {
    const resultado = simularPartida(perfilNeutro, perfilNeutro, () => Math.random());
    expect(resultado.chancesCasa).toBeGreaterThanOrEqual(0);
    expect(resultado.chancesFora).toBeGreaterThanOrEqual(0);
    expect(resultado.golsCasa).toBeGreaterThanOrEqual(0);
    expect(resultado.golsFora).toBeGreaterThanOrEqual(0);
  });
});

describe("resolverChanceJogador", () => {
  const finalizador = buscarArquetipo("finalizador");
  const artilheiro: Jogador = {
    id: "j1",
    nome: "Artilheiro Teste",
    posicao: "atacante",
    arquetipo_id: finalizador.id,
    idade: 24,
    atributos: { finalizacao: 95, frieza: 90, posicionamento_ofensivo: 90, drible: 60, velocidade: 60, cabeceio: 60, protecao_de_bola: 60, movimentacao: 60 },
  };

  it("jogador com atributo muito acima da defesa adversária tende a ter sucesso", () => {
    const chance = resolverChanceJogador(artilheiro, "equilibrado", 1000, () => 0.1);
    expect(chance.sucesso).toBe(true);
  });

  it("retorna o atributo correspondente ao subtipo sorteado", () => {
    const chance = resolverChanceJogador(artilheiro, "jogo_aereo", 1500, () => 0.5);
    expect(["finalizacao", "cabeceio", "drible", "visao_de_jogo", "desarme"]).toContain(chance.atributoUsado);
  });
});
