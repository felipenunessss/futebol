import { useMemo, useState } from "react";
import type { Posicao } from "@motor/schemas/player.js";
import type { Contrato } from "@motor/schemas/contract.js";
import { assinarContrato, criarEstadoInicial, overallAtual, type EstadoDeCarreira } from "@motor/career/Player.js";
import { multiplicadorDeValorizacaoPorStatus } from "@motor/career/status.js";
import { gerarPropostasIniciais, type PropostaTransferencia } from "@motor/market/transfers.js";
import { loadCampeonatosNacionais, loadClubes, loadEstaduais } from "../../data/browserLoaders.js";

/**
 * Estado + regras do wizard de criação de carreira — espelha o fluxo de
 * `src/cli/index.ts` `jogarCarreiraInterativaCli` (nome → nacionalidade →
 * posição → arquétipo → número de camisa → propostas iniciais → contrato
 * assinado), só que dirigido por cliques em vez de prompts de terminal.
 */

const TEMPORADA_INICIAL = 2027;
/** Id provisório só pra identificar o jogador dentro do estado — a carreira em si não tem conta/usuário ainda. */
const ID_DO_JOGADOR = "jogador_web";

export type PassoDeCriacao = "nome" | "nacionalidade" | "posicao" | "arquetipo" | "numero" | "pe" | "proposta" | "resumo";

export function useCriacaoDeCarreira() {
  const [passo, setPasso] = useState<PassoDeCriacao>("nome");
  const [nome, setNome] = useState("");
  const [nacionalidade, setNacionalidade] = useState<string>();
  const [posicao, setPosicao] = useState<Posicao>();
  const [arquetipoId, setArquetipoId] = useState<string>();
  const [numero, setNumero] = useState<number>();
  const [estadoProvisorio, setEstadoProvisorio] = useState<EstadoDeCarreira>();
  const [propostas, setPropostas] = useState<PropostaTransferencia[]>([]);
  const [estadoFinal, setEstadoFinal] = useState<EstadoDeCarreira>();

  const clubes = useMemo(() => loadClubes(), []);
  const clubePorId = useMemo(() => new Map(clubes.map((c) => [c.id, c])), [clubes]);
  const estaduais = useMemo(() => loadEstaduais(), []);
  const nacionais = useMemo(() => loadCampeonatosNacionais(), []);
  /** Nomes dos campeonatos (estaduais + nacionais) que cada clube disputa, por Club.id — pra mostrar na tela de propostas. */
  const campeonatosPorClube = useMemo(() => {
    const mapa = new Map<string, { id: string; nome: string }[]>();
    for (const campeonato of [...nacionais, ...estaduais]) {
      for (const clubeId of campeonato.times) {
        const lista = mapa.get(clubeId) ?? [];
        lista.push({ id: campeonato.id, nome: campeonato.nome });
        mapa.set(clubeId, lista);
      }
    }
    return mapa;
  }, [estaduais, nacionais]);

  function confirmarNome(valorDigitado: string): void {
    setNome(valorDigitado.trim() || "Jogador Sem Nome");
    setPasso("nacionalidade");
  }

  function escolherNacionalidade(codigo: string): void {
    setNacionalidade(codigo);
    setPasso("posicao");
  }

  function escolherPosicao(valor: Posicao): void {
    setPosicao(valor);
    setPasso("arquetipo");
  }

  function escolherArquetipo(valor: string): void {
    setArquetipoId(valor);
    setPasso("numero");
  }

  function confirmarNumero(valor: number): void {
    setNumero(valor);
    setPasso("pe");
  }

  function escolherPeDominante(peDominante: "destro" | "canhoto"): void {
    if (!posicao || !arquetipoId) return;

    const estado = criarEstadoInicial({
      id: ID_DO_JOGADOR,
      nome,
      posicao,
      arquetipoId,
      clubeInicialId: "", // provisório — só pra calcular overall/perfil antes de existir um clube de verdade
      temporadaInicial: TEMPORADA_INICIAL,
      nacionalidade,
      numero,
      peDominante,
    });
    setEstadoProvisorio(estado);

    const propostasGeradas = gerarPropostasIniciais(clubes, {
      overall: overallAtual(estado),
      idade: estado.jogador.idade,
      reputacaoNacional: estado.reputacao.nacional,
      multiplicadorStatus: multiplicadorDeValorizacaoPorStatus(estado.statusNoClube),
    });
    setPropostas(propostasGeradas);
    setPasso("proposta");
  }

  function aceitarProposta(proposta: PropostaTransferencia): void {
    if (!estadoProvisorio) return;

    const termos = proposta.propostaInicial;
    const contrato: Contrato = {
      clubeId: proposta.clubeOfertanteId,
      salarioMensal: termos.salarioMensal,
      luvas: termos.luvas,
      // mesma estimativa simples usada em src/cli/index.ts e src/market/negotiation.ts contrapropostaPadrao
      clausulaRescisao: termos.salarioMensal * 12 * (termos.anos + 1),
      anos: termos.anos,
      temporadaAssinatura: TEMPORADA_INICIAL,
    };

    setEstadoFinal(assinarContrato(estadoProvisorio, contrato, proposta.statusOferecido));
    setPasso("resumo");
  }

  /** Fallback pro raro caso de nenhuma proposta chegar (ver `market/transfers.ts` `gerarPropostasIniciais`) — mesmo espírito do fallback manual da CLI, sem negociação nenhuma por trás. */
  function escolherClubeManualmente(clubeId: string): void {
    if (!estadoProvisorio) return;
    setEstadoFinal({ ...estadoProvisorio, clubeAtualId: clubeId });
    setPasso("resumo");
  }

  return {
    passo,
    nome,
    nacionalidade,
    posicao,
    clubes,
    clubePorId,
    campeonatosPorClube,
    propostas,
    estadoFinal,
    confirmarNome,
    escolherNacionalidade,
    escolherPosicao,
    escolherArquetipo,
    confirmarNumero,
    escolherPeDominante,
    aceitarProposta,
    escolherClubeManualmente,
  };
}
