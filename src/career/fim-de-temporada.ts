import type { Club } from "../schemas/club.js";
import { calcularValorDeMercado, type PerfilDeMercado } from "../market/valuation.js";
import { gerarProposta, selecionarClubesInteressados, type PropostaTransferencia } from "../market/transfers.js";
import { obterRating } from "../simulation/rating.js";
import { multiplicadorDeValorizacaoPorStatus } from "./status.js";
import { assinarContrato, overallAtual, type EstadoDeCarreira } from "./Player.js";

/**
 * Tela dedicada de fim de temporada (resumo → propostas/renovação → próxima
 * temporada) — substitui a negociação de transferência real que antes
 * acontecia espalhada nos cenários narrativos da pré-temporada
 * (`career/career-loop.ts` `ContextoResolucaoDePeriodo.desativarNegociacaoNarrativa`,
 * ligado por quem usa este módulo pra não oferecer a mesma proposta duas
 * vezes). Reaproveita 100% da lógica de mercado já existente
 * (`market/transfers.ts`) — a "renovação" do clube atual nada mais é que
 * `gerarProposta` aplicada a ele mesmo, sem nenhuma fórmula nova.
 */

export interface PropostasDeFimDeTemporada {
  /** Propostas de OUTROS clubes (transferência) — pode vir vazia (nenhum clube interessado nesta janela). */
  propostas: PropostaTransferencia[];
  /** Proposta de renovação do PRÓPRIO clube atual — `undefined` só se o jogador não tiver clube (não deveria acontecer em uso normal, carreira sempre começa com um clube). */
  renovacao?: PropostaTransferencia;
}

const MAX_PROPOSTAS_EXTERNAS = 3;

/**
 * Gera as propostas de fim de temporada — chamado 1x, depois do resumo da
 * temporada que terminou e antes de iniciar a próxima. Não muda `estado`
 * (puro); quem chama aplica a escolha do jogador via `aplicarEscolhaDeFimDeTemporada`.
 */
export function gerarPropostasDeFimDeTemporada(estado: EstadoDeCarreira, clubes: Club[], random: () => number = Math.random): PropostasDeFimDeTemporada {
  const clubeAtual = clubes.find((c) => c.id === estado.clubeAtualId);
  const ratingClubeAtual = clubeAtual ? obterRating(clubeAtual) : 0;

  const perfil: PerfilDeMercado = {
    overall: overallAtual(estado),
    idade: estado.jogador.idade,
    reputacaoNacional: estado.reputacao.nacional,
    multiplicadorStatus: multiplicadorDeValorizacaoPorStatus(estado.statusNoClube),
  };
  const valorDeMercado = calcularValorDeMercado(perfil);

  const interessados = selecionarClubesInteressados(clubes, estado.clubeAtualId, perfil, { random }).slice(0, MAX_PROPOSTAS_EXTERNAS);
  const propostas = interessados.map((clube) => gerarProposta(clube, valorDeMercado, estado.statusNoClube, estado.jogador.idade, ratingClubeAtual, random));

  // Renovação: mesma fórmula de proposta, só que o "clube ofertante" é o próprio clube atual — sem
  // salto de rating (`ratingClubeAtual` nos dois lados), então o status oferecido reflete continuar
  // como está, não uma promoção.
  const renovacao = clubeAtual ? gerarProposta(clubeAtual, valorDeMercado, estado.statusNoClube, estado.jogador.idade, ratingClubeAtual, random) : undefined;

  return { propostas, renovacao };
}

export type EscolhaDeFimDeTemporada =
  | { tipo: "renovar" }
  | { tipo: "transferir"; clubeOfertanteId: string }
  | { tipo: "ficar_sem_assinar" };

/**
 * Aplica a escolha do jogador sobre as propostas de fim de temporada — assina o contrato
 * correspondente (`career/Player.ts` `assinarContrato`) pra "renovar"/"transferir", ou devolve o
 * estado sem mudança pra "ficar_sem_assinar" (mantém o clube/contrato atuais como estavam, sem
 * assinar nada de novo).
 */
export function aplicarEscolhaDeFimDeTemporada(estado: EstadoDeCarreira, propostas: PropostasDeFimDeTemporada, escolha: EscolhaDeFimDeTemporada): EstadoDeCarreira {
  if (escolha.tipo === "ficar_sem_assinar") return estado;

  const proposta = escolha.tipo === "renovar" ? propostas.renovacao : propostas.propostas.find((p) => p.clubeOfertanteId === escolha.clubeOfertanteId);
  if (!proposta) return estado;

  return assinarContrato(
    estado,
    {
      clubeId: proposta.clubeOfertanteId,
      salarioMensal: proposta.propostaInicial.salarioMensal,
      luvas: proposta.propostaInicial.luvas,
      clausulaRescisao: proposta.propostaInicial.salarioMensal * 12 * (proposta.propostaInicial.anos + 1),
      anos: proposta.propostaInicial.anos,
      temporadaAssinatura: estado.temporada,
    },
    proposta.statusOferecido,
  );
}
