import type { Cenario } from "./scenarios.js";

/**
 * Eventos de contexto que podem acontecer **durante** uma partida ao vivo
 * (`simulation/live-match.ts` `jogarPartidaAoVivo`), sorteados e resolvidos
 * junto com as chances de gol do jogador — cartão duvidoso, provocação da
 * torcida, cãibra, etc. Reaproveita o mesmo formato de `progression/
 * scenarios.ts` (`Cenario`/`Opcao`/`ResultadoPossivel`, `sortearCenario`,
 * `resolverEscolha`, `aplicarImpacto`) só que num catálogo **separado e bem
 * menor**, escopado pra coisas que fazem sentido no calor do jogo — não
 * reaproveita o catálogo principal (`CENARIOS`) porque a maioria dele é
 * sobre decisões fora de campo/entre partidas (contrato, imprensa, vida
 * pessoal), sem sentido como pausa no meio de uma partida.
 *
 * Sem `gatilho`: ao contrário do catálogo principal, aqui não há contexto
 * de carreira (idade/reputação/momento da temporada) disponível no motor
 * de partida (`simulation/*` não depende de `career/*`) — todo evento é
 * elegível sempre, e quem decide SE algum evento acontece (e com que
 * frequência) é `jogarPartidaAoVivo`, não este catálogo.
 *
 * Deltas só em `moral`/`relacoesInternas` (nunca `atributos`) de propósito:
 * um evento de partida não tem acesso à posição do jogador aqui (só ao
 * `Cenario`/`Opcao` puros), e mexer num atributo fora da lista da posição
 * dele (`schemas/player.ts` `ATRIBUTOS_POR_POSICAO`) criaria um campo
 * "órfão" sem efeito em `calcularOverall`. Moral/relações internas são
 * universais, valem pra qualquer posição.
 */
