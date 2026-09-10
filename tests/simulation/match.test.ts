import { describe, expect, it } from "vitest";
import { buscarArquetipo, type Jogador } from "../../src/schemas/player.js";
import {
  foraDeCombatePorIncidente,
  gerarPerfilTime,
  incidenteEncerraParticipacao,
  probabilidadeDeVencer,
  resolverChanceJogador,
  simularPartida,
  sortearIncidenteDeJogador,
  type ParticipacaoJogador,
  type PerfilTime,
} from "../../src/simulation/match.js";

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

  it("sem participação do jogador, chancesJogador fica vazio", () => {
    const resultado = simularPartida(perfilNeutro, perfilNeutro, () => 0.5);
    expect(resultado.chancesJogador).toEqual([]);
  });

  it("com um atacante em campo e random sempre no início da faixa, todas as chances do lado dele viram chance individual", () => {
    const finalizador = buscarArquetipo("finalizador");
    const artilheiro: Jogador = {
      id: "j1",
      nome: "Artilheiro Teste",
      posicao: "atacante",
      arquetipo_id: finalizador.id,
      idade: 24,
      atributos: { finalizacao: 90, frieza: 80, posicionamento_ofensivo: 80 },
    };
    const participacao: ParticipacaoJogador = { lado: "casa", jogador: artilheiro, estiloTecnico: "equilibrado" };

    const resultado = simularPartida(perfilNeutro, perfilNeutro, () => 0, participacao);

    expect(resultado.chancesJogador).toHaveLength(resultado.chancesCasa);
    // random sempre 0 força sucesso em cada duelo (ver resolverDuelo) — todo gol de casa veio do jogador
    expect(resultado.golsCasa).toBe(resultado.chancesCasa);
  });

  it("goleiro nunca recebe chance de ataque, mesmo com peso de sorteio favorável (random sempre 0)", () => {
    const muralha = buscarArquetipo("muralha");
    const goleiro: Jogador = {
      id: "g1",
      nome: "Goleiro Teste",
      posicao: "goleiro",
      arquetipo_id: muralha.id,
      idade: 28,
      atributos: { reflexos: 90 },
    };
    const participacao: ParticipacaoJogador = { lado: "casa", jogador: goleiro, estiloTecnico: "equilibrado" };

    const resultado = simularPartida(perfilNeutro, perfilNeutro, () => 0, participacao);

    expect(resultado.chancesJogador).toEqual([]);
  });

  it("participação do jogador funciona igual quando ele está no time visitante", () => {
    const finalizador = buscarArquetipo("finalizador");
    const artilheiro: Jogador = {
      id: "j1",
      nome: "Artilheiro Teste",
      posicao: "atacante",
      arquetipo_id: finalizador.id,
      idade: 24,
      atributos: { finalizacao: 90 },
    };
    const participacao: ParticipacaoJogador = { lado: "fora", jogador: artilheiro, estiloTecnico: "equilibrado" };

    const resultado = simularPartida(perfilNeutro, perfilNeutro, () => 0, participacao);

    expect(resultado.chancesJogador).toHaveLength(resultado.chancesFora);
    expect(resultado.golsFora).toBe(resultado.chancesFora);
  });

  it("cartão vermelho logo no início da partida tira o jogador do resto do jogo (nenhuma chance pessoal)", () => {
    const finalizador = buscarArquetipo("finalizador");
    const artilheiro: Jogador = {
      id: "j1",
      nome: "Artilheiro Teste",
      posicao: "atacante",
      arquetipo_id: finalizador.id,
      idade: 24,
      atributos: { finalizacao: 90, frieza: 80, posicionamento_ofensivo: 80 },
    };
    const participacao: ParticipacaoJogador = { lado: "casa", jogador: artilheiro, estiloTecnico: "equilibrado" };

    let chamada = 0;
    // 1ª chamada (sorteio de incidente) força cartão vermelho (random alto); a 2ª (índice de saída)
    // e todas as seguintes (resolução de duelo) ficam no mínimo — jogador sai antes da 1ª chance dele.
    const random = () => (chamada++ === 0 ? 0.999 : 0);

    const resultado = simularPartida(perfilNeutro, perfilNeutro, random, participacao);

    expect(resultado.incidenteJogador).toEqual({ tipo: "cartao_vermelho" });
    expect(resultado.chancesJogador).toEqual([]);
  });

  it("sem incidente (random baixo), o jogador continua recebendo chances normalmente", () => {
    const finalizador = buscarArquetipo("finalizador");
    const artilheiro: Jogador = {
      id: "j1",
      nome: "Artilheiro Teste",
      posicao: "atacante",
      arquetipo_id: finalizador.id,
      idade: 24,
      atributos: { finalizacao: 90, frieza: 80, posicionamento_ofensivo: 80 },
    };
    const participacao: ParticipacaoJogador = { lado: "casa", jogador: artilheiro, estiloTecnico: "equilibrado" };

    const resultado = simularPartida(perfilNeutro, perfilNeutro, () => 0, participacao);

    expect(resultado.incidenteJogador).toBeUndefined();
    expect(resultado.chancesJogador).toHaveLength(resultado.chancesCasa);
  });
});

