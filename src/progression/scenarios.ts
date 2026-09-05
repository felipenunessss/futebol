import type { Atributo } from "../schemas/player.js";

/**
 * Cenários de múltipla escolha da carreira — ver `docs/game-design.md`
 * seção 5.1 ("Dilemas de carreira", lesões, imprensa regional, rivalidades
 * pessoais). Cada cenário tem 2-3 opções; cada opção tem um ou mais
 * resultados possíveis com probabilidade própria (a escolha em si não é
 * determinística — a mesma opção pode dar certo ou errado) e cada
 * resultado carrega um impacto na carreira (atributo, moral, reputação).
 */

export interface ImpactoCarreira {
  /** Delta direto no valor do atributo (não é a curva de XP de partida — pode ser negativo, ex: lesão; clampado 1-99 ao aplicar). */
  atributos?: Partial<Record<Atributo, number>>;
  /** Delta na moral do jogador, aplicado sobre o valor atual (clampado 0-100). */
  moral?: number;
  /** Delta na reputação do jogador, aplicado sobre o valor atual (clampado 0-100). */
  reputacao?: number;
  /** Texto livre descrevendo o desfecho, pra mostrar ao jogador. */
  narrativa: string;
}

export interface ResultadoPossivel {
  /** 0-1 — a soma dos resultados de uma mesma opção deve fechar em 1. */
  probabilidade: number;
  impacto: ImpactoCarreira;
}

export interface Opcao {
  id: string;
  texto: string;
  /** 1 ou mais resultados possíveis, probabilidades somando 1. Uma opção "garantida" tem 1 resultado só, com probabilidade 1. */
  resultados: ResultadoPossivel[];
}

export interface Cenario {
  id: string;
  titulo: string;
  descricao: string;
  /** 2 ou 3 escolhas. */
  opcoes: Opcao[];
}

export interface EscolhaResolvida {
  opcao: Opcao;
  resultado: ResultadoPossivel;
}

/** Sorteia qual dos resultados possíveis de uma opção acontece, ponderado pela probabilidade de cada um. */
export function resolverEscolha(opcao: Opcao, random: () => number = Math.random): EscolhaResolvida {
  const somaProbabilidades = opcao.resultados.reduce((soma, r) => soma + r.probabilidade, 0);
  if (Math.abs(somaProbabilidades - 1) > 0.001) {
    throw new Error(`resolverEscolha: probabilidades da opção "${opcao.id}" somam ${somaProbabilidades}, deveriam somar 1`);
  }

  let alvo = random();
  for (const resultado of opcao.resultados) {
    if (alvo < resultado.probabilidade) return { opcao, resultado };
    alvo -= resultado.probabilidade;
  }

  return { opcao, resultado: opcao.resultados[opcao.resultados.length - 1] };
}

function clamp(valor: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, valor));
}

export interface EstadoJogadorParaImpacto {
  atributos: Partial<Record<Atributo, number>>;
  moral: number;
  reputacao: number;
}

/**
 * Aplica o impacto de um resultado de cenário ao estado do jogador. Deltas
 * de atributo são diretos (não passam pela curva de retorno decrescente de
 * `progression/xp.ts` — um cenário narrativo é um evento pontual, não
 * desempenho de partida), clampados em 1-99. Não muta o estado recebido.
 */
export function aplicarImpacto(estado: EstadoJogadorParaImpacto, impacto: ImpactoCarreira): EstadoJogadorParaImpacto {
  const atributos = { ...estado.atributos };
  for (const [atributo, delta] of Object.entries(impacto.atributos ?? {})) {
    const atual = atributos[atributo as Atributo] ?? 1;
    atributos[atributo as Atributo] = clamp(atual + (delta as number), 1, 99);
  }

  return {
    atributos,
    moral: clamp(estado.moral + (impacto.moral ?? 0), 0, 100),
    reputacao: clamp(estado.reputacao + (impacto.reputacao ?? 0), 0, 100),
  };
}

export function sortearCenario(cenarios: Cenario[], random: () => number = Math.random): Cenario {
  if (cenarios.length === 0) throw new Error("sortearCenario: lista de cenários vazia");
  return cenarios[Math.floor(random() * cenarios.length)];
}

/**
 * Catálogo inicial de cenários — cobre os 4 pilares de "Narrativa de
 * carreira" já previstos em `docs/game-design.md` seção 5.1. Não é
 * definitivo, é o ponto de partida pra validar o mecanismo.
 */
