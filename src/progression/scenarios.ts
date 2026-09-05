import type { Atributo } from "../schemas/player.js";

/**
 * Cenários de múltipla escolha da carreira — ver `docs/game-design.md`
 * seção 5.1 ("Narrativa de carreira": dilemas, lesões, imprensa,
 * rivalidades) e seção 5.3 ("Vida fora de campo": reputação regional,
 * patrocínios, relações com elenco/comissão/diretoria, vida pessoal).
 * Cada cenário tem 2-3 opções; cada opção tem um ou mais resultados
 * possíveis com probabilidade própria (a escolha em si não é
 * determinística — a mesma opção pode dar certo ou errado) e cada
 * resultado carrega um impacto na carreira (atributo, moral, reputação
 * nacional/regional, relações internas).
 */

export interface ImpactoCarreira {
  /** Delta direto no valor do atributo (não é a curva de XP de partida — pode ser negativo, ex: lesão; clampado 1-99 ao aplicar). */
  atributos?: Partial<Record<Atributo, number>>;
  /** Delta na moral do jogador, aplicado sobre o valor atual (clampado 0-100). */
  moral?: number;
  /** Delta na reputação NACIONAL, aplicado sobre o valor atual (clampado 0-100). */
  reputacao?: number;
  /**
   * Delta na reputação REGIONAL — a região em si não é decidida pelo
   * cenário (que é genérico, reusável em qualquer contexto), é decidida
   * por quem aplica o impacto (normalmente a região do clube atual do
   * jogador, ver `career/Player.ts` `aplicarImpactoDeCenario`).
   */
  reputacaoRegional?: number;
  /** Delta nas relações com elenco/comissão técnica/diretoria (um número só, agregado — ver docs/motor-de-partida.md). Clampado 0-100. */
  relacoesInternas?: number;
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

/**
 * Reputação separada por escopo — ver `docs/game-design.md` seção 5.3
 * ("ídolo local no estadual x desconhecido fora do estado"). `porRegiao`
 * usa a mesma chave de região que quem chama decidir (tipicamente a UF do
 * clube atual, ex: "SP", "RJ") — uma região sem entrada ainda equivale a 0.
 */
export interface Reputacao {
  nacional: number;
  porRegiao: Record<string, number>;
}

export function criarReputacaoInicial(): Reputacao {
  return { nacional: 10, porRegiao: {} };
}

export interface EstadoJogadorParaImpacto {
  atributos: Partial<Record<Atributo, number>>;
  moral: number;
  reputacao: Reputacao;
  relacoesInternas: number;
}

/**
 * Aplica o impacto de um resultado de cenário ao estado do jogador. Deltas
 * de atributo são diretos (não passam pela curva de retorno decrescente de
 * `progression/xp.ts` — um cenário narrativo é um evento pontual, não
 * desempenho de partida), clampados em 1-99. Reputação regional só é
 * aplicada se `regiaoAtual` for informado (sem região, o delta regional é
 * ignorado — documentado, não é erro silencioso: fica só sem efeito).
 * Não muta o estado recebido.
 */
export function aplicarImpacto(
  estado: EstadoJogadorParaImpacto,
  impacto: ImpactoCarreira,
  regiaoAtual?: string,
): EstadoJogadorParaImpacto {
  const atributos = { ...estado.atributos };
  for (const [atributo, delta] of Object.entries(impacto.atributos ?? {})) {
    const atual = atributos[atributo as Atributo] ?? 1;
    atributos[atributo as Atributo] = clamp(atual + (delta as number), 1, 99);
  }

  const porRegiao = { ...estado.reputacao.porRegiao };
  if (impacto.reputacaoRegional && regiaoAtual) {
    porRegiao[regiaoAtual] = clamp((porRegiao[regiaoAtual] ?? 0) + impacto.reputacaoRegional, 0, 100);
  }

  return {
    atributos,
    moral: clamp(estado.moral + (impacto.moral ?? 0), 0, 100),
    reputacao: {
      nacional: clamp(estado.reputacao.nacional + (impacto.reputacao ?? 0), 0, 100),
      porRegiao,
    },
    relacoesInternas: clamp(estado.relacoesInternas + (impacto.relacoesInternas ?? 0), 0, 100),
  };
}

export function sortearCenario(cenarios: Cenario[], random: () => number = Math.random): Cenario {
  if (cenarios.length === 0) throw new Error("sortearCenario: lista de cenários vazia");
  return cenarios[Math.floor(random() * cenarios.length)];
}

/**
 * Catálogo de cenários — cobre os pilares de "Narrativa de carreira" e
 * "Vida fora de campo" do `docs/game-design.md` (seções 5.1 e 5.3). Não é
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
          { probabilidade: 1, impacto: { reputacaoRegional: 10, moral: 5, narrativa: "A torcida reconhece sua lealdade e o carinho pelo escudo cresce." } },
        ],
      },
      {
        id: "negociar_prazo",
        texto: "Pedir pra decidir só depois do estadual",
        resultados: [
          { probabilidade: 0.5, impacto: { moral: 5, reputacaoRegional: 5, narrativa: "O clube aceita esperar — você termina o estadual fortalecido, sem pressão." } },
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
          { probabilidade: 1, impacto: { moral: 2, relacoesInternas: 3, narrativa: "Recuperação tranquila, sem sequelas — a comissão técnica valoriza a responsabilidade." } },
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
          { probabilidade: 0.5, impacto: { reputacaoRegional: 15, narrativa: "A resposta cai bem e a torcida abraça ainda mais sua causa." } },
          { probabilidade: 0.5, impacto: { reputacaoRegional: -10, moral: -5, narrativa: "A declaração vira polêmica e a pressão sobre você só aumenta." } },
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
  {
    id: "mudanca_de_cidade",
    titulo: "Mudança de cidade",
    descricao: "Você acabou de se transferir e precisa se estabelecer numa cidade nova.",
    opcoes: [
      {
        id: "trazer_familia",
        texto: "Trazer a família junto",
        resultados: [
          { probabilidade: 0.6, impacto: { moral: 10, narrativa: "A família se adapta bem à nova cidade, e isso te deixa mais tranquilo." } },
          { probabilidade: 0.4, impacto: { moral: -10, narrativa: "A adaptação da família é difícil, e isso pesa no seu humor dentro de campo." } },
        ],
      },
      {
        id: "ir_sozinho",
        texto: "Ir sozinho por enquanto",
        resultados: [
          { probabilidade: 1, impacto: { moral: -3, narrativa: "Fica mais fácil focar só no futebol, mas a saudade de casa pesa um pouco." } },
        ],
      },
      {
        id: "pedir_ajuda_ao_clube",
        texto: "Pedir ajuda ao clube pra se estabelecer",
        resultados: [
          { probabilidade: 0.7, impacto: { moral: 8, relacoesInternas: 5, narrativa: "O clube ajuda bastante com a mudança — você se sente acolhido desde o primeiro dia." } },
          { probabilidade: 0.3, impacto: { moral: -5, relacoesInternas: -8, narrativa: "O clube promete ajuda e não cumpre — a relação começa arranhada." } },
        ],
      },
    ],
  },
  {
    id: "divergencia_tecnica",
    titulo: "Divergência tática com o técnico",
    descricao: "Você discorda do esquema tático usado nos últimos jogos e sente que isso limita seu desempenho.",
    opcoes: [
      {
        id: "questionar_publicamente",
        texto: "Questionar o esquema publicamente",
        resultados: [
          { probabilidade: 0.3, impacto: { relacoesInternas: -10, reputacao: 5, narrativa: "A cobrança pública funciona e o esquema muda, mas o técnico não esquece a exposição." } },
          { probabilidade: 0.7, impacto: { relacoesInternas: -20, narrativa: "O técnico não gosta nada de ser cobrado em público — a relação esfria." } },
        ],
      },
      {
        id: "conversar_reservadamente",
        texto: "Conversar reservadamente com o técnico",
        resultados: [
          { probabilidade: 0.65, impacto: { relacoesInternas: 10, narrativa: "O técnico ouve e ajusta alguns detalhes — a relação sai fortalecida." } },
          { probabilidade: 0.35, impacto: { relacoesInternas: 3, narrativa: "O técnico mantém o esquema, mas valoriza a forma como você trouxe o assunto." } },
        ],
      },
      {
        id: "aceitar_e_adaptar",
        texto: "Aceitar e se adaptar ao sistema",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 5, narrativa: "Você se dedica a se encaixar no sistema — a comissão técnica nota o profissionalismo." } },
        ],
      },
    ],
  },
  {
    id: "atrito_com_colega",
    titulo: "Atrito com um companheiro de elenco",
    descricao: "Uma bronca no vestiário esquentou os ânimos entre você e um companheiro de time.",
    opcoes: [
      {
        id: "resolver_na_conversa",
        texto: "Resolver na conversa direta",
        resultados: [
          { probabilidade: 0.75, impacto: { relacoesInternas: 10, narrativa: "Vocês se entendem, e o grupo respira aliviado." } },
          { probabilidade: 0.25, impacto: { relacoesInternas: -5, narrativa: "A conversa não resolve — o clima segue tenso entre vocês." } },
        ],
      },
      {
        id: "deixar_o_tempo_resolver",
        texto: "Deixar o tempo resolver sozinho",
        resultados: [
          { probabilidade: 0.5, impacto: { relacoesInternas: 2, narrativa: "Com o tempo, a rusga esfria por conta própria." } },
          { probabilidade: 0.5, impacto: { relacoesInternas: -15, moral: -5, narrativa: "Sem conversa nenhuma, a rusga vira racha dentro do grupo." } },
        ],
      },
      {
        id: "levar_a_comissao",
        texto: "Levar o caso à comissão técnica",
        resultados: [
          { probabilidade: 0.6, impacto: { relacoesInternas: 5, narrativa: "A comissão medeia bem e o caso se resolve." } },
          { probabilidade: 0.4, impacto: { relacoesInternas: -10, moral: -5, narrativa: "O caso vira assunto do vestiário inteiro, e isso gera constrangimento." } },
        ],
      },
    ],
  },
  {
    id: "oferta_patrocinio",
    titulo: "Oferta de patrocínio",
    descricao: "Uma marca te procura oferecendo um contrato de patrocínio pessoal.",
    opcoes: [
      {
        id: "aceitar_termos_oferecidos",
        texto: "Aceitar os termos oferecidos",
        resultados: [
          { probabilidade: 0.7, impacto: { reputacao: 5, narrativa: "O contrato rende bem, e a marca gosta da parceria." } },
          { probabilidade: 0.3, impacto: { moral: -8, narrativa: "As exigências de agenda da marca pesam na sua rotina." } },
        ],
      },
      {
        id: "negociar_termos_melhores",
        texto: "Negociar termos melhores",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacao: 8, narrativa: "Você consegue condições melhores no contrato." } },
          { probabilidade: 0.5, impacto: { moral: -3, narrativa: "A marca desiste da negociação diante da contraproposta." } },
        ],
      },
      {
        id: "recusar_por_enquanto",
        texto: "Recusar por enquanto",
        resultados: [
          { probabilidade: 1, impacto: { moral: 3, narrativa: "Você mantém o foco 100% no campo, sem compromissos extras." } },
        ],
      },
    ],
  },
  {
    id: "pressao_torcida_organizada",
    titulo: "Reunião com a torcida organizada",
    descricao: "Depois de uma sequência de resultados ruins, a torcida organizada pede uma conversa com o elenco.",
    opcoes: [
      {
        id: "aceitar_a_conversa",
        texto: "Aceitar a conversa",
        resultados: [
          { probabilidade: 0.55, impacto: { reputacaoRegional: 10, moral: 5, narrativa: "O diálogo direto acalma os ânimos da torcida." } },
          { probabilidade: 0.45, impacto: { reputacaoRegional: -10, moral: -10, narrativa: "A conversa esquenta ainda mais os ânimos." } },
        ],
      },
      {
        id: "recusar_e_manter_distancia",
        texto: "Recusar e manter distância",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: -8, narrativa: "A torcida se sente ignorada pelo elenco." } },
        ],
      },
    ],
  },
  {
    id: "acao_social_comunidade",
    titulo: "Ação social na comunidade",
    descricao: "O clube te convida pra participar de uma ação social no bairro onde fica o estádio.",
    opcoes: [
      {
        id: "participar_ativamente",
        texto: "Participar ativamente",
        resultados: [
          { probabilidade: 0.8, impacto: { reputacaoRegional: 15, moral: 5, narrativa: "A comunidade te adota como ídolo local." } },
          { probabilidade: 0.2, impacto: { reputacaoRegional: 5, narrativa: "Poucas pessoas aparecem, mas o gesto é notado por quem esteve lá." } },
        ],
      },
      {
        id: "recusar_por_falta_de_tempo",
        texto: "Recusar por falta de tempo",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: -3, narrativa: "Você perde a chance de se aproximar da torcida local." } },
        ],
      },
    ],
  },
];