describe("sortearIncidenteDeJogador", () => {
  it("random baixo (perto de 0) nunca gera incidente", () => {
    expect(sortearIncidenteDeJogador(() => 0)).toBeUndefined();
    expect(sortearIncidenteDeJogador(() => 0.5)).toBeUndefined();
  });

  it("random bem alto gera cartão vermelho", () => {
    expect(sortearIncidenteDeJogador(() => 0.999)).toEqual({ tipo: "cartao_vermelho" });
  });

  it("faixa intermediária alta gera lesão, com gravidade e partidasFora dentro do esperado", () => {
    let chamada = 0;
    const random = () => (chamada++ === 0 ? 0.97 : 0.05); // cai na faixa de lesão; 2ª chamada sorteia a gravidade (baixa = leve)
    const incidente = sortearIncidenteDeJogador(random);
    expect(incidente?.tipo).toBe("lesao");
    if (incidente?.tipo === "lesao") {
      expect(incidente.gravidade).toBe("leve");
      expect(incidente.partidasFora).toBeGreaterThanOrEqual(1);
      expect(incidente.partidasFora).toBeLessThanOrEqual(3);
    }
  });

  it("faixa mais alta, mas fora das de vermelho/lesão, gera cartão amarelo", () => {
    expect(sortearIncidenteDeJogador(() => 0.9)).toEqual({ tipo: "cartao_amarelo" });
  });
});

describe("incidenteEncerraParticipacao", () => {
  it("cartão vermelho e lesão encerram participação; cartão amarelo não", () => {
    expect(incidenteEncerraParticipacao({ tipo: "cartao_vermelho" })).toBe(true);
    expect(incidenteEncerraParticipacao({ tipo: "lesao", gravidade: "leve", partidasFora: 2 })).toBe(true);
    expect(incidenteEncerraParticipacao({ tipo: "cartao_amarelo" })).toBe(false);
  });
});

describe("foraDeCombatePorIncidente", () => {
  it("cartão vermelho sempre vira 1 partida de suspensão", () => {
    expect(foraDeCombatePorIncidente({ tipo: "cartao_vermelho" })).toEqual({ motivo: "suspensao", partidasRestantes: 1 });
  });

  it("lesão vira partidasRestantes igual ao que foi sorteado", () => {
    expect(foraDeCombatePorIncidente({ tipo: "lesao", gravidade: "grave", partidasFora: 12 })).toEqual({ motivo: "lesao", partidasRestantes: 12 });
  });

  it("cartão amarelo não gera nenhuma pendência", () => {
    expect(foraDeCombatePorIncidente({ tipo: "cartao_amarelo" })).toBeUndefined();
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
