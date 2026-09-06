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
