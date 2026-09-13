import { describe, expect, it } from "vitest";
import { cenariosElegiveis, jogarPartidaAoVivo, type EventoAoVivo } from "../../src/simulation/live-match.js";
import type { ParticipacaoJogador, PerfilTime } from "../../src/simulation/match.js";
import { buscarArquetipo, type Jogador } from "../../src/schemas/player.js";
import type { Opcao } from "../../src/progression/scenarios.js";
import { EVENTOS_DE_PARTIDA } from "../../src/progression/match-events.js";

const perfilSimetrico: PerfilTime = { defesa: 1600, meio: 1600, ataque: 1600 };

describe("jogarPartidaAoVivo", () => {
  it("sem participacaoJogador, devolve um ResultadoPartida válido (sem chances do jogador)", async () => {
    const { resultado, impactosDeContexto } = await jogarPartidaAoVivo(perfilSimetrico, perfilSimetrico, () => Math.random(), undefined, {
      msPorMinuto: 0,
      maxEventosDeContexto: 0,
    });

    expect(resultado.chancesJogador).toEqual([]);
    expect(resultado.golsCasa).toBeGreaterThanOrEqual(0);
    expect(resultado.golsFora).toBeGreaterThanOrEqual(0);
    expect(impactosDeContexto).toEqual([]);
  });

  it("a decisão na chance do jogador muda de verdade a chance de gol (não é só narrativa)", async () => {
    // atacante fraco (força baixa em qualquer atributo de chance) contra defesa forte —
    // sem ajuste, o duelo deveria perder; com um ajuste de força grande o suficiente, vira gol.
    const jogador: Jogador = {
      id: "j1",
      nome: "Teste",
      posicao: "atacante",
      arquetipo_id: buscarArquetipo("finalizador").id,
      idade: 22,
      atributos: { finalizacao: 1, cabeceio: 1, drible: 1, visao_de_jogo: 1, desarme: 1 },
    };
    const participacao: ParticipacaoJogador = { lado: "casa", jogador, estiloTecnico: "equilibrado" };
    const perfilFora: PerfilTime = { defesa: 1800, meio: 1600, ataque: 1600 };
    // random constante 0.38: precisa ficar estritamente ABAIXO de pesoJogador do atacante (0.4, ver
    // PESO_ENVOLVIMENTO_ATAQUE) pra a chance cair pro jogador, e estritamente ENTRE o piso (0.35) e
    // o teto (0.5) de `resolverDuelo` — sem ajuste, a probabilidade de vencer (força base, atributo
    // 1) é ínfima, presa no PISO (0.35): 0.38 não é menor que 0.35, perde; com o ajuste, a
    // probabilidade sobe pro TETO (0.5): 0.38 é menor que 0.5, vira gol.
    const randomConstante = () => 0.38;

    const semAjuste = await jogarPartidaAoVivo(perfilSimetrico, perfilFora, randomConstante, participacao, {
      msPorMinuto: 0,
      maxEventosDeContexto: 0,
    });
    expect(semAjuste.resultado.chancesJogador.length).toBeGreaterThan(0);
    expect(semAjuste.resultado.chancesJogador.every((c) => !c.sucesso)).toBe(true);

    const comAjusteNaForcaDoJogador = await jogarPartidaAoVivo(perfilSimetrico, perfilFora, randomConstante, participacao, {
      msPorMinuto: 0,
      maxEventosDeContexto: 0,
      decidirChance: () => ({ ajusteForcaJogador: 2000, ajusteForcaDefensiva: 0 }),
    });
    expect(comAjusteNaForcaDoJogador.resultado.chancesJogador.every((c) => c.sucesso)).toBe(true);

    const comAjusteNaDefesaAdversaria = await jogarPartidaAoVivo(perfilSimetrico, perfilFora, randomConstante, participacao, {
      msPorMinuto: 0,
      maxEventosDeContexto: 0,
      decidirChance: () => ({ ajusteForcaJogador: 0, ajusteForcaDefensiva: -2000 }),
    });
    expect(comAjusteNaDefesaAdversaria.resultado.chancesJogador.every((c) => c.sucesso)).toBe(true);
  });

  it("decidirChance recebe minuto/subtipo/atributoUsado consistentes com a chance resolvida", async () => {
    const jogador: Jogador = {
      id: "j1",
      nome: "Teste",
      posicao: "atacante",
      arquetipo_id: buscarArquetipo("finalizador").id,
      idade: 22,
      atributos: { finalizacao: 1, cabeceio: 1, drible: 1, visao_de_jogo: 1, desarme: 1 },
    };
    const participacao: ParticipacaoJogador = { lado: "casa", jogador, estiloTecnico: "equilibrado" };
    const contextosRecebidos: { minuto: number; subtipo: string; atributoUsado: string }[] = [];

    const { resultado } = await jogarPartidaAoVivo(perfilSimetrico, perfilSimetrico, () => 0.3, participacao, {
      msPorMinuto: 0,
      maxEventosDeContexto: 0,
      decidirChance: (contexto) => {
        contextosRecebidos.push(contexto);
        return { ajusteForcaJogador: 0, ajusteForcaDefensiva: 0 };
      },
    });

    expect(contextosRecebidos.length).toBe(resultado.chancesJogador.length);
    for (const contexto of contextosRecebidos) {
      expect(contexto.minuto).toBeGreaterThanOrEqual(1);
      expect(contexto.minuto).toBeLessThanOrEqual(90);
    }
    expect(contextosRecebidos.map((c) => c.atributoUsado)).toEqual(resultado.chancesJogador.map((c) => c.atributoUsado));
  });

  it("nem toda chance do jogador pausa pra decisão — probabilidadeDePausarChance controla a fração", async () => {
    const jogador: Jogador = {
      id: "j1",
      nome: "Teste",
      posicao: "atacante",
      arquetipo_id: buscarArquetipo("finalizador").id,
      idade: 22,
      atributos: { finalizacao: 50, cabeceio: 50, drible: 50, visao_de_jogo: 50, desarme: 50 },
    };
    const participacao: ParticipacaoJogador = { lado: "casa", jogador, estiloTecnico: "equilibrado" };

    // random baixo e fixo (0.1) garante que toda chance da casa seja do jogador (pesoJogador do
    // atacante é 0.4, 0.1 < 0.4) — determinístico, sem depender de sorte pra ter chances pra testar.
    let chamadasComProbabilidadeZero = 0;
    const { resultado: comProbabilidadeZero } = await jogarPartidaAoVivo(perfilSimetrico, perfilSimetrico, () => 0.1, participacao, {
      msPorMinuto: 0,
      maxEventosDeContexto: 0,
      probabilidadeDePausarChance: 0,
      decidirChance: () => {
        chamadasComProbabilidadeZero++;
        return { ajusteForcaJogador: 0, ajusteForcaDefensiva: 0 };
      },
    });
    expect(comProbabilidadeZero.chancesJogador.length).toBeGreaterThan(0);
    expect(chamadasComProbabilidadeZero).toBe(0); // nenhuma pausou

    let chamadasComProbabilidadeUm = 0;
    const { resultado: comProbabilidadeUm } = await jogarPartidaAoVivo(perfilSimetrico, perfilSimetrico, () => 0.1, participacao, {
      msPorMinuto: 0,
      maxEventosDeContexto: 0,
      probabilidadeDePausarChance: 1,
      decidirChance: () => {
        chamadasComProbabilidadeUm++;
        return { ajusteForcaJogador: 0, ajusteForcaDefensiva: 0 };
      },
    });
    expect(chamadasComProbabilidadeUm).toBe(comProbabilidadeUm.chancesJogador.length); // todas pausaram
  });

  it("eventos de contexto: sorteiam do catálogo, pausam pra decisão e o impacto resolvido volta em impactosDeContexto", async () => {
    let chamadas = 0;
    const decidirEventoDeContexto = (cenario: { opcoes: Opcao[] }): Opcao => {
      chamadas++;
      return cenario.opcoes[cenario.opcoes.length - 1]; // sempre a opção "segura" (garantida, probabilidade 1)
    };

    const { impactosDeContexto } = await jogarPartidaAoVivo(perfilSimetrico, perfilSimetrico, () => 0.1, undefined, {
      msPorMinuto: 0,
      maxEventosDeContexto: 2,
      decidirEventoDeContexto,
    });

    // random=0.1 < probabilidade fixa de sorteio (0.35) — os 2 slots candidatos sempre viram evento de verdade
    expect(chamadas).toBe(2);
    expect(impactosDeContexto).toHaveLength(2);
    for (const impacto of impactosDeContexto) {
      expect(impacto.narrativa).toBeTruthy();
    }
  });

  it("sem decidirEventoDeContexto, resolve sozinho escolhendo sempre a 1ª opção (mesmo padrão de escolherOpcao)", async () => {
    const { impactosDeContexto } = await jogarPartidaAoVivo(perfilSimetrico, perfilSimetrico, () => 0.1, undefined, {
      msPorMinuto: 0,
      maxEventosDeContexto: 2,
    });

    expect(impactosDeContexto.length).toBeGreaterThan(0);
  });

  it("onEvento é chamado em ordem crescente de minuto, terminando em apito_final com o placar final", async () => {
    const eventos: EventoAoVivo[] = [];
    const { resultado } = await jogarPartidaAoVivo(perfilSimetrico, perfilSimetrico, () => Math.random(), undefined, {
      msPorMinuto: 0,
      maxEventosDeContexto: 0,
      onEvento: (evento) => {
        eventos.push(evento);
      },
    });

    const comMinuto = eventos.filter((e): e is Extract<EventoAoVivo, { minuto: number }> => "minuto" in e);
    for (let i = 1; i < comMinuto.length; i++) {
      expect(comMinuto[i].minuto).toBeGreaterThanOrEqual(comMinuto[i - 1].minuto);
    }

    const ultimo = eventos[eventos.length - 1];
    expect(ultimo.tipo).toBe("apito_final");
    if (ultimo.tipo === "apito_final") {
      expect(ultimo.golsCasa).toBe(resultado.golsCasa);
      expect(ultimo.golsFora).toBe(resultado.golsFora);
    }
  });

  describe("cenariosElegiveis", () => {
    it("no minuto 5, só sobram cenários sem janela ou com janela 'inicio' (bug real: 'crise de ansiedade no início' podia sair aos 80')", () => {
      const elegiveis = cenariosElegiveis(5, false);
      expect(elegiveis.length).toBeGreaterThan(0);
      for (const cenario of elegiveis) {
        expect(cenario.janelaDePartida === undefined || cenario.janelaDePartida === "inicio").toBe(true);
      }
      expect(elegiveis.some((c) => c.id === "crise_de_ansiedade_pre_jogo")).toBe(true);
      expect(elegiveis.some((c) => c.id === "pressao_para_cobrar_penalti")).toBe(false); // janela "fim"
    });

    it("no minuto 80, só sobram cenários sem janela ou com janela 'fim' (bug real: pênalti/falta decisiva podiam sair no início do jogo)", () => {
      const elegiveis = cenariosElegiveis(80, false);
      for (const cenario of elegiveis) {
        expect(cenario.janelaDePartida === undefined || cenario.janelaDePartida === "fim").toBe(true);
      }
      expect(elegiveis.some((c) => c.id === "pressao_para_cobrar_penalti")).toBe(true);
      expect(elegiveis.some((c) => c.id === "assumir_cobranca_de_falta_decisiva")).toBe(true);
      expect(elegiveis.some((c) => c.id === "crise_de_ansiedade_pre_jogo")).toBe(false); // janela "inicio"
    });

    it("'comemoração polêmica de gol' só é elegível se o jogador já marcou um gol nesta partida", () => {
      expect(cenariosElegiveis(50, false).some((c) => c.id === "comemoracao_polemica")).toBe(false);
      expect(cenariosElegiveis(50, true).some((c) => c.id === "comemoracao_polemica")).toBe(true);
    });

    it("nunca fica vazio (sempre sobra pelo menos os cenários sem restrição nenhuma)", () => {
      for (let minuto = 1; minuto <= 90; minuto++) {
        expect(cenariosElegiveis(minuto, false).length).toBeGreaterThan(0);
      }
    });
  });

  it("bug real corrigido: cenário de contexto com efeito de gol (pênalti/gol contra) atualiza o placar de verdade, não só a narrativa", async () => {
    const jogador: Jogador = {
      id: "j1",
      nome: "Teste",
      posicao: "atacante",
      arquetipo_id: buscarArquetipo("finalizador").id,
      idade: 22,
      atributos: { finalizacao: 50, cabeceio: 50, drible: 50, visao_de_jogo: 50, desarme: 50 },
    };
    const participacao: ParticipacaoJogador = { lado: "casa", jogador, estiloTecnico: "equilibrado" };

    const cenarioComGolAFavor = EVENTOS_DE_PARTIDA.find((c) => c.id === "pressao_para_cobrar_penalti")!;
    const cenarioComGolContra = EVENTOS_DE_PARTIDA.find((c) => c.id === "gol_contra")!;
    expect(cenarioComGolAFavor).toBeDefined();
    expect(cenarioComGolContra).toBeDefined();

    // random=0.1 constante: < 0.25 (PROBABILIDADE_DE_EVENTO_DE_CONTEXTO, garante o slot de evento
    // quando maxEventosDeContexto:1) e < 0.6 (garante cair no resultados[0] de "aceitar_cobrar", que
    // tem efeitoDeGol "a_favor"). Por ser uma constante (não uma sequência), as DUAS partidas abaixo
    // resolvem toda chance genérica/do jogador de forma IDÊNTICA — a única diferença entre elas é a
    // existência (ou não) do slot de evento de contexto, isolando exatamente o efeito dele no placar.
    const random = () => 0.1;
    const semEvento = await jogarPartidaAoVivo(perfilSimetrico, perfilSimetrico, random, participacao, { msPorMinuto: 0, maxEventosDeContexto: 0 });
    const comGolAFavor = await jogarPartidaAoVivo(perfilSimetrico, perfilSimetrico, random, participacao, {
      msPorMinuto: 0,
      maxEventosDeContexto: 1,
      decidirEventoDeContexto: () => cenarioComGolAFavor.opcoes[0], // "aceitar_cobrar"
    });
    // participacao.lado é "casa" — "a_favor" soma pro lado do próprio jogador.
    expect(comGolAFavor.resultado.golsCasa).toBe(semEvento.resultado.golsCasa + 1);
    expect(comGolAFavor.resultado.golsFora).toBe(semEvento.resultado.golsFora);

    const comGolContra = await jogarPartidaAoVivo(perfilSimetrico, perfilSimetrico, random, participacao, {
      msPorMinuto: 0,
      maxEventosDeContexto: 1,
      decidirEventoDeContexto: () => cenarioComGolContra.opcoes[0], // "pedir_a_bola_de_novo_rapido" — TODO resultado tem efeitoDeGol "contra"
    });
    // participacao.lado é "casa" — "contra" soma pro lado adversário ("fora").
    expect(comGolContra.resultado.golsFora).toBe(semEvento.resultado.golsFora + 1);
    expect(comGolContra.resultado.golsCasa).toBe(semEvento.resultado.golsCasa);
  });
});
