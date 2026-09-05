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
  {
    id: "pressao_para_cobrar_penalti",
    titulo: "A cobrança é sua?",
    descricao: "Pênalti nos acréscimos de um jogo decisivo. O grupo olha pra você esperando que assuma a cobrança.",
    opcoes: [
      {
        id: "aceitar_cobrar",
        texto: "Assumir a cobrança",
        resultados: [
          { probabilidade: 0.6, impacto: { atributos: { frieza: 3 }, moral: 15, reputacaoRegional: 15, narrativa: "Você bate com categoria e vira herói da torcida." } },
          { probabilidade: 0.4, impacto: { atributos: { frieza: -2 }, moral: -20, reputacaoRegional: -15, narrativa: "A cobrança sai errada e o silêncio toma conta do estádio." } },
        ],
      },
      {
        id: "passar_a_responsabilidade",
        texto: "Passar a cobrança pra outro batedor",
        resultados: [
          { probabilidade: 0.7, impacto: { relacoesInternas: 3, narrativa: "O colega converte, e ninguém questiona sua decisão." } },
          { probabilidade: 0.3, impacto: { moral: -8, narrativa: "O colega perde, e uma parte da torcida cobra por que você não bateu." } },
        ],
      },
    ],
  },
  {
    id: "reagir_a_cartao_duvidoso",
    titulo: "Cartão duvidoso do árbitro",
    descricao: "O árbitro te mostra um cartão amarelo que você considera injusto, no meio de uma partida tensa.",
    opcoes: [
      {
        id: "reclamar_com_o_arbitro",
        texto: "Reclamar abertamente com o árbitro",
        resultados: [
          { probabilidade: 0.35, impacto: { atributos: { frieza: 2 }, reputacaoRegional: 5, narrativa: "A reclamação é firme mas respeitosa — a torcida aprova a atitude." } },
          { probabilidade: 0.65, impacto: { atributos: { frieza: -3 }, moral: -10, narrativa: "O árbitro não gosta da insistência e o clima do jogo piora pra você." } },
        ],
      },
      {
        id: "manter_a_calma",
        texto: "Manter a calma e seguir jogando",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { frieza: 2 }, narrativa: "Você engole a injustiça e mantém o foco no jogo." } },
        ],
      },
    ],
  },
  {
    id: "reserva_insatisfeito",
    titulo: "Parado no banco",
    descricao: "Você está há semanas no banco de reservas sem entender bem o motivo.",
    opcoes: [
      {
        id: "cobrar_o_tecnico",
        texto: "Cobrar satisfação diretamente do técnico",
        resultados: [
          { probabilidade: 0.4, impacto: { relacoesInternas: 8, moral: 10, narrativa: "O técnico explica os critérios e promete mais chances — a relação melhora." } },
          { probabilidade: 0.6, impacto: { relacoesInternas: -15, moral: -10, narrativa: "O técnico não gosta da cobrança e você segue no banco, agora com a relação mais fria." } },
        ],
      },
      {
        id: "treinar_ainda_mais_forte",
        texto: "Treinar ainda mais forte pra reconquistar espaço",
        resultados: [
          { probabilidade: 0.55, impacto: { atributos: { resistencia: 3 }, relacoesInternas: 5, moral: 5, narrativa: "A dedicação extra chama atenção da comissão técnica." } },
          { probabilidade: 0.45, impacto: { moral: -10, narrativa: "O esforço extra não muda nada — a sensação de estagnação cresce." } },
        ],
      },
      {
        id: "pedir_transferencia",
        texto: "Pedir pra ser negociado",
        resultados: [
          { probabilidade: 0.5, impacto: { relacoesInternas: -10, reputacao: 5, narrativa: "O pedido choca o clube, mas mostra que você quer jogar — sua reputação de competitivo cresce." } },
          { probabilidade: 0.5, impacto: { relacoesInternas: -20, moral: -10, narrativa: "O pedido é mal recebido e você vira alvo de críticas internas por falta de compromisso." } },
        ],
      },
    ],
  },
  {
    id: "capitania_oferecida",
    titulo: "Oferta de capitania",
    descricao: "O técnico sugere seu nome pra ser o novo capitão do elenco.",
    opcoes: [
      {
        id: "aceitar_capitania",
        texto: "Aceitar a braçadeira",
        resultados: [
          { probabilidade: 0.65, impacto: { atributos: { lideranca: 3 }, relacoesInternas: 10, reputacaoRegional: 10, narrativa: "Você veste a braçadeira com naturalidade e o grupo responde bem." } },
          { probabilidade: 0.35, impacto: { relacoesInternas: -8, moral: -5, narrativa: "A responsabilidade pesa mais do que o esperado e alguns colegas questionam a escolha." } },
        ],
      },
      {
        id: "recusar_capitania",
        texto: "Recusar, ainda não se sente pronto",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 3, narrativa: "O técnico respeita a decisão e escolhe outro capitão." } },
        ],
      },
    ],
  },
  {
    id: "convocacao_selecao_nacional",
    titulo: "Convocação para a seleção",
    descricao: "Seu nome aparece pela primeira vez numa lista de convocados da seleção nacional.",
    opcoes: [
      {
        id: "aproveitar_a_oportunidade",
        texto: "Se dedicar ao máximo pra aproveitar a chance",
        resultados: [
          { probabilidade: 0.55, impacto: { reputacao: 20, moral: 15, narrativa: "Uma boa exibição na seleção projeta seu nome nacionalmente." } },
          { probabilidade: 0.45, impacto: { reputacao: -5, moral: -10, narrativa: "A pressão da estreia pesa e a atuação fica abaixo do esperado." } },
        ],
      },
      {
        id: "jogar_com_naturalidade",
        texto: "Encarar como mais um jogo, sem pressão extra",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 8, narrativa: "A tranquilidade ajuda numa estreia discreta, mas sem sustos." } },
        ],
      },
    ],
  },
  {
    id: "redes_sociais_criticas",
    titulo: "Enxurrada de críticas nas redes sociais",
    descricao: "Depois de uma atuação fraca, suas redes sociais são inundadas de críticas duras.",
    opcoes: [
      {
        id: "responder_nas_redes",
        texto: "Responder às críticas nas redes",
        resultados: [
          { probabilidade: 0.3, impacto: { reputacao: 8, narrativa: "A resposta bem-humorada vira meme positivo e desarma a crise." } },
          { probabilidade: 0.7, impacto: { reputacao: -12, moral: -10, narrativa: "A resposta piora a repercussão e vira mais uma polêmica." } },
        ],
      },
      {
        id: "sair_das_redes_por_uns_dias",
        texto: "Ficar longe das redes sociais por uns dias",
        resultados: [
          { probabilidade: 1, impacto: { moral: 5, narrativa: "A distância ajuda a recuperar a cabeça longe do barulho." } },
        ],
      },
    ],
  },
  {
    id: "entrevista_coletiva_apos_derrota",
    titulo: "Coletiva depois de uma derrota dura",
    descricao: "A diretoria pede que você fale com a imprensa depois de uma eliminação dolorida.",
    opcoes: [
      {
        id: "assumir_a_responsabilidade",
        texto: "Assumir a responsabilidade publicamente",
        resultados: [
          { probabilidade: 0.6, impacto: { reputacao: 10, relacoesInternas: 5, narrativa: "A postura madura é elogiada pela imprensa e pelo elenco." } },
          { probabilidade: 0.4, impacto: { moral: -10, narrativa: "Assumir a culpa sozinho pesa emocionalmente nas semanas seguintes." } },
        ],
      },
      {
        id: "falar_de_forma_generica",
        texto: "Falar de forma genérica, sem entrar em detalhes",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: -3, narrativa: "A entrevista morna não empolga ninguém, mas também não gera polêmica." } },
        ],
      },
    ],
  },
  {
    id: "agente_pressiona_transferencia",
    titulo: "Seu agente quer uma saída",
    descricao: "Seu empresário insiste que está na hora de sair do clube pra um lugar com mais projeção.",
    opcoes: [
      {
        id: "seguir_o_conselho_do_agente",
        texto: "Seguir o conselho e pressionar por saída",
        resultados: [
          { probabilidade: 0.5, impacto: { relacoesInternas: -15, reputacao: 8, narrativa: "A pressão funciona e abre caminho pra uma saída vantajosa — mas o clube não esquece." } },
          { probabilidade: 0.5, impacto: { relacoesInternas: -20, moral: -10, narrativa: "O pedido irrita a diretoria e você fica marcado como problema por um tempo." } },
        ],
      },
      {
        id: "confiar_no_momento_atual",
        texto: "Confiar no momento atual e não forçar nada",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 5, narrativa: "O clube valoriza a postura tranquila em meio à especulação." } },
        ],
      },
    ],
  },
  {
    id: "proposta_do_exterior",
    titulo: "Proposta vinda do exterior",
    descricao: "Um clube estrangeiro te sonda com uma proposta que mudaria sua carreira.",
    opcoes: [
      {
        id: "topar_o_desafio",
        texto: "Topar o desafio e se transferir",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacao: 20, moral: 10, narrativa: "A adaptação vai bem e sua carreira ganha um salto internacional." } },
          { probabilidade: 0.5, impacto: { moral: -15, atributos: { frieza: -2 }, narrativa: "O choque cultural e o idioma pesam mais do que o esperado no começo." } },
        ],
      },
      {
        id: "recusar_e_ficar",
        texto: "Recusar e continuar no país",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 8, narrativa: "A torcida local valoriza a permanência em meio ao assédio externo." } },
        ],
      },
    ],
  },
  {
    id: "suspensao_por_cartao",
    titulo: "Suspenso por acúmulo de cartões",
    descricao: "Você cumpre suspensão automática e vai desfalcar o time num jogo importante.",
    opcoes: [
      {
        id: "acompanhar_de_perto_do_elenco",
        texto: "Acompanhar o jogo de perto, ao lado do elenco",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 5, narrativa: "O apoio próximo é notado pelos companheiros mesmo fora de campo." } },
        ],
      },
      {
        id: "aproveitar_para_descansar",
        texto: "Aproveitar o desfalque pra descansar em casa",
        resultados: [
          { probabilidade: 0.6, impacto: { atributos: { resistencia: 2 }, narrativa: "O descanso extra ajuda a recarregar as energias pro resto da temporada." } },
          { probabilidade: 0.4, impacto: { relacoesInternas: -5, narrativa: "A ausência é vista como desinteresse por parte de alguns colegas." } },
        ],
      },
    ],
  },
  {
    id: "lesao_grave_temporada",
    titulo: "Lesão grave, temporada em risco",
    descricao: "Um exame aponta uma lesão séria — o departamento médico apresenta duas linhas de tratamento.",
    opcoes: [
      {
        id: "cirurgia_e_recuperacao_padrao",
        texto: "Cirurgia e reabilitação no ritmo recomendado",
        resultados: [
          { probabilidade: 0.8, impacto: { moral: -5, narrativa: "A recuperação é longa, mas sem sequelas — você volta no ritmo esperado." } },
          { probabilidade: 0.2, impacto: { atributos: { resistencia: -3 }, moral: -15, narrativa: "A recuperação tem complicações e demora mais do que o previsto." } },
        ],
      },
      {
        id: "tratamento_experimental_acelerado",
        texto: "Arriscar um tratamento experimental pra voltar mais rápido",
        resultados: [
          { probabilidade: 0.4, impacto: { moral: 10, narrativa: "O tratamento funciona e você volta bem antes do previsto." } },
          { probabilidade: 0.6, impacto: { atributos: { resistencia: -6, forca_fisica: -4 }, moral: -20, narrativa: "O risco não compensa — a lesão se agrava e deixa sequelas." } },
        ],
      },
    ],
  },
  {
    id: "novo_tecnico_chega",
    titulo: "Novo técnico no comando",
    descricao: "O clube troca de técnico no meio da temporada, e o novo comandante ainda não conhece bem o elenco.",
    opcoes: [
      {
        id: "buscar_o_novo_tecnico",
        texto: "Buscar uma conversa logo cedo com o novo técnico",
        resultados: [
          { probabilidade: 0.7, impacto: { relacoesInternas: 10, narrativa: "A iniciativa é bem recebida e ajuda a te posicionar bem no novo sistema." } },
          { probabilidade: 0.3, impacto: { relacoesInternas: -5, narrativa: "O técnico prefere observar antes de conversar, e a abordagem soa apressada." } },
        ],
      },
      {
        id: "deixar_o_futebol_falar",
        texto: "Deixar o desempenho em campo falar por você",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 3, narrativa: "Sem pressa, você deixa o novo técnico te avaliar com calma nos treinos e jogos." } },
        ],
      },
    ],
  },
  {
    id: "escandalo_vazado_na_imprensa",
    titulo: "Vestiário vazou pra imprensa",
    descricao: "Um desentendimento interno do elenco vazou pra imprensa, e os holofotes se voltam pro vestiário.",
    opcoes: [
      {
        id: "negar_publicamente",
        texto: "Negar tudo publicamente",
        resultados: [
          { probabilidade: 0.4, impacto: { reputacao: 5, narrativa: "A negativa firme esfria a repercussão." } },
          { probabilidade: 0.6, impacto: { reputacao: -10, relacoesInternas: -8, narrativa: "Novos detalhes vazam contradizendo a versão, e a credibilidade cai." } },
        ],
      },
      {
        id: "resolver_internamente_primeiro",
        texto: "Resolver a questão internamente antes de falar",
        resultados: [
          { probabilidade: 0.75, impacto: { relacoesInternas: 10, narrativa: "O grupo se fecha, resolve a questão por dentro e a poeira baixa." } },
          { probabilidade: 0.25, impacto: { relacoesInternas: -5, moral: -5, narrativa: "Mesmo com a tentativa de resolver por dentro, o caso segue rendendo manchetes." } },
        ],
      },
    ],
  },
  {
    id: "evento_patrocinador_dia_de_folga",
    titulo: "Patrocinador convoca pra um evento na folga",
    descricao: "Um dos seus patrocinadores pede sua presença num evento justo no seu dia de folga.",
    opcoes: [
      {
        id: "comparecer_ao_evento",
        texto: "Comparecer ao evento",
        resultados: [
          { probabilidade: 0.7, impacto: { reputacao: 5, moral: -3, narrativa: "O evento vai bem e fortalece a parceria, mas o descanso fica pra depois." } },
          { probabilidade: 0.3, impacto: { moral: -10, narrativa: "O cansaço acumulado do evento pesa nos treinos seguintes." } },
        ],
      },
      {
        id: "recusar_para_descansar",
        texto: "Recusar pra preservar o descanso",
        resultados: [
          { probabilidade: 1, impacto: { moral: 5, narrativa: "O descanso rende bem, ainda que o patrocinador fique um pouco incomodado." } },
        ],
      },
    ],
  },
  {
    id: "amistoso_beneficente",
    titulo: "Convite pra amistoso beneficente",
    descricao: "Uma instituição de caridade te convida pra um amistoso em prol de uma causa social.",
    opcoes: [
      {
        id: "participar_do_amistoso",
        texto: "Participar do amistoso",
        resultados: [
          { probabilidade: 0.85, impacto: { reputacao: 10, reputacaoRegional: 10, moral: 5, narrativa: "O gesto solidário repercute muito bem e humaniza sua imagem pública." } },
          { probabilidade: 0.15, impacto: { moral: -5, narrativa: "Uma pancada boba no amistoso te deixa incomodado por alguns dias, mas sem sequelas." } },
        ],
      },
      {
        id: "recusar_por_agenda",
        texto: "Recusar por conta da agenda apertada",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: -3, narrativa: "A recusa passa despercebida, mas perde-se uma boa oportunidade de imagem." } },
        ],
      },
    ],
  },
  {
    id: "mentoria_de_jovem_promessa",
    titulo: "Um garoto da base pede conselhos",
    descricao: "Uma jovem promessa da base do clube te procura pedindo orientação pra carreira.",
    opcoes: [
      {
        id: "aceitar_mentorar",
        texto: "Aceitar mentorar o garoto",
        resultados: [
          { probabilidade: 0.8, impacto: { atributos: { lideranca: 3 }, relacoesInternas: 8, reputacaoRegional: 5, narrativa: "A mentoria rende frutos e o clube reconhece sua liderança." } },
          { probabilidade: 0.2, impacto: { moral: -3, narrativa: "O tempo dedicado à mentoria pesa um pouco na sua própria rotina de treinos." } },
        ],
      },
      {
        id: "recusar_falta_de_tempo",
        texto: "Recusar por falta de tempo",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: -3, narrativa: "O garoto entende, mas o gesto de recusa não passa despercebido no clube." } },
        ],
      },
    ],
  },
  {
    id: "reuniao_de_metas_com_diretoria",
    titulo: "Reunião de metas com a diretoria",
    descricao: "A diretoria convoca uma reunião pra alinhar as expectativas de resultado pro resto da temporada.",
    opcoes: [
      {
        id: "cobrar_investimento_no_elenco",
        texto: "Cobrar mais investimento no elenco",
        resultados: [
          { probabilidade: 0.45, impacto: { relacoesInternas: 5, reputacaoRegional: 8, narrativa: "A cobrança é bem recebida e a torcida vê você como alguém que briga pelo clube." } },
          { probabilidade: 0.55, impacto: { relacoesInternas: -10, narrativa: "A diretoria não gosta de ser pressionada e a relação esfria." } },
        ],
      },
      {
        id: "aceitar_o_planejamento",
        texto: "Aceitar o planejamento apresentado",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 5, narrativa: "A postura colaborativa é bem vista pela diretoria." } },
        ],
      },
    ],
  },
  {
    id: "multidao_de_torcedores_pede_autografo",
    titulo: "Cercado por torcedores na saída do treino",
    descricao: "Uma multidão de torcedores te cerca na saída do centro de treinamento pedindo fotos e autógrafos.",
    opcoes: [
      {
        id: "parar_para_atender_a_todos",
        texto: "Parar pra atender a todos com calma",
        resultados: [
          { probabilidade: 0.85, impacto: { reputacaoRegional: 12, moral: 3, narrativa: "A atenção com a torcida vira assunto positivo na cidade toda." } },
          { probabilidade: 0.15, impacto: { moral: -5, narrativa: "A demora acaba atrasando seu compromisso seguinte, gerando um certo desgaste." } },
        ],
      },
      {
        id: "cumprimentar_rapido_e_seguir",
        texto: "Cumprimentar rapidamente e seguir em frente",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 2, narrativa: "Um gesto rápido e cordial, sem grandes repercussões." } },
        ],
      },
    ],
  },
  {
    id: "rixa_com_torcida_visitante",
    titulo: "Provocação da torcida visitante",
    descricao: "Jogando fora de casa, a torcida do adversário te provoca durante o aquecimento.",
    opcoes: [
      {
        id: "responder_com_gesto",
        texto: "Responder com um gesto pra torcida",
        resultados: [
          { probabilidade: 0.4, impacto: { reputacao: 5, atributos: { frieza: 2 }, narrativa: "O gesto viraliza como sinal de personalidade e sangue-frio." } },
          { probabilidade: 0.6, impacto: { reputacao: -8, narrativa: "O gesto é mal interpretado e vira munição pra críticas na imprensa adversária." } },
        ],
      },
      {
        id: "ignorar_completamente",
        texto: "Ignorar completamente e focar no aquecimento",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { frieza: 2 }, narrativa: "A provocação não tira seu foco do jogo." } },
        ],
      },
    ],
  },
  {
    id: "crise_financeira_pessoal",
    titulo: "Proposta de investimento suspeita",
    descricao: "Um conhecido oferece uma oportunidade de investimento pessoal com retorno alto demais pra ser verdade.",
    opcoes: [
      {
        id: "investir_uma_parte",
        texto: "Investir uma parte do patrimônio",
        resultados: [
          { probabilidade: 0.3, impacto: { moral: 10, narrativa: "O investimento surpreende e rende um bom retorno." } },
          { probabilidade: 0.7, impacto: { moral: -15, narrativa: "O esquema desanda e parte do dinheiro investido se perde." } },
        ],
      },
      {
        id: "consultar_um_especialista",
        texto: "Consultar um especialista financeiro antes de decidir",
        resultados: [
          { probabilidade: 1, impacto: { moral: 3, narrativa: "O especialista identifica os riscos a tempo, e você evita uma dor de cabeça." } },
        ],
      },
    ],
  },
];
