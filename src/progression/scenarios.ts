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
  /** Condições sob as quais o cenário faz sentido acontecer. Omitido = elegível a qualquer momento (era o comportamento único antes deste campo existir). */
  gatilho?: Gatilho;
}

/**
 * Fase ampla da temporada, do ponto de vista de "que tipo de assunto de
 * carreira faz sentido agora" — não é o `periodo` granular de
 * `data/loaders/calendario.ts` (esse é por competição/mês); é uma
 * categoria simples que quem monta o `ContextoSorteio` decide a partir do
 * contexto que tiver disponível (calendário real, ou um valor fixo em
 * demos que ainda não têm calendário ligado).
 *
 * - `pre_temporada`: pré-temporada / entressafra — janela de
 *   transferência, negociação de contrato, planejamento, ainda sem jogos
 *   valendo pontos.
 * - `temporada_regular`: meio da temporada, jogos normais rolando.
 * - `reta_final`: fase decisiva da temporada (mata-mata, briga direta por
 *   título/rebaixamento/vaga).
 * - `pos_temporada`: temporada encerrada, balanço do ano, decisões sobre o
 *   futuro (aposentadoria, renovação, etc.).
 */
export type MomentoDeCarreira = "pre_temporada" | "temporada_regular" | "reta_final" | "pos_temporada";

/**
 * Condições de elegibilidade de um cenário — todo campo é opcional; um
 * `Gatilho` com nenhum campo definido (ou um `Cenario` sem `gatilho`) é
 * elegível sempre. Os campos de min/max são inclusivos e comparam contra
 * o `ContextoSorteio` correspondente; `momentos`, se definido, só filtra
 * o cenário quando o `ContextoSorteio.momento` é informado — sem essa
 * informação (ex: chamador que ainda não ligou o calendário) o cenário
 * continua elegível, permissivo por padrão.
 */
export interface Gatilho {
  idadeMinima?: number;
  idadeMaxima?: number;
  reputacaoNacionalMinima?: number;
  reputacaoNacionalMaxima?: number;
  /** Reputação na região atual do jogador (`ContextoSorteio.reputacaoRegional`), não a nacional. */
  reputacaoRegionalMinima?: number;
  reputacaoRegionalMaxima?: number;
  moralMinima?: number;
  moralMaxima?: number;
  relacoesInternasMinima?: number;
  relacoesInternasMaxima?: number;
  /** Momentos em que o cenário faz sentido (ver `MomentoDeCarreira`). Omitido = qualquer momento. */
  momentos?: MomentoDeCarreira[];
}

/** Contexto atual do jogador/carreira usado pra decidir quais cenários são elegíveis (ver `filtrarCenariosElegiveis`). */
export interface ContextoSorteio {
  idadeJogador: number;
  reputacaoNacional: number;
  /** Reputação na região atual do jogador (0 se a região não tiver entrada em `Reputacao.porRegiao`). */
  reputacaoRegional: number;
  moral: number;
  relacoesInternas: number;
  /** Omitido = não filtra por momento, mesmo que algum cenário declare `gatilho.momentos`. */
  momento?: MomentoDeCarreira;
}

/** Confere se um cenário é elegível num contexto — usado por `filtrarCenariosElegiveis`. */
export function cenarioElegivel(cenario: Cenario, contexto: ContextoSorteio): boolean {
  const g = cenario.gatilho;
  if (!g) return true;

  if (g.idadeMinima !== undefined && contexto.idadeJogador < g.idadeMinima) return false;
  if (g.idadeMaxima !== undefined && contexto.idadeJogador > g.idadeMaxima) return false;
  if (g.reputacaoNacionalMinima !== undefined && contexto.reputacaoNacional < g.reputacaoNacionalMinima) return false;
  if (g.reputacaoNacionalMaxima !== undefined && contexto.reputacaoNacional > g.reputacaoNacionalMaxima) return false;
  if (g.reputacaoRegionalMinima !== undefined && contexto.reputacaoRegional < g.reputacaoRegionalMinima) return false;
  if (g.reputacaoRegionalMaxima !== undefined && contexto.reputacaoRegional > g.reputacaoRegionalMaxima) return false;
  if (g.moralMinima !== undefined && contexto.moral < g.moralMinima) return false;
  if (g.moralMaxima !== undefined && contexto.moral > g.moralMaxima) return false;
  if (g.relacoesInternasMinima !== undefined && contexto.relacoesInternas < g.relacoesInternasMinima) return false;
  if (g.relacoesInternasMaxima !== undefined && contexto.relacoesInternas > g.relacoesInternasMaxima) return false;
  if (g.momentos && contexto.momento && !g.momentos.includes(contexto.momento)) return false;

  return true;
}

/** Filtra o catálogo pros cenários elegíveis num contexto — chame antes de `sortearCenario` pra sortear só entre o que faz sentido agora. */
export function filtrarCenariosElegiveis(cenarios: Cenario[], contexto: ContextoSorteio): Cenario[] {
  return cenarios.filter((cenario) => cenarioElegivel(cenario, contexto));
}

/**
 * Mapeia o `periodo` (string livre, ver `PeriodoCalendario` em
 * `schemas/calendar.ts`/`data/loaders/calendario.ts`) pro `MomentoDeCarreira`
 * mais próximo. Não importa nada de `data/loaders` de propósito — o tipo do
 * campo já é só `string`, então este módulo de progressão não precisa
 * depender do módulo de dados de calendário.
 *
 * **Limitação real, documentada**: o calendário padrão brasileiro tem só 5
 * períodos, e o último (`"mai-nov"`) cobre 7 meses inteiros — de maio até
 * novembro, incluindo tanto o meio da temporada quanto a reta final de
 * verdade (rodadas finais do Brasileirão/Libertadores em outubro-novembro).
 * Não dá pra distinguir isso só pelo nome do período; por isso período
 * nenhum aqui mapeia pra `"reta_final"` — quem sabe a rodada/fase exata
 * (não só o mês) deve usar `momentoPorProgresso` em vez deste, que é mais
 * preciso pra decidir reta final. Período desconhecido cai no padrão
 * permissivo `"temporada_regular"`.
 */
export function momentoDoPeriodo(periodo: string): MomentoDeCarreira {
  const momentoPorPeriodo: Record<string, MomentoDeCarreira> = {
    "jan-1a_quinz": "pre_temporada", // ainda dentro da janela de transferência/pré-temporada real, mesmo com os primeiros jogos de estadual já rolando
    fev: "temporada_regular",
    mar: "temporada_regular",
    abr: "temporada_regular",
    "mai-nov": "temporada_regular",
  };

  return momentoPorPeriodo[periodo] ?? "temporada_regular";
}

/**
 * Deriva o momento a partir do progresso da temporada (`0` = início da
 * pré-temporada, `1` = fim, depois de tudo decidido) — mais preciso que
 * `momentoDoPeriodo` pra decidir `"reta_final"`, que não é um mês fixo
 * (depende do formato/tamanho de cada competição, varia por país). Útil
 * pra quem já sabe em que rodada/fase da temporada está, não só em que mês
 * do calendário.
 */