export const EVENTOS_DE_PARTIDA: Cenario[] = [
  {
    id: "cartao_duvidoso_ao_vivo",
    titulo: "Cartão duvidoso",
    descricao: "O árbitro te mostra um cartão amarelo que você considera injusto, no calor do jogo.",
    opcoes: [
      {
        id: "reclamar",
        texto: "Reclamar abertamente com o árbitro",
        resultados: [
          { probabilidade: 0.35, impacto: { moral: 5, narrativa: "A reclamação é firme mas respeitosa — a torcida aprova a atitude." } },
          { probabilidade: 0.65, impacto: { moral: -10, narrativa: "O árbitro não gosta da insistência e o clima do jogo piora pra você." } },
        ],
      },
      {
        id: "manter_a_calma",
        texto: "Engolir a injustiça e seguir jogando",
        resultados: [{ probabilidade: 1, impacto: { moral: 2, narrativa: "Você mantém o foco e segue no jogo sem se abalar." } }],
      },
    ],
  },
  {
    id: "disputa_de_bola_no_choque",
    titulo: "Disputa dura de bola",
    descricao: "Numa dividida forte, você sente um desconforto — dá pra seguir, mas dói.",
    opcoes: [
      {
        id: "insistir_na_disputa",
        texto: "Insistir, entrar forte na próxima disputa também",
        resultados: [
          { probabilidade: 0.6, impacto: { moral: 3, narrativa: "Você impõe respeito e ganha a próxima bola dividida também." } },
          { probabilidade: 0.4, impacto: { moral: -12, narrativa: "O desconforto piora e você passa o resto da partida sentindo." } },
        ],
      },
      {
        id: "jogar_por_fora",
        texto: "Jogar por fora da disputa até passar o incômodo",
        resultados: [{ probabilidade: 1, impacto: { moral: -2, narrativa: "Você se poupa, mas perde intensidade no jogo por alguns minutos." } }],
      },
    ],
  },
  {
    id: "provocacao_da_torcida_rival",
    titulo: "Provocação da torcida rival",
    descricao: "A torcida do adversário vem com tudo pra tirar seu foco.",
    opcoes: [
      {
        id: "responder_a_provocacao",
        texto: "Responder à provocação (gesto pra torcida)",
        resultados: [
          { probabilidade: 0.5, impacto: { moral: 10, narrativa: "A resposta empolga você e desmonta o clima criado pela torcida rival." } },
          { probabilidade: 0.5, impacto: { moral: -8, narrativa: "A provocação rende vaia extra e tira seu foco do jogo." } },
        ],
      },
      {
        id: "ignorar_a_provocacao",
        texto: "Ignorar e manter o foco na bola",
        resultados: [{ probabilidade: 1, impacto: { moral: 2, narrativa: "Você não dá corda e segue concentrado." } }],
      },
    ],
  },
  {
    id: "caibra_no_fim_do_jogo",
    titulo: "Cãibra no fim do jogo",
    descricao: "Faltando minutos, uma cãibra aperta — a comissão técnica pergunta se você aguenta terminar.",
    opcoes: [
      {
        id: "insistir_em_ficar",
        texto: "Insistir em ficar em campo",
        resultados: [
          { probabilidade: 0.55, impacto: { moral: 8, relacoesInternas: 5, narrativa: "Você aguenta até o fim e o gesto de garra é bem visto pelo elenco." } },
          { probabilidade: 0.45, impacto: { moral: -10, narrativa: "A cãibra piora e os últimos minutos são de sofrimento em campo." } },
        ],
      },
      {
        id: "pedir_substituicao",
        texto: "Pedir pra sair",
        resultados: [{ probabilidade: 1, impacto: { moral: 3, relacoesInternas: -2, narrativa: "Você sai por precaução — sensato, ainda que renda algum cochicho no vestiário." } }],
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
          { probabilidade: 0.6, impacto: { moral: 20, narrativa: "Você bate com categoria e vira herói da torcida." } },
          { probabilidade: 0.4, impacto: { moral: -25, narrativa: "A cobrança sai errada e o silêncio toma conta do estádio." } },
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
    id: "assumir_cobranca_de_falta_decisiva",
    titulo: "Cobrança de falta decisiva",
    descricao: "Falta na entrada da área, no fim de um jogo empatado — alguém precisa bater.",
    opcoes: [
      {
        id: "bater_a_falta",
        texto: "Bater a falta você mesmo",
        resultados: [
          { probabilidade: 0.45, impacto: { moral: 20, narrativa: "A bola encobre a barreira e entra — momento inesquecível." } },
          { probabilidade: 0.55, impacto: { moral: -8, narrativa: "A cobrança sai por cima do travessão, sem susto pro goleiro." } },
        ],
      },
      {
        id: "ceder_a_cobranca",
        texto: "Ceder a cobrança pro especialista do time",
        resultados: [{ probabilidade: 1, impacto: { relacoesInternas: 2, narrativa: "A decisão tática é respeitada por todos, seja qual for o resultado da falta." } }],
      },
    ],
  },
  {
    id: "gol_contra",
    titulo: "Gol contra num momento crucial",
    descricao: "Um desvio infeliz seu resulta num gol contra em um momento crucial da partida.",
    opcoes: [
      {
        id: "pedir_a_bola_de_novo_rapido",
        texto: "Pedir a bola de novo o mais rápido possível",
        resultados: [
          { probabilidade: 0.5, impacto: { moral: 7, narrativa: "A reação rápida vira redenção instantânea aos olhos da torcida." } },
          { probabilidade: 0.5, impacto: { moral: -15, narrativa: "O peso do erro te acompanha pelo resto da partida." } },
        ],
      },
      {
        id: "pedir_um_momento_para_se_recompor",
        texto: "Pedir um momento pra se recompor mentalmente",
        resultados: [{ probabilidade: 1, impacto: { moral: -5, narrativa: "Você segue o jogo com a cabeça mais tranquila, mesmo abalado." } }],
      },
    ],
  },
  {
    id: "comemoracao_polemica",
    titulo: "Comemoração polêmica de gol",
    descricao: "Depois de marcar um gol importante, você pensa numa comemoração que pode ser vista como provocação.",
    opcoes: [
      {
        id: "fazer_a_comemoracao_provocativa",
        texto: "Fazer a comemoração provocativa mesmo assim",
        resultados: [
          { probabilidade: 0.45, impacto: { moral: 12, narrativa: "A torcida ama a ousadia e a comemoração vira ícone da rivalidade." } },
          { probabilidade: 0.55, impacto: { moral: -10, narrativa: "A comemoração rende punição da federação e crítica generalizada." } },
        ],
      },
      {
        id: "comemorar_de_forma_neutra",
        texto: "Comemorar de forma neutra",
        resultados: [{ probabilidade: 1, impacto: { moral: 2, narrativa: "A comemoração discreta não gera nenhuma polêmica." } }],
      },
    ],
  },
  {
    id: "discussao_com_colega_durante_o_jogo",
    titulo: "Discussão com colega em campo",
    descricao: "No calor do jogo, uma falha de entrosamento gera uma discussão acalorada com um companheiro em campo.",
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
        resultados: [{ probabilidade: 1, impacto: { relacoesInternas: 2, narrativa: "A postura profissional evita imagem ruim em campo." } }],
      },
    ],
  },
  {
    id: "quase_expulsao",
    titulo: "Quase expulso em jogo tenso",
    descricao: "Numa partida de clima muito tenso, você chega perto de ser expulso após um lance polêmico.",
    opcoes: [
      {
        id: "se_conter_no_limite",
        texto: "Se conter no limite e seguir jogando",
        resultados: [
          { probabilidade: 0.7, impacto: { moral: 5, narrativa: "O autocontrole no limite evita o pior e você segue em campo." } },
          { probabilidade: 0.3, impacto: { moral: -12, narrativa: "O árbitro decide expulsar você mesmo com a contenção." } },
        ],
      },
      {
        id: "pedir_substituicao_preventiva",
        texto: "Pedir pra sair antes de piorar",
        resultados: [{ probabilidade: 1, impacto: { relacoesInternas: 3, narrativa: "A saída preventiva é vista como madura pela comissão técnica." } }],
      },
    ],
  },
  {
    id: "tirado_no_intervalo",
    titulo: "Substituído no intervalo",
    descricao: "O técnico decide te tirar de campo logo no intervalo, sem uma explicação clara.",
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
        resultados: [{ probabilidade: 1, impacto: { relacoesInternas: 4, moral: -3, narrativa: "A postura profissional é notada, mesmo com o desconforto do momento." } }],
      },
    ],
  },
  {
    id: "gesto_de_fair_play",
    titulo: "Oportunidade de um gesto de fair play",
    descricao: "Num lance de jogo, você percebe que poderia se aproveitar de um erro do árbitro em seu favor.",
    opcoes: [
      {
        id: "avisar_o_arbitro_do_erro",
        texto: "Avisar o árbitro sobre o próprio erro",
        resultados: [
          { probabilidade: 0.85, impacto: { moral: 12, narrativa: "O gesto de fair play repercute muito bem e vira referência de esportividade." } },
          { probabilidade: 0.15, impacto: { relacoesInternas: -5, narrativa: "Parte do próprio elenco não gosta de abrir mão de uma vantagem." } },
        ],
      },
      {
        id: "aceitar_a_vantagem",
        texto: "Aceitar a vantagem gerada pelo erro",
        resultados: [{ probabilidade: 1, impacto: { moral: -3, narrativa: "A vantagem ajuda no resultado, mas incomoda quem valoriza o espírito esportivo." } }],
      },
    ],
  },
  {
    id: "calor_extremo_durante_a_partida",
    titulo: "Calor extremo durante a partida",
    descricao: "Uma partida acontece sob calor extremo, exigindo cuidado redobrado com hidratação e ritmo.",
    opcoes: [
      {
        id: "gerenciar_o_ritmo_com_cuidado",
        texto: "Gerenciar o ritmo com cuidado ao longo do jogo",
        resultados: [
          { probabilidade: 0.7, impacto: { moral: 3, narrativa: "O gerenciamento inteligente evita desgaste excessivo." } },
          { probabilidade: 0.3, impacto: { moral: -3, narrativa: "Mesmo com cuidado, o calor extremo cobra seu preço no fim do jogo." } },
        ],
      },
      {
        id: "jogar_no_ritmo_normal_no_calor",
        texto: "Jogar no ritmo normal, ignorando o calor",
        resultados: [
          { probabilidade: 0.4, impacto: { narrativa: "Você aguenta bem o ritmo normal, apesar do calor." } },
          { probabilidade: 0.6, impacto: { moral: -10, narrativa: "A exaustão pelo calor extremo compromete o fim da sua partida." } },
        ],
      },
    ],
  },
  {
    id: "var_anula_gol_polemico",
    titulo: "VAR anula um gol polêmico",
    descricao: "Um gol seu é anulado pelo VAR numa decisão bastante controversa.",
    opcoes: [
      {
        id: "reclamar_com_o_var",
        texto: "Reclamar veementemente da decisão",
        resultados: [
          { probabilidade: 0.35, impacto: { moral: 3, narrativa: "A reclamação inflamada agrada a torcida, mesmo sem mudar o resultado." } },
          { probabilidade: 0.65, impacto: { moral: -14, narrativa: "A reclamação rende cartão amarelo e desgasta ainda mais seu momento." } },
        ],
      },
      {
        id: "aceitar_a_decisao_do_var",
        texto: "Aceitar a decisão e seguir o jogo",
        resultados: [{ probabilidade: 1, impacto: { moral: 3, narrativa: "A serenidade ajuda a manter o foco no restante da partida." } }],
      },
    ],
  },
  {
    id: "goleiro_avanca_para_escanteio_decisivo",
    titulo: "Goleiro avança pro escanteio decisivo",
    descricao: "Nos acréscimos de um jogo que seu time precisa vencer, a comissão sinaliza pro goleiro subir pro escanteio ofensivo.",
    opcoes: [
      {
        id: "apoiar_a_subida_do_goleiro",
        texto: "Apoiar a subida arriscada do goleiro",
        resultados: [
          { probabilidade: 0.35, impacto: { moral: 20, narrativa: "A jogada arriscada dá certo, e o gol nos acréscimos vira história." } },
          { probabilidade: 0.65, impacto: { moral: -10, narrativa: "A jogada não funciona, e o time ainda sofre um contra-ataque perigoso no fim." } },
        ],
      },
      {
        id: "sugerir_manter_o_goleiro_atras",
        texto: "Sugerir manter o goleiro atrás por segurança",
        resultados: [{ probabilidade: 1, impacto: { relacoesInternas: 2, narrativa: "A cautela é respeitada, ainda que o empate se mantenha até o fim." } }],
      },
    ],
  },
  {
    id: "entrevista_ao_vivo_no_intervalo",
    titulo: "Entrevista ao vivo no intervalo",
    descricao: "Você é chamado pra uma entrevista ao vivo bem no intervalo de um jogo apertado.",
    opcoes: [
      {
        id: "falar_com_intensidade",
        texto: "Falar com intensidade sobre o momento do time",
        resultados: [
          { probabilidade: 0.55, impacto: { moral: 8, narrativa: "A intensidade da fala contagia a torcida no segundo tempo." } },
          { probabilidade: 0.45, impacto: { moral: -6, narrativa: "A fala soa arrogante fora de contexto e rende críticas." } },
        ],
      },
      {
        id: "falar_de_forma_serena",
        texto: "Falar de forma serena e ponderada",
        resultados: [{ probabilidade: 1, impacto: { moral: 3, narrativa: "A serenidade transmite confiança sem grandes riscos." } }],
      },
    ],
  },
  {
    id: "crise_de_ansiedade_pre_jogo",
    titulo: "Crise de ansiedade no início do jogo",
    descricao: "Nos primeiros minutos da partida, uma crise de ansiedade forte te pega de surpresa.",
    opcoes: [
      {
        id: "buscar_o_psicologo_do_clube",
        texto: "Buscar apoio da comissão técnica imediatamente",
        resultados: [
          { probabilidade: 0.8, impacto: { moral: 7, narrativa: "O apoio imediato ajuda a controlar a crise a tempo de render no jogo." } },
          { probabilidade: 0.2, impacto: { moral: -10, narrativa: "Mesmo com ajuda, a ansiedade afeta bastante sua atuação nesse jogo." } },
        ],
      },
      {
        id: "tentar_respirar_e_entrar_em_campo",
        texto: "Tentar controlar sozinho e seguir jogando",
        resultados: [
          { probabilidade: 0.4, impacto: { moral: 2, narrativa: "Você consegue se acalmar sozinho a tempo." } },
          { probabilidade: 0.6, impacto: { moral: -12, narrativa: "A crise não controlada compromete bastante sua atuação." } },
        ],
      },
    ],
  },
  {
    id: "arbitro_pede_desculpas_por_erro",
    titulo: "Árbitro pede desculpas por um erro",
    descricao: "Depois de um erro claro de arbitragem contra você, o árbitro procura pra se desculpar em particular.",
    opcoes: [
      {
        id: "aceitar_as_desculpas_do_arbitro",
        texto: "Aceitar as desculpas com tranquilidade",
        resultados: [{ probabilidade: 1, impacto: { moral: 3, narrativa: "A maturidade no momento é notada e respeitada por todos." } }],
      },
      {
        id: "cobrar_publicamente_mesmo_apos_desculpas",
        texto: "Cobrar publicamente mesmo depois das desculpas",
        resultados: [
          { probabilidade: 0.5, impacto: { moral: 4, narrativa: "A cobrança pública reforça a necessidade de mais rigor na arbitragem." } },
          { probabilidade: 0.5, impacto: { moral: -4, narrativa: "A cobrança soa desnecessária depois que o árbitro já reconheceu o erro." } },
        ],
      },
    ],
  },
  {
    id: "cobranca_de_companheiro_apos_erro",
    titulo: "Erro de um companheiro",
    descricao: "Um companheiro erra feio numa jogada que custa uma boa chance sua.",
    opcoes: [
      {
        id: "cobrar_duro",
        texto: "Cobrar duro, na hora",
        resultados: [
          { probabilidade: 0.4, impacto: { relacoesInternas: 5, moral: 3, narrativa: "A cobrança acerta o tom e o time reage, mais concentrado." } },
          { probabilidade: 0.6, impacto: { relacoesInternas: -8, narrativa: "A cobrança pega mal — o clima esfria entre vocês dois pro resto do jogo." } },
        ],
      },
      {
        id: "apoiar_o_companheiro",
        texto: "Dar apoio e seguir em frente",
        resultados: [{ probabilidade: 1, impacto: { relacoesInternas: 5, narrativa: "O gesto de apoio fortalece a relação com o companheiro." } }],
      },
    ],
  },
];