export const CENARIOS: Cenario[] = [
  {
    id: "proposta_clube_grande",
    titulo: "Proposta de um clube grande",
    descricao: "No meio do estadual, um clube maior te sondou. O técnico do seu time atual pediu discrição — a decisão é sua.",
    opcoes: [
      {
        id: "aceitar_agora",
        texto: "Aceitar a proposta e sair agora mesmo",
        resultados: [
          { probabilidade: 0.6, impacto: { atributos: { frieza: 3 }, moral: 10, narrativa: "A adaptação é rápida — o novo ambiente te motiva." } },
          { probabilidade: 0.4, impacto: { atributos: { frieza: -2 }, moral: -15, narrativa: "Você troca de clube em más condições e a adaptação é difícil no começo." } },
        ],
      },
      {
        id: "recusar_por_lealdade",
        texto: "Recusar por lealdade ao clube atual",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 10, moral: 5, narrativa: "A torcida reconhece sua lealdade e o carinho pelo escudo cresce." } },
        ],
      },
      {
        id: "negociar_prazo",
        texto: "Pedir pra decidir só depois do estadual",
        resultados: [
          { probabilidade: 0.5, impacto: { moral: 5, reputacao: 5, narrativa: "O clube aceita esperar — você termina o estadual fortalecido, sem pressão." } },
          { probabilidade: 0.5, impacto: { moral: -10, narrativa: "O clube grande desiste da proposta enquanto você esperava. Oportunidade perdida." } },
        ],
      },
    ],
  },
  {
    id: "lesao_treino",
    titulo: "Lesão durante o treino",
    descricao: "Numa sessão de treino, você sente uma dor muscular incomum. O departamento médico pede pra você decidir como seguir.",
    opcoes: [
      {
        id: "jogar_mesmo_assim",
        texto: "Ignorar a dor e jogar mesmo assim",
        resultados: [
          { probabilidade: 0.3, impacto: { atributos: { forca_fisica: -5, resistencia: -5 }, moral: -10, narrativa: "A dor piora em campo — você fica semanas fora por lesão mais séria." } },
          { probabilidade: 0.7, impacto: { atributos: { frieza: 2 }, moral: 5, narrativa: "Você aguenta bem, sem sequelas, e ganha confiança por ter enfrentado a dor." } },
        ],
      },
      {
        id: "tratar_com_cautela",
        texto: "Parar e tratar com cautela",
        resultados: [
          { probabilidade: 1, impacto: { moral: 2, narrativa: "Recuperação tranquila, sem sequelas — a comissão técnica valoriza a responsabilidade." } },
        ],
      },
    ],
  },
  {
    id: "pressao_imprensa_classico",
    titulo: "Manchetes depois do clássico",
    descricao: "A imprensa local repercute sua atuação no clássico do fim de semana — pra bem ou pra mal, seu nome está em todo canto.",
    opcoes: [
      {
        id: "responder_criticas",
        texto: "Responder às críticas publicamente",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacao: 15, narrativa: "A resposta cai bem e a torcida abraça ainda mais sua causa." } },
          { probabilidade: 0.5, impacto: { reputacao: -10, moral: -5, narrativa: "A declaração vira polêmica e a pressão sobre você só aumenta." } },
        ],
      },
      {
        id: "manter_silencio",
        texto: "Manter o silêncio e deixar o futebol falar",
        resultados: [
          { probabilidade: 1, impacto: { moral: 5, narrativa: "A discrição é bem vista — o foco volta pro próximo jogo." } },
        ],
      },
    ],
  },
  {
    id: "rivalidade_pessoal",
    titulo: "Provocação de um rival",
    descricao: "Um jogador do time adversário te provocou publicamente antes do duelo direto entre vocês.",
    opcoes: [
      {
        id: "retrucar_na_midia",
        texto: "Retrucar na mídia",
        resultados: [
          { probabilidade: 0.4, impacto: { reputacao: 10, moral: -5, narrativa: "A resposta vira assunto e a torcida adora a rivalidade — mas a pressão extra pesa." } },
          { probabilidade: 0.6, impacto: { moral: -10, narrativa: "A troca de farpas só aumenta a pressão em cima de você." } },
        ],
      },
      {
        id: "ignorar_e_focar",
        texto: "Ignorar e focar no jogo",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { frieza: 3 }, narrativa: "Você mantém a cabeça fria e usa a provocação como combustível silencioso." } },
        ],
      },
      {
        id: "conversar_em_particular",
        texto: "Buscar o rival pra conversar em particular",
        resultados: [
          { probabilidade: 0.7, impacto: { reputacao: 5, moral: 5, narrativa: "Vocês resolvem por baixo dos panos — o gesto rende respeito dos dois lados." } },
          { probabilidade: 0.3, impacto: { moral: -15, reputacao: -5, narrativa: "O rival usa a conversa contra você na mídia, e a situação piora." } },
        ],
      },
    ],
  },
];