export function momentoPorProgresso(progresso: number): MomentoDeCarreira {
  if (progresso <= 0) return "pre_temporada";
  if (progresso >= 1) return "pos_temporada";
  if (progresso >= 0.85) return "reta_final";
  return "temporada_regular";
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
    gatilho: { momentos: ["pre_temporada"] },
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
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
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
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
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
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
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
    gatilho: { momentos: ["pre_temporada"] },
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
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
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
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
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
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
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
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
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
    gatilho: { moralMaxima: 60, momentos: ["temporada_regular", "reta_final"] },
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
    gatilho: { relacoesInternasMinima: 55, idadeMinima: 21 },
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
    gatilho: { reputacaoNacionalMinima: 40 },
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
    gatilho: { momentos: ["pre_temporada"] },
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
    gatilho: { momentos: ["pre_temporada"], reputacaoNacionalMinima: 30 },
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
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
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
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
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
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
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
    gatilho: { momentos: ["pre_temporada", "pos_temporada"] },
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
    gatilho: { idadeMinima: 24 },
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
    gatilho: { momentos: ["pre_temporada"] },
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
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
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
  {
    id: "coreografia_da_torcida",
    titulo: "Coreografia dedicada a você",
    descricao: "A torcida organizada prepara uma coreografia especial em sua homenagem antes do jogo.",
    gatilho: { reputacaoRegionalMinima: 20, momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "agradecer_publicamente",
        texto: "Agradecer publicamente antes da bola rolar",
        resultados: [
          { probabilidade: 0.75, impacto: { reputacaoRegional: 15, moral: 8, narrativa: "O gesto emociona a torcida e fortalece o vínculo com a arquibancada." } },
          { probabilidade: 0.25, impacto: { moral: -5, narrativa: "A emoção do momento tira seu foco e o início de jogo é abaixo do normal." } },
        ],
      },
      {
        id: "focar_no_jogo",
        texto: "Agradecer com um aceno rápido e focar no jogo",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 5, narrativa: "Discreto, mas suficiente pra torcida sentir-se valorizada." } },
        ],
      },
    ],
  },
  {
    id: "jejum_de_vitorias",
    titulo: "Jejum de vitórias",
    descricao: "O time acumula rodadas sem vencer e o clima no elenco está pesado.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "puxar_reuniao_no_vestiario",
        texto: "Puxar uma reunião só com os jogadores, sem a comissão",
        resultados: [
          { probabilidade: 0.5, impacto: { atributos: { lideranca: 3 }, relacoesInternas: 12, moral: 10, narrativa: "A conversa franca reacende o espírito de grupo." } },
          { probabilidade: 0.5, impacto: { relacoesInternas: -8, narrativa: "A reunião expõe rachas que já existiam, e o clima piora." } },
        ],
      },
      {
        id: "manter_a_rotina",
        texto: "Manter a rotina normal e confiar no trabalho",
        resultados: [
          { probabilidade: 1, impacto: { moral: -3, narrativa: "Sem grandes gestos, o grupo tenta reverter o jejum só com trabalho." } },
        ],
      },
    ],
  },
  {
    id: "recepcao_no_aeroporto",
    titulo: "Recepção no aeroporto",
    descricao: "Ao voltar de uma viagem, uma multidão de torcedores espera no aeroporto — o clima pode ser calor ou cobrança, depende do momento do time.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "parar_para_interagir",
        texto: "Parar pra interagir com quem está lá",
        resultados: [
          { probabilidade: 0.6, impacto: { reputacaoRegional: 10, moral: 5, narrativa: "A recepção calorosa vira assunto positivo na cidade." } },
          { probabilidade: 0.4, impacto: { reputacaoRegional: -8, moral: -8, narrativa: "A recepção é hostil, e o momento vira desgaste emocional." } },
        ],
      },
      {
        id: "seguir_direto",
        texto: "Seguir direto, sem parar",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: -2, narrativa: "Evita o desgaste, mas parte da torcida sente indiferença." } },
        ],
      },
    ],
  },
  {
    id: "reconhecido_em_publico",
    titulo: "Reconhecido em lugar inesperado",
    descricao: "Num momento de folga, longe dos holofotes, alguém te reconhece e pede uma foto na hora.",
    opcoes: [
      {
        id: "atender_com_simpatia",
        texto: "Atender com simpatia, mesmo fora de hora",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 6, narrativa: "O gesto espontâneo rende boa repercussão de boca em boca." } },
        ],
      },
      {
        id: "pedir_para_deixar_para_depois",
        texto: "Pedir educadamente pra deixar pra outro momento",
        resultados: [
          { probabilidade: 0.5, impacto: { moral: 3, narrativa: "A pessoa entende e você preserva seu momento de privacidade." } },
          { probabilidade: 0.5, impacto: { reputacaoRegional: -6, narrativa: "A recusa viraliza como sinal de arrogância, mesmo sem essa intenção." } },
        ],
      },
    ],
  },
  {
    id: "festa_aniversario_do_clube",
    titulo: "Aniversário do clube",
    descricao: "O clube completa mais um ano e organiza uma festa com a torcida — sua presença é sugerida, mas não obrigatória.",
    opcoes: [
      {
        id: "comparecer_a_festa",
        texto: "Comparecer à festa",
        resultados: [
          { probabilidade: 0.8, impacto: { reputacaoRegional: 12, relacoesInternas: 5, narrativa: "Sua presença é o ponto alto da celebração." } },
          { probabilidade: 0.2, impacto: { moral: -3, narrativa: "O evento cansativo atrapalha um pouco a recuperação física da semana." } },
        ],
      },
      {
        id: "enviar_mensagem_de_video",
        texto: "Enviar uma mensagem em vídeo, sem comparecer",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 4, narrativa: "O gesto é bem recebido, mesmo à distância." } },
        ],
      },
    ],
  },
  {
    id: "preparador_fisico_plano_diferente",
    titulo: "Plano de treino diferente do habitual",
    descricao: "O preparador físico propõe um plano de treino fora da sua zona de conforto, prometendo ganhos de performance.",
    gatilho: { momentos: ["pre_temporada"] },
    opcoes: [
      {
        id: "seguir_o_plano_a_risca",
        texto: "Seguir o plano à risca",
        resultados: [
          { probabilidade: 0.55, impacto: { atributos: { resistencia: 4, forca_fisica: 2 }, narrativa: "O novo plano funciona e traz ganhos físicos reais." } },
          { probabilidade: 0.45, impacto: { atributos: { resistencia: -3 }, moral: -8, narrativa: "O corpo não responde bem à mudança brusca, e a fadiga aumenta." } },
        ],
      },
      {
        id: "pedir_adaptacao_gradual",
        texto: "Pedir uma adaptação mais gradual do plano",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { resistencia: 1 }, relacoesInternas: 2, narrativa: "O ganho é modesto, mas sem sobressaltos." } },
        ],
      },
    ],
  },
  {
    id: "analise_de_video_erro_recorrente",
    titulo: "Análise de vídeo aponta erro recorrente",
    descricao: "A comissão técnica te chama pra uma sessão de vídeo mostrando um erro que se repete há semanas.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "trabalhar_o_ajuste_com_afinco",
        texto: "Trabalhar o ajuste com afinco nos próximos treinos",
        resultados: [
          { probabilidade: 0.65, impacto: { atributos: { posicionamento_defensivo: 3 }, relacoesInternas: 5, narrativa: "O ajuste funciona e o erro praticamente some do seu jogo." } },
          { probabilidade: 0.35, impacto: { moral: -5, narrativa: "O vício de movimento é difícil de corrigir rápido, e a cobrança pesa." } },
        ],
      },
      {
        id: "discordar_da_analise",
        texto: "Discordar da análise da comissão",
        resultados: [
          { probabilidade: 0.4, impacto: { relacoesInternas: -5, narrativa: "A comissão respeita o contraponto, mas fica de olho." } },
          { probabilidade: 0.6, impacto: { relacoesInternas: -12, narrativa: "A discordância é vista como resistência a evoluir." } },
        ],
      },
    ],
  },
  {
    id: "disputa_de_posicao_com_colega",
    titulo: "Disputa de posição com um companheiro",
    descricao: "Um companheiro de elenco disputa a mesma posição que você, e a titularidade está em jogo.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "elevar_o_nivel_nos_treinos",
        texto: "Elevar o nível nos treinos pra garantir a vaga",
        resultados: [
          { probabilidade: 0.6, impacto: { atributos: { frieza: 2 }, relacoesInternas: -3, narrativa: "A postura competitiva garante a titularidade, mas esfria um pouco a amizade." } },
          { probabilidade: 0.4, impacto: { moral: -8, narrativa: "O esforço extra não é suficiente, e o companheiro leva a titularidade." } },
        ],
      },
      {
        id: "torcer_pelo_melhor_para_o_time",
        texto: "Manter a relação amistosa e deixar o técnico decidir",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 8, narrativa: "A maturidade na disputa é notada e valorizada pelo grupo." } },
        ],
      },
    ],
  },
  {
    id: "mudanca_de_esquema_antes_de_jogo_grande",
    titulo: "Mudança de esquema antes do jogo grande",
    descricao: "Às vésperas de um jogo decisivo, o técnico anuncia uma mudança tática que te tira da posição habitual.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "abracar_a_mudanca",
        texto: "Abraçar a mudança e se adaptar rápido",
        resultados: [
          { probabilidade: 0.5, impacto: { atributos: { movimentacao: 3 }, relacoesInternas: 8, narrativa: "A adaptação surpreende e o técnico passa a confiar mais em você." } },
          { probabilidade: 0.5, impacto: { moral: -8, narrativa: "A mudança de última hora atrapalha seu ritmo na partida decisiva." } },
        ],
      },
      {
        id: "pedir_para_manter_a_posicao",
        texto: "Pedir pra manter sua posição de origem",
        resultados: [
          { probabilidade: 0.5, impacto: { relacoesInternas: 3, narrativa: "O técnico ouve e ajusta o plano, respeitando seu pedido." } },
          { probabilidade: 0.5, impacto: { relacoesInternas: -8, narrativa: "O pedido é visto como falta de flexibilidade num momento importante." } },
        ],
      },
    ],
  },
  {
    id: "tirado_no_intervalo",
    titulo: "Substituído no intervalo",
    descricao: "O técnico decide te tirar de campo logo no intervalo, sem uma explicação clara.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "cobrar_explicacao_no_vestiario",
        texto: "Cobrar uma explicação ainda no vestiário",
        resultados: [
          { probabilidade: 0.4, impacto: { relacoesInternas: 5, narrativa: "A conversa franca esclarece o mal-entendido e fortalece a relação." } },
          { probabilidade: 0.6, impacto: { relacoesInternas: -15, moral: -10, narrativa: "A cobrança no calor do momento gera um atrito sério com o técnico." } },
        ],
      },
      {
        id: "engolir_e_conversar_depois",
        texto: "Engolir a decisão e conversar com calma depois",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 4, moral: -3, narrativa: "A postura profissional é notada, mesmo com o desconforto do momento." } },
        ],
      },
    ],
  },
  {
    id: "podcast_convite",
    titulo: "Convite pra um podcast de esportes",
    descricao: "Um podcast popular te convida pra uma conversa longa e sem roteiro fechado.",
    gatilho: { reputacaoNacionalMinima: 30 },
    opcoes: [
      {
        id: "topar_a_conversa_aberta",
        texto: "Topar a conversa sem roteiro fechado",
        resultados: [
          { probabilidade: 0.55, impacto: { reputacao: 12, narrativa: "A espontaneidade humaniza sua imagem e viraliza de forma positiva." } },
          { probabilidade: 0.45, impacto: { reputacao: -8, narrativa: "Uma resposta solta demais vira manchete indesejada." } },
        ],
      },
      {
        id: "pedir_perguntas_previas",
        texto: "Pedir as perguntas com antecedência",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 3, narrativa: "A conversa sai controlada, sem grandes repercussões." } },
        ],
      },
    ],
  },
  {
    id: "documentario_sobre_carreira",
    titulo: "Proposta de documentário",
    descricao: "Uma produtora quer fazer um documentário sobre sua trajetória até aqui.",
    gatilho: { reputacaoNacionalMinima: 50 },
    opcoes: [
      {
        id: "abrir_as_portas",
        texto: "Abrir as portas da vida pessoal pro documentário",
        resultados: [
          { probabilidade: 0.6, impacto: { reputacao: 15, moral: 5, narrativa: "O documentário emociona o público e projeta sua imagem." } },
          { probabilidade: 0.4, impacto: { moral: -10, relacoesInternas: -5, narrativa: "Detalhes expostos incomodam pessoas próximas e geram desconforto." } },
        ],
      },
      {
        id: "limitar_ao_profissional",
        texto: "Limitar o documentário só ao lado profissional",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 5, narrativa: "O resultado é mais morno, mas sem arestas pessoais expostas." } },
        ],
      },
    ],
  },
  {
    id: "comparacao_publica_com_outro_jogador",
    titulo: "Comparado publicamente com outro jogador",
    descricao: "A imprensa começa a te comparar diretamente com outro jogador de destaque da mesma posição.",
    gatilho: { reputacaoNacionalMinima: 40 },
    opcoes: [
      {
        id: "usar_a_comparacao_como_motivacao",
        texto: "Usar a comparação como motivação extra",
        resultados: [
          { probabilidade: 0.55, impacto: { atributos: { frieza: 2 }, moral: 10, narrativa: "A comparação vira combustível e seu rendimento melhora." } },
          { probabilidade: 0.45, impacto: { moral: -10, narrativa: "A pressão da comparação pesa mais do que ajuda." } },
        ],
      },
      {
        id: "ignorar_a_comparacao",
        texto: "Ignorar completamente a comparação",
        resultados: [
          { probabilidade: 1, impacto: { moral: 2, narrativa: "Você segue seu próprio ritmo, sem se abalar." } },
        ],
      },
    ],
  },
  {
    id: "pergunta_constrangedora_entrevista",
    titulo: "Pergunta constrangedora ao vivo",
    descricao: "Num programa ao vivo, um repórter faz uma pergunta constrangedora sobre sua vida pessoal.",
    gatilho: { reputacaoNacionalMinima: 20 },
    opcoes: [
      {
        id: "responder_com_humor",
        texto: "Responder com humor e desviar",
        resultados: [
          { probabilidade: 0.6, impacto: { reputacao: 8, narrativa: "A resposta bem-humorada desarma a situação e cai bem com o público." } },
          { probabilidade: 0.4, impacto: { reputacao: -5, narrativa: "A tentativa de piada soa deslocada e vira assunto por dias." } },
        ],
      },
      {
        id: "recusar_responder",
        texto: "Recusar-se a responder educadamente",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: -2, narrativa: "A recusa é respeitada, mas gera um breve climão no estúdio." } },
        ],
      },
    ],
  },
  {
    id: "exposicao_da_vida_pessoal_pela_imprensa",
    titulo: "Vida pessoal exposta pela imprensa",
    descricao: "Um veículo de imprensa publica detalhes da sua vida pessoal sem sua autorização.",
    gatilho: { reputacaoNacionalMinima: 30 },
    opcoes: [
      {
        id: "buscar_medidas_legais",
        texto: "Buscar medidas legais contra a publicação",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacao: 5, moral: 5, narrativa: "A resposta firme é respeitada e freia novas invasões de privacidade." } },
          { probabilidade: 0.5, impacto: { reputacao: -5, moral: -8, narrativa: "O processo vira mais assunto na mídia, prolongando o desconforto." } },
        ],
      },
      {
        id: "deixar_para_la",
        texto: "Deixar pra lá e não alimentar o assunto",
        resultados: [
          { probabilidade: 1, impacto: { moral: -5, narrativa: "O assunto esfria sozinho depois de alguns dias." } },
        ],
      },
    ],
  },
  {
    id: "jogador_estrangeiro_precisa_de_ajuda",
    titulo: "Reforço estrangeiro precisa de ajuda",
    descricao: "Um novo reforço estrangeiro chega ao clube com dificuldade de adaptação ao idioma e à cultura local.",
    opcoes: [
      {
        id: "ajudar_na_adaptacao",
        texto: "Ajudar ativamente na adaptação dele",
        resultados: [
          { probabilidade: 0.8, impacto: { relacoesInternas: 10, atributos: { lideranca: 2 }, narrativa: "O gesto de acolhimento fortalece o grupo como um todo." } },
          { probabilidade: 0.2, impacto: { moral: -3, narrativa: "O tempo dedicado a ajudar tira um pouco do seu foco pessoal." } },
        ],
      },
      {
        id: "deixar_a_adaptacao_por_conta_do_clube",
        texto: "Deixar a adaptação por conta da estrutura do clube",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: -3, narrativa: "O reforço se sente um pouco mais isolado no início." } },
        ],
      },
    ],
  },
  {
    id: "zoeira_do_grupo",
    titulo: "Zoeira do grupo passa dos limites",
    descricao: "Uma brincadeira do elenco com você acaba passando dos limites nas redes sociais internas do time.",
    opcoes: [
      {
        id: "levar_na_esportiva",
        texto: "Levar na esportiva e revidar com bom humor",
        resultados: [
          { probabilidade: 0.75, impacto: { relacoesInternas: 8, moral: 3, narrativa: "A leveza fortalece o vínculo com o grupo." } },
          { probabilidade: 0.25, impacto: { moral: -5, narrativa: "Mesmo levando na esportiva, o comentário incomoda por dentro." } },
        ],
      },
      {
        id: "pedir_para_parar",
        texto: "Pedir educadamente pra brincadeira parar",
        resultados: [
          { probabilidade: 0.6, impacto: { relacoesInternas: 3, narrativa: "O grupo entende e respeita o limite colocado." } },
          { probabilidade: 0.4, impacto: { relacoesInternas: -8, narrativa: "O pedido é mal recebido e você vira o \"sem graça\" do grupo por um tempo." } },
        ],
      },
    ],
  },
  {
    id: "ausencia_em_aniversario_de_colega",
    titulo: "Ausência no aniversário de um colega",
    descricao: "Você não pôde comparecer ao aniversário de um companheiro de elenco por conta da agenda apertada.",
    opcoes: [
      {
        id: "compensar_com_um_gesto",
        texto: "Compensar com um gesto especial depois",
        resultados: [
          { probabilidade: 0.7, impacto: { relacoesInternas: 6, narrativa: "O gesto é bem recebido e apaga qualquer mal-estar." } },
          { probabilidade: 0.3, impacto: { relacoesInternas: 1, narrativa: "O gesto ajuda pouco — o colega ainda guarda uma mágoa." } },
        ],
      },
      {
        id: "nao_fazer_nada_a_respeito",
        texto: "Não fazer nada a respeito",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: -5, narrativa: "A ausência sem gesto nenhum deixa um ressentimento silencioso." } },
        ],
      },
    ],
  },
  {
    id: "conselho_de_veterano_se_aposentando",
    titulo: "Conselho de um veterano prestes a se aposentar",
    descricao: "Um veterano do elenco, na reta final da carreira, te chama pra uma conversa sincera sobre o futuro.",
    opcoes: [
      {
        id: "ouvir_com_atencao",
        texto: "Ouvir com atenção e levar os conselhos a sério",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { frieza: 2 }, relacoesInternas: 6, narrativa: "A conversa amadurece sua visão sobre a carreira." } },
        ],
      },
      {
        id: "ouvir_por_educacao",
        texto: "Ouvir por educação, sem levar muito a sério",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: -2, narrativa: "O veterano nota o desinteresse, e algo se perde na relação." } },
        ],
      },
    ],
  },
  {
    id: "renovacao_de_contrato",
    titulo: "Negociação de renovação de contrato",
    descricao: "Seu contrato está perto do fim e o clube abre negociação de renovação.",
    gatilho: { momentos: ["pre_temporada"] },
    opcoes: [
      {
        id: "negociar_com_firmeza",
        texto: "Negociar com firmeza por condições melhores",
        resultados: [
          { probabilidade: 0.55, impacto: { reputacao: 8, moral: 10, narrativa: "A negociação dura, mas você sai com um contrato bem melhor." } },
          { probabilidade: 0.45, impacto: { relacoesInternas: -10, moral: -5, narrativa: "A postura dura desgasta a relação com a diretoria." } },
        ],
      },
      {
        id: "aceitar_a_primeira_proposta",
        texto: "Aceitar a primeira proposta, sem contestar",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 8, narrativa: "A diretoria valoriza a simplicidade da negociação." } },
        ],
      },
    ],
  },
  {
    id: "bonus_por_titulo",
    titulo: "Bônus por título prometido",
    descricao: "A diretoria promete um bônus especial ao elenco caso o time seja campeão na reta final da temporada.",
    gatilho: { momentos: ["reta_final"] },
    opcoes: [
      {
        id: "cobrar_formalizacao_por_escrito",
        texto: "Cobrar que a promessa seja formalizada por escrito",
        resultados: [
          { probabilidade: 0.6, impacto: { relacoesInternas: -3, moral: 8, narrativa: "A formalização garante segurança, ainda que a cobrança incomode um pouco a diretoria." } },
          { probabilidade: 0.4, impacto: { relacoesInternas: -10, narrativa: "A diretoria interpreta a cobrança como desconfiança." } },
        ],
      },
      {
        id: "confiar_na_palavra_da_diretoria",
        texto: "Confiar na palavra dada",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 5, narrativa: "A confiança fortalece a relação, com o risco reservado pro futuro." } },
        ],
      },
    ],
  },
  {
    id: "mudanca_de_patamar_salarial",
    titulo: "Mudança de patamar salarial",
    descricao: "Depois de uma sequência de boas atuações, você se vê num novo patamar salarial dentro do elenco.",
    gatilho: { momentos: ["pre_temporada"] },
    opcoes: [
      {
        id: "manter_a_rotina_de_sempre",
        texto: "Manter a rotina e humildade de sempre",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 6, narrativa: "O grupo respeita a maturidade em lidar com a nova condição." } },
        ],
      },
      {
        id: "mudar_o_padrao_de_vida_rapido",
        texto: "Mudar o padrão de vida rapidamente",
        resultados: [
          { probabilidade: 0.4, impacto: { moral: 8, narrativa: "A nova vida traz conforto e bem-estar genuínos." } },
          { probabilidade: 0.6, impacto: { relacoesInternas: -8, moral: -3, narrativa: "A mudança repentina gera comentários de que você \"mudou a cabeça\"." } },
        ],
      },
    ],
  },
  {
    id: "novo_dono_compra_o_clube",
    titulo: "Novo dono assume o clube",
    descricao: "Um novo investidor compra o clube e promete mudanças profundas na estrutura.",
    opcoes: [
      {
        id: "apoiar_publicamente_as_mudancas",
        texto: "Apoiar publicamente as mudanças",
        resultados: [
          { probabilidade: 0.5, impacto: { relacoesInternas: 10, reputacaoRegional: 5, narrativa: "O apoio público te aproxima da nova gestão." } },
          { probabilidade: 0.5, impacto: { reputacaoRegional: -8, narrativa: "Parte da torcida vê o apoio como bajulação ao novo dono." } },
        ],
      },
      {
        id: "esperar_para_ver",
        texto: "Esperar pra ver o que muda na prática",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 2, narrativa: "A cautela é uma postura segura em meio à incerteza." } },
        ],
      },
    ],
  },
  {
    id: "clausula_de_rescisao_negociada",
    titulo: "Negociação de cláusula de rescisão",
    descricao: "O clube propõe reduzir sua cláusula de rescisão em troca de outros benefícios contratuais.",
    gatilho: { momentos: ["pre_temporada"] },
    opcoes: [
      {
        id: "aceitar_a_troca",
        texto: "Aceitar a troca proposta",
        resultados: [
          { probabilidade: 0.5, impacto: { moral: 8, relacoesInternas: 5, narrativa: "Os novos benefícios compensam bem a cláusula menor." } },
          { probabilidade: 0.5, impacto: { moral: -8, narrativa: "Uma proposta de fora surge logo depois, e a cláusula baixa custa uma boa oportunidade de negociação." } },
        ],
      },
      {
        id: "manter_a_clausula_atual",
        texto: "Manter a cláusula atual",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: -3, narrativa: "O clube respeita a decisão, ainda que um pouco frustrado." } },
        ],
      },
    ],
  },
  {
    id: "interesse_de_multiplos_clubes",
    titulo: "Múltiplos clubes de olho em você",
    descricao: "Numa mesma janela, mais de um clube demonstra interesse formal em contar com você.",
    gatilho: { momentos: ["pre_temporada"], reputacaoNacionalMinima: 30 },
    opcoes: [
      {
        id: "deixar_o_mercado_aquecer",
        texto: "Deixar o mercado aquecer antes de decidir",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacao: 15, narrativa: "A disputa entre clubes valoriza ainda mais seu nome no mercado." } },
          { probabilidade: 0.5, impacto: { relacoesInternas: -8, narrativa: "A demora em decidir gera desconforto com o clube atual." } },
        ],
      },
      {
        id: "decidir_rapido",
        texto: "Decidir rápido pra evitar desgaste",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 5, narrativa: "A decisão rápida evita ruído desnecessário." } },
        ],
      },
    ],
  },
  {
    id: "agente_troca_de_empresario",
    titulo: "Troca de empresário",
    descricao: "Você considera trocar de empresário no meio da carreira, em busca de melhores oportunidades.",
    opcoes: [
      {
        id: "trocar_de_empresario",
        texto: "Trocar de empresário",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacao: 10, moral: 5, narrativa: "O novo empresário abre portas que antes pareciam fechadas." } },
          { probabilidade: 0.5, impacto: { moral: -10, narrativa: "A transição é conturbada, com pendências do contrato antigo." } },
        ],
      },
      {
        id: "manter_o_empresario_atual",
        texto: "Manter o empresário atual",
        resultados: [
          { probabilidade: 1, impacto: { moral: 2, narrativa: "A relação de confiança de longa data se mantém estável." } },
        ],
      },
    ],
  },
  {
    id: "boato_de_transferencia_antes_de_confirmado",
    titulo: "Boato de transferência antes da hora",
    descricao: "A imprensa noticia uma transferência sua antes de qualquer confirmação oficial do clube.",
    gatilho: { momentos: ["pre_temporada"] },
    opcoes: [
      {
        id: "desmentir_o_boato",
        texto: "Desmentir o boato publicamente",
        resultados: [
          { probabilidade: 0.55, impacto: { relacoesInternas: 8, narrativa: "O desmentido acalma o clube e a torcida." } },
          { probabilidade: 0.45, impacto: { reputacao: -5, narrativa: "O desmentido soa falso quando a negociação de fato avança dias depois." } },
        ],
      },
      {
        id: "nao_comentar",
        texto: "Não comentar o assunto",
        resultados: [
          { probabilidade: 1, impacto: { moral: -3, narrativa: "O silêncio alimenta ainda mais especulação por um tempo." } },
        ],
      },
    ],
  },
  {
    id: "insonia_antes_de_jogo_decisivo",
    titulo: "Insônia antes de um jogo decisivo",
    descricao: "Na véspera de um jogo decisivo, a ansiedade tira seu sono.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "buscar_ajuda_do_departamento_medico",
        texto: "Buscar ajuda do departamento médico",
        resultados: [
          { probabilidade: 0.75, impacto: { atributos: { frieza: 2 }, narrativa: "O acompanhamento ajuda a acalmar a mente a tempo do jogo." } },
          { probabilidade: 0.25, impacto: { moral: -5, narrativa: "Mesmo com ajuda, a noite maldormida cobra seu preço no dia seguinte." } },
        ],
      },
      {
        id: "tentar_relaxar_sozinho",
        texto: "Tentar relaxar sozinho, sem ajuda externa",
        resultados: [
          { probabilidade: 0.4, impacto: { atributos: { frieza: 1 }, narrativa: "Você consegue descansar o suficiente por conta própria." } },
          { probabilidade: 0.6, impacto: { moral: -8, narrativa: "A noite maldormida pesa na atuação do dia seguinte." } },
        ],
      },
    ],
  },
  {
    id: "questao_alimentar_dieta",
    titulo: "Questão alimentar",
    descricao: "O nutricionista do clube propõe uma dieta rígida pra otimizar seu rendimento físico.",
    opcoes: [
      {
        id: "seguir_a_dieta_rigidamente",
        texto: "Seguir a dieta rigidamente",
        resultados: [
          { probabilidade: 0.6, impacto: { atributos: { resistencia: 3, forca_fisica: 2 }, narrativa: "O corpo responde bem à disciplina alimentar." } },
          { probabilidade: 0.4, impacto: { moral: -8, narrativa: "A rigidez da dieta pesa no bem-estar emocional." } },
        ],
      },
      {
        id: "seguir_com_flexibilidade",
        texto: "Seguir a dieta com alguma flexibilidade",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { resistencia: 1 }, moral: 3, narrativa: "O equilíbrio traz ganhos modestos, sem sacrifício extremo." } },
        ],
      },
    ],
  },
  {
    id: "psicologo_esportivo",
    titulo: "Convite pra acompanhamento psicológico",
    descricao: "O clube oferece acompanhamento com um psicólogo esportivo pra todo o elenco.",
    opcoes: [
      {
        id: "aceitar_o_acompanhamento",
        texto: "Aceitar o acompanhamento",
        resultados: [
          { probabilidade: 0.8, impacto: { atributos: { frieza: 3 }, moral: 8, narrativa: "O acompanhamento ajuda bastante a lidar com a pressão do dia a dia." } },
          { probabilidade: 0.2, impacto: { moral: -2, narrativa: "O processo é incômodo no início, mesmo trazendo benefícios a médio prazo." } },
        ],
      },
      {
        id: "recusar_o_acompanhamento",
        texto: "Recusar, preferindo lidar sozinho",
        resultados: [
          { probabilidade: 1, impacto: { moral: -2, narrativa: "Sem apoio extra, a pressão do dia a dia segue sendo administrada sozinho." } },
        ],
      },
    ],
  },
  {
    id: "lesao_recorrente_de_desgaste",
    titulo: "Lesão recorrente de desgaste",
    descricao: "Uma dor que já apareceu outras vezes na temporada volta a incomodar.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "investir_em_tratamento_preventivo",
        texto: "Investir num tratamento preventivo mais longo",
        resultados: [
          { probabilidade: 0.7, impacto: { atributos: { resistencia: 2 }, moral: 5, narrativa: "O tratamento preventivo resolve o problema de vez." } },
          { probabilidade: 0.3, impacto: { moral: -5, narrativa: "Mesmo com o tratamento, o incômodo volta a aparecer meses depois." } },
        ],
      },
      {
        id: "tratar_apenas_o_sintoma",
        texto: "Tratar apenas o sintoma pontual",
        resultados: [
          { probabilidade: 0.4, impacto: { narrativa: "O sintoma passa rápido, sem maiores consequências dessa vez." } },
          { probabilidade: 0.6, impacto: { atributos: { resistencia: -3 }, moral: -8, narrativa: "Sem resolver a causa, a dor volta ainda mais forte." } },
        ],
      },
    ],
  },
  {
    id: "nascimento_de_filho",
    titulo: "Nascimento de um filho",
    descricao: "Seu filho nasce bem no meio de uma sequência importante de jogos da temporada.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "tirar_dias_de_folga",
        texto: "Tirar alguns dias de folga pra ficar com a família",
        resultados: [
          { probabilidade: 1, impacto: { moral: 15, narrativa: "O tempo com a família recarrega suas energias de um jeito que só isso faz." } },
        ],
      },
      {
        id: "voltar_rapido_aos_treinos",
        texto: "Voltar rápido aos treinos",
        resultados: [
          { probabilidade: 0.5, impacto: { relacoesInternas: 5, narrativa: "O comprometimento é elogiado pela comissão técnica." } },
          { probabilidade: 0.5, impacto: { moral: -12, narrativa: "A volta apressada pesa emocionalmente mais do que você esperava." } },
        ],
      },
    ],
  },
  {
    id: "casamento",
    titulo: "Casamento na reta final da temporada",
    descricao: "Você planeja seu casamento justamente na reta final de uma temporada decisiva.",
    gatilho: { momentos: ["reta_final"] },
    opcoes: [
      {
        id: "manter_a_data_do_casamento",
        texto: "Manter a data do casamento como planejado",
        resultados: [
          { probabilidade: 0.7, impacto: { moral: 12, narrativa: "A celebração é um marco de felicidade que contagia seu momento na temporada." } },
          { probabilidade: 0.3, impacto: { moral: -5, narrativa: "A logística do evento acaba sendo mais desgastante do que o esperado." } },
        ],
      },
      {
        id: "adiar_o_casamento",
        texto: "Adiar o casamento pra depois da temporada",
        resultados: [
          { probabilidade: 1, impacto: { moral: -5, narrativa: "A decisão profissional pesa, mesmo sendo compreendida por todos." } },
        ],
      },
    ],
  },
  {
    id: "perda_na_familia",
    titulo: "Perda na família",
    descricao: "Uma perda familiar te atinge duramente bem no meio da temporada.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "afastar_se_temporariamente",
        texto: "Se afastar temporariamente dos jogos",
        resultados: [
          { probabilidade: 1, impacto: { moral: 5, narrativa: "O tempo necessário pra lidar com a dor é respeitado pelo clube." } },
        ],
      },
      {
        id: "jogar_para_se_distrair",
        texto: "Jogar mesmo assim, como forma de se distrair",
        resultados: [
          { probabilidade: 0.4, impacto: { moral: 8, narrativa: "O futebol vira um refúgio saudável nesse momento difícil." } },
          { probabilidade: 0.6, impacto: { moral: -15, narrativa: "A dor é maior do que o campo consegue aliviar, e o desempenho cai." } },
        ],
      },
    ],
  },
  {
    id: "amizade_antiga_pede_favor_financeiro",
    titulo: "Amigo antigo pede favor financeiro",
    descricao: "Um amigo de antes da carreira te procura pedindo ajuda financeira num momento difícil.",
    opcoes: [
      {
        id: "ajudar_o_amigo",
        texto: "Ajudar o amigo financeiramente",
        resultados: [
          { probabilidade: 0.6, impacto: { moral: 10, narrativa: "A ajuda fortalece uma amizade de longa data." } },
          { probabilidade: 0.4, impacto: { moral: -10, narrativa: "O dinheiro não resolve o problema e a relação fica constrangida." } },
        ],
      },
      {
        id: "recusar_educadamente",
        texto: "Recusar educadamente",
        resultados: [
          { probabilidade: 1, impacto: { moral: -3, narrativa: "A recusa protege suas finanças, mas deixa um gosto amargo." } },
        ],
      },
    ],
  },
  {
    id: "convocacao_torneio_continental",
    titulo: "Convocação pra torneio continental",
    descricao: "Você é convocado pela seleção pra um torneio continental de destaque.",
    gatilho: { reputacaoNacionalMinima: 40 },
    opcoes: [
      {
        id: "priorizar_o_torneio",
        texto: "Priorizar o torneio ao máximo",
        resultados: [
          { probabilidade: 0.55, impacto: { reputacao: 18, moral: 10, narrativa: "Uma boa campanha no torneio projeta seu nome internacionalmente." } },
          { probabilidade: 0.45, impacto: { atributos: { resistencia: -3 }, moral: -8, narrativa: "O desgaste físico do torneio cobra seu preço na sequência da temporada." } },
        ],
      },
      {
        id: "equilibrar_com_o_clube",
        texto: "Equilibrar bem entre seleção e clube",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 5, narrativa: "O equilíbrio evita desgaste, mesmo sem grandes destaques." } },
        ],
      },
    ],
  },
  {
    id: "disputa_de_vaga_lista_final",
    titulo: "Disputa pela vaga na lista final",
    descricao: "Você briga com outro jogador por uma vaga na lista final de convocados pra um grande torneio.",
    gatilho: { reputacaoNacionalMinima: 35 },
    opcoes: [
      {
        id: "treinar_no_limite",
        texto: "Treinar no limite pra garantir a vaga",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacao: 12, atributos: { resistencia: -2 }, narrativa: "O esforço extra garante a vaga, mas cobra um preço físico." } },
          { probabilidade: 0.5, impacto: { moral: -12, narrativa: "Mesmo com o esforço, a vaga vai pro outro jogador." } },
        ],
      },
      {
        id: "manter_o_ritmo_normal",
        texto: "Manter o ritmo normal de treinos",
        resultados: [
          { probabilidade: 1, impacto: { moral: -2, narrativa: "Sem esforço extra, o resultado da disputa fica por conta do que já vinha sendo feito." } },
        ],
      },
    ],
  },
  {
    id: "lesao_as_vesperas_de_torneio",
    titulo: "Lesão às vésperas de um grande torneio",
    descricao: "Um desconforto muscular aparece justamente às vésperas da estreia de um grande torneio.",
    gatilho: { reputacaoNacionalMinima: 35 },
    opcoes: [
      {
        id: "arriscar_jogar_mesmo_assim",
        texto: "Arriscar jogar mesmo assim",
        resultados: [
          { probabilidade: 0.4, impacto: { reputacao: 10, narrativa: "Você joga bem apesar do desconforto e o torneio sai sem sequelas." } },
          { probabilidade: 0.6, impacto: { atributos: { resistencia: -5 }, moral: -15, narrativa: "A lesão piora em pleno torneio e você desfalca a equipe nos jogos seguintes." } },
        ],
      },
      {
        id: "pedir_para_ficar_fora",
        texto: "Pedir pra ficar fora da estreia por precaução",
        resultados: [
          { probabilidade: 1, impacto: { moral: 3, narrativa: "A cautela preserva sua saúde pro restante do torneio." } },
        ],
      },
    ],
  },
  {
    id: "curso_de_formacao",
    titulo: "Curso de formação de treinadores",
    descricao: "O clube oferece a jogadores do elenco um curso introdutório de formação de treinadores.",
    gatilho: { idadeMinima: 26 },
    opcoes: [
      {
        id: "fazer_o_curso",
        texto: "Fazer o curso nas horas vagas",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { visao_de_jogo: 2 }, moral: 3, narrativa: "O curso amplia sua visão tática, mesmo sem afetar o presente imediato." } },
        ],
      },
      {
        id: "focar_so_no_futebol",
        texto: "Focar só no futebol por enquanto",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você mantém o foco total no dia a dia de jogador." } },
        ],
      },
    ],
  },
  {
    id: "faculdade_durante_a_carreira",
    titulo: "Faculdade em paralelo à carreira",
    descricao: "Você considera retomar os estudos, cursando faculdade em paralelo à rotina de jogador.",
    opcoes: [
      {
        id: "matricular_se_na_faculdade",
        texto: "Se matricular e encarar o desafio",
        resultados: [
          { probabilidade: 0.6, impacto: { moral: 8, narrativa: "Os estudos trazem um equilíbrio bem-vindo à rotina." } },
          { probabilidade: 0.4, impacto: { moral: -8, narrativa: "Conciliar faculdade e futebol se mostra mais cansativo do que o esperado." } },
        ],
      },
      {
        id: "deixar_para_depois",
        texto: "Deixar os estudos pra depois da carreira",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você posterga a decisão, focando 100% no futebol por enquanto." } },
        ],
      },
    ],
  },
  {
    id: "planejamento_financeiro_longo_prazo",
    titulo: "Planejamento financeiro de longo prazo",
    descricao: "Um consultor financeiro te procura sugerindo um planejamento pra depois da carreira de jogador.",
    opcoes: [
      {
        id: "contratar_o_planejamento",
        texto: "Contratar um planejamento financeiro sério",
        resultados: [
          { probabilidade: 1, impacto: { moral: 6, narrativa: "A segurança de um plano de longo prazo traz tranquilidade pro presente." } },
        ],
      },
      {
        id: "adiar_o_planejamento",
        texto: "Adiar essa decisão pra mais adiante",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você posterga o tema, sem consequência imediata." } },
        ],
      },
    ],
  },
  {
    id: "parceria_com_criador_de_conteudo",
    titulo: "Parceria com um criador de conteúdo",
    descricao: "Um criador de conteúdo popular propõe uma parceria de conteúdo com você.",
    opcoes: [
      {
        id: "topar_a_parceria",
        texto: "Topar a parceria de conteúdo",
        resultados: [
          { probabilidade: 0.65, impacto: { reputacao: 10, narrativa: "O conteúdo faz sucesso e amplia seu alcance com o público jovem." } },
          { probabilidade: 0.35, impacto: { reputacao: -5, narrativa: "O conteúdo é mal recebido e soa forçado pro seu perfil." } },
        ],
      },
      {
        id: "recusar_a_parceria",
        texto: "Recusar a parceria",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere manter sua imagem pública mais reservada." } },
        ],
      },
    ],
  },
  {
    id: "vazamento_de_conteudo_pessoal",
    titulo: "Vazamento de conteúdo pessoal",
    descricao: "Um conteúdo pessoal seu vaza indevidamente nas redes sociais.",
    opcoes: [
      {
        id: "se_pronunciar_publicamente",
        texto: "Se pronunciar publicamente sobre o vazamento",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacao: 5, moral: -5, narrativa: "O pronunciamento firme ajuda a controlar a narrativa, mas o desgaste emocional é real." } },
          { probabilidade: 0.5, impacto: { reputacao: -10, moral: -12, narrativa: "O pronunciamento só alimenta ainda mais o assunto." } },
        ],
      },
      {
        id: "ficar_em_silencio",
        texto: "Ficar em silêncio e deixar passar",
        resultados: [
          { probabilidade: 1, impacto: { moral: -8, narrativa: "O silêncio dói, mas evita alimentar ainda mais a repercussão." } },
        ],
      },
    ],
  },
  {
    id: "meme_viral_positivo",
    titulo: "Meme viral positivo",
    descricao: "Uma comemoração espontânea sua vira meme positivo e viraliza nas redes.",
    opcoes: [
      {
        id: "abracar_o_meme",
        texto: "Abraçar o meme e brincar com ele",
        resultados: [
          { probabilidade: 0.85, impacto: { reputacao: 12, moral: 5, narrativa: "A leveza com o próprio meme te aproxima ainda mais do público." } },
          { probabilidade: 0.15, impacto: { reputacao: -3, narrativa: "O meme já começa a se desgastar, e insistir soa forçado." } },
        ],
      },
      {
        id: "ignorar_o_meme",
        texto: "Ignorar o meme e seguir em frente",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "O meme circula sem sua participação direta." } },
        ],
      },
    ],
  },
  {
    id: "quase_expulsao",
    titulo: "Quase expulso em jogo tenso",
    descricao: "Numa partida de clima muito tenso, você chega perto de ser expulso após um lance polêmico.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "se_conter_no_limite",
        texto: "Se conter no limite e seguir jogando",
        resultados: [
          { probabilidade: 0.7, impacto: { atributos: { frieza: 3 }, narrativa: "O autocontrole no limite evita o pior e você segue em campo." } },
          { probabilidade: 0.3, impacto: { atributos: { frieza: -2 }, moral: -10, narrativa: "O árbitro decide expulsar você mesmo com a contenção." } },
        ],
      },
      {
        id: "pedir_substituicao_preventiva",
        texto: "Pedir pra sair antes de piorar",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 3, narrativa: "A saída preventiva é vista como madura pela comissão técnica." } },
        ],
      },
    ],
  },
  {
    id: "assumir_cobranca_de_falta_decisiva",
    titulo: "Cobrança de falta decisiva",
    descricao: "Falta na entrada da área, no fim de um jogo empatado — alguém precisa bater.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "bater_a_falta",
        texto: "Bater a falta você mesmo",
        resultados: [
          { probabilidade: 0.45, impacto: { atributos: { frieza: 3, finalizacao: 2 }, moral: 15, reputacaoRegional: 12, narrativa: "A bola encobre a barreira e entra — momento inesquecível." } },
          { probabilidade: 0.55, impacto: { moral: -8, narrativa: "A cobrança sai por cima do travessão, sem susto pro goleiro." } },
        ],
      },
      {
        id: "ceder_a_cobranca",
        texto: "Ceder a cobrança pro especialista do time",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 2, narrativa: "A decisão tática é respeitada por todos, seja qual for o resultado da falta." } },
        ],
      },
    ],
  },
  {
    id: "gol_contra",
    titulo: "Gol contra num momento crucial",
    descricao: "Um desvio infeliz seu resulta num gol contra em um momento crucial da partida.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "pedir_a_bola_de_novo_rapido",
        texto: "Pedir a bola de novo o mais rápido possível",
        resultados: [
          { probabilidade: 0.5, impacto: { atributos: { frieza: 2 }, moral: 5, narrativa: "A reação rápida vira redenção instantânea aos olhos da torcida." } },
          { probabilidade: 0.5, impacto: { moral: -15, narrativa: "O peso do erro te acompanha pelo resto da partida." } },
        ],
      },
      {
        id: "pedir_um_momento_para_se_recompor",
        texto: "Pedir um momento pra se recompor mentalmente",
        resultados: [
          { probabilidade: 1, impacto: { moral: -5, narrativa: "Você segue o jogo com a cabeça mais tranquila, mesmo abalado." } },
        ],
      },
    ],
  },
  {
    id: "comemoracao_polemica",
    titulo: "Comemoração polêmica de gol",
    descricao: "Depois de marcar um gol importante, você pensa numa comemoração que pode ser vista como provocação.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "fazer_a_comemoracao_provocativa",
        texto: "Fazer a comemoração provocativa mesmo assim",
        resultados: [
          { probabilidade: 0.45, impacto: { reputacaoRegional: 15, narrativa: "A torcida ama a ousadia e a comemoração vira ícone da rivalidade." } },
          { probabilidade: 0.55, impacto: { reputacao: -10, narrativa: "A comemoração rende punição da federação e crítica generalizada." } },
        ],
      },
      {
        id: "comemorar_de_forma_neutra",
        texto: "Comemorar de forma neutra",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 2, narrativa: "A comemoração discreta não gera nenhuma polêmica." } },
        ],
      },
    ],
  },
  {
    id: "discussao_com_colega_durante_o_jogo",
    titulo: "Discussão com colega em campo",
    descricao: "No calor do jogo, uma falha de entrosamento gera uma discussão acalorada com um companheiro em campo.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "resolver_ali_mesmo",
        texto: "Resolver ali mesmo, em campo",
        resultados: [
          { probabilidade: 0.6, impacto: { relacoesInternas: 5, narrativa: "A conversa rápida acalma os ânimos e o time volta a se entender em campo." } },
          { probabilidade: 0.4, impacto: { relacoesInternas: -10, moral: -5, narrativa: "A discussão piora e vira imagem repetida nas transmissões." } },
        ],
      },
      {
        id: "deixar_para_o_vestiario",
        texto: "Deixar a discussão pro vestiário",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 2, narrativa: "A postura profissional evita imagem ruim em campo." } },
        ],
      },
    ],
  },
  {
    id: "atraso_a_treino",
    titulo: "Atraso a um treino",
    descricao: "Um imprevisto pessoal te deixa atrasado pra um treino importante.",
    opcoes: [
      {
        id: "avisar_com_antecedencia",
        texto: "Avisar a comissão com antecedência sobre o atraso",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 2, narrativa: "A transparência evita maiores problemas." } },
        ],
      },
      {
        id: "chegar_sem_avisar",
        texto: "Chegar atrasado sem avisar antes",
        resultados: [
          { probabilidade: 0.4, impacto: { relacoesInternas: -5, narrativa: "O atraso passa quase despercebido, mas fica registrado." } },
          { probabilidade: 0.6, impacto: { relacoesInternas: -15, moral: -5, narrativa: "O atraso gera punição interna e um desgaste real com a comissão." } },
        ],
      },
    ],
  },
  {
    id: "festa_na_vespera_de_jogo_importante",
    titulo: "Convite pra festa na véspera de jogo importante",
    descricao: "Amigos te convidam pra uma festa bem na véspera de um jogo decisivo.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "ir_a_festa_com_moderacao",
        texto: "Ir à festa, mas com moderação",
        resultados: [
          { probabilidade: 0.5, impacto: { moral: 8, narrativa: "O momento de descontração ajuda a aliviar a pressão pro jogo." } },
          { probabilidade: 0.5, impacto: { atributos: { resistencia: -2 }, relacoesInternas: -8, narrativa: "Alguém vaza fotos da festa, e a comissão técnica não gosta nada disso." } },
        ],
      },
      {
        id: "recusar_o_convite",
        texto: "Recusar o convite e focar no jogo",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 3, narrativa: "O profissionalismo é notado pela comissão técnica." } },
        ],
      },
    ],
  },
  {
    id: "punicao_interna_do_elenco",
    titulo: "Punição interna do elenco",
    descricao: "O elenco estabelece uma nova regra de punições internas por atrasos e faltas de compromisso.",
    opcoes: [
      {
        id: "apoiar_a_nova_regra",
        texto: "Apoiar publicamente a nova regra",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 6, atributos: { lideranca: 2 }, narrativa: "O apoio à disciplina interna fortalece sua imagem de liderança." } },
        ],
      },
      {
        id: "questionar_a_regra",
        texto: "Questionar a necessidade da regra",
        resultados: [
          { probabilidade: 0.4, impacto: { relacoesInternas: 2, narrativa: "O questionamento leva a ajustes que deixam a regra mais justa." } },
          { probabilidade: 0.6, impacto: { relacoesInternas: -8, narrativa: "O grupo interpreta o questionamento como resistência à disciplina." } },
        ],
      },
    ],
  },
  {
    id: "jogo_amistoso_de_pretemporada_no_exterior",
    titulo: "Amistoso de pré-temporada no exterior",
    descricao: "O clube viaja pro exterior pra uma série de amistosos de pré-temporada.",
    gatilho: { momentos: ["pre_temporada"] },
    opcoes: [
      {
        id: "aproveitar_para_se_destacar",
        texto: "Aproveitar a vitrine pra se destacar",
        resultados: [
          { probabilidade: 0.6, impacto: { reputacao: 8, narrativa: "Boas atuações nos amistosos chamam atenção internacional." } },
          { probabilidade: 0.4, impacto: { atributos: { resistencia: -2 }, narrativa: "A intensidade extra na pré-temporada cobra um preço físico." } },
        ],
      },
      {
        id: "usar_como_preparacao",
        texto: "Usar os jogos só como preparação física",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { resistencia: 2 }, narrativa: "A preparação física rende ganhos sólidos pro início da temporada." } },
        ],
      },
    ],
  },
  {
    id: "reencontro_com_ex_clube",
    titulo: "Reencontro com o ex-clube",
    descricao: "Você enfrenta pela primeira vez o clube que te formou como profissional.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "comemorar_gol_com_respeito",
        texto: "Se marcar, comemorar com respeito ao ex-clube",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 8, narrativa: "O gesto de respeito é elogiado pelas duas torcidas." } },
        ],
      },
      {
        id: "jogar_normalmente_sem_gestos_especiais",
        texto: "Jogar normalmente, sem gestos especiais",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "O reencontro passa sem grandes storylines emocionais." } },
        ],
      },
    ],
  },
  {
    id: "jornalista_pede_furo_exclusivo",
    titulo: "Jornalista pede um furo exclusivo",
    descricao: "Um jornalista de confiança pede que você conceda um furo de reportagem exclusivo.",
    gatilho: { reputacaoNacionalMinima: 30 },
    opcoes: [
      {
        id: "conceder_o_furo",
        texto: "Conceder o furo exclusivo",
        resultados: [
          { probabilidade: 0.6, impacto: { reputacao: 10, narrativa: "A exclusividade rende boa repercussão e fortalece uma parceria de confiança." } },
          { probabilidade: 0.4, impacto: { relacoesInternas: -5, narrativa: "Outros veículos reclamam de favorecimento, e isso gera desconforto." } },
        ],
      },
      {
        id: "recusar_o_furo",
        texto: "Recusar, tratando todos os veículos igualmente",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "A postura imparcial evita qualquer tipo de atrito com a imprensa." } },
        ],
      },
    ],
  },
  {
    id: "bastidor_de_reality_show",
    titulo: "Convite pra um reality show esportivo",
    descricao: "Uma emissora convida você pra participar de um reality show sobre bastidores do futebol.",
    gatilho: { reputacaoNacionalMinima: 40 },
    opcoes: [
      {
        id: "participar_do_reality",
        texto: "Participar do reality show",
        resultados: [
          { probabilidade: 0.45, impacto: { reputacao: 15, narrativa: "A exposição rende uma legião nova de fãs." } },
          { probabilidade: 0.55, impacto: { reputacao: -8, relacoesInternas: -5, narrativa: "Momentos editados fora de contexto geram desconforto no elenco." } },
        ],
      },
      {
        id: "recusar_o_reality",
        texto: "Recusar o convite",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere manter o foco fora dos holofotes de entretenimento." } },
        ],
      },
    ],
  },
  {
    id: "patrocinador_pede_mudanca_de_visual",
    titulo: "Patrocinador sugere mudança de visual",
    descricao: "Um patrocinador pessoal sugere uma mudança de visual pra combinar com a nova campanha publicitária.",
    opcoes: [
      {
        id: "aceitar_a_mudanca",
        texto: "Aceitar a mudança de visual",
        resultados: [
          { probabilidade: 0.6, impacto: { reputacao: 6, narrativa: "O novo visual rende boa repercussão na campanha." } },
          { probabilidade: 0.4, impacto: { reputacao: -4, narrativa: "O visual não agrada o público, e vira motivo de piada." } },
        ],
      },
      {
        id: "manter_o_visual_atual",
        texto: "Manter seu visual atual",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "O patrocinador aceita, ainda que um pouco decepcionado." } },
        ],
      },
    ],
  },
  {
    id: "torcida_pede_desculpas_por_ofensa",
    titulo: "Torcida pede desculpas por ofensa",
    descricao: "Depois de um episódio de ofensas de uma parcela da torcida, um grupo organizado vem pedir desculpas.",
    opcoes: [
      {
        id: "aceitar_as_desculpas",
        texto: "Aceitar as desculpas publicamente",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 10, moral: 5, narrativa: "O gesto de reconciliação fortalece a relação com a torcida." } },
        ],
      },
      {
        id: "manter_distancia",
        texto: "Manter uma certa distância, ainda magoado",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: -3, narrativa: "A distância é entendida, mas deixa uma lacuna na relação." } },
        ],
      },
    ],
  },
  {
    id: "presidente_do_clube_pede_conselho",
    titulo: "Presidente do clube pede conselho",
    descricao: "O presidente do clube te procura em busca de conselhos sobre uma decisão importante da diretoria.",
    gatilho: { relacoesInternasMinima: 55 },
    opcoes: [
      {
        id: "dar_sua_opiniao_sincera",
        texto: "Dar sua opinião sincera",
        resultados: [
          { probabilidade: 0.6, impacto: { relacoesInternas: 10, narrativa: "A sinceridade é valorizada e fortalece sua influência interna." } },
          { probabilidade: 0.4, impacto: { relacoesInternas: -8, narrativa: "A opinião sincera desagrada o presidente, que esperava outra resposta." } },
        ],
      },
      {
        id: "evitar_se_envolver",
        texto: "Evitar se envolver em decisões de diretoria",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere manter distância de assuntos fora do campo." } },
        ],
      },
    ],
  },
  {
    id: "novo_camisa_10_do_time",
    titulo: "A camisa 10 fica disponível",
    descricao: "O camisa 10 histórico do time deixa o clube, e a numeração fica disponível.",
    opcoes: [
      {
        id: "pedir_a_camisa_10",
        texto: "Pedir pra usar a camisa 10",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacaoRegional: 15, moral: 8, narrativa: "Vestir a 10 é um baita orgulho e a torcida aprova a escolha." } },
          { probabilidade: 0.5, impacto: { reputacaoRegional: -10, moral: -10, narrativa: "A comparação com o antigo ídolo pesa demais e vira cobrança extra." } },
        ],
      },
      {
        id: "manter_o_numero_atual",
        texto: "Manter seu número atual",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere não carregar o peso simbólico da numeração." } },
        ],
      },
    ],
  },
  {
    id: "proposta_de_virar_garoto_propaganda",
    titulo: "Proposta pra virar garoto-propaganda",
    descricao: "Uma grande marca de consumo propõe que você seja o rosto principal de uma campanha nacional.",
    gatilho: { reputacaoNacionalMinima: 50 },
    opcoes: [
      {
        id: "aceitar_ser_o_rosto_da_marca",
        texto: "Aceitar ser o rosto da marca",
        resultados: [
          { probabilidade: 0.65, impacto: { reputacao: 18, narrativa: "A campanha estoura e projeta seu nome muito além do futebol." } },
          { probabilidade: 0.35, impacto: { reputacao: -8, moral: -5, narrativa: "A superexposição vira alvo de piadas e desgasta sua imagem." } },
        ],
      },
      {
        id: "participar_de_forma_discreta",
        texto: "Participar de forma mais discreta da campanha",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 6, narrativa: "A participação discreta é segura e sem sobressaltos." } },
        ],
      },
    ],
  },
  {
    id: "rumor_de_favorecimento_na_escalacao",
    titulo: "Rumor de favorecimento na escalação",
    descricao: "Boatos internos sugerem que você é escalado por favorecimento, não por mérito esportivo.",
    opcoes: [
      {
        id: "responder_com_desempenho",
        texto: "Responder aos rumores só com desempenho em campo",
        resultados: [
          { probabilidade: 0.65, impacto: { relacoesInternas: 8, reputacao: 5, narrativa: "As atuações consistentes calam qualquer boato." } },
          { probabilidade: 0.35, impacto: { relacoesInternas: -5, narrativa: "Mesmo jogando bem, os rumores persistem entre parte do grupo." } },
        ],
      },
      {
        id: "confrontar_o_boato_diretamente",
        texto: "Confrontar o boato diretamente com quem espalha",
        resultados: [
          { probabilidade: 0.5, impacto: { relacoesInternas: 5, narrativa: "O confronto direto esclarece a situação de vez." } },
          { probabilidade: 0.5, impacto: { relacoesInternas: -12, narrativa: "O confronto piora o clima interno em vez de resolver." } },
        ],
      },
    ],
  },
  {
    id: "colega_pede_para_cobrir_ausencia",
    titulo: "Colega pede pra cobrir uma ausência",
    descricao: "Um companheiro de elenco pede que você cubra uma ausência dele perante a comissão técnica.",
    opcoes: [
      {
        id: "cobrir_o_colega",
        texto: "Cobrir a ausência do colega",
        resultados: [
          { probabilidade: 0.5, impacto: { relacoesInternas: 8, narrativa: "O favor fortalece a amizade, e ninguém descobre nada." } },
          { probabilidade: 0.5, impacto: { relacoesInternas: -15, moral: -8, narrativa: "A mentira é descoberta e você também é responsabilizado." } },
        ],
      },
      {
        id: "recusar_encobrir",
        texto: "Recusar encobrir a situação",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: -3, narrativa: "O colega fica chateado, mas você mantém sua integridade com a comissão." } },
        ],
      },
    ],
  },
  {
    id: "treino_em_alta_altitude",
    titulo: "Treino em alta altitude",
    descricao: "O clube organiza uma pré-temporada de treinos em alta altitude, visando ganho de resistência.",
    gatilho: { momentos: ["pre_temporada"] },
    opcoes: [
      {
        id: "encarar_o_treino_intenso",
        texto: "Encarar o treino intenso de altitude",
        resultados: [
          { probabilidade: 0.6, impacto: { atributos: { resistencia: 4 }, narrativa: "O corpo se adapta bem e o ganho de resistência é notável." } },
          { probabilidade: 0.4, impacto: { moral: -8, narrativa: "A altitude castiga mais do que o esperado, e o corpo demora a se adaptar." } },
        ],
      },
      {
        id: "pedir_adaptacao_progressiva",
        texto: "Pedir uma adaptação mais progressiva",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { resistencia: 1 }, narrativa: "O ganho é mais discreto, mas sem sobrecarga." } },
        ],
      },
    ],
  },
  {
    id: "mudanca_de_regime_de_treino_fisico",
    titulo: "Mudança de regime de treino físico",
    descricao: "A comissão técnica decide mudar o regime de treinos físicos de toda a temporada.",
    gatilho: { momentos: ["pre_temporada"] },
    opcoes: [
      {
        id: "abracar_o_novo_regime",
        texto: "Abraçar o novo regime de treinos",
        resultados: [
          { probabilidade: 0.55, impacto: { atributos: { forca_fisica: 3 }, narrativa: "O novo regime traz ganhos físicos visíveis ao longo dos meses." } },
          { probabilidade: 0.45, impacto: { atributos: { resistencia: -2 }, moral: -5, narrativa: "O corpo reage mal à intensidade do novo regime." } },
        ],
      },
      {
        id: "seguir_o_regime_anterior_em_paralelo",
        texto: "Seguir parte do regime anterior em paralelo",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você tenta equilibrar o novo com o antigo, sem grandes mudanças." } },
        ],
      },
    ],
  },
  {
    id: "entrevista_ao_vivo_no_intervalo",
    titulo: "Entrevista ao vivo no intervalo",
    descricao: "Você é chamado pra uma entrevista ao vivo bem no intervalo de um jogo apertado.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "falar_com_intensidade",
        texto: "Falar com intensidade sobre o momento do time",
        resultados: [
          { probabilidade: 0.55, impacto: { reputacaoRegional: 10, narrativa: "A intensidade da fala contagia a torcida no segundo tempo." } },
          { probabilidade: 0.45, impacto: { reputacaoRegional: -6, narrativa: "A fala soa arrogante fora de contexto e rende críticas." } },
        ],
      },
      {
        id: "falar_de_forma_serena",
        texto: "Falar de forma serena e ponderada",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 3, narrativa: "A serenidade transmite confiança sem grandes riscos." } },
        ],
      },
    ],
  },
  {
    id: "torcida_rival_invade_hotel_da_delegacao",
    titulo: "Torcida rival cerca o hotel da delegação",
    descricao: "Em viagem, torcedores do time rival cercam o hotel da delegação na véspera do jogo.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "manter_a_rotina_normal",
        texto: "Manter a rotina normal da delegação",
        resultados: [
          { probabilidade: 0.7, impacto: { atributos: { frieza: 2 }, narrativa: "A tranquilidade do grupo neutraliza a tentativa de intimidação." } },
          { probabilidade: 0.3, impacto: { moral: -10, narrativa: "O clima tenso da noite afeta o sono e a concentração da equipe." } },
        ],
      },
      {
        id: "pedir_reforco_de_seguranca",
        texto: "Pedir reforço de segurança ao clube",
        resultados: [
          { probabilidade: 1, impacto: { moral: 3, narrativa: "O reforço de segurança traz mais tranquilidade pra delegação." } },
        ],
      },
    ],
  },
  {
    id: "suspeita_de_dopping",
    titulo: "Suspeita de exame antidoping",
    descricao: "Um suplemento novo, receitado pelo departamento médico, levanta dúvidas sobre possível contaminação antes de um exame antidoping.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "suspender_o_suplemento_por_seguranca",
        texto: "Suspender o suplemento por segurança",
        resultados: [
          { probabilidade: 1, impacto: { moral: 3, relacoesInternas: 3, narrativa: "A cautela evita qualquer risco de complicação futura." } },
        ],
      },
      {
        id: "manter_o_suplemento",
        texto: "Manter o suplemento, confiando na prescrição médica",
        resultados: [
          { probabilidade: 0.8, impacto: { atributos: { resistencia: 2 }, narrativa: "Não há problema algum, e o suplemento ajuda no rendimento." } },
          { probabilidade: 0.2, impacto: { reputacao: -20, moral: -20, narrativa: "O exame acusa uma substância irregular, gerando uma crise de imagem grave." } },
        ],
      },
    ],
  },
  {
    id: "convite_para_ser_padrinho_de_evento_social",
    titulo: "Convite pra ser padrinho de evento social",
    descricao: "Uma ONG te convida pra ser padrinho de um evento de arrecadação pra crianças carentes.",
    gatilho: { reputacaoRegionalMinima: 20 },
    opcoes: [
      {
        id: "aceitar_ser_padrinho",
        texto: "Aceitar ser padrinho do evento",
        resultados: [
          { probabilidade: 0.9, impacto: { reputacaoRegional: 15, reputacao: 5, moral: 5, narrativa: "O evento arrecada muito mais do que o esperado, e sua imagem sai fortalecida." } },
          { probabilidade: 0.1, impacto: { moral: -3, narrativa: "Problemas de organização do evento acabam manchando um pouco o resultado." } },
        ],
      },
      {
        id: "recusar_por_agenda_apertada",
        texto: "Recusar por agenda apertada",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: -3, narrativa: "A ONG entende, mas perde-se uma boa chance de repercussão positiva." } },
        ],
      },
    ],
  },
  {
    id: "reducao_de_minutos_em_campo",
    titulo: "Redução de minutos em campo",
    descricao: "O técnico começa a reduzir gradualmente seus minutos em campo, sem uma explicação direta.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "conversar_sobre_o_planejamento",
        texto: "Conversar sobre o planejamento de minutagem",
        resultados: [
          { probabilidade: 0.6, impacto: { relacoesInternas: 8, narrativa: "A conversa esclarece que é uma gestão de desgaste físico, não perda de espaço." } },
          { probabilidade: 0.4, impacto: { moral: -8, narrativa: "A resposta vaga do técnico só aumenta a insegurança sobre seu futuro no time." } },
        ],
      },
      {
        id: "aceitar_sem_questionar",
        texto: "Aceitar sem questionar",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 3, narrativa: "A postura tranquila é bem vista, mesmo com a dúvida latente." } },
        ],
      },
    ],
  },
  {
    id: "mudanca_de_posicao_tatica",
    titulo: "Mudança permanente de posição tática",
    descricao: "O técnico sugere uma mudança permanente pra uma nova posição no campo, argumentando ganho tático.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "topar_a_nova_posicao",
        texto: "Topar a mudança permanente",
        resultados: [
          { probabilidade: 0.5, impacto: { atributos: { movimentacao: 3, visao_de_jogo: 2 }, moral: 8, narrativa: "A nova posição revela uma faceta do seu jogo que nem você conhecia." } },
          { probabilidade: 0.5, impacto: { moral: -10, narrativa: "A adaptação é difícil, e você sente falta da posição original." } },
        ],
      },
      {
        id: "resistir_a_mudanca",
        texto: "Resistir e defender sua posição original",
        resultados: [
          { probabilidade: 0.5, impacto: { relacoesInternas: -5, narrativa: "O técnico respeita, mas anota a resistência à mudança." } },
          { probabilidade: 0.5, impacto: { relacoesInternas: -12, narrativa: "A resistência é vista como falta de versatilidade." } },
        ],
      },
    ],
  },
  {
    id: "rivalidade_interna_por_titularidade",
    titulo: "Rivalidade interna por titularidade",
    descricao: "Uma rivalidade silenciosa cresce dentro do elenco entre você e outro jogador pela mesma vaga.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "transformar_em_competicao_saudavel",
        texto: "Transformar a rivalidade numa competição saudável",
        resultados: [
          { probabilidade: 0.7, impacto: { relacoesInternas: 8, atributos: { frieza: 2 }, narrativa: "A rivalidade saudável eleva o nível dos dois." } },
          { probabilidade: 0.3, impacto: { relacoesInternas: -5, narrativa: "Apesar da boa intenção, o clima segue tenso nos bastidores." } },
        ],
      },
      {
        id: "deixar_a_rivalidade_crescer",
        texto: "Deixar a rivalidade crescer sem intervir",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: -8, narrativa: "A rivalidade não tratada acaba afetando o ambiente do grupo." } },
        ],
      },
    ],
  },
  {
    id: "proposta_de_ser_capitao_da_selecao",
    titulo: "Proposta de ser capitão da seleção",
    descricao: "O técnico da seleção sugere seu nome pra capitanear o time nacional num torneio importante.",
    gatilho: { reputacaoNacionalMinima: 60 },
    opcoes: [
      {
        id: "aceitar_a_capitania_da_selecao",
        texto: "Aceitar a capitania da seleção",
        resultados: [
          { probabilidade: 0.55, impacto: { atributos: { lideranca: 4 }, reputacao: 20, narrativa: "A braçadeira nacional consagra seu nome na história do time." } },
          { probabilidade: 0.45, impacto: { reputacao: -10, moral: -10, narrativa: "A pressão da braçadeira nacional pesa mais do que o esperado." } },
        ],
      },
      {
        id: "sugerir_outro_capitao",
        texto: "Sugerir que outro jogador mais experiente seja capitão",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 5, narrativa: "O gesto de humildade é respeitado por todo o grupo da seleção." } },
        ],
      },
    ],
  },
  {
    id: "entrevista_sobre_racismo_no_futebol",
    titulo: "Entrevista sobre racismo no futebol",
    descricao: "Um veículo de imprensa te convida pra uma entrevista sobre racismo no futebol, tema sensível e importante.",
    gatilho: { reputacaoNacionalMinima: 30 },
    opcoes: [
      {
        id: "falar_abertamente_sobre_o_tema",
        texto: "Falar abertamente sobre o tema",
        resultados: [
          { probabilidade: 0.75, impacto: { reputacao: 15, narrativa: "A fala corajosa e bem construída gera um debate importante e te fortalece como voz relevante." } },
          { probabilidade: 0.25, impacto: { reputacao: -5, narrativa: "Uma frase mal formulada é tirada de contexto e vira polêmica." } },
        ],
      },
      {
        id: "falar_de_forma_mais_cautelosa",
        texto: "Falar de forma mais cautelosa, sem se aprofundar",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 2, narrativa: "A resposta cautelosa evita riscos, mas perde força de impacto." } },
        ],
      },
    ],
  },
  {
    id: "gesto_de_fair_play",
    titulo: "Oportunidade de um gesto de fair play",
    descricao: "Num lance de jogo, você percebe que poderia se aproveitar de um erro do árbitro em seu favor.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "avisar_o_arbitro_do_erro",
        texto: "Avisar o árbitro sobre o próprio erro",
        resultados: [
          { probabilidade: 0.85, impacto: { reputacao: 15, narrativa: "O gesto de fair play repercute muito bem e vira referência de esportividade." } },
          { probabilidade: 0.15, impacto: { relacoesInternas: -5, narrativa: "Parte do próprio elenco não gosta de abrir mão de uma vantagem." } },
        ],
      },
      {
        id: "aceitar_a_vantagem",
        texto: "Aceitar a vantagem gerada pelo erro",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: -3, narrativa: "A vantagem ajuda no resultado, mas incomoda quem valoriza o espírito esportivo." } },
        ],
      },
    ],
  },
  {
    id: "campanha_publicitaria_polemica",
    titulo: "Campanha publicitária polêmica",
    descricao: "Uma marca propõe uma campanha publicitária de tom mais ousado, que pode dividir opiniões.",
    gatilho: { reputacaoNacionalMinima: 40 },
    opcoes: [
      {
        id: "topar_a_campanha_ousada",
        texto: "Topar a campanha, mesmo sabendo do risco",
        resultados: [
          { probabilidade: 0.45, impacto: { reputacao: 15, narrativa: "A ousadia paga e a campanha vira referência de marketing esportivo." } },
          { probabilidade: 0.55, impacto: { reputacao: -12, narrativa: "A campanha gera bastante crítica e desgasta sua imagem pública." } },
        ],
      },
      {
        id: "pedir_um_tom_mais_neutro",
        texto: "Pedir um tom mais neutro pra campanha",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 4, narrativa: "A campanha sai mais morna, mas sem sobressaltos." } },
        ],
      },
    ],
  },
  {
    id: "acusacao_injusta_da_imprensa",
    titulo: "Acusação injusta da imprensa",
    descricao: "Um veículo de imprensa publica uma acusação injusta e sem provas contra você.",
    opcoes: [
      {
        id: "processar_o_veiculo",
        texto: "Processar o veículo de imprensa",
        resultados: [
          { probabilidade: 0.6, impacto: { reputacao: 10, narrativa: "A ação judicial força uma retratação pública que restaura sua imagem." } },
          { probabilidade: 0.4, impacto: { moral: -8, narrativa: "O processo se arrasta, e a repercussão negativa demora a esfriar." } },
        ],
      },
      {
        id: "responder_apenas_em_campo",
        texto: "Responder apenas com desempenho em campo",
        resultados: [
          { probabilidade: 1, impacto: { moral: -3, reputacao: 3, narrativa: "O silêncio combinado com bom futebol acaba desmentindo a acusação com o tempo." } },
        ],
      },
    ],
  },
  {
    id: "reencontro_com_mentor_de_base",
    titulo: "Reencontro com o mentor da base",
    descricao: "Um antigo treinador da base, que acreditou em você quando ninguém mais acreditava, aparece num jogo.",
    opcoes: [
      {
        id: "dedicar_um_momento_a_ele",
        texto: "Dedicar um momento especial a ele depois do jogo",
        resultados: [
          { probabilidade: 1, impacto: { moral: 10, reputacaoRegional: 5, narrativa: "O gesto de gratidão emociona a todos que acompanham a história." } },
        ],
      },
      {
        id: "cumprimentar_rapidamente",
        texto: "Cumprimentá-lo rapidamente, sem alarde",
        resultados: [
          { probabilidade: 1, impacto: { moral: 3, narrativa: "Um reencontro simples, mas sincero." } },
        ],
      },
    ],
  },
  {
    id: "pedido_de_transferencia_de_um_amigo_no_elenco",
    titulo: "Amigo do elenco pede conselho sobre sair",
    descricao: "Um grande amigo dentro do elenco te pede conselho sobre aceitar uma proposta de outro clube.",
    gatilho: { momentos: ["pre_temporada"] },
    opcoes: [
      {
        id: "incentivar_a_saida",
        texto: "Incentivar o amigo a aceitar a proposta",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 5, moral: -3, narrativa: "O amigo agradece o conselho sincero, mesmo que doa a possível despedida." } },
        ],
      },
      {
        id: "pedir_para_ele_ficar",
        texto: "Pedir pra ele ficar, priorizando a amizade",
        resultados: [
          { probabilidade: 0.5, impacto: { relacoesInternas: 8, narrativa: "O amigo decide ficar, e a dupla segue fazendo história junto." } },
          { probabilidade: 0.5, impacto: { relacoesInternas: -5, narrativa: "O amigo sai mesmo assim, e um certo ressentimento fica no ar." } },
        ],
      },
    ],
  },
  {
    id: "crise_de_ansiedade_pre_jogo",
    titulo: "Crise de ansiedade antes de um jogo",
    descricao: "Momentos antes de entrar em campo, uma crise de ansiedade forte te pega de surpresa.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "buscar_o_psicologo_do_clube",
        texto: "Buscar o psicólogo do clube imediatamente",
        resultados: [
          { probabilidade: 0.8, impacto: { atributos: { frieza: 2 }, moral: 5, narrativa: "O apoio imediato ajuda a controlar a crise a tempo do jogo." } },
          { probabilidade: 0.2, impacto: { moral: -10, narrativa: "Mesmo com ajuda, a ansiedade afeta bastante sua atuação nesse jogo." } },
        ],
      },
      {
        id: "tentar_respirar_e_entrar_em_campo",
        texto: "Tentar controlar sozinho e entrar em campo",
        resultados: [
          { probabilidade: 0.4, impacto: { atributos: { frieza: 1 }, narrativa: "Você consegue se acalmar sozinho a tempo." } },
          { probabilidade: 0.6, impacto: { moral: -12, narrativa: "A crise não controlada compromete bastante sua atuação." } },
        ],
      },
    ],
  },
  {
    id: "lesao_de_um_titular_abre_espaco",
    titulo: "Lesão de um titular abre espaço",
    descricao: "A lesão de um jogador titular abre uma vaga inesperada na equipe.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "abraçar_a_oportunidade",
        texto: "Abraçar a oportunidade com intensidade total",
        resultados: [
          { probabilidade: 0.6, impacto: { reputacao: 12, moral: 10, narrativa: "Você aproveita bem a chance e conquista espaço definitivo no time." } },
          { probabilidade: 0.4, impacto: { moral: -8, narrativa: "A pressão da oportunidade pesa e o rendimento fica abaixo do esperado." } },
        ],
      },
      {
        id: "jogar_com_naturalidade_na_oportunidade",
        texto: "Jogar com naturalidade, sem pressão extra",
        resultados: [
          { probabilidade: 1, impacto: { moral: 3, narrativa: "A tranquilidade ajuda a aproveitar bem o novo espaço, com o tempo." } },
        ],
      },
    ],
  },
  {
    id: "comissao_tecnica_pede_feedback_do_elenco",
    titulo: "Comissão técnica pede feedback do elenco",
    descricao: "A comissão técnica reúne o elenco pra ouvir feedback sincero sobre os métodos de trabalho.",
    opcoes: [
      {
        id: "dar_feedback_sincero",
        texto: "Dar um feedback sincero, incluindo críticas",
        resultados: [
          { probabilidade: 0.6, impacto: { relacoesInternas: 8, narrativa: "A sinceridade é bem recebida e gera mudanças positivas nos métodos." } },
          { probabilidade: 0.4, impacto: { relacoesInternas: -8, narrativa: "As críticas não são bem recebidas por parte da comissão." } },
        ],
      },
      {
        id: "elogiar_sem_criticas",
        texto: "Dar um feedback só de elogios, sem críticas",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 3, narrativa: "O feedback positivo é bem recebido, mas não muda nada na prática." } },
        ],
      },
    ],
  },
  {
    id: "torcida_faz_ato_de_protesto",
    titulo: "Torcida organiza ato de protesto",
    descricao: "Depois de resultados ruins, a torcida organiza um ato de protesto no entorno do centro de treinamento.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "sair_para_dialogar",
        texto: "Sair pra dialogar diretamente com os manifestantes",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacaoRegional: 12, narrativa: "O diálogo direto acalma os ânimos e mostra comprometimento." } },
          { probabilidade: 0.5, impacto: { reputacaoRegional: -10, moral: -10, narrativa: "O diálogo esquenta ainda mais os ânimos do protesto." } },
        ],
      },
      {
        id: "permanecer_dentro_do_ct",
        texto: "Permanecer dentro do CT, sem confronto direto",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: -6, narrativa: "A ausência de diálogo é vista como distanciamento do elenco." } },
        ],
      },
    ],
  },
  {
    id: "jogo_com_portoes_fechados",
    titulo: "Jogo com portões fechados",
    descricao: "Por punição disciplinar, um jogo importante acontece com portões fechados, sem torcida no estádio.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "criar_motivacao_extra_no_vestiario",
        texto: "Criar uma motivação extra dentro do vestiário",
        resultados: [
          { probabilidade: 0.55, impacto: { atributos: { lideranca: 2 }, relacoesInternas: 6, narrativa: "A motivação interna supre bem a ausência da torcida." } },
          { probabilidade: 0.45, impacto: { moral: -5, narrativa: "O silêncio do estádio vazio pesa mais do que o esperado no ambiente do jogo." } },
        ],
      },
      {
        id: "tratar_como_jogo_normal",
        texto: "Tratar como um jogo normal",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "O jogo segue seu curso normal, apesar do clima atípico." } },
        ],
      },
    ],
  },
  {
    id: "viagem_longa_e_cansativa",
    titulo: "Viagem longa e cansativa",
    descricao: "Uma viagem excepcionalmente longa e desgastante antecede um jogo fora de casa.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "priorizar_o_descanso_na_viagem",
        texto: "Priorizar o descanso durante toda a viagem",
        resultados: [
          { probabilidade: 0.7, impacto: { atributos: { resistencia: 2 }, narrativa: "O cuidado com o descanso ajuda a chegar em melhores condições pro jogo." } },
          { probabilidade: 0.3, impacto: { narrativa: "Mesmo com cuidado, o desgaste da viagem se faz sentir." } },
        ],
      },
      {
        id: "aproveitar_para_estudar_o_adversario",
        texto: "Aproveitar a viagem pra estudar o adversário",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { visao_de_jogo: 2 }, narrativa: "O estudo extra do adversário ajuda taticamente, mesmo com o cansaço da viagem." } },
        ],
      },
    ],
  },
  {
    id: "pedido_de_ajuda_de_ex_companheiro_em_dificuldade",
    titulo: "Ex-companheiro em dificuldade pede ajuda",
    descricao: "Um ex-companheiro de time, hoje sem clube e passando dificuldades, pede sua ajuda.",
    opcoes: [
      {
        id: "ajudar_e_indicar_ao_clube",
        texto: "Ajudar e tentar indicá-lo ao seu clube",
        resultados: [
          { probabilidade: 0.5, impacto: { moral: 10, relacoesInternas: 5, narrativa: "A indicação dá certo, e o ex-companheiro consegue uma nova chance." } },
          { probabilidade: 0.5, impacto: { moral: -3, narrativa: "A indicação não dá certo, mas o gesto de tentar já é valorizado." } },
        ],
      },
      {
        id: "ajudar_apenas_financeiramente",
        texto: "Ajudar apenas de forma financeira, discretamente",
        resultados: [
          { probabilidade: 1, impacto: { moral: 5, narrativa: "A ajuda discreta faz diferença real na vida do ex-companheiro." } },
        ],
      },
    ],
  },
  {
    id: "proposta_de_embaixador_do_clube",
    titulo: "Proposta de ser embaixador do clube",
    descricao: "O clube propõe que você seja embaixador institucional, representando a marca em eventos oficiais.",
    gatilho: { reputacaoRegionalMinima: 30 },
    opcoes: [
      {
        id: "aceitar_ser_embaixador",
        texto: "Aceitar o papel de embaixador",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 8, reputacaoRegional: 8, narrativa: "O papel institucional fortalece sua ligação histórica com o clube." } },
        ],
      },
      {
        id: "recusar_o_papel_institucional",
        texto: "Recusar, preferindo focar só no campo",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere manter o foco exclusivo em ser jogador." } },
        ],
      },
    ],
  },
  {
    id: "mudanca_de_alojamento_da_delegacao",
    titulo: "Mudança de alojamento da delegação",
    descricao: "Por questões de segurança, a delegação muda de hotel na véspera de um jogo importante.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "manter_a_rotina_apesar_da_mudanca",
        texto: "Manter a rotina de preparação apesar da mudança",
        resultados: [
          { probabilidade: 0.7, impacto: { atributos: { frieza: 2 }, narrativa: "A adaptação rápida evita qualquer prejuízo na preparação." } },
          { probabilidade: 0.3, impacto: { moral: -5, narrativa: "A mudança de última hora bagunça um pouco a rotina de preparação." } },
        ],
      },
      {
        id: "reclamar_da_organizacao",
        texto: "Reclamar da falta de organização com a diretoria",
        resultados: [
          { probabilidade: 0.5, impacto: { relacoesInternas: -3, narrativa: "A reclamação é ouvida, mas incomoda quem organizou a mudança." } },
          { probabilidade: 0.5, impacto: { relacoesInternas: -10, narrativa: "A reclamação é vista como falta de profissionalismo diante do imprevisto." } },
        ],
      },
    ],
  },
  {
    id: "crianca_hospitalizada_pede_visita",
    titulo: "Criança hospitalizada pede uma visita",
    descricao: "Uma criança internada, fã declarada sua, pede uma visita através das redes sociais da família.",
    gatilho: { reputacaoRegionalMinima: 20 },
    opcoes: [
      {
        id: "visitar_a_crianca_no_hospital",
        texto: "Visitar a criança no hospital",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 15, reputacaoRegional: 10, moral: 8, narrativa: "A visita emociona o país inteiro e vira um dos momentos mais bonitos da sua carreira." } },
        ],
      },
      {
        id: "enviar_uma_mensagem_em_video",
        texto: "Enviar uma mensagem em vídeo, sem visita presencial",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 6, narrativa: "A mensagem já emociona bastante, mesmo à distância." } },
        ],
      },
    ],
  },
  {
    id: "imprensa_estrangeira_pede_entrevista",
    titulo: "Imprensa estrangeira pede entrevista",
    descricao: "Depois de boas atuações, um veículo estrangeiro de peso pede uma entrevista exclusiva.",
    gatilho: { reputacaoNacionalMinima: 55 },
    opcoes: [
      {
        id: "conceder_a_entrevista_estrangeira",
        texto: "Conceder a entrevista",
        resultados: [
          { probabilidade: 0.65, impacto: { reputacao: 15, narrativa: "A entrevista amplia sua projeção internacional de forma significativa." } },
          { probabilidade: 0.35, impacto: { reputacao: -5, narrativa: "Uma tradução equivocada distorce suas palavras e gera confusão." } },
        ],
      },
      {
        id: "recusar_por_enquanto_a_entrevista",
        texto: "Recusar por enquanto",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere esperar um momento mais oportuno pra essa exposição." } },
        ],
      },
    ],
  },
  {
    id: "suspeita_de_favorecimento_de_arbitragem",
    titulo: "Suspeita de favorecimento na arbitragem",
    descricao: "Depois de uma sequência de decisões controversas a seu favor, surgem suspeitas públicas de favorecimento.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "se_pronunciar_contra_a_suspeita",
        texto: "Se pronunciar publicamente contra a suspeita",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacao: 8, narrativa: "O pronunciamento firme ajuda a encerrar o assunto." } },
          { probabilidade: 0.5, impacto: { reputacao: -8, narrativa: "O pronunciamento é visto como uma reação exagerada e desnecessária." } },
        ],
      },
      {
        id: "deixar_o_assunto_esfriar",
        texto: "Deixar o assunto esfriar sozinho",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Sem alimentar o debate, o assunto perde força com o tempo." } },
        ],
      },
    ],
  },
  {
    id: "dilema_de_jogar_machucado_em_jogo_decisivo",
    titulo: "Jogar machucado numa final",
    descricao: "Com uma lesão leve, você tem a chance de jogar uma final histórica, mas o risco de agravar existe.",
    gatilho: { momentos: ["reta_final"] },
    opcoes: [
      {
        id: "jogar_a_final_mesmo_assim",
        texto: "Jogar a final mesmo machucado",
        resultados: [
          { probabilidade: 0.55, impacto: { reputacao: 18, moral: 15, narrativa: "Você joga a final histórica e o gesto de coragem vira lenda no clube." } },
          { probabilidade: 0.45, impacto: { atributos: { resistencia: -6 }, moral: -15, narrativa: "A lesão piora seriamente durante a final, custando meses de recuperação." } },
        ],
      },
      {
        id: "preservar_se_para_o_futuro",
        texto: "Se preservar, pensando no futuro da carreira",
        resultados: [
          { probabilidade: 1, impacto: { moral: -10, narrativa: "A decisão racional dói no momento, mas preserva sua saúde a longo prazo." } },
        ],
      },
    ],
  },
  {
    id: "pressao_por_gols_em_seca_de_artilharia",
    titulo: "Pressão por gols numa seca de artilharia",
    descricao: "Há semanas sem marcar, a cobrança da torcida e da imprensa por gols aumenta a cada jogo.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "arriscar_mais_finalizacoes",
        texto: "Arriscar mais finalizações de qualquer posição",
        resultados: [
          { probabilidade: 0.45, impacto: { atributos: { finalizacao: 3 }, moral: 12, narrativa: "A insistência é recompensada com um gol libertador." } },
          { probabilidade: 0.55, impacto: { moral: -10, narrativa: "As tentativas continuam sem sucesso, e a pressão só aumenta." } },
        ],
      },
      {
        id: "focar_em_outras_funcoes",
        texto: "Focar em outras funções além de finalizar",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { visao_de_jogo: 2 }, narrativa: "O foco em outras funções ajuda o time, mesmo sem resolver a seca de gols." } },
        ],
      },
    ],
  },
  {
    id: "mudanca_de_empresario_de_marketing",
    titulo: "Mudança de empresário de marketing",
    descricao: "Você considera contratar um empresário especializado só na parte de marketing pessoal.",
    opcoes: [
      {
        id: "contratar_empresario_de_marketing",
        texto: "Contratar um empresário de marketing",
        resultados: [
          { probabilidade: 0.6, impacto: { reputacao: 10, narrativa: "A gestão profissional da imagem traz resultados visíveis." } },
          { probabilidade: 0.4, impacto: { moral: -5, narrativa: "O novo empresário empurra compromissos demais pra sua agenda." } },
        ],
      },
      {
        id: "seguir_sem_empresario_de_marketing",
        texto: "Seguir sem esse tipo de gestão por enquanto",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere manter o foco só no futebol por ora." } },
        ],
      },
    ],
  },
  {
    id: "oportunidade_de_estudar_idiomas",
    titulo: "Oportunidade de estudar um novo idioma",
    descricao: "Pensando numa possível transferência futura, você considera estudar um novo idioma.",
    opcoes: [
      {
        id: "comecar_o_estudo_do_idioma",
        texto: "Começar o estudo do idioma",
        resultados: [
          { probabilidade: 1, impacto: { moral: 5, narrativa: "O novo aprendizado te deixa mais preparado pra uma eventual mudança de país." } },
        ],
      },
      {
        id: "adiar_o_estudo_do_idioma",
        texto: "Adiar esse estudo pra mais adiante",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere focar no presente por enquanto." } },
        ],
      },
    ],
  },
  {
    id: "reencontro_com_familia_apos_longa_turne",
    titulo: "Reencontro com a família após longa turnê",
    descricao: "Depois de semanas de viagens seguidas, você finalmente reencontra a família em casa.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "tirar_um_tempo_de_qualidade",
        texto: "Tirar um tempo de qualidade só pra família",
        resultados: [
          { probabilidade: 1, impacto: { moral: 12, narrativa: "O tempo de qualidade recarrega suas energias emocionais de verdade." } },
        ],
      },
      {
        id: "manter_o_foco_nos_treinos",
        texto: "Manter o foco total nos treinos, mesmo recém-chegado",
        resultados: [
          { probabilidade: 0.5, impacto: { relacoesInternas: 3, narrativa: "O comprometimento extra é notado pela comissão técnica." } },
          { probabilidade: 0.5, impacto: { moral: -10, narrativa: "A falta de tempo com a família pesa emocionalmente mais do que o esperado." } },
        ],
      },
    ],
  },
  {
    id: "desafio_beneficente_nas_redes_sociais",
    titulo: "Desafio beneficente nas redes sociais",
    descricao: "Um desafio viral beneficente circula nas redes, e colegas te marcam pra participar.",
    opcoes: [
      {
        id: "participar_e_doar",
        texto: "Participar do desafio e fazer uma doação",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 8, moral: 3, narrativa: "A participação engajada rende boa repercussão e ajuda a causa." } },
        ],
      },
      {
        id: "ignorar_o_desafio",
        texto: "Ignorar o desafio",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você passa longe da onda viral do momento." } },
        ],
      },
    ],
  },
  {
    id: "rumor_de_affair_na_midia",
    titulo: "Rumor de affair na mídia",
    descricao: "Um rumor infundado de affair envolvendo seu nome circula pelos veículos de fofoca.",
    gatilho: { reputacaoNacionalMinima: 30 },
    opcoes: [
      {
        id: "desmentir_o_rumor_publicamente",
        texto: "Desmentir o rumor publicamente",
        resultados: [
          { probabilidade: 0.6, impacto: { reputacao: 5, narrativa: "O desmentido claro encerra o assunto rapidamente." } },
          { probabilidade: 0.4, impacto: { reputacao: -5, narrativa: "O desmentido só alimenta ainda mais especulação." } },
        ],
      },
      {
        id: "ignorar_o_rumor",
        texto: "Ignorar completamente o rumor",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Sem alimentar, o rumor perde força sozinho depois de um tempo." } },
        ],
      },
    ],
  },
  {
    id: "pedido_de_indicacao_de_jogador_para_o_clube",
    titulo: "Pedido de indicação de jogador",
    descricao: "A diretoria te pede uma indicação de reforço, já que você conhece bem o mercado de jogadores.",
    gatilho: { relacoesInternasMinima: 50 },
    opcoes: [
      {
        id: "indicar_um_nome_de_confianca",
        texto: "Indicar um nome de sua confiança",
        resultados: [
          { probabilidade: 0.6, impacto: { relacoesInternas: 10, narrativa: "A indicação dá certo, e o clube valoriza seu faro pra reforços." } },
          { probabilidade: 0.4, impacto: { relacoesInternas: -5, narrativa: "A indicação não performa bem, e isso pesa um pouco contra você." } },
        ],
      },
      {
        id: "evitar_se_envolver_em_indicacoes",
        texto: "Evitar se envolver em indicações de mercado",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere manter distância desse tipo de decisão." } },
        ],
      },
    ],
  },
  {
    id: "reforma_da_casa_propria",
    titulo: "Reforma da casa própria",
    descricao: "Você decide reformar a casa da família com o dinheiro acumulado da carreira.",
    opcoes: [
      {
        id: "fazer_uma_reforma_completa",
        texto: "Fazer uma reforma completa e ambiciosa",
        resultados: [
          { probabilidade: 0.6, impacto: { moral: 10, narrativa: "A reforma fica linda, e a família fica emocionada com o resultado." } },
          { probabilidade: 0.4, impacto: { moral: -5, narrativa: "A obra estoura o orçamento e se arrasta mais do que o planejado." } },
        ],
      },
      {
        id: "fazer_uma_reforma_modesta",
        texto: "Fazer uma reforma mais modesta e planejada",
        resultados: [
          { probabilidade: 1, impacto: { moral: 5, narrativa: "A reforma fica pronta no prazo, sem sustos financeiros." } },
        ],
      },
    ],
  },
  {
    id: "investimento_em_negocio_proprio",
    titulo: "Investimento em negócio próprio",
    descricao: "Você considera investir parte do patrimônio abrindo um negócio próprio fora do futebol.",
    opcoes: [
      {
        id: "abrir_o_negocio_proprio",
        texto: "Abrir o negócio próprio",
        resultados: [
          { probabilidade: 0.5, impacto: { moral: 10, narrativa: "O negócio decola e vira uma fonte extra de orgulho e renda." } },
          { probabilidade: 0.5, impacto: { moral: -10, narrativa: "O negócio não vai bem, e a experiência custa um aprendizado caro." } },
        ],
      },
      {
        id: "esperar_o_fim_da_carreira",
        texto: "Esperar o fim da carreira pra empreender",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere focar 100% no futebol por enquanto." } },
        ],
      },
    ],
  },
  {
    id: "convite_para_ser_comentarista_de_um_jogo",
    titulo: "Convite pra comentar um jogo na TV",
    descricao: "Uma emissora te convida pra comentar ao vivo um jogo de outra competição, num dia de folga.",
    gatilho: { reputacaoNacionalMinima: 40 },
    opcoes: [
      {
        id: "aceitar_comentar_o_jogo",
        texto: "Aceitar comentar o jogo",
        resultados: [
          { probabilidade: 0.65, impacto: { reputacao: 8, narrativa: "Seus comentários analíticos surpreendem e rendem elogios." } },
          { probabilidade: 0.35, impacto: { reputacao: -5, narrativa: "Uma opinião polêmica sobre outro clube rende desconforto." } },
        ],
      },
      {
        id: "recusar_o_convite_de_comentarista",
        texto: "Recusar o convite",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere manter distância desse tipo de exposição por enquanto." } },
        ],
      },
    ],
  },
  {
    id: "exposicao_de_bastidores_do_vestiario_em_livro",
    titulo: "Convite pra lançar um livro de bastidores",
    descricao: "Uma editora propõe que você lance um livro contando bastidores da sua carreira e do vestiário.",
    gatilho: { reputacaoNacionalMinima: 40 },
    opcoes: [
      {
        id: "escrever_o_livro_com_detalhes",
        texto: "Escrever o livro com detalhes reais de bastidor",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacao: 15, narrativa: "O livro vira sucesso de vendas e é elogiado pela sinceridade." } },
          { probabilidade: 0.5, impacto: { relacoesInternas: -15, narrativa: "Detalhes revelados incomodam profundamente ex-companheiros e comissões." } },
        ],
      },
      {
        id: "escrever_um_livro_mais_generico",
        texto: "Escrever um livro mais genérico, sem detalhes sensíveis",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 5, narrativa: "O livro sai morno, mas sem gerar nenhum atrito interno." } },
        ],
      },
    ],
  },
  {
    id: "torcida_organizada_pede_ingressos",
    titulo: "Torcida organizada pede ingressos",
    descricao: "Uma torcida organizada pede que você intermedeie a compra de ingressos pra um jogo com procura alta.",
    gatilho: { reputacaoRegionalMinima: 20 },
    opcoes: [
      {
        id: "ajudar_com_os_ingressos",
        texto: "Ajudar a intermediar os ingressos",
        resultados: [
          { probabilidade: 0.7, impacto: { reputacaoRegional: 10, narrativa: "O gesto fortalece bastante o vínculo com essa torcida organizada." } },
          { probabilidade: 0.3, impacto: { relacoesInternas: -5, narrativa: "A intermediação gera desconforto com o setor de bilheteria do clube." } },
        ],
      },
      {
        id: "nao_se_envolver_com_ingressos",
        texto: "Não se envolver com questões de ingressos",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: -3, narrativa: "A torcida organizada fica um pouco frustrada com a resposta." } },
        ],
      },
    ],
  },
  {
    id: "jogo_em_estadio_lotado_pela_primeira_vez",
    titulo: "Primeira vez num estádio lotado",
    descricao: "Você joga pela primeira vez na carreira diante de um estádio completamente lotado.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "usar_a_energia_da_torcida",
        texto: "Usar a energia da torcida a seu favor",
        resultados: [
          { probabilidade: 0.6, impacto: { atributos: { frieza: 2 }, moral: 10, narrativa: "A energia da torcida potencializa sua atuação de forma incrível." } },
          { probabilidade: 0.4, impacto: { moral: -8, narrativa: "A grandiosidade do momento te deixa nervoso além do normal." } },
        ],
      },
      {
        id: "isolar_se_do_barulho",
        texto: "Se isolar mentalmente do barulho da torcida",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você consegue manter o foco de forma neutra, sem grandes picos emocionais." } },
        ],
      },
    ],
  },
  {
    id: "jogo_debaixo_de_chuva_forte",
    titulo: "Jogo debaixo de chuva forte",
    descricao: "Uma chuva forte transforma o gramado num desafio extra durante uma partida importante.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "adaptar_o_jogo_a_chuva",
        texto: "Adaptar seu estilo de jogo à chuva",
        resultados: [
          { probabilidade: 0.6, impacto: { atributos: { passe_curto: 2 }, narrativa: "A adaptação ao gramado pesado rende uma atuação sólida." } },
          { probabilidade: 0.4, impacto: { moral: -5, narrativa: "As condições difíceis atrapalham bastante seu rendimento na partida." } },
        ],
      },
      {
        id: "manter_o_estilo_normal_na_chuva",
        texto: "Manter seu estilo normal de jogo",
        resultados: [
          { probabilidade: 0.5, impacto: { narrativa: "O estilo habitual funciona razoavelmente, apesar das condições." } },
          { probabilidade: 0.5, impacto: { moral: -8, narrativa: "O estilo habitual não se adapta bem ao gramado encharcado." } },
        ],
      },
    ],
  },
  {
    id: "calor_extremo_durante_a_partida",
    titulo: "Calor extremo durante a partida",
    descricao: "Uma partida acontece sob calor extremo, exigindo cuidado redobrado com hidratação e ritmo.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "gerenciar_o_ritmo_com_cuidado",
        texto: "Gerenciar o ritmo com cuidado ao longo do jogo",
        resultados: [
          { probabilidade: 0.7, impacto: { atributos: { resistencia: 2 }, narrativa: "O gerenciamento inteligente evita desgaste excessivo." } },
          { probabilidade: 0.3, impacto: { moral: -3, narrativa: "Mesmo com cuidado, o calor extremo cobra seu preço no fim do jogo." } },
        ],
      },
      {
        id: "jogar_no_ritmo_normal_no_calor",
        texto: "Jogar no ritmo normal, ignorando o calor",
        resultados: [
          { probabilidade: 0.4, impacto: { narrativa: "Você aguenta bem o ritmo normal, apesar do calor." } },
          { probabilidade: 0.6, impacto: { atributos: { resistencia: -3 }, moral: -8, narrativa: "A exaustão pelo calor extremo compromete o fim da sua partida." } },
        ],
      },
    ],
  },
  {
    id: "arbitro_pede_desculpas_por_erro",
    titulo: "Árbitro pede desculpas por um erro",
    descricao: "Depois de um erro claro de arbitragem contra você, o árbitro procura pra se desculpar em particular.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "aceitar_as_desculpas_do_arbitro",
        texto: "Aceitar as desculpas com tranquilidade",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { frieza: 2 }, narrativa: "A maturidade no momento é notada e respeitada por todos." } },
        ],
      },
      {
        id: "cobrar_publicamente_mesmo_apos_desculpas",
        texto: "Cobrar publicamente mesmo depois das desculpas",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacao: 5, narrativa: "A cobrança pública reforça a necessidade de mais rigor na arbitragem." } },
          { probabilidade: 0.5, impacto: { reputacao: -5, narrativa: "A cobrança soa desnecessária depois que o árbitro já reconheceu o erro." } },
        ],
      },
    ],
  },
  {
    id: "var_anula_gol_polemico",
    titulo: "VAR anula um gol polêmico",
    descricao: "Um gol seu é anulado pelo VAR numa decisão bastante controversa.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "reclamar_com_o_var",
        texto: "Reclamar veementemente da decisão",
        resultados: [
          { probabilidade: 0.35, impacto: { atributos: { frieza: -2 }, reputacaoRegional: 8, narrativa: "A reclamação inflamada agrada a torcida, mesmo sem mudar o resultado." } },
          { probabilidade: 0.65, impacto: { atributos: { frieza: -3 }, moral: -10, narrativa: "A reclamação rende cartão amarelo e desgasta ainda mais seu momento." } },
        ],
      },
      {
        id: "aceitar_a_decisao_do_var",
        texto: "Aceitar a decisão e seguir o jogo",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { frieza: 2 }, narrativa: "A serenidade ajuda a manter o foco no restante da partida." } },
        ],
      },
    ],
  },
  {
    id: "reclamacao_formal_contra_arbitragem",
    titulo: "Reclamação formal contra a arbitragem",
    descricao: "O clube pede que você assine uma reclamação formal contra a arbitragem de uma rodada.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "assinar_a_reclamacao",
        texto: "Assinar a reclamação formal",
        resultados: [
          { probabilidade: 0.5, impacto: { relacoesInternas: 5, reputacao: -3, narrativa: "A reclamação formal reforça a união do elenco, mas incomoda a federação." } },
          { probabilidade: 0.5, impacto: { reputacao: -8, narrativa: "A reclamação é mal recebida e rende punição adicional ao clube." } },
        ],
      },
      {
        id: "nao_assinar_a_reclamacao",
        texto: "Não assinar, preferindo seguir em frente",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: -3, narrativa: "Parte do grupo estranha sua ausência na reclamação coletiva." } },
        ],
      },
    ],
  },
  {
    id: "disputa_por_numero_de_camisa",
    titulo: "Disputa por número de camisa",
    descricao: "Um novo reforço chega ao clube e também quer usar o mesmo número de camisa que você.",
    opcoes: [
      {
        id: "ceder_o_numero",
        texto: "Ceder o número ao novo reforço",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 8, narrativa: "O gesto de generosidade é muito bem recebido pelo grupo." } },
        ],
      },
      {
        id: "manter_o_numero_por_direito",
        texto: "Manter o número por ter chegado primeiro",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: -2, narrativa: "A decisão é compreendida, mas gera um leve desconforto inicial." } },
        ],
      },
    ],
  },
  {
    id: "troca_de_camisa_com_torcedor_durante_jogo",
    titulo: "Torcedor invade o campo pedindo a camisa",
    descricao: "No fim de um jogo, um torcedor invade o gramado pedindo pra trocar de camisa com você.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "trocar_a_camisa_com_o_torcedor",
        texto: "Trocar a camisa com o torcedor",
        resultados: [
          { probabilidade: 0.7, impacto: { reputacaoRegional: 12, narrativa: "O gesto espontâneo vira um dos momentos mais compartilhados da rodada." } },
          { probabilidade: 0.3, impacto: { reputacao: -5, narrativa: "A invasão de campo rende punição disciplinar ao clube por falha de segurança." } },
        ],
      },
      {
        id: "recusar_e_pedir_seguranca",
        texto: "Recusar e pedir a intervenção da segurança",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: -5, narrativa: "A recusa é vista como fria pela torcida, mesmo sendo uma questão de segurança." } },
        ],
      },
    ],
  },
  {
    id: "entrada_dura_gera_climao_pos_jogo",
    titulo: "Entrada dura gera climão pós-jogo",
    descricao: "Uma entrada dura sua num adversário gera climão nos corredores depois do apito final.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "procurar_o_adversario_para_conversar",
        texto: "Procurar o adversário pra conversar após o jogo",
        resultados: [
          { probabilidade: 0.7, impacto: { reputacao: 8, narrativa: "A conversa madura resolve o climão e vira exemplo de esportividade." } },
          { probabilidade: 0.3, impacto: { reputacao: -5, narrativa: "O adversário não aceita bem a conversa, e o climão persiste." } },
        ],
      },
      {
        id: "evitar_o_confronto_pos_jogo",
        texto: "Evitar qualquer contato após o jogo",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "O assunto esfria sozinho, sem necessidade de gestos extras." } },
        ],
      },
    ],
  },
  {
    id: "jogo_amistoso_contra_selecao_de_lendas",
    titulo: "Amistoso contra uma seleção de lendas",
    descricao: "Um evento especial coloca você em campo contra ídolos aposentados do futebol mundial.",
    gatilho: { reputacaoNacionalMinima: 50 },
    opcoes: [
      {
        id: "jogar_com_intensidade_total",
        texto: "Jogar com intensidade total, como um jogo de verdade",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacao: 10, narrativa: "A postura competitiva rende boas atuações e respeito das lendas." } },
          { probabilidade: 0.5, impacto: { reputacao: -3, narrativa: "A intensidade excessiva soa deslocada num evento pensado pra ser leve." } },
        ],
      },
      {
        id: "jogar_de_forma_descontraida",
        texto: "Jogar de forma descontraída, aproveitando o momento",
        resultados: [
          { probabilidade: 1, impacto: { moral: 8, narrativa: "O evento vira uma memória especial e leve na sua carreira." } },
        ],
      },
    ],
  },
  {
    id: "convite_para_jogo_das_estrelas",
    titulo: "Convite pro Jogo das Estrelas",
    descricao: "Você é convidado pra representar seu campeonato num tradicional jogo das estrelas.",
    gatilho: { reputacaoNacionalMinima: 40 },
    opcoes: [
      {
        id: "participar_do_jogo_das_estrelas",
        texto: "Participar do Jogo das Estrelas",
        resultados: [
          { probabilidade: 0.8, impacto: { reputacao: 10, moral: 5, narrativa: "A participação reforça seu reconhecimento entre os melhores do campeonato." } },
          { probabilidade: 0.2, impacto: { atributos: { resistencia: -2 }, narrativa: "O desgaste extra do evento pesa um pouco na sequência da temporada." } },
        ],
      },
      {
        id: "recusar_para_descansar",
        texto: "Recusar pra aproveitar a folga do calendário",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { resistencia: 2 }, narrativa: "O descanso extra ajuda a recarregar as energias." } },
        ],
      },
    ],
  },
  {
    id: "pedido_de_autografo_de_crianca_com_doenca_grave",
    titulo: "Pedido de autógrafo de criança com doença grave",
    descricao: "A família de uma criança com doença grave pede um autógrafo e uma mensagem de força.",
    gatilho: { reputacaoRegionalMinima: 15 },
    opcoes: [
      {
        id: "enviar_autografo_e_mensagem_pessoal",
        texto: "Enviar autógrafo e uma mensagem pessoal gravada",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 12, moral: 8, narrativa: "O gesto emociona a família e viraliza como exemplo de generosidade." } },
        ],
      },
      {
        id: "enviar_apenas_o_autografo",
        texto: "Enviar apenas o autógrafo, sem mensagem extra",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 3, narrativa: "O gesto simples já é bem recebido pela família." } },
        ],
      },
    ],
  },
  {
    id: "torcida_cobra_explicacoes_apos_eliminacao",
    titulo: "Torcida cobra explicações após eliminação",
    descricao: "Depois de uma eliminação inesperada, a torcida cobra explicações do elenco na saída do estádio.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "parar_para_explicar",
        texto: "Parar pra explicar a situação com calma",
        resultados: [
          { probabilidade: 0.55, impacto: { reputacaoRegional: 10, narrativa: "A postura de dar a cara a tapa é reconhecida pela torcida." } },
          { probabilidade: 0.45, impacto: { reputacaoRegional: -8, moral: -10, narrativa: "A explicação não convence, e a cobrança aumenta ainda mais." } },
        ],
      },
      {
        id: "seguir_direto_para_o_onibus",
        texto: "Seguir direto pro ônibus, sem parar",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: -10, narrativa: "A ausência de explicação é vista como desrespeito à torcida." } },
        ],
      },
    ],
  },
  {
    id: "proposta_de_ser_conselheiro_do_clube",
    titulo: "Proposta de ser conselheiro do clube",
    descricao: "Pensando no pós-carreira, o clube sugere que você comece a participar do conselho deliberativo.",
    gatilho: { idadeMinima: 30 },
    opcoes: [
      {
        id: "aceitar_participar_do_conselho",
        texto: "Aceitar participar do conselho",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 8, reputacaoRegional: 5, narrativa: "A participação no conselho fortalece seus laços institucionais com o clube." } },
        ],
      },
      {
        id: "recusar_por_enquanto_o_conselho",
        texto: "Recusar por enquanto, focando só em jogar",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere adiar essa fase da carreira." } },
        ],
      },
    ],
  },
  {
    id: "relacionamento_afetado_pela_rotina_de_jogos",
    titulo: "Relacionamento afetado pela rotina de jogos",
    descricao: "A rotina intensa de jogos e viagens começa a afetar seu relacionamento pessoal.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "reservar_tempo_de_qualidade",
        texto: "Reservar tempo de qualidade, mesmo com a rotina apertada",
        resultados: [
          { probabilidade: 0.7, impacto: { moral: 10, narrativa: "O esforço extra fortalece bastante o relacionamento." } },
          { probabilidade: 0.3, impacto: { moral: -5, narrativa: "Mesmo com esforço, a tensão na relação persiste por um tempo." } },
        ],
      },
      {
        id: "priorizar_a_carreira_no_momento",
        texto: "Priorizar a carreira nesse momento",
        resultados: [
          { probabilidade: 1, impacto: { moral: -8, narrativa: "A decisão profissional pesa bastante no lado pessoal." } },
        ],
      },
    ],
  },
  {
    id: "amigo_de_infancia_pede_emprego_no_clube",
    titulo: "Amigo de infância pede emprego no clube",
    descricao: "Um amigo de infância te pede ajuda pra conseguir um emprego na estrutura do clube.",
    opcoes: [
      {
        id: "indicar_o_amigo_de_infancia",
        texto: "Indicar o amigo pra uma vaga no clube",
        resultados: [
          { probabilidade: 0.5, impacto: { moral: 8, relacoesInternas: 3, narrativa: "O amigo se sai bem na função, e a indicação vira motivo de orgulho." } },
          { probabilidade: 0.5, impacto: { relacoesInternas: -8, narrativa: "O amigo não corresponde na função, e isso reflete mal em você." } },
        ],
      },
      {
        id: "ajudar_de_outra_forma",
        texto: "Ajudar o amigo de outra forma, fora do clube",
        resultados: [
          { probabilidade: 1, impacto: { moral: 3, narrativa: "A ajuda alternativa evita qualquer risco profissional." } },
        ],
      },
    ],
  },
  {
    id: "mudanca_de_fisioterapeuta",
    titulo: "Mudança de fisioterapeuta pessoal",
    descricao: "Você considera contratar um fisioterapeuta pessoal, além da estrutura oferecida pelo clube.",
    opcoes: [
      {
        id: "contratar_fisioterapeuta_pessoal",
        texto: "Contratar um fisioterapeuta pessoal",
        resultados: [
          { probabilidade: 0.7, impacto: { atributos: { resistencia: 3 }, narrativa: "O acompanhamento extra faz diferença real na sua recuperação." } },
          { probabilidade: 0.3, impacto: { relacoesInternas: -3, narrativa: "O departamento médico do clube não gosta muito da decisão paralela." } },
        ],
      },
      {
        id: "seguir_so_com_a_estrutura_do_clube",
        texto: "Seguir só com a estrutura oferecida pelo clube",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 3, narrativa: "A confiança na estrutura do clube é bem vista internamente." } },
        ],
      },
    ],
  },
  {
    id: "avaliacao_de_desempenho_semestral",
    titulo: "Avaliação de desempenho semestral",
    descricao: "O clube realiza uma avaliação semestral de desempenho de todo o elenco.",
    opcoes: [
      {
        id: "buscar_a_avaliacao_com_atencao",
        texto: "Buscar a avaliação com atenção e abertura",
        resultados: [
          { probabilidade: 0.7, impacto: { relacoesInternas: 6, atributos: { frieza: 1 }, narrativa: "A abertura pra feedback rende insights valiosos sobre seu jogo." } },
          { probabilidade: 0.3, impacto: { moral: -5, narrativa: "A avaliação traz críticas mais duras do que o esperado." } },
        ],
      },
      {
        id: "receber_a_avaliacao_com_desconfianca",
        texto: "Receber a avaliação com desconfiança",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: -3, narrativa: "A postura defensiva não ajuda muito no processo de evolução." } },
        ],
      },
    ],
  },
  {
    id: "reportagem_investigativa_sobre_financas",
    titulo: "Reportagem investigativa sobre finanças",
    descricao: "Uma reportagem investigativa levanta questões sobre a gestão financeira do seu patrimônio.",
    gatilho: { reputacaoNacionalMinima: 30 },
    opcoes: [
      {
        id: "abrir_as_financas_para_esclarecer",
        texto: "Abrir as finanças publicamente pra esclarecer",
        resultados: [
          { probabilidade: 0.6, impacto: { reputacao: 12, narrativa: "A transparência total encerra qualquer dúvida de forma definitiva." } },
          { probabilidade: 0.4, impacto: { reputacao: -8, narrativa: "A exposição revela decisões financeiras questionáveis que geram crítica." } },
        ],
      },
      {
        id: "responder_por_meio_de_nota_juridica",
        texto: "Responder apenas por nota jurídica formal",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: -2, narrativa: "A resposta formal e seca não convence totalmente a opinião pública." } },
        ],
      },
    ],
  },
  {
    id: "onda_de_criticas_por_baixo_rendimento",
    titulo: "Onda de críticas por baixo rendimento",
    descricao: "Uma sequência de jogos abaixo do esperado gera uma onda forte de críticas da torcida e da imprensa.",
    gatilho: { momentos: ["temporada_regular", "reta_final"], moralMaxima: 50 },
    opcoes: [
      {
        id: "buscar_apoio_psicologico_na_crise",
        texto: "Buscar apoio psicológico pra atravessar a fase",
        resultados: [
          { probabilidade: 0.75, impacto: { moral: 10, atributos: { frieza: 2 }, narrativa: "O apoio ajuda a virar a chave e recuperar a confiança aos poucos." } },
          { probabilidade: 0.25, impacto: { moral: -3, narrativa: "A fase de baixa segue difícil, mesmo com o apoio recebido." } },
        ],
      },
      {
        id: "tentar_resolver_sozinho_a_crise",
        texto: "Tentar resolver a crise sozinho",
        resultados: [
          { probabilidade: 0.4, impacto: { moral: 5, narrativa: "Com força de vontade, você consegue reverter a fase sozinho." } },
          { probabilidade: 0.6, impacto: { moral: -12, narrativa: "Sem apoio, a fase ruim se estende por mais tempo do que deveria." } },
        ],
      },
    ],
  },
  {
    id: "torcida_pede_selfie_em_restaurante",
    titulo: "Torcedores pedem selfie em restaurante",
    descricao: "Num jantar tranquilo em família, torcedores se aproximam pedindo selfies repetidamente.",
    opcoes: [
      {
        id: "atender_com_paciencia_no_restaurante",
        texto: "Atender com paciência, mesmo durante o jantar",
        resultados: [
          { probabilidade: 0.8, impacto: { reputacaoRegional: 8, moral: -3, narrativa: "A paciência é elogiada, mesmo custando um pouco do momento em família." } },
          { probabilidade: 0.2, impacto: { moral: -8, narrativa: "O jantar em família fica praticamente arruinado pela quantidade de interrupções." } },
        ],
      },
      {
        id: "pedir_privacidade_no_restaurante",
        texto: "Pedir educadamente por um pouco de privacidade",
        resultados: [
          { probabilidade: 0.6, impacto: { moral: 5, narrativa: "O pedido é entendido, e o jantar segue tranquilo." } },
          { probabilidade: 0.4, impacto: { reputacaoRegional: -5, narrativa: "O pedido é mal interpretado como arrogância nas redes sociais." } },
        ],
      },
    ],
  },
  {
    id: "jogo_decisivo_marcado_pela_chuva_de_papel",
    titulo: "Jogo decisivo com chuva de papel picado",
    descricao: "Antes de um jogo decisivo, a torcida organiza uma chuva de papel picado impressionante na entrada do time.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "usar_a_festa_como_impulso",
        texto: "Usar a festa da torcida como impulso extra",
        resultados: [
          { probabilidade: 0.6, impacto: { moral: 12, reputacaoRegional: 8, narrativa: "A energia da festa contagia o time, que entra em campo eletrizado." } },
          { probabilidade: 0.4, impacto: { moral: -5, narrativa: "A expectativa gerada pela festa acaba pesando demais no início do jogo." } },
        ],
      },
      {
        id: "manter_a_concentracao_normal",
        texto: "Manter a concentração normal, sem se empolgar demais",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você aproveita o momento sem deixar que ele afete sua concentração." } },
        ],
      },
    ],
  },
  {
    id: "mudanca_de_regime_alimentar_imposta_pelo_clube",
    titulo: "Mudança de regime alimentar imposta pelo clube",
    descricao: "O clube impõe um novo regime alimentar padrão pra todo o elenco, sem exceções.",
    opcoes: [
      {
        id: "seguir_o_regime_imposto",
        texto: "Seguir o regime imposto, mesmo sem gostar totalmente",
        resultados: [
          { probabilidade: 0.65, impacto: { atributos: { resistencia: 2 }, relacoesInternas: 3, narrativa: "O corpo se adapta bem ao novo regime alimentar." } },
          { probabilidade: 0.35, impacto: { moral: -5, narrativa: "A adaptação ao novo regime é bem mais difícil do que o esperado." } },
        ],
      },
      {
        id: "pedir_excecao_no_regime",
        texto: "Pedir uma exceção pontual no regime",
        resultados: [
          { probabilidade: 0.5, impacto: { relacoesInternas: -3, narrativa: "A exceção é concedida, mas gera um certo desconforto com a nutrição." } },
          { probabilidade: 0.5, impacto: { relacoesInternas: -10, narrativa: "O pedido é negado e visto como falta de comprometimento." } },
        ],
      },
    ],
  },
  {
    id: "proposta_de_ser_garoto_propaganda_de_orgao_publico",
    titulo: "Convite pra campanha de órgão público",
    descricao: "Um órgão público te convida pra estampar uma campanha de conscientização social.",
    gatilho: { reputacaoNacionalMinima: 30 },
    opcoes: [
      {
        id: "aceitar_a_campanha_publica",
        texto: "Aceitar participar da campanha",
        resultados: [
          { probabilidade: 0.85, impacto: { reputacao: 10, reputacaoRegional: 8, narrativa: "A campanha de conscientização é muito bem recebida pelo público." } },
          { probabilidade: 0.15, impacto: { reputacao: -5, narrativa: "A associação com o órgão público vira alvo de polêmica política." } },
        ],
      },
      {
        id: "recusar_por_neutralidade",
        texto: "Recusar por preferir se manter neutro",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere não se associar publicamente a esse tipo de campanha." } },
        ],
      },
    ],
  },
  {
    id: "crise_de_confianca_apos_sequencia_de_erros",
    titulo: "Crise de confiança após sequência de erros",
    descricao: "Uma sequência de erros técnicos seguidos abala sua confiança em campo.",
    gatilho: { momentos: ["temporada_regular", "reta_final"], moralMaxima: 45 },
    opcoes: [
      {
        id: "conversar_com_o_tecnico_sobre_a_crise",
        texto: "Conversar abertamente com o técnico sobre a crise",
        resultados: [
          { probabilidade: 0.7, impacto: { relacoesInternas: 8, moral: 8, narrativa: "A conversa franca ajuda a reconstruir a confiança aos poucos." } },
          { probabilidade: 0.3, impacto: { moral: -5, narrativa: "Mesmo com a conversa, a insegurança em campo ainda persiste." } },
        ],
      },
      {
        id: "tentar_superar_sozinho_a_crise",
        texto: "Tentar superar a crise sozinho, sem conversar",
        resultados: [
          { probabilidade: 0.4, impacto: { atributos: { frieza: 2 }, narrativa: "Com força de vontade, você consegue superar a fase por conta própria." } },
          { probabilidade: 0.6, impacto: { moral: -12, narrativa: "Sem apoio, a insegurança se aprofunda ainda mais." } },
        ],
      },
    ],
  },
  {
    id: "duvida_entre_hospital_publico_e_particular_para_familiar",
    titulo: "Dúvida sobre tratamento de um familiar",
    descricao: "Um familiar próximo precisa de tratamento médico, e você tem condições de bancar uma opção mais cara.",
    opcoes: [
      {
        id: "bancar_o_melhor_tratamento_disponivel",
        texto: "Bancar o melhor tratamento disponível, sem medir custos",
        resultados: [
          { probabilidade: 1, impacto: { moral: 10, narrativa: "O cuidado com a família traz uma tranquilidade emocional enorme." } },
        ],
      },
      {
        id: "seguir_a_recomendacao_medica_padrao",
        texto: "Seguir a recomendação médica padrão, sem gastos extras",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "O tratamento segue seu curso normal, dentro do esperado." } },
        ],
      },
    ],
  },
  {
    id: "reencontro_com_treinador_da_base",
    titulo: "Reencontro com treinador da base em outro clube",
    descricao: "Você reencontra, agora como adversário, o treinador que te formou nas categorias de base.",
    opcoes: [
      {
        id: "cumprimentar_com_carinho_o_ex_treinador",
        texto: "Cumprimentar com carinho antes do jogo",
        resultados: [
          { probabilidade: 1, impacto: { moral: 8, reputacaoRegional: 3, narrativa: "O gesto de carinho e gratidão emociona quem acompanha a história." } },
        ],
      },
      {
        id: "manter_a_postura_profissional_no_reencontro",
        texto: "Manter a postura profissional, sem gestos especiais",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "O reencontro é respeitoso, mas discreto." } },
        ],
      },
    ],
  },
  {
    id: "pedido_de_ajuda_financeira_de_instituicao_social",
    titulo: "Pedido de ajuda de instituição social",
    descricao: "Uma instituição social da sua região de origem pede ajuda financeira pra continuar funcionando.",
    gatilho: { reputacaoRegionalMinima: 15 },
    opcoes: [
      {
        id: "ajudar_a_instituicao_social",
        texto: "Ajudar financeiramente a instituição",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 15, moral: 8, narrativa: "A ajuda garante a continuidade da instituição e fortalece seu vínculo com a região." } },
        ],
      },
      {
        id: "sugerir_uma_campanha_coletiva",
        texto: "Sugerir uma campanha coletiva com outros jogadores",
        resultados: [
          { probabilidade: 0.6, impacto: { reputacaoRegional: 10, relacoesInternas: 5, narrativa: "A campanha coletiva engaja o elenco todo e multiplica o impacto." } },
          { probabilidade: 0.4, impacto: { reputacaoRegional: 3, narrativa: "A campanha tem adesão baixa, mas ainda ajuda um pouco a causa." } },
        ],
      },
    ],
  },
  {
    id: "jogo_de_despedida_de_um_idolo_do_clube",
    titulo: "Jogo de despedida de um ídolo do clube",
    descricao: "Você participa do jogo de despedida de um ídolo histórico do clube.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "homenagear_o_idolo_em_campo",
        texto: "Homenagear o ídolo com um gesto especial em campo",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 10, relacoesInternas: 5, narrativa: "A homenagem emociona o estádio inteiro e fortalece sua ligação com a história do clube." } },
        ],
      },
      {
        id: "jogar_normalmente_na_despedida",
        texto: "Jogar normalmente, sem gestos especiais",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "O jogo de despedida segue seu roteiro emocionante, com sua participação discreta." } },
        ],
      },
    ],
  },
  {
    id: "convite_para_conselho_deliberativo",
    titulo: "Convite pro conselho deliberativo",
    descricao: "O clube convida você a integrar o conselho deliberativo, ainda na ativa.",
    gatilho: { idadeMinima: 28 },
    opcoes: [
      {
        id: "aceitar_o_conselho_deliberativo",
        texto: "Aceitar integrar o conselho",
        resultados: [
          { probabilidade: 0.7, impacto: { relacoesInternas: 8, narrativa: "Sua voz no conselho ajuda a equilibrar decisões importantes do clube." } },
          { probabilidade: 0.3, impacto: { moral: -5, narrativa: "O acúmulo de funções pesa mais do que o esperado na sua rotina." } },
        ],
      },
      {
        id: "recusar_o_conselho_por_enquanto",
        texto: "Recusar por enquanto, focando só em jogar",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere adiar esse tipo de responsabilidade institucional." } },
        ],
      },
    ],
  },
  {
    id: "ameaca_anonima_nas_redes",
    titulo: "Ameaça anônima nas redes sociais",
    descricao: "Uma mensagem ameaçadora anônima aparece nas suas redes sociais depois de um resultado ruim.",
    opcoes: [
      {
        id: "denunciar_e_acionar_seguranca",
        texto: "Denunciar formalmente e acionar a segurança do clube",
        resultados: [
          { probabilidade: 1, impacto: { moral: 5, narrativa: "A resposta institucional rápida traz segurança e tranquilidade." } },
        ],
      },
      {
        id: "ignorar_a_ameaca",
        texto: "Ignorar a mensagem, tratando como exagero isolado",
        resultados: [
          { probabilidade: 0.6, impacto: { narrativa: "A mensagem realmente não passava de um exagero isolado." } },
          { probabilidade: 0.4, impacto: { moral: -15, narrativa: "A situação escala e exige uma resposta mais séria depois." } },
        ],
      },
    ],
  },
  {
    id: "classico_de_maxima_rivalidade_regional",
    titulo: "Clássico de máxima rivalidade regional",
    descricao: "Você encara o clássico de maior rivalidade histórica da região, com clima de guerra nas arquibancadas.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "assumir_o_protagonismo_no_classico",
        texto: "Assumir o protagonismo no clássico",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacaoRegional: 20, moral: 15, narrativa: "Uma atuação decisiva no maior clássico da região vira história eterna com a torcida." } },
          { probabilidade: 0.5, impacto: { reputacaoRegional: -10, moral: -12, narrativa: "A pressão do clássico pesa e a atuação fica bem abaixo do esperado." } },
        ],
      },
      {
        id: "jogar_dentro_do_seu_papel_no_classico",
        texto: "Jogar dentro do seu papel normal, sem se expor demais",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 4, narrativa: "Uma atuação discreta, mas sólida, dentro do que se espera de você." } },
        ],
      },
    ],
  },
  {
    id: "pressao_por_recorde_pessoal_de_gols",
    titulo: "Pressão por recorde pessoal de gols",
    descricao: "Você está a poucos gols de bater seu recorde pessoal numa única temporada.",
    gatilho: { momentos: ["temporada_regular", "reta_final"], moralMinima: 60 },
    opcoes: [
      {
        id: "focar_no_recorde_pessoal",
        texto: "Focar bastante em bater o recorde",
        resultados: [
          { probabilidade: 0.5, impacto: { atributos: { finalizacao: 3 }, reputacao: 12, narrativa: "O recorde é batido, e sua confiança dispara." } },
          { probabilidade: 0.5, impacto: { moral: -8, narrativa: "A obsessão pelo número pessoal atrapalha o desempenho coletivo do time." } },
        ],
      },
      {
        id: "priorizar_o_coletivo_sobre_o_recorde",
        texto: "Priorizar o coletivo, sem se preocupar com o número",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 5, narrativa: "O foco no coletivo é muito bem visto pelo grupo, mesmo sem bater o recorde." } },
        ],
      },
    ],
  },
  {
    id: "quebra_de_recorde_do_clube",
    titulo: "Quebra de recorde histórico do clube",
    descricao: "Você está próximo de quebrar um recorde histórico de artilharia do clube.",
    gatilho: { momentos: ["temporada_regular", "reta_final"], moralMinima: 60 },
    opcoes: [
      {
        id: "buscar_a_quebra_do_recorde",
        texto: "Buscar ativamente a quebra do recorde",
        resultados: [
          { probabilidade: 0.55, impacto: { reputacaoRegional: 20, moral: 15, narrativa: "A quebra do recorde histórico consagra seu nome no clube pra sempre." } },
          { probabilidade: 0.45, impacto: { moral: -8, narrativa: "A pressão pelo recorde histórico pesa e afeta seu desempenho geral." } },
        ],
      },
      {
        id: "deixar_o_recorde_vir_naturalmente",
        texto: "Deixar o recorde vir naturalmente, sem forçar",
        resultados: [
          { probabilidade: 1, impacto: { moral: 5, narrativa: "A tranquilidade ajuda a manter o rendimento normal do time." } },
        ],
      },
    ],
  },
  {
    id: "entrada_para_o_hall_da_fama",
    titulo: "Convite pro hall da fama do clube",
    descricao: "O clube anuncia sua entrada no hall da fama institucional, ainda durante a carreira ativa.",
    gatilho: { reputacaoNacionalMinima: 70, idadeMinima: 30 },
    opcoes: [
      {
        id: "participar_da_cerimonia_do_hall_da_fama",
        texto: "Participar da cerimônia com discurso emocionado",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 15, moral: 8, narrativa: "O discurso emocionado marca época na história do clube." } },
        ],
      },
      {
        id: "participar_de_forma_discreta_do_hall_da_fama",
        texto: "Participar de forma mais discreta",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 6, narrativa: "A homenagem acontece de forma mais simples, mas ainda assim significativa." } },
        ],
      },
    ],
  },
  {
    id: "testemunho_em_documentario_de_outro_jogador",
    titulo: "Convite pra depor em documentário de outro jogador",
    descricao: "Você é convidado a dar um depoimento num documentário sobre a carreira de outro jogador que admira.",
    gatilho: { reputacaoNacionalMinima: 40 },
    opcoes: [
      {
        id: "dar_um_depoimento_sincero",
        texto: "Dar um depoimento sincero e detalhado",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 6, relacoesInternas: 3, narrativa: "O depoimento é elogiado pela sinceridade e carinho com o colega." } },
        ],
      },
      {
        id: "recusar_o_depoimento",
        texto: "Recusar o convite pra depoimento",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere não se envolver na produção do documentário." } },
        ],
      },
    ],
  },
  {
    id: "convite_para_selecionar_uniforme_do_clube",
    titulo: "Convite pra opinar no novo uniforme",
    descricao: "O departamento de marketing te convida pra opinar sobre o design do próximo uniforme do clube.",
    opcoes: [
      {
        id: "dar_opiniao_ativa_sobre_uniforme",
        texto: "Dar uma opinião ativa sobre o design",
        resultados: [
          { probabilidade: 0.7, impacto: { reputacaoRegional: 6, narrativa: "Sua sugestão é incorporada e bem recebida pela torcida." } },
          { probabilidade: 0.3, impacto: { reputacaoRegional: -3, narrativa: "Sua sugestão não agrada parte da torcida, que prefere o design tradicional." } },
        ],
      },
      {
        id: "deixar_a_decisao_com_o_marketing",
        texto: "Deixar a decisão inteiramente com o marketing",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "O uniforme segue seu processo normal de criação, sem sua interferência direta." } },
        ],
      },
    ],
  },
  {
    id: "reuniao_sobre_extensao_de_patrocinio_master",
    titulo: "Reunião sobre patrocínio master do clube",
    descricao: "A diretoria pede sua presença numa reunião importante sobre a renovação do patrocínio master do clube.",
    gatilho: { momentos: ["pre_temporada"] },
    opcoes: [
      {
        id: "participar_ativamente_da_reuniao",
        texto: "Participar ativamente, dando sua visão de jogador",
        resultados: [
          { probabilidade: 0.65, impacto: { relacoesInternas: 8, narrativa: "Sua visão de jogador ajuda a fechar um acordo mais vantajoso pro clube." } },
          { probabilidade: 0.35, impacto: { relacoesInternas: -3, narrativa: "Sua opinião diverge da diretoria e gera um leve atrito na reunião." } },
        ],
      },
      {
        id: "apenas_acompanhar_a_reuniao",
        texto: "Apenas acompanhar, sem se posicionar muito",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "A reunião segue seu curso normal, com sua participação discreta." } },
        ],
      },
    ],
  },
  {
    id: "torcida_pede_permanencia_em_ano_de_saida",
    titulo: "Torcida pede permanência num ano de possível saída",
    descricao: "Com boatos de saída circulando, a torcida organiza uma campanha pedindo sua permanência no clube.",
    gatilho: { reputacaoRegionalMinima: 30, momentos: ["pre_temporada"] },
    opcoes: [
      {
        id: "sinalizar_permanencia_a_torcida",
        texto: "Sinalizar publicamente vontade de permanecer",
        resultados: [
          { probabilidade: 0.6, impacto: { reputacaoRegional: 15, relacoesInternas: 5, narrativa: "O gesto fortalece imensamente o vínculo emocional com a torcida." } },
          { probabilidade: 0.4, impacto: { moral: -8, narrativa: "A sinalização pública complica sua posição numa eventual negociação de saída." } },
        ],
      },
      {
        id: "manter_a_situacao_em_aberto",
        texto: "Manter a situação em aberto, sem se comprometer",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: -5, narrativa: "A falta de sinalização clara frustra um pouco a torcida." } },
        ],
      },
    ],
  },
  {
    id: "oferta_de_dupla_funcao_em_campo",
    titulo: "Oferta de dupla função em campo",
    descricao: "O técnico sugere que você acumule uma função tática extra em campo, além da sua principal.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "aceitar_a_dupla_funcao",
        texto: "Aceitar acumular a função extra",
        resultados: [
          { probabilidade: 0.5, impacto: { atributos: { visao_de_jogo: 2, movimentacao: 2 }, relacoesInternas: 6, narrativa: "A versatilidade extra te torna ainda mais valioso pro esquema tático." } },
          { probabilidade: 0.5, impacto: { atributos: { resistencia: -3 }, moral: -8, narrativa: "O desgaste extra da dupla função cobra um preço físico alto." } },
        ],
      },
      {
        id: "recusar_a_dupla_funcao",
        texto: "Recusar, preferindo manter o foco numa função só",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere manter a especialização na sua função original." } },
        ],
      },
    ],
  },
  {
    id: "desgaste_fisico_por_calendario_apertado",
    titulo: "Desgaste físico por calendário apertado",
    descricao: "Uma sequência de jogos a cada três dias cobra um pedágio físico alto do elenco inteiro.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "pedir_gestao_de_carga_individual",
        texto: "Pedir uma gestão de carga individualizada ao preparador",
        resultados: [
          { probabilidade: 0.7, impacto: { atributos: { resistencia: 2 }, narrativa: "A gestão individualizada ajuda bastante a atravessar o calendário apertado." } },
          { probabilidade: 0.3, impacto: { relacoesInternas: -3, narrativa: "O pedido é visto como querer tratamento diferenciado dos demais." } },
        ],
      },
      {
        id: "seguir_o_ritmo_padrao_do_elenco",
        texto: "Seguir o mesmo ritmo padrão do restante do elenco",
        resultados: [
          { probabilidade: 0.5, impacto: { narrativa: "Você aguenta bem o ritmo intenso, sem problemas maiores." } },
          { probabilidade: 0.5, impacto: { atributos: { resistencia: -4 }, moral: -8, narrativa: "O desgaste acumulado cobra seu preço nas semanas seguintes." } },
        ],
      },
    ],
  },
  {
    id: "pedido_de_descanso_estrategico_do_departamento_medico",
    titulo: "Pedido de descanso estratégico",
    descricao: "O departamento médico recomenda que você descanse um jogo importante como prevenção.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "seguir_a_recomendacao_medica",
        texto: "Seguir a recomendação médica à risca",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { resistencia: 2 }, relacoesInternas: 5, narrativa: "A prevenção evita uma lesão maior no médio prazo." } },
        ],
      },
      {
        id: "insistir_em_jogar_apesar_da_recomendacao",
        texto: "Insistir em jogar apesar da recomendação",
        resultados: [
          { probabilidade: 0.4, impacto: { moral: 8, narrativa: "Você joga bem e a decisão parece ter valido a pena dessa vez." } },
          { probabilidade: 0.6, impacto: { atributos: { resistencia: -5 }, moral: -15, narrativa: "A insistência custa uma lesão que poderia ter sido evitada." } },
        ],
      },
    ],
  },
  {
    id: "retorno_de_lesao_com_receio_de_recair",
    titulo: "Retorno de lesão com receio de recair",
    descricao: "De volta aos gramados após uma lesão longa, um receio silencioso de recair te acompanha.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "jogar_com_confianca_total",
        texto: "Jogar com confiança total, sem se poupar",
        resultados: [
          { probabilidade: 0.65, impacto: { atributos: { frieza: 2 }, moral: 10, narrativa: "A confiança total ajuda a recuperar seu melhor nível rapidamente." } },
          { probabilidade: 0.35, impacto: { atributos: { resistencia: -3 }, moral: -10, narrativa: "O receio se confirma parcialmente, com um novo desconforto na região." } },
        ],
      },
      {
        id: "voltar_com_cautela_gradual",
        texto: "Voltar com cautela, aumentando a carga aos poucos",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { resistencia: 1 }, narrativa: "A volta gradual é mais segura, mesmo que mais lenta." } },
        ],
      },
    ],
  },
  {
    id: "comparacao_com_geracao_anterior_do_clube",
    titulo: "Comparação com a geração anterior do clube",
    descricao: "A imprensa compara sua geração atual do time com uma geração vitoriosa do passado do clube.",
    opcoes: [
      {
        id: "assumir_a_comparacao_como_meta",
        texto: "Assumir a comparação como meta a perseguir",
        resultados: [
          { probabilidade: 0.5, impacto: { moral: 10, reputacaoRegional: 8, narrativa: "A meta inspira o grupo, que passa a jogar à altura da comparação." } },
          { probabilidade: 0.5, impacto: { moral: -10, narrativa: "A comparação pesa demais e o grupo parece nunca estar à altura." } },
        ],
      },
      {
        id: "descartar_a_comparacao",
        texto: "Descartar a comparação, focando no presente",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "O grupo prefere construir sua própria identidade, sem olhar pro passado." } },
        ],
      },
    ],
  },
  {
    id: "proposta_de_ser_voz_do_elenco_em_negociacao_coletiva",
    titulo: "Proposta de ser voz do elenco em negociação",
    descricao: "O elenco escolhe você como representante numa negociação coletiva com a diretoria sobre condições de trabalho.",
    gatilho: { relacoesInternasMinima: 55 },
    opcoes: [
      {
        id: "aceitar_representar_o_elenco",
        texto: "Aceitar representar o elenco na negociação",
        resultados: [
          { probabilidade: 0.6, impacto: { atributos: { lideranca: 3 }, relacoesInternas: 12, narrativa: "A negociação é bem-sucedida, e sua liderança sai fortalecida perante o grupo." } },
          { probabilidade: 0.4, impacto: { relacoesInternas: -8, narrativa: "A negociação não avança, e parte do grupo fica frustrada com o resultado." } },
        ],
      },
      {
        id: "sugerir_outro_representante",
        texto: "Sugerir que outro jogador mais experiente represente o grupo",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 3, narrativa: "O grupo respeita sua escolha e segue com outro representante." } },
        ],
      },
    ],
  },
  {
    id: "dilema_de_jogar_amistoso_de_selecao_com_risco_de_lesao",
    titulo: "Amistoso de seleção com risco de lesão",
    descricao: "Um amistoso de seleção sem grande importância competitiva ainda assim carrega risco físico real.",
    gatilho: { reputacaoNacionalMinima: 35 },
    opcoes: [
      {
        id: "jogar_o_amistoso_normalmente",
        texto: "Jogar o amistoso normalmente",
        resultados: [
          { probabilidade: 0.8, impacto: { reputacao: 5, narrativa: "O amistoso passa sem incidentes, e sua presença é bem avaliada." } },
          { probabilidade: 0.2, impacto: { atributos: { resistencia: -4 }, moral: -12, narrativa: "Um lance banal do amistoso resulta numa lesão que ninguém esperava." } },
        ],
      },
      {
        id: "pedir_para_jogar_so_um_tempo",
        texto: "Pedir pra jogar só uma parte do amistoso",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "A gestão de risco é aceita pela comissão da seleção, sem problemas." } },
        ],
      },
    ],
  },
  {
    id: "pedido_de_torcedor_para_participar_de_casamento",
    titulo: "Torcedor pede participação em casamento",
    descricao: "Um torcedor fervoroso pede que você grave uma mensagem surpresa pro casamento dele.",
    gatilho: { reputacaoRegionalMinima: 20 },
    opcoes: [
      {
        id: "gravar_a_mensagem_para_o_casamento",
        texto: "Gravar a mensagem surpresa",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 10, moral: 5, narrativa: "A surpresa emociona o casal e viraliza como um gesto genuíno de carinho." } },
        ],
      },
      {
        id: "nao_conseguir_gravar_a_tempo",
        texto: "Não conseguir gravar a tempo por conta da agenda",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: -3, narrativa: "O torcedor entende, mas fica visivelmente decepcionado." } },
        ],
      },
    ],
  },
  {
    id: "entrevista_sobre_planos_pos_aposentadoria",
    titulo: "Entrevista sobre planos pós-aposentadoria",
    descricao: "Um jornalista pergunta diretamente sobre seus planos pra depois de encerrar a carreira de jogador.",
    gatilho: { idadeMinima: 30 },
    opcoes: [
      {
        id: "compartilhar_planos_detalhados",
        texto: "Compartilhar planos detalhados pro pós-carreira",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 6, narrativa: "A maturidade em falar do futuro é bem recebida pelo público." } },
        ],
      },
      {
        id: "evitar_falar_do_futuro",
        texto: "Evitar falar do assunto, focando só no presente",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere manter o foco total no momento atual da carreira." } },
        ],
      },
    ],
  },
  {
    id: "convite_para_ser_jurado_de_premiacao_esportiva",
    titulo: "Convite pra ser jurado de premiação esportiva",
    descricao: "Você é convidado pra integrar o júri de uma premiação anual do futebol nacional.",
    gatilho: { reputacaoNacionalMinima: 50 },
    opcoes: [
      {
        id: "aceitar_ser_jurado",
        texto: "Aceitar o convite pra ser jurado",
        resultados: [
          { probabilidade: 0.7, impacto: { reputacao: 8, narrativa: "Sua participação no júri é vista como reconhecimento da sua bagagem no esporte." } },
          { probabilidade: 0.3, impacto: { reputacao: -5, narrativa: "Um voto polêmico seu no júri gera crítica pública." } },
        ],
      },
      {
        id: "recusar_ser_jurado",
        texto: "Recusar, preferindo não opinar sobre outros jogadores",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere manter distância desse tipo de julgamento público." } },
        ],
      },
    ],
  },
  {
    id: "disputa_judicial_de_imagem",
    titulo: "Disputa judicial pelo uso da sua imagem",
    descricao: "Uma empresa usa sua imagem sem autorização numa campanha publicitária.",
    gatilho: { reputacaoNacionalMinima: 30 },
    opcoes: [
      {
        id: "processar_pelo_uso_indevido",
        texto: "Processar a empresa pelo uso indevido",
        resultados: [
          { probabilidade: 0.7, impacto: { reputacao: 8, moral: 5, narrativa: "A ação é bem-sucedida e reforça o respeito pela sua imagem." } },
          { probabilidade: 0.3, impacto: { moral: -5, narrativa: "O processo se arrasta na justiça sem uma resolução rápida." } },
        ],
      },
      {
        id: "resolver_de_forma_amigavel",
        texto: "Resolver de forma amigável, sem processo",
        resultados: [
          { probabilidade: 1, impacto: { moral: 3, narrativa: "A resolução amigável evita desgaste, mesmo sem grande repercussão." } },
        ],
      },
    ],
  },
  {
    id: "vazamento_de_valor_salarial",
    titulo: "Vazamento do valor do seu salário",
    descricao: "Seu valor salarial vaza pra imprensa, gerando debate público sobre o tema.",
    gatilho: { reputacaoNacionalMinima: 30 },
    opcoes: [
      {
        id: "comentar_o_vazamento_salarial",
        texto: "Comentar publicamente sobre o vazamento",
        resultados: [
          { probabilidade: 0.4, impacto: { reputacao: 5, narrativa: "O comentário equilibrado ajuda a contextualizar o valor divulgado." } },
          { probabilidade: 0.6, impacto: { reputacao: -8, relacoesInternas: -5, narrativa: "O comentário rende ainda mais debate, incomodando a diretoria." } },
        ],
      },
      {
        id: "nao_comentar_o_vazamento",
        texto: "Não comentar o vazamento salarial",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "O assunto perde força naturalmente com o tempo." } },
        ],
      },
    ],
  },
  {
    id: "proposta_de_reality_show_do_clube",
    titulo: "Proposta de reality show institucional do clube",
    descricao: "O clube propõe um reality show institucional mostrando o dia a dia do CT, incluindo você.",
    opcoes: [
      {
        id: "topar_o_reality_institucional",
        texto: "Topar participar do reality institucional",
        resultados: [
          { probabilidade: 0.6, impacto: { reputacaoRegional: 10, narrativa: "O reality aproxima a torcida do dia a dia do elenco de forma positiva." } },
          { probabilidade: 0.4, impacto: { relacoesInternas: -5, narrativa: "Alguns companheiros não gostam da exposição extra gerada pelo programa." } },
        ],
      },
      {
        id: "participar_minimamente_do_reality",
        texto: "Participar apenas do mínimo necessário",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Sua presença discreta no programa passa despercebida." } },
        ],
      },
    ],
  },
  {
    id: "mudanca_de_horario_de_jogos_por_transmissao",
    titulo: "Mudança de horário de jogos por transmissão",
    descricao: "A emissora de TV solicita mudança nos horários dos jogos pra melhor audiência, afetando a rotina do elenco.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "aceitar_a_mudanca_de_horario",
        texto: "Aceitar a mudança de horário sem questionar",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 3, narrativa: "A flexibilidade é bem vista pela diretoria e pela emissora." } },
        ],
      },
      {
        id: "questionar_o_impacto_na_rotina",
        texto: "Questionar o impacto na rotina de preparação",
        resultados: [
          { probabilidade: 0.5, impacto: { relacoesInternas: 3, narrativa: "O questionamento leva a pequenos ajustes que ajudam a rotina do elenco." } },
          { probabilidade: 0.5, impacto: { relacoesInternas: -5, narrativa: "O questionamento é ignorado, mas fica registrado como reclamação." } },
        ],
      },
    ],
  },
  {
    id: "jogo_em_altitude_elevada_no_exterior",
    titulo: "Jogo em altitude elevada no exterior",
    descricao: "Uma competição continental leva você a jogar numa cidade de altitude elevada, dificultando a respiração.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "seguir_protocolo_de_adaptacao_de_altitude",
        texto: "Seguir o protocolo de adaptação de altitude do clube",
        resultados: [
          { probabilidade: 0.75, impacto: { atributos: { resistencia: 2 }, narrativa: "O protocolo de adaptação funciona bem, minimizando o desconforto." } },
          { probabilidade: 0.25, impacto: { moral: -5, narrativa: "Mesmo com o protocolo, a altitude cobra um preço físico alto na partida." } },
        ],
      },
      {
        id: "jogar_sem_adaptacao_especial",
        texto: "Jogar sem nenhuma adaptação especial",
        resultados: [
          { probabilidade: 0.3, impacto: { narrativa: "Surpreendentemente, seu corpo reage bem mesmo sem adaptação." } },
          { probabilidade: 0.7, impacto: { atributos: { resistencia: -4 }, moral: -10, narrativa: "A falta de adaptação pesa muito na sua atuação em campo." } },
        ],
      },
    ],
  },
  {
    id: "reforco_contratado_na_mesma_posicao",
    titulo: "Reforço de peso contratado na sua posição",
    descricao: "O clube anuncia a contratação de um reforço badalado exatamente na sua posição.",
    gatilho: { momentos: ["pre_temporada"] },
    opcoes: [
      {
        id: "encarar_como_motivacao_extra",
        texto: "Encarar a chegada como motivação extra",
        resultados: [
          { probabilidade: 0.6, impacto: { atributos: { frieza: 2 }, moral: 8, narrativa: "A concorrência saudável eleva seu nível de jogo consideravelmente." } },
          { probabilidade: 0.4, impacto: { moral: -10, narrativa: "A chegada do reforço abala sua confiança sobre o futuro no clube." } },
        ],
      },
      {
        id: "pedir_esclarecimentos_sobre_o_plano",
        texto: "Pedir esclarecimentos diretos sobre o plano da comissão",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 3, narrativa: "A conversa franca esclarece o papel de cada um dentro do novo planejamento." } },
        ],
      },
    ],
  },
  {
    id: "pressao_por_gols_decisivos_em_mata_mata",
    titulo: "Pressão por gols decisivos em mata-mata",
    descricao: "Numa fase de mata-mata, a expectativa por gols decisivos seus cresce a cada rodada eliminatória.",
    gatilho: { momentos: ["reta_final"] },
    opcoes: [
      {
        id: "abracar_o_protagonismo_no_mata_mata",
        texto: "Abraçar o protagonismo nos jogos decisivos",
        resultados: [
          { probabilidade: 0.5, impacto: { reputacao: 15, moral: 12, narrativa: "Você entrega gols decisivos e vira o nome do mata-mata inteiro." } },
          { probabilidade: 0.5, impacto: { moral: -12, narrativa: "A pressão por protagonismo pesa, e as chances decisivas não convertem." } },
        ],
      },
      {
        id: "jogar_de_forma_coletiva_no_mata_mata",
        texto: "Jogar de forma mais coletiva, sem buscar o protagonismo",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 5, narrativa: "O jogo coletivo ajuda o time a avançar, mesmo sem grandes números individuais seus." } },
        ],
      },
    ],
  },
  {
    id: "oferta_de_bicampeonato_bonus_contratual",
    titulo: "Bônus contratual por bicampeonato",
    descricao: "A diretoria propõe um bônus contratual extra caso o time conquiste o bicampeonato na temporada.",
    gatilho: { momentos: ["reta_final"] },
    opcoes: [
      {
        id: "aceitar_a_meta_de_bicampeonato",
        texto: "Aceitar a meta com entusiasmo",
        resultados: [
          { probabilidade: 0.5, impacto: { moral: 12, reputacao: 10, narrativa: "A meta ambiciosa motiva o grupo inteiro ao longo da temporada." } },
          { probabilidade: 0.5, impacto: { moral: -8, narrativa: "A meta alta demais vira fonte extra de pressão desnecessária." } },
        ],
      },
      {
        id: "tratar_como_meta_normal",
        texto: "Tratar como só mais uma meta normal da temporada",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "A meta é encarada com tranquilidade, sem alarde extra." } },
        ],
      },
    ],
  },
  {
    id: "rescisao_amigavel_proposta_pelo_clube",
    titulo: "Proposta de rescisão amigável",
    descricao: "Fora dos planos técnicos, o clube propõe uma rescisão amigável de contrato antes do previsto.",
    gatilho: { momentos: ["pre_temporada"] },
    opcoes: [
      {
        id: "aceitar_a_rescisao_amigavel",
        texto: "Aceitar a rescisão amigável",
        resultados: [
          { probabilidade: 0.6, impacto: { moral: 5, reputacao: 3, narrativa: "A saída negociada abre espaço pra uma nova oportunidade em outro clube." } },
          { probabilidade: 0.4, impacto: { moral: -12, narrativa: "A saída antecipada pesa emocionalmente mais do que o esperado." } },
        ],
      },
      {
        id: "recusar_a_rescisao_e_lutar_por_espaco",
        texto: "Recusar e lutar por espaço dentro do elenco",
        resultados: [
          { probabilidade: 0.4, impacto: { relacoesInternas: 5, moral: 8, narrativa: "A luta por espaço é recompensada com uma reviravolta na sua situação." } },
          { probabilidade: 0.6, impacto: { relacoesInternas: -10, moral: -10, narrativa: "A recusa gera um ambiente desconfortável, sem mudar o cenário técnico." } },
        ],
      },
    ],
  },
  {
    id: "convite_para_selecao_permanente_de_lendas",
    titulo: "Convite pra seleção permanente de lendas",
    descricao: "Uma organização internacional convida você a integrar permanentemente uma seleção de lendas do futebol.",
    gatilho: { reputacaoNacionalMinima: 70, idadeMinima: 32 },
    opcoes: [
      {
        id: "aceitar_integrar_selecao_de_lendas",
        texto: "Aceitar integrar a seleção de lendas",
        resultados: [
          { probabilidade: 1, impacto: { reputacao: 12, narrativa: "O convite reforça publicamente seu status entre os grandes nomes do esporte." } },
        ],
      },
      {
        id: "recusar_selecao_de_lendas",
        texto: "Recusar, preferindo focar na carreira ativa",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "Você prefere manter o foco total na carreira que ainda está em curso." } },
        ],
      },
    ],
  },
  {
    id: "pedido_de_desculpas_publicas_por_declaracao_polemica",
    titulo: "Pedido de desculpas por declaração polêmica",
    descricao: "Uma declaração sua, tirada de contexto ou não, gera pedidos públicos de desculpas.",
    opcoes: [
      {
        id: "pedir_desculpas_publicamente",
        texto: "Pedir desculpas publicamente",
        resultados: [
          { probabilidade: 0.7, impacto: { reputacao: 8, narrativa: "O pedido sincero de desculpas é bem recebido e encerra a polêmica." } },
          { probabilidade: 0.3, impacto: { reputacao: -5, narrativa: "O pedido soa pouco sincero e não convence totalmente o público." } },
        ],
      },
      {
        id: "manter_a_declaracao_original",
        texto: "Manter a declaração original, sem recuar",
        resultados: [
          { probabilidade: 0.4, impacto: { reputacao: 5, narrativa: "A firmeza é respeitada por quem concorda com o ponto original." } },
          { probabilidade: 0.6, impacto: { reputacao: -12, narrativa: "A falta de recuo prolonga bastante a polêmica." } },
        ],
      },
    ],
  },
  {
    id: "reencontro_com_torcida_apos_longa_lesao",
    titulo: "Reencontro com a torcida após longa lesão",
    descricao: "Depois de meses afastado por lesão grave, você finalmente reencontra a torcida no estádio.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "fazer_um_gesto_de_gratidao_a_torcida",
        texto: "Fazer um gesto de gratidão à torcida pelo apoio durante a lesão",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 15, moral: 10, narrativa: "O gesto de gratidão emociona o estádio inteiro no seu retorno." } },
        ],
      },
      {
        id: "focar_apenas_no_jogo_no_retorno",
        texto: "Focar apenas no jogo, sem gestos especiais",
        resultados: [
          { probabilidade: 1, impacto: { moral: 5, narrativa: "O retorno discreto ainda assim é celebrado pela torcida presente." } },
        ],
      },
    ],
  },
  {
    id: "ultimo_jogo_da_temporada_decisao_de_permanencia",
    titulo: "Último jogo da temporada e decisão de permanência",
    descricao: "No último jogo da temporada, com o contrato perto do fim, você precisa sinalizar sua decisão sobre o futuro no clube.",
    gatilho: { momentos: ["reta_final"] },
    opcoes: [
      {
        id: "anunciar_permanencia_no_ultimo_jogo",
        texto: "Anunciar a permanência já no último jogo da temporada",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 15, relacoesInternas: 8, narrativa: "O anúncio no último jogo vira uma festa emocionante com a torcida." } },
        ],
      },
      {
        id: "deixar_a_decisao_para_a_pausa_da_temporada",
        texto: "Deixar a decisão pra depois, durante a pausa da temporada",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "A decisão fica pra ser anunciada com calma, fora do calor do último jogo." } },
        ],
      },
    ],
  },
  {
    id: "goleiro_avanca_para_escanteio_decisivo",
    titulo: "Goleiro avança pro escanteio decisivo",
    descricao: "Nos acréscimos de um jogo que seu time precisa vencer, a comissão sinaliza pro goleiro subir pro escanteio ofensivo.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "apoiar_a_subida_do_goleiro",
        texto: "Apoiar a subida arriscada do goleiro",
        resultados: [
          { probabilidade: 0.35, impacto: { moral: 15, reputacaoRegional: 12, narrativa: "A jogada arriscada dá certo, e o gol nos acréscimos vira história." } },
          { probabilidade: 0.65, impacto: { moral: -10, narrativa: "A jogada não funciona, e o time ainda sofre um contra-ataque perigoso no fim." } },
        ],
      },
      {
        id: "sugerir_manter_o_goleiro_atras",
        texto: "Sugerir manter o goleiro atrás por segurança",
        resultados: [
          { probabilidade: 1, impacto: { relacoesInternas: 2, narrativa: "A cautela é respeitada, ainda que o empate se mantenha até o fim." } },
        ],
      },
    ],
  },
  {
    id: "jogo_adiado_por_problemas_no_gramado",
    titulo: "Jogo adiado por problemas no gramado",
    descricao: "Um jogo muito aguardado é adiado de última hora por problemas estruturais no gramado do estádio.",
    gatilho: { momentos: ["temporada_regular", "reta_final"] },
    opcoes: [
      {
        id: "manter_a_rotina_apesar_do_adiamento",
        texto: "Manter a rotina de preparação apesar do adiamento",
        resultados: [
          { probabilidade: 1, impacto: { atributos: { frieza: 1 }, narrativa: "A disciplina em manter a rotina ajuda a não perder o ritmo competitivo." } },
        ],
      },
      {
        id: "aproveitar_o_adiamento_para_descansar",
        texto: "Aproveitar o adiamento pra descansar mais",
        resultados: [
          { probabilidade: 0.6, impacto: { atributos: { resistencia: 2 }, narrativa: "O descanso extra chega bem, recarregando as energias." } },
          { probabilidade: 0.4, impacto: { moral: -5, narrativa: "A quebra de rotina atrapalha um pouco o ritmo competitivo do time." } },
        ],
      },
    ],
  },
  {
    id: "torcedor_famoso_elogia_publicamente",
    titulo: "Torcedor famoso elogia você publicamente",
    descricao: "Uma celebridade torcedora do seu clube te elogia publicamente nas redes sociais depois de uma boa atuação.",
    gatilho: { reputacaoNacionalMinima: 30 },
    opcoes: [
      {
        id: "agradecer_o_elogio_publicamente",
        texto: "Agradecer o elogio publicamente",
        resultados: [
          { probabilidade: 0.85, impacto: { reputacao: 8, narrativa: "A troca simpática entre vocês viraliza de forma bem positiva." } },
          { probabilidade: 0.15, impacto: { reputacao: -3, narrativa: "A resposta soa deslocada, e alguns veem como bajulação à celebridade." } },
        ],
      },
      {
        id: "nao_comentar_o_elogio",
        texto: "Não comentar publicamente o elogio",
        resultados: [
          { probabilidade: 1, impacto: { narrativa: "O elogio circula sozinho pelas redes, sem sua participação direta." } },
        ],
      },
    ],
  },
  {
    id: "convite_para_clinica_de_futebol_infantil",
    titulo: "Convite pra clínica de futebol infantil",
    descricao: "Uma escolinha de futebol na sua região de origem te convida pra dar uma clínica especial pras crianças.",
    gatilho: { reputacaoRegionalMinima: 15 },
    opcoes: [
      {
        id: "dar_a_clinica_pessoalmente",
        texto: "Dar a clínica pessoalmente pras crianças",
        resultados: [
          { probabilidade: 0.9, impacto: { reputacaoRegional: 15, moral: 8, narrativa: "A clínica emociona as crianças e as famílias, e vira um marco na comunidade." } },
          { probabilidade: 0.1, impacto: { atributos: { resistencia: -1 }, narrativa: "O dia intenso de atividades cansa mais do que o esperado." } },
        ],
      },
      {
        id: "enviar_equipamentos_em_vez_de_ir",
        texto: "Enviar equipamentos esportivos em vez de comparecer",
        resultados: [
          { probabilidade: 1, impacto: { reputacaoRegional: 6, narrativa: "A doação de equipamentos já ajuda bastante, mesmo sem sua presença." } },
        ],
      },
    ],
  },
];
