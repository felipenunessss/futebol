import { useEffect, useMemo, useRef, useState } from "react";
import { construirCalendarioPadrao } from "@motor/data/loaders/calendario.js";
import type { Club } from "@motor/schemas/club.js";
import { ATRIBUTOS_POR_POSICAO, buscarArquetipo, NACIONALIDADES_CONMEBOL, type Atributo, type Posicao } from "@motor/schemas/player.js";
import { overallAtual, type EstadoDeCarreira } from "@motor/career/Player.js";
import { xpParaProximoNivel } from "@motor/progression/xp.js";
import type { ImpactoCarreira, Opcao } from "@motor/progression/scenarios.js";
import type { LinhaTabela } from "@motor/simulation/season.js";
import type { ContextoDecisaoChance, EventoAoVivo, ResultadoDecisaoChance } from "@motor/simulation/live-match.js";
import { probabilidadeDeDuelo } from "@motor/simulation/match.js";
import type { SubtipoChance } from "@motor/simulation/tactics.js";
import type { AlocacaoDePontos, AoIniciarSemanaInfo, ChaveamentoDeMataMataNaTemporada, ContextoPartidaDoJogadorSemanal, SorteioDeGruposNaTemporada } from "@motor/career/career-loop.js";
import type { PropostaTransferencia } from "@motor/market/transfers.js";
import type { EscolhaDeFimDeTemporada, PropostasDeFimDeTemporada } from "@motor/career/fim-de-temporada.js";
import {
  useTemporada,
  type AnimacaoDeEscolhaPendente,
  type EscolhaDePrePartida,
  type EstatisticasCarreira,
  type EtapaDoChaveamento,
  type EventoDeFeed,
  type FaixasDeDestaqueDaTabela,
  type InfoPotesFaseSuica,
  type InfoTacasDaCompeticao,
  type JogoDaSemana,
  type PartidaAoVivoEmAndamento,
  type PromptPendente,
  type ResultadoDaRodadaExibido,
  type VelocidadeAoVivo,
} from "./useTemporada.js";
import { Escudo } from "../../components/Escudo.js";
import { corDeTextoContrastante } from "../../lib/contraste.js";
import { extrairCorDominante } from "../../lib/corDoEscudo.js";
import { formatarMoeda } from "../../lib/formato.js";
import type { StatusNoClube } from "@motor/career/status.js";

const ROTULO_POSICAO: Record<Posicao, string> = {
  goleiro: "Goleiro",
  zagueiro: "Zagueiro",
  lateral: "Lateral",
  volante: "Volante",
  meia: "Meia",
  atacante: "Atacante",
};

const LABEL_SUBTIPO: Record<SubtipoChance, string> = {
  voleio: "voleio",
  cabeceio: "cabeceio",
  chute_de_fora: "chute de fora da área",
  jogada_individual: "jogada individual",
  passe_decisivo: "passe decisivo",
  desarme_decisivo: "desarme decisivo",
};

function escudoDoClube(clubePorId: Map<string, Club>, id: string): string | undefined {
  return clubePorId.get(id)?.escudo_url;
}

/** Cache em módulo (sobrevive a remounts/trocas de clube dentro da mesma sessão de página) — evita
 * reprocessar a mesma imagem de escudo mais de uma vez. `undefined` como valor é um resultado válido
 * (extração tentada e não deu cor vibrante nenhuma), por isso o cache usa `has`, não só truthiness. */
const cacheDeCorPorEscudo = new Map<string, string | undefined>();

/** Cor de fundo dinâmica "extraída" do escudo do clube atual (canvas, ver `lib/corDoEscudo.ts`) — só
 * usada quando o clube não tem `cor_primaria` cadastrada manualmente (a maioria). `undefined` enquanto
 * a extração ainda não terminou ou falhou (quem chama cai pro `cor_primaria`/fundo padrão nesse caso). */
function useCorDominanteDoEscudo(url: string | undefined): string | undefined {
  const [cor, setCor] = useState<string | undefined>(url ? cacheDeCorPorEscudo.get(url) : undefined);

  useEffect(() => {
    if (!url) {
      setCor(undefined);
      return;
    }
    if (cacheDeCorPorEscudo.has(url)) {
      setCor(cacheDeCorPorEscudo.get(url));
      return;
    }
    let cancelado = false;
    setCor(undefined);
    extrairCorDominante(url).then((corExtraida) => {
      cacheDeCorPorEscudo.set(url, corExtraida);
      if (!cancelado) setCor(corExtraida);
    });
    return () => {
      cancelado = true;
    };
  }, [url]);

  return cor;
}

function nomeDoClube(clubePorId: Map<string, Club>, id: string): string {
  const clube = clubePorId.get(id);
  return clube?.nome_popular ?? clube?.nome ?? id;
}

function nomeDoCampeonato(nomePorCampeonato: Map<string, string>, id: string): string {
  return nomePorCampeonato.get(id) ?? id;
}

/** Data aproximada da semana (1-52) — o motor não tem calendário real, só o número da semana; aqui
 * é só pra dar contexto de "quando" na tela, contando 7 dias por semana a partir de 1º de janeiro. */
function intervaloDeSemana(temporada: number, semana: number): { inicio: Date; fim: Date } {
  const inicio = new Date(Date.UTC(temporada, 0, 1 + (semana - 1) * 7));
  const fim = new Date(Date.UTC(temporada, 0, 1 + (semana - 1) * 7 + 6));
  return { inicio, fim };
}

function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function posicaoNaTabela(tabela: LinhaTabela[] | undefined, clubeId: string): number | undefined {
  const indice = tabela?.findIndex((linha) => linha.clubeId === clubeId) ?? -1;
  return indice >= 0 ? indice + 1 : undefined;
}

function formatarImpactoResumido(impacto: ImpactoCarreira): string {
  const partes: string[] = [];
  for (const [atributo, delta] of Object.entries(impacto.atributos ?? {})) partes.push(`${atributo.replaceAll("_", " ")} ${delta! > 0 ? "+" : ""}${delta}`);
  if (impacto.moral) partes.push(`moral ${impacto.moral > 0 ? "+" : ""}${impacto.moral}`);
  if (impacto.reputacao) partes.push(`reputação ${impacto.reputacao > 0 ? "+" : ""}${impacto.reputacao}`);
  if (impacto.reputacaoRegional) partes.push(`reputação regional ${impacto.reputacaoRegional > 0 ? "+" : ""}${impacto.reputacaoRegional}`);
  if (impacto.relacoesInternas) partes.push(`relações internas ${impacto.relacoesInternas > 0 ? "+" : ""}${impacto.relacoesInternas}`);
  return partes.length > 0 ? partes.join(", ") : "sem impacto numérico";
}

/**
 * "35% sim · 65% não" — todo `Opcao.resultados` do catálogo hoje tem 1 ou 2
 * itens (nunca 3+, ver `scenarios.ts`/`match-events.ts`), e por convenção
 * (mesma de `career-loop.ts` `resolverNegociacaoDeTransferencia`) o
 * `resultados[0]` é sempre o desfecho favorável, o resto é desfavorável —
 * daí dar pra resumir qualquer opção como um binário sim/não. `undefined`
 * quando só há 1 resultado (100%, sem risco — não faz sentido "sim/não").
 */
function formatarProbabilidadeSimNao(resultados: { probabilidade: number }[]): string | undefined {
  if (resultados.length < 2) return undefined;
  const probabilidadeSim = resultados[0].probabilidade;
  const probabilidadeNao = 1 - probabilidadeSim;
  return `${Math.round(probabilidadeSim * 100)}% sim · ${Math.round(probabilidadeNao * 100)}% não`;
}

export function TelaDeTemporada({ estadoInicial }: { estadoInicial: EstadoDeCarreira }) {
  const temporada = useTemporada(estadoInicial);
  const {
    estadoAtual,
    fase,
    feed,
    promptPendente,
    partidaAoVivo,
    tabelaPorCampeonato,
    faseMataMataPorCampeonato,
    grupoDoJogadorPorCampeonato,
    competicoesDoJogador,
    estatisticasCarreira,
    resultado,
    clubePorId,
    nomePorCampeonato,
    escudoPorCampeonato,
    potesFaseSuicaPorCampeonato,
  } = temporada;
  const nomeDaNacionalidade = NACIONALIDADES_CONMEBOL.find((n) => n.codigo === estadoAtual.jogador.nacionalidade)?.nome ?? estadoAtual.jogador.nacionalidade;
  const promptSemana = promptPendente?.tipo === "semana" ? promptPendente : undefined;
  const promptPrePartida = promptPendente?.tipo === "pre_partida" ? promptPendente : undefined;
  const promptSeguirCampeonatos = promptPendente?.tipo === "seguir_campeonatos" ? promptPendente : undefined;
  const promptDaPartidaAoVivo = promptPendente?.tipo === "chance_ao_vivo" || promptPendente?.tipo === "evento_ao_vivo" ? promptPendente : undefined;
  const promptDeCarreira = promptPendente && !promptSemana && !promptPrePartida && !promptSeguirCampeonatos && !promptDaPartidaAoVivo ? promptPendente : undefined;
  const lesionado = estadoAtual.bandeirasNarrativas.includes("lesionado");
  const { resultadoDaRodada, animacaoDeEscolha, sorteioPendente, chaveamentoPendente } = temporada;
  const escudoClubeAtual = escudoDoClube(clubePorId, estadoAtual.clubeAtualId);
  const corExtraidaDoEscudo = useCorDominanteDoEscudo(escudoClubeAtual);
  const corDeFundo = corExtraidaDoEscudo ?? clubePorId.get(estadoAtual.clubeAtualId)?.cor_primaria;
  const escudoDoProximoCampeonato = temporada.jogoDaSemana ? escudoPorCampeonato.get(temporada.jogoDaSemana.campeonatoId) : undefined;

  return (
    <div
      className="min-h-screen p-6 transition-colors relative overflow-hidden"
      style={{ backgroundColor: corDeFundo ?? "#020617", color: corDeFundo ? corDeTextoContrastante(corDeFundo) : "#f1f5f9" }}
    >
      {escudoDoProximoCampeonato && (
        <img
          src={escudoDoProximoCampeonato}
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none fixed -right-24 -bottom-24 w-[32rem] h-[32rem] object-contain opacity-[0.08] z-0"
        />
      )}
      <CalendarioSemanalLateral
        temporada={estadoAtual.temporada}
        semanaAtual={temporada.semanaAtual}
        jogoDaSemana={temporada.jogoDaSemana}
        clubePorId={clubePorId}
        nomePorCampeonato={nomePorCampeonato}
        simulandoAutomaticamente={temporada.simulandoAutomaticamente}
        onSimularAteAMetade={temporada.simularAteAMetadeDaTemporada}
        onSimularAteOFinal={temporada.simularAteOFinalDaTemporada}
      />
      {temporada.simulandoAutomaticamente && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-full bg-slate-900/95 border border-slate-800 shadow-xl px-4 py-2 text-xs backdrop-blur text-slate-100">
          <span className="text-slate-300">Simulando semanas automaticamente…</span>
          <button type="button" onClick={temporada.pararSimulacaoAutomatica} className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
            Parar e voltar ao normal
          </button>
        </div>
      )}
      <div className="fixed top-4 right-4 z-20 w-56 flex flex-col gap-3 max-h-[calc(100vh-2rem)] overflow-y-auto">
        {estadoAtual.foraDeCombate && (
          <div className="flex items-center gap-2 rounded-full bg-red-950/95 border border-red-800 shadow-xl px-4 py-2 text-xs backdrop-blur shrink-0">
            <span className="text-red-300 font-medium">
              {estadoAtual.foraDeCombate.motivo === "suspensao" ? "Suspenso" : "Lesionado"} —{" "}
              {estadoAtual.foraDeCombate.partidasRestantes > 1 ? `faltam ${estadoAtual.foraDeCombate.partidasRestantes} partidas` : "falta 1 partida"} do clube
            </span>
          </div>
        )}
        {competicoesDoJogador.length > 0 && (
          <PainelDeCompeticoes
            competicoesDoJogador={competicoesDoJogador}
            tabelaPorCampeonato={tabelaPorCampeonato}
            faseMataMataPorCampeonato={faseMataMataPorCampeonato}
            chaveamentoPorCampeonato={temporada.chaveamentoPorCampeonato}
            grupoDoJogadorPorCampeonato={grupoDoJogadorPorCampeonato}
            clubeId={estadoAtual.clubeAtualId}
            clubePorId={clubePorId}
            nomePorCampeonato={nomePorCampeonato}
            faixasPorCampeonato={temporada.faixasPorCampeonato}
            potesFaseSuicaPorCampeonato={potesFaseSuicaPorCampeonato}
          />
        )}
        <PainelLateralEstatisticasEAtributos
          estatisticasCarreira={estatisticasCarreira}
          nomePorCampeonato={nomePorCampeonato}
          tacaPorCampeonato={temporada.tacaPorCampeonato}
          atributos={estadoAtual.jogador.atributos}
          atributosDaPosicao={ATRIBUTOS_POR_POSICAO[estadoAtual.jogador.posicao]}
        />
      </div>
      <div className="relative z-[1] mx-auto max-w-3xl flex flex-col gap-4">
        <Cabecalho
          estado={estadoAtual}
          nomeClube={nomeDoClube(clubePorId, estadoAtual.clubeAtualId)}
          escudoClube={escudoDoClube(clubePorId, estadoAtual.clubeAtualId)}
          nomeDaNacionalidade={nomeDaNacionalidade}
        />

        {/* Enquanto a animação de escolha, o sorteio/chaveamento ou a tela de resultados da rodada
            estão abertos, nenhum outro prompt aparece — o motor já resolveu tudo (não está pausado
            por causa disso), é só a UI que segura a revelação (ver `useTemporada.ts`).
            IMPORTANTE: sorteio/chaveamento vêm ANTES de resultadoDaRodada de propósito — a 1ª
            rodada/etapa de uma fase recém-criada já roda (e já pode resolver a partida do próprio
            clube, setando resultadoDaRodada) na MESMA janela de execução em que o sorteio/
            chaveamento acabou de ser decidido, então se resultadoDaRodada tivesse prioridade mais
            alta aqui o sorteio nunca apareceria (sempre mascarado pelo resultado que vem logo
            depois, no mesmo tick) — ver reporte do usuário "não apareceu nenhum sorteio". */}
        {animacaoDeEscolha ? (
          <PainelAnimacaoDeEscolha animacao={animacaoDeEscolha} onConcluir={temporada.concluirAnimacaoDeEscolha} />
        ) : partidaAoVivo ? (
          // Precisa vir ANTES de promptSemana/sorteio/etc: o motor já segue pra `aoIniciarSemana` da
          // PRÓXIMA semana assim que a partida ao vivo termina (não espera `confirmarFimDeJogo`), o
          // que criava um nova prompt "semana" enquanto a tela de fim de jogo ainda não tinha sido
          // confirmada — como esse prompt vinha DEPOIS no JSX (dentro do fragment abaixo), as duas
          // telas ficavam empilhadas na mesma renderização e a de fim de jogo parecia ter sido pulada
          // (só estava abaixo da dobra). Dando prioridade aqui, a tela de fim de jogo bloqueia a
          // visualização até o clique em "Continuar" (`onConfirmarFimDeJogo`), aí sim revelando o
          // resultado da rodada represado (se houver) e, por fim, o prompt da próxima semana.
          <PainelPartidaAoVivo
            partida={partidaAoVivo}
            clubePorId={clubePorId}
            status={estadoAtual.statusNoClube}
            prompt={promptDaPartidaAoVivo}
            velocidade={temporada.velocidadeAoVivo}
            onDefinirVelocidade={temporada.definirVelocidadeAoVivo}
            onResponderChance={temporada.responderChanceAoVivo}
            onResponderEvento={temporada.responderEventoAoVivo}
            onConfirmarFimDeJogo={temporada.confirmarFimDeJogo}
          />
        ) : sorteioPendente ? (
          <PainelSorteio sorteio={sorteioPendente} clubePorId={clubePorId} nomePorCampeonato={nomePorCampeonato} onContinuar={temporada.fecharSorteioDeGrupos} />
        ) : chaveamentoPendente ? (
          <PainelChaveamento chaveamento={chaveamentoPendente} clubePorId={clubePorId} nomePorCampeonato={nomePorCampeonato} onContinuar={temporada.fecharChaveamento} />
        ) : resultadoDaRodada ? (
          <PainelResultadoDaRodada
            resultadoDaRodada={resultadoDaRodada}
            clubePorId={clubePorId}
            nomePorCampeonato={nomePorCampeonato}
            faixasPorCampeonato={temporada.faixasPorCampeonato}
            onAvancar={temporada.responderResultadoDaRodada}
          />
        ) : (
          <>
            {promptSemana && (
              <PainelSemana info={promptSemana.info} temporada={estadoAtual.temporada} nomePorCampeonato={nomePorCampeonato} onContinuar={temporada.responderSemana} />
            )}
            {promptSeguirCampeonatos && (
              <PainelSeguirCampeonatos idsAtivos={promptSeguirCampeonatos.idsAtivos} nomePorCampeonato={nomePorCampeonato} onConfirmar={temporada.responderSeguirCampeonatos} />
            )}
            {promptPrePartida && (
              <PainelPrePartida
                contexto={promptPrePartida.contexto}
                clubePorId={clubePorId}
                nomePorCampeonato={nomePorCampeonato}
                tabelaPorCampeonato={tabelaPorCampeonato}
                lesionado={lesionado}
                onEscolher={temporada.responderPrePartida}
              />
            )}
            {promptDeCarreira && <PainelDePrompt prompt={promptDeCarreira} temporada={temporada} />}
            {fase === "resumo" && resultado && (
              <ResumoDeTemporada
                resultado={resultado}
                clubePorId={clubePorId}
                nomePorCampeonato={nomePorCampeonato}
                tacaPorCampeonato={temporada.tacaPorCampeonato}
                estatisticasCarreira={estatisticasCarreira}
                onVerPropostas={temporada.verPropostasFimDeTemporada}
              />
            )}
            {fase === "propostas" && temporada.propostasFimDeTemporada && (
              <PainelPropostasFimDeTemporada
                propostas={temporada.propostasFimDeTemporada}
                clubePorId={clubePorId}
                nomeClubeAtual={nomeDoClube(clubePorId, estadoAtual.clubeAtualId)}
                onResponder={temporada.responderFimDeTemporada}
              />
            )}
          </>
        )}

        {/* O feed fica sempre visível (durante a temporada E depois do resumo) — é aqui que os
            placares das suas partidas aparecem conforme a temporada avança. */}
        <Feed eventos={feed} clubePorId={clubePorId} nomePorCampeonato={nomePorCampeonato} faixasPorCampeonato={temporada.faixasPorCampeonato} />
      </div>
    </div>
  );
}

const ROTULOS_DIA_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
/**
 * O motor não marca em que DIA da semana cai treino/jogo (só a semana como
 * um todo, ver `AoIniciarSemanaInfo`/`ContextoPartidaDoJogadorSemanal`) —
 * fixamos convencionalmente treino na 3ª posição (meio de semana) e jogo na
 * 6ª (fim de semana), só pra dar "corpo de calendário" ao que se sabe por
 * semana. Não é uma previsão exata de dia do motor.
 */
const INDICE_DIA_TREINO = 2;
const INDICE_DIA_JOGO = 5;

function CalendarioSemanalLateral({
  temporada,
  semanaAtual,
  jogoDaSemana,
  clubePorId,
  nomePorCampeonato,
  simulandoAutomaticamente,
  onSimularAteAMetade,
  onSimularAteOFinal,
}: {
  temporada: number;
  semanaAtual: number;
  jogoDaSemana: JogoDaSemana | undefined;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
  simulandoAutomaticamente: boolean;
  onSimularAteAMetade: () => void;
  onSimularAteOFinal: () => void;
}) {
  const periodos = useMemo(() => construirCalendarioPadrao(temporada).calendario, [temporada]);
  const temTreino = periodos.some((p) => p.semanaInicio === semanaAtual && p.pontoDeTreino !== false);
  const { inicio } = intervaloDeSemana(temporada, semanaAtual);

  return (
    <div className="fixed top-4 left-4 z-10 w-64 rounded-xl bg-slate-900/95 border border-slate-800 shadow-xl p-3 flex flex-col gap-2 text-xs backdrop-blur text-slate-100">
      <h2 className="font-semibold text-slate-400">Semana {semanaAtual}</h2>
      <div className="grid grid-cols-7 gap-1">
        {ROTULOS_DIA_SEMANA.map((rotulo, indice) => {
          const data = new Date(inicio);
          data.setUTCDate(data.getUTCDate() + indice);
          const ehTreino = indice === INDICE_DIA_TREINO && temTreino;
          const ehJogo = indice === INDICE_DIA_JOGO && !!jogoDaSemana;
          const titulo = ehJogo && jogoDaSemana ? `${nomeDoClube(clubePorId, jogoDaSemana.mandanteId)} x ${nomeDoClube(clubePorId, jogoDaSemana.visitanteId)}` : undefined;

          return (
            <div
              key={rotulo}
              title={titulo}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-px ${ehJogo ? "bg-emerald-950/60 border border-emerald-800" : "bg-slate-800/60 border border-slate-800"}`}
            >
              <span className="text-slate-500 leading-none text-[9px]">{rotulo.charAt(0)}</span>
              <span className="text-slate-400 leading-none text-[9px] tabular-nums">{data.getUTCDate()}</span>
              {ehJogo ? <span className="leading-none text-[11px]">⚽</span> : ehTreino ? <span className="leading-none text-[11px]">🏋️</span> : null}
            </div>
          );
        })}
      </div>
      {jogoDaSemana && (
        <div className="rounded-lg bg-emerald-950/60 border border-emerald-800 px-2 py-1.5 text-emerald-400 truncate">
          ⚽ {nomeDoCampeonato(nomePorCampeonato, jogoDaSemana.campeonatoId)}
          {jogoDaSemana.resultado && ` (${jogoDaSemana.resultado.golsCasa}-${jogoDaSemana.resultado.golsFora})`}
        </div>
      )}
      {!simulandoAutomaticamente && (
        <div className="flex flex-col gap-1 border-t border-slate-800 pt-2">
          <span className="text-slate-500">Simular semanas de uma vez:</span>
          <button type="button" onClick={onSimularAteAMetade} className="text-left text-emerald-400 hover:text-emerald-300 transition-colors">
            Até a metade da temporada
          </button>
          <button type="button" onClick={onSimularAteOFinal} className="text-left text-emerald-400 hover:text-emerald-300 transition-colors">
            Até o final da temporada
          </button>
        </div>
      )}
    </div>
  );
}

function PainelDeCompeticoes({
  competicoesDoJogador,
  tabelaPorCampeonato,
  faseMataMataPorCampeonato,
  chaveamentoPorCampeonato,
  grupoDoJogadorPorCampeonato,
  clubeId,
  clubePorId,
  nomePorCampeonato,
  faixasPorCampeonato,
  potesFaseSuicaPorCampeonato,
}: {
  competicoesDoJogador: string[];
  tabelaPorCampeonato: Map<string, LinhaTabela[]>;
  faseMataMataPorCampeonato: Map<string, { etapa: string; eliminado: boolean }>;
  chaveamentoPorCampeonato: Map<string, EtapaDoChaveamento[]>;
  grupoDoJogadorPorCampeonato: Map<string, string>;
  clubeId: string;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
  faixasPorCampeonato: Map<string, FaixasDeDestaqueDaTabela>;
  potesFaseSuicaPorCampeonato: Map<string, InfoPotesFaseSuica>;
}) {
  const [classificacaoAberta, setClassificacaoAberta] = useState(false);

  return (
    <>
      <div className="rounded-xl bg-slate-900/95 border border-slate-800 shadow-xl p-3 flex flex-col gap-2 text-xs backdrop-blur text-slate-100">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-400">Suas competições</h2>
          <button type="button" onClick={() => setClassificacaoAberta(true)} className="shrink-0 text-emerald-400 hover:text-emerald-300 transition-colors">
            Classificação
          </button>
        </div>
        {competicoesDoJogador.map((campeonatoId) => {
          const posicao = posicaoNaTabela(tabelaPorCampeonato.get(campeonatoId), clubeId);
          const fase = faseMataMataPorCampeonato.get(campeonatoId);
          return (
            <div key={campeonatoId} className={`border-t border-slate-800 pt-2 first:border-t-0 first:pt-0 ${fase?.eliminado ? "bg-red-950/30 -mx-2 px-2 rounded" : ""}`}>
              <div className="font-medium text-slate-200">{nomeDoCampeonato(nomePorCampeonato, campeonatoId)}</div>
              {fase ? (
                <div className={fase.eliminado ? "text-red-400 font-medium" : "text-emerald-400"}>{fase.eliminado ? `Eliminado (${rotuloEtapa(fase.etapa)})` : rotuloEtapa(fase.etapa)}</div>
              ) : posicao ? (
                <div className="text-slate-400">{posicao}º colocado</div>
              ) : (
                <div className="text-slate-500">aguardando dados</div>
              )}
            </div>
          );
        })}
      </div>
      {classificacaoAberta && (
        <PainelClassificacao
          competicoesDoJogador={competicoesDoJogador}
          tabelaPorCampeonato={tabelaPorCampeonato}
          faseMataMataPorCampeonato={faseMataMataPorCampeonato}
          chaveamentoPorCampeonato={chaveamentoPorCampeonato}
          grupoDoJogadorPorCampeonato={grupoDoJogadorPorCampeonato}
          clubeId={clubeId}
          clubePorId={clubePorId}
          nomePorCampeonato={nomePorCampeonato}
          faixasPorCampeonato={faixasPorCampeonato}
          potesFaseSuicaPorCampeonato={potesFaseSuicaPorCampeonato}
          onFechar={() => setClassificacaoAberta(false)}
        />
      )}
    </>
  );
}

/** Nome de grupo gerado por `simulation/groups.ts`/`incremental.ts` `nomeDoGrupo` ("Grupo A", "Grupo B", ...) — só nesse formato quando a fase tinha MAIS de um grupo; senão o nome capturado é o slug interno da fase (ex: "grupos", "regular"), que não faz sentido mostrar pro jogador. */
const PADRAO_NOME_DE_GRUPO = /^Grupo [A-Z]$/;

function PainelClassificacao({
  competicoesDoJogador,
  tabelaPorCampeonato,
  faseMataMataPorCampeonato,
  chaveamentoPorCampeonato,
  grupoDoJogadorPorCampeonato,
  clubeId,
  clubePorId,
  nomePorCampeonato,
  faixasPorCampeonato,
  potesFaseSuicaPorCampeonato,
  onFechar,
}: {
  competicoesDoJogador: string[];
  tabelaPorCampeonato: Map<string, LinhaTabela[]>;
  faseMataMataPorCampeonato: Map<string, { etapa: string; eliminado: boolean }>;
  chaveamentoPorCampeonato: Map<string, EtapaDoChaveamento[]>;
  grupoDoJogadorPorCampeonato: Map<string, string>;
  clubeId: string;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
  faixasPorCampeonato: Map<string, FaixasDeDestaqueDaTabela>;
  potesFaseSuicaPorCampeonato: Map<string, InfoPotesFaseSuica>;
  onFechar: () => void;
}) {
  const [aba, setAba] = useState<"tabela" | "chaveamento">("tabela");
  const competicoesComChaveamento = competicoesDoJogador.filter((id) => (chaveamentoPorCampeonato.get(id)?.length ?? 0) > 0);

  return (
    <div className="fixed inset-0 z-30 bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-4 sm:p-6" onClick={onFechar}>
      <div className="mx-auto max-w-2xl mt-6 mb-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-6 flex flex-col gap-5 text-slate-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Classificação</h2>
          <button type="button" onClick={onFechar} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            Fechar
          </button>
        </div>
        <div className="flex gap-1 border-b border-slate-800 -mt-1">
          <button
            type="button"
            onClick={() => setAba("tabela")}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${aba === "tabela" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            Tabela
          </button>
          <button
            type="button"
            onClick={() => setAba("chaveamento")}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${aba === "chaveamento" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            Chaveamento
          </button>
        </div>
        {aba === "tabela" ? (
          competicoesDoJogador.map((campeonatoId) => {
            const grupo = grupoDoJogadorPorCampeonato.get(campeonatoId);
            const mostrarGrupo = grupo && PADRAO_NOME_DE_GRUPO.test(grupo);
            const fase = faseMataMataPorCampeonato.get(campeonatoId);
            const tabela = tabelaPorCampeonato.get(campeonatoId);
            const potes = potesFaseSuicaPorCampeonato.get(campeonatoId);
            return (
              <div key={campeonatoId} className={`flex flex-col gap-2 ${fase?.eliminado ? "bg-red-950/30 -mx-3 px-3 py-2 rounded-lg" : ""}`}>
                <h3 className="text-sm font-semibold text-slate-200">
                  {nomeDoCampeonato(nomePorCampeonato, campeonatoId)}
                  {mostrarGrupo && <span className="text-slate-400 font-normal"> — {grupo}</span>}
                </h3>
                {fase ? (
                  <p className={`text-sm ${fase.eliminado ? "text-red-400 font-medium" : "text-emerald-400"}`}>
                    {fase.eliminado ? `Eliminado(a) na fase: ${rotuloEtapa(fase.etapa)}` : `Fase atual: ${rotuloEtapa(fase.etapa)}`}
                  </p>
                ) : tabela && potes ? (
                  <TabelaPorPotes tabela={tabela} potes={potes} clubeId={clubeId} clubePorId={clubePorId} />
                ) : tabela ? (
                  <TabelaCompleta tabela={tabela} clubeId={clubeId} clubePorId={clubePorId} faixas={faixasPorCampeonato.get(campeonatoId)} />
                ) : (
                  <p className="text-sm text-slate-500">Aguardando dados.</p>
                )}
              </div>
            );
          })
        ) : competicoesComChaveamento.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma das suas competições chegou numa fase de mata-mata ainda.</p>
        ) : (
          competicoesComChaveamento.map((campeonatoId) => (
            <div key={campeonatoId} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-200">{nomeDoCampeonato(nomePorCampeonato, campeonatoId)}</h3>
              <ChaveamentoDaCompeticao etapas={chaveamentoPorCampeonato.get(campeonatoId)!} clubeId={clubeId} clubePorId={clubePorId} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Chaveamento acumulado de UMA competição (todas as etapas já resolvidas, uma coluna por etapa,
 * rolagem horizontal se não couber) — pedido do usuário: "aba específica pros mata-matas mostrando
 * o chaveamento". Só mostra o que já aconteceu (etapas futuras/pendentes simplesmente não têm
 * entrada ainda em `etapas`, ver `useTemporada.ts` `chaveamentoPorCampeonato`). */
function ChaveamentoDaCompeticao({ etapas, clubeId, clubePorId }: { etapas: EtapaDoChaveamento[]; clubeId: string; clubePorId: Map<string, Club> }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 min-w-max">
        {etapas.map((etapa) => (
          <div key={etapa.nome} className="flex flex-col gap-1.5 w-48 shrink-0">
            <div className="text-xs font-medium text-slate-400">{rotuloEtapa(etapa.nome)}</div>
            {etapa.confrontos.map((confronto, indice) => (
              <div key={indice} className="rounded-lg bg-slate-800/60 p-2 flex flex-col gap-1 text-xs">
                <LinhaDeTimeNoChaveamento
                  clubePorId={clubePorId}
                  timeId={confronto.timeA}
                  gols={confronto.golsA}
                  venceu={confronto.vencedor === confronto.timeA}
                  ehDoJogador={confronto.timeA === clubeId}
                />
                <LinhaDeTimeNoChaveamento
                  clubePorId={clubePorId}
                  timeId={confronto.timeB}
                  gols={confronto.golsB}
                  venceu={confronto.vencedor === confronto.timeB}
                  ehDoJogador={confronto.timeB === clubeId}
                />
                {confronto.decididoNosPenaltis && (
                  <div className="text-slate-500 text-[11px] text-center">nos pênaltis{confronto.penaltis && ` (${confronto.penaltis.golsA} x ${confronto.penaltis.golsB})`}</div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function LinhaDeTimeNoChaveamento({
  clubePorId,
  timeId,
  gols,
  venceu,
  ehDoJogador,
}: {
  clubePorId: Map<string, Club>;
  timeId: string;
  gols: number;
  venceu: boolean;
  ehDoJogador: boolean;
}) {
  // Duas classes `text-*` concorrentes na mesma tag empatam em especificidade — qual delas "ganha"
  // depende da ordem em que o Tailwind gerou o CSS, não da ordem no JSX; sem decidir a cor final
  // aqui em JS, o time do jogador podia ficar sem destaque nenhum quando PERDIA (a cor de "perdeu"
  // apagava a de "é seu time") — pedido do usuário: "quero que o meu time esteja destacado nos
  // brackets que ele estiver", inclusive numa eliminação. Uma única decisão de cor evita a disputa.
  const corTexto = ehDoJogador ? (venceu ? "text-emerald-400 font-semibold" : "text-emerald-600") : venceu ? "text-slate-100 font-medium" : "text-slate-500";
  return (
    <div className={`flex items-center gap-1.5 ${corTexto}`}>
      <Escudo url={escudoDoClube(clubePorId, timeId)} alt="" tamanho={14} />
      <span className="flex-1 truncate">{nomeDoClube(clubePorId, timeId)}</span>
      <span className="tabular-nums shrink-0">{gols}</span>
    </div>
  );
}

/** Faixa de destaque da linha `indice` (0-based) de uma tabela com `totalLinhas` linhas — pedido do
 * usuário: mostrar em cores os classificados pra próxima fase (topo) e os rebaixados (fim), não só
 * o resultado final; depois pediu cor DIFERENTE pra Libertadores vs Sul-Americana quando o
 * campeonato dá vaga pras duas (`faixas.libertadores`/`sulamericana`, mutuamente exclusivo com
 * `faixas.classificados` — ver `useTemporada.ts` `faixasDeDestaqueDaTabela`). Só uma borda lateral
 * colorida (não muda o fundo), pra não brigar com o destaque de "seu clube" (fundo esmeralda)
 * quando as duas coincidem. */
function classeFaixaDaLinha(indice: number, totalLinhas: number, faixas: FaixasDeDestaqueDaTabela | undefined): string {
  if (!faixas) return "";
  if (faixas.libertadores && indice < faixas.libertadores) return "border-l-4 border-l-amber-500";
  if (faixas.sulamericana && indice < (faixas.libertadores ?? 0) + faixas.sulamericana) return "border-l-4 border-l-cyan-500";
  if (faixas.classificados && indice < faixas.classificados) return "border-l-4 border-l-sky-500";
  if (faixas.rebaixados && indice >= totalLinhas - faixas.rebaixados) return "border-l-4 border-l-red-500";
  return "";
}

function LegendaDeFaixas({ faixas }: { faixas: FaixasDeDestaqueDaTabela | undefined }) {
  if (!faixas?.classificados && !faixas?.libertadores && !faixas?.sulamericana && !faixas?.rebaixados) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-500">
      {faixas.libertadores && (
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-amber-500" /> Vaga Libertadores
        </span>
      )}
      {faixas.sulamericana && (
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-cyan-500" /> Vaga Sul-Americana
        </span>
      )}
      {faixas.classificados && (
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-sky-500" /> Classificação
        </span>
      )}
      {faixas.rebaixados && (
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-red-500" /> Rebaixamento
        </span>
      )}
    </div>
  );
}

/**
 * Fase suíça com classificação por pote (ver `InfoPotesFaseSuica`) — separa a tabela geral (única,
 * como o motor simula) em 1 sub-tabela por pote, cada uma destacando o top `vagasPorPote` PRÓPRIO
 * (não o top N do geral, que classificaria o time errado quando o pote do jogador for mais difícil
 * que a média — pedido do usuário: "verificar o formato", "separados em 4 grupos"). A ordem relativa
 * dentro de cada pote já vem correta ao filtrar a tabela geral (que já está ordenada por pontos).
 */
function TabelaPorPotes({ tabela, potes, clubeId, clubePorId }: { tabela: LinhaTabela[]; potes: InfoPotesFaseSuica; clubeId: string; clubePorId: Map<string, Club> }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: potes.numPotes }, (_, indicePote) => {
        const tabelaDoPote = tabela.filter((linha) => potes.potePorTime.get(linha.clubeId) === indicePote);
        return (
          <div key={indicePote}>
            <div className="text-xs font-medium text-slate-400 mb-1">Pote {indicePote + 1}</div>
            <TabelaCompleta tabela={tabelaDoPote} clubeId={clubeId} clubePorId={clubePorId} faixas={{ classificados: potes.vagasPorPote }} />
          </div>
        );
      })}
    </div>
  );
}

function TabelaCompleta({ tabela, clubeId, clubePorId, faixas }: { tabela: LinhaTabela[]; clubeId: string; clubePorId: Map<string, Club>; faixas?: FaixasDeDestaqueDaTabela }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr className="text-slate-400 text-left">
            <th className="pr-2 py-1">Pos</th>
            <th className="pr-2 py-1">Clube</th>
            <th className="pr-2 py-1 text-right">Pts</th>
            <th className="pr-2 py-1 text-right">J</th>
            <th className="pr-2 py-1 text-right">V</th>
            <th className="pr-2 py-1 text-right">E</th>
            <th className="pr-2 py-1 text-right">D</th>
            <th className="pr-2 py-1 text-right">SG</th>
          </tr>
        </thead>
        <tbody>
          {tabela.map((linha, indice) => (
            <tr
              key={linha.clubeId}
              className={`border-t border-slate-800 ${classeFaixaDaLinha(indice, tabela.length, faixas)} ${linha.clubeId === clubeId ? "bg-emerald-950/60 text-emerald-300 font-medium" : ""}`}
            >
              <td className="pr-2 py-1">{indice + 1}</td>
              <td className="pr-2 py-1">
                <span className="flex items-center gap-1.5">
                  <Escudo url={escudoDoClube(clubePorId, linha.clubeId)} alt="" tamanho={14} />
                  {nomeDoClube(clubePorId, linha.clubeId)}
                </span>
              </td>
              <td className="pr-2 py-1 text-right">{linha.pontos}</td>
              <td className="pr-2 py-1 text-right">{linha.jogos}</td>
              <td className="pr-2 py-1 text-right">{linha.vitorias}</td>
              <td className="pr-2 py-1 text-right">{linha.empates}</td>
              <td className="pr-2 py-1 text-right">{linha.derrotas}</td>
              <td className="pr-2 py-1 text-right">{linha.saldoDeGols}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <LegendaDeFaixas faixas={faixas} />
    </div>
  );
}

function Cabecalho({
  estado,
  nomeClube,
  escudoClube,
  nomeDaNacionalidade,
}: {
  estado: EstadoDeCarreira;
  nomeClube: string;
  escudoClube: string | undefined;
  nomeDaNacionalidade: string | undefined;
}) {
  const xpNecessario = xpParaProximoNivel(estado.nivel);
  const progresso = Math.min(100, Math.round((estado.xpAcumulado / xpNecessario) * 100));

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-6 flex flex-col gap-3 text-slate-100">
      <div className="flex items-center gap-4 flex-wrap">
        <Escudo url={escudoClube} alt={nomeClube} tamanho={56} />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold">
            {estado.jogador.nome} #{estado.jogador.numero} — {ROTULO_POSICAO[estado.jogador.posicao]}, {estado.jogador.idade} anos, {nomeDaNacionalidade}
          </h1>
          <span className="text-sm text-slate-400">
            {nomeClube} · Temporada {estado.temporada}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Stat rotulo="Overall" valor={overallAtual(estado)} />
        <Stat rotulo="Status no elenco" valor={ROTULO_STATUS[estado.statusNoClube]} />
        <Stat rotulo="Moral" valor={estado.moral} />
        <Stat rotulo="Pontos disponíveis" valor={estado.pontosDisponiveis} destaque={estado.pontosDisponiveis > 0} />
      </div>
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Nível {estado.nivel}</span>
          <span>
            {Math.round(estado.xpAcumulado)}/{Math.round(xpNecessario)} XP
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${progresso}%` }} />
        </div>
      </div>
    </div>
  );
}

function PainelEstatisticas({
  estatisticas,
  nomePorCampeonato,
  tacaPorCampeonato,
  colunas = 4,
}: {
  estatisticas: EstatisticasCarreira;
  nomePorCampeonato: Map<string, string>;
  tacaPorCampeonato: Map<string, InfoTacasDaCompeticao>;
  /** 4 (padrão) pro uso mais largo (fim de temporada); 2 pra caber na lateral estreita sempre visível. */
  colunas?: 2 | 4;
}) {
  return (
    <div className="rounded-lg bg-slate-800/60 p-3 text-sm flex flex-col gap-2">
      <div className={`grid gap-2 ${colunas === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        <Stat rotulo="Temporadas" valor={estatisticas.temporadas} />
        <Stat rotulo="Partidas" valor={estatisticas.partidas} />
        <Stat rotulo="Gols" valor={estatisticas.gols} />
        <Stat rotulo="Assistências" valor={estatisticas.assistencias} />
      </div>
      <div>
        <div className="text-slate-400 text-xs mb-1">Títulos ({estatisticas.titulos.length})</div>
        {estatisticas.titulos.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum título ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {estatisticas.titulos.map((t, indice) => {
              const tacas = tacaPorCampeonato.get(t.campeonatoId);
              const url = t.subtitulo === "apertura" ? tacas?.apertura : t.subtitulo === "clausura" ? tacas?.clausura : tacas?.principal;
              const rotuloSubtitulo = t.subtitulo === "apertura" ? "Apertura — " : t.subtitulo === "clausura" ? "Clausura — " : "";
              return (
                <li key={indice} className="flex items-center gap-2 text-xs text-slate-300">
                  <TrofeuDaCompeticao url={url} />
                  <span>
                    {rotuloSubtitulo}
                    {nomeDoCampeonato(nomePorCampeonato, t.campeonatoId)} — {t.temporada}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Imagem real da taça quando a competição tem (`taca_url`/`taca_apertura_url`/`taca_clausura_url`,
 * externa ou local em `web/public/trofeus/` — ver `docs/dados-a-verificar.md`) — senão um ícone
 * genérico de troféu (SVG embutido, não busca nada externo), pra sala de troféus sempre mostrar
 * alguma coisa em vez de um emoji plano. Pedido do usuário: "importe as taças dos campeonatos pra
 * que elas apareçam na sala de troféus". */
function TrofeuDaCompeticao({ url }: { url: string | undefined }) {
  if (url) return <img src={url} alt="" className="w-6 h-6 object-contain shrink-0" />;
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5a2 2 0 0 0 0 4h1" />
      <path d="M16 5h3a2 2 0 0 1 0 4h-1" />
      <path d="M10 12v3" />
      <path d="M14 12v3" />
      <path d="M9 19h6" />
      <path d="M12 15v4" />
    </svg>
  );
}

/** Versão compacta do radar de atributos, pra caber na lateral estreita sempre visível (o SVG do
 * radar de verdade escala proporcionalmente com a largura — numa coluna de ~14rem os rótulos
 * ficariam ilegíveis, ver `RadarDeAtributos.tsx`). Mesmos valores, só como lista com barra. */
function ListaCompactaDeAtributos({ atributos, atributosDaPosicao }: { atributos: Partial<Record<Atributo, number>>; atributosDaPosicao: Atributo[] }) {
  return (
    <div className="flex flex-col gap-1">
      {atributosDaPosicao.map((atributo) => {
        const valor = atributos[atributo] ?? 0;
        return (
          <div key={atributo} className="flex items-center gap-2">
            <span className="flex-1 truncate text-slate-400 capitalize">{atributo.replaceAll("_", " ")}</span>
            <div className="w-12 h-1.5 rounded-full bg-slate-700 overflow-hidden shrink-0">
              <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (valor / 99) * 100)}%` }} />
            </div>
            <span className="tabular-nums text-slate-200 w-5 text-right shrink-0">{Math.round(valor)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Painel fixo na lateral direita, sempre visível (pedido do usuário: "eu não quero que o gráfico
 * de atributos e as estatísticas fique escondido") — antes era um toggle escondido no cabeçalho. */
function PainelLateralEstatisticasEAtributos({
  estatisticasCarreira,
  nomePorCampeonato,
  tacaPorCampeonato,
  atributos,
  atributosDaPosicao,
}: {
  estatisticasCarreira: EstatisticasCarreira;
  nomePorCampeonato: Map<string, string>;
  tacaPorCampeonato: Map<string, InfoTacasDaCompeticao>;
  atributos: Partial<Record<Atributo, number>>;
  atributosDaPosicao: Atributo[];
}) {
  return (
    <div className="rounded-xl bg-slate-900/95 border border-slate-800 shadow-xl p-3 flex flex-col gap-3 text-xs backdrop-blur text-slate-100">
      <div>
        <h2 className="font-semibold text-slate-400 mb-2">Estatísticas da carreira</h2>
        <PainelEstatisticas estatisticas={estatisticasCarreira} nomePorCampeonato={nomePorCampeonato} tacaPorCampeonato={tacaPorCampeonato} colunas={2} />
      </div>
      <div className="border-t border-slate-800 pt-2">
        <h2 className="font-semibold text-slate-400 mb-2">Atributos</h2>
        <ListaCompactaDeAtributos atributos={atributos} atributosDaPosicao={atributosDaPosicao} />
      </div>
    </div>
  );
}

function Stat({ rotulo, valor, destaque }: { rotulo: string; valor: string | number; destaque?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-800/60 px-3 py-2">
      <div className="text-slate-400 text-xs">{rotulo}</div>
      <div className={`font-medium ${destaque ? "text-emerald-400" : ""}`}>{valor}</div>
    </div>
  );
}

function PainelDePrompt({ prompt, temporada }: { prompt: PromptPendente; temporada: ReturnType<typeof useTemporada> }) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6 text-slate-100">
      {prompt.tipo === "pontos" && <PromptDistribuicaoDePontos estado={prompt.estado} onConfirmar={temporada.responderDistribuicaoDePontos} />}
      {prompt.tipo === "cenario" && <PromptCenario titulo={prompt.cenario.titulo} descricao={prompt.cenario.descricao} opcoes={prompt.cenario.opcoes} onEscolher={temporada.responderCenario} />}
    </div>
  );
}

/** Nomes de fase de mata-mata vêm crus dos arquivos de dado (`FaseDeMataMata.nome`, ex:
 * "segunda_fase", "quartas") — sem isso apareciam com underscore na tela ("Eliminado
 * (segunda_fase)"). Cobre os valores conhecidos usados hoje; qualquer outro cai no fallback
 * genérico (troca `_`/`-` por espaço + primeira letra maiúscula), então nunca mostra underscore. */
const ROTULO_ETAPA: Record<string, string> = {
  primeira_fase: "Primeira fase",
  segunda_fase: "Segunda fase",
  terceira_fase: "Terceira fase",
  quarta_fase: "Quarta fase",
  quinta_fase: "Quinta fase",
  oitavas: "Oitavas de final",
  quartas: "Quartas de final",
  quartas_liguilla: "Quartas da liguilla",
  semifinal: "Semifinal",
  semifinal_liguilla: "Semifinal da liguilla",
  final: "Final",
  final_liguilla: "Final da liguilla",
  final_do_apertura_ou_clausura: "Final do Apertura/Clausura",
  repescagem: "Repescagem",
  hexagonal_titulo: "Hexagonal do título",
  hexagonal_ascenso: "Hexagonal de acesso",
  hexagonal_descenso: "Hexagonal de descenso",
  hexagonal_rebaixamento: "Hexagonal de rebaixamento",
  quadrangular_internacional: "Quadrangular internacional",
};

function rotuloEtapa(etapa: string): string {
  const conhecido = ROTULO_ETAPA[etapa];
  if (conhecido) return conhecido;
  const comEspacos = etapa.replaceAll("_", " ").replaceAll("-", " ");
  return comEspacos.charAt(0).toUpperCase() + comEspacos.slice(1);
}

function PainelSemana({
  info,
  temporada,
  nomePorCampeonato,
  onContinuar,
}: {
  info: AoIniciarSemanaInfo;
  temporada: number;
  nomePorCampeonato: Map<string, string>;
  onContinuar: (pularAteProximoJogo?: boolean) => void;
}) {
  const { inicio, fim } = intervaloDeSemana(temporada, info.semana);

  return (
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6 flex flex-col gap-3 text-slate-100">
      <h2 className="text-lg font-semibold">
        Semana {info.semana} — {formatarData(inicio)} a {formatarData(fim)}
      </h2>
      {info.competicoesDoJogador.length > 0 ? (
        <p className="text-sm text-slate-400">Competições do seu clube: {info.competicoesDoJogador.map((id) => nomeDoCampeonato(nomePorCampeonato, id)).join(", ")}</p>
      ) : (
        <p className="text-sm text-slate-500">Seu clube não tem competição ativa no momento.</p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => onContinuar()} className="mt-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors px-4 py-2.5 font-medium self-start">
          Continuar
        </button>
        <button
          type="button"
          onClick={() => onContinuar(true)}
          className="mt-1 rounded-lg bg-slate-800 border border-slate-700 hover:border-emerald-500 hover:bg-slate-800/70 transition-colors px-4 py-2.5 font-medium self-start text-sm"
        >
          Simular até o próximo jogo
        </button>
      </div>
    </div>
  );
}

function PainelSeguirCampeonatos({
  idsAtivos,
  nomePorCampeonato,
  onConfirmar,
}: {
  idsAtivos: string[];
  nomePorCampeonato: Map<string, string>;
  onConfirmar: (idsEscolhidos: string[]) => void;
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  function alternar(id: string): void {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  return (
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6 flex flex-col gap-3 text-slate-100">
      <h2 className="text-lg font-semibold">Outras competições ativas nesta temporada</h2>
      <p className="text-sm text-slate-400">Escolha quais você quer acompanhar com resumo de tabela a cada período (nenhuma é obrigatória).</p>
      <div className="grid gap-2 max-h-72 overflow-y-auto pr-1">
        {idsAtivos.map((id) => (
          <label key={id} className="flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 cursor-pointer hover:border-emerald-500 transition-colors">
            <input type="checkbox" checked={selecionados.has(id)} onChange={() => alternar(id)} className="accent-emerald-500" />
            {nomeDoCampeonato(nomePorCampeonato, id)}
          </label>
        ))}
      </div>
      <button type="button" onClick={() => onConfirmar([...selecionados])} className="mt-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors px-4 py-2.5 font-medium self-start">
        Confirmar
      </button>
    </div>
  );
}

const ROTULO_STATUS: Record<StatusNoClube, string> = {
  promessa: "Promessa",
  reserva: "Reserva",
  titular: "Titular",
  idolo: "Ídolo",
};

function PainelPrePartida({
  contexto,
  clubePorId,
  nomePorCampeonato,
  tabelaPorCampeonato,
  lesionado,
  onEscolher,
}: {
  contexto: ContextoPartidaDoJogadorSemanal;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
  tabelaPorCampeonato: Map<string, LinhaTabela[]>;
  lesionado: boolean;
  onEscolher: (escolha: EscolhaDePrePartida) => void;
}) {
  const mandanteNome = nomeDoClube(clubePorId, contexto.mandanteId);
  const visitanteNome = nomeDoClube(clubePorId, contexto.visitanteId);
  const tabela = tabelaPorCampeonato.get(contexto.campeonatoId);
  const posicaoMandante = posicaoNaTabela(tabela, contexto.mandanteId);
  const posicaoVisitante = posicaoNaTabela(tabela, contexto.visitanteId);

  return (
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6 flex flex-col gap-4 text-slate-100">
      <div className="text-xs uppercase tracking-wide text-emerald-400">
        {nomeDoCampeonato(nomePorCampeonato, contexto.campeonatoId)}
        {contexto.etapa ? ` — ${rotuloEtapa(contexto.etapa)}` : contexto.rodada !== undefined ? ` — Rodada ${contexto.rodada}` : ""} — semana {contexto.semana}
      </div>
      <div className="flex items-center justify-center gap-4">
        <div className="text-right flex-1">
          <div className="font-semibold flex items-center justify-end gap-1.5">
            {mandanteNome}
            <Escudo url={escudoDoClube(clubePorId, contexto.mandanteId)} alt={mandanteNome} />
          </div>
          <div className="text-xs text-slate-400">{posicaoMandante ? `${posicaoMandante}º colocado` : "posição ainda não disponível"}</div>
        </div>
        <span className="text-slate-500 text-sm">x</span>
        <div className="text-left flex-1">
          <div className="font-semibold flex items-center gap-1.5">
            <Escudo url={escudoDoClube(clubePorId, contexto.visitanteId)} alt={visitanteNome} />
            {visitanteNome}
          </div>
          <div className="text-xs text-slate-400">{posicaoVisitante ? `${posicaoVisitante}º colocado` : "posição ainda não disponível"}</div>
        </div>
      </div>
      {/* Antes mostrava "status no elenco" aqui (`ROTULO_STATUS[status]`) — pedido do usuário: isso é
          o status de CONTRATO na temporada inteira, não responde "estou jogando ou não" nessa
          partida específica; se titular ou reserva NESSA partida só se sabe depois de simulada (ver
          `RotuloTitular` no resultado da rodada), então não dá pra mostrar aqui de antemão. */}
      <p className="text-xs text-slate-500 text-center">Você joga {contexto.lado === "casa" ? "em casa" : "fora"}</p>
      {lesionado && <p className="text-xs text-amber-400 text-center">⚠️ Você está jogando lesionado — cuidado com as decisões durante a partida.</p>}
      <div className="grid gap-2">
        <button type="button" onClick={() => onEscolher("rapida")} className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-left hover:border-emerald-500 hover:bg-slate-800/70 transition-colors">
          Simulação rápida (direto pro resultado)
        </button>
        <button type="button" onClick={() => onEscolher("ao_vivo")} className="rounded-lg bg-emerald-900/40 border border-emerald-700 px-4 py-2.5 text-left hover:border-emerald-500 transition-colors">
          Simular o jogo (ao vivo — pausa em lances importantes)
        </button>
      </div>
    </div>
  );
}

const ROTULO_VELOCIDADE: Record<VelocidadeAoVivo, string> = { normal: "Normal", rapida: "Rápido", ultrarrapida: "Ultrarrápido" };

function SeletorDeVelocidade({ velocidade, onDefinirVelocidade }: { velocidade: VelocidadeAoVivo; onDefinirVelocidade: (velocidade: VelocidadeAoVivo) => void }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      {(Object.keys(ROTULO_VELOCIDADE) as VelocidadeAoVivo[]).map((opcao) => (
        <button
          key={opcao}
          type="button"
          onClick={() => onDefinirVelocidade(opcao)}
          className={`rounded-md px-2 py-0.5 border transition-colors ${
            opcao === velocidade ? "bg-emerald-700 border-emerald-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
          }`}
        >
          {ROTULO_VELOCIDADE[opcao]}
        </button>
      ))}
    </div>
  );
}

function PainelPartidaAoVivo({
  partida,
  clubePorId,
  status,
  prompt,
  velocidade,
  onDefinirVelocidade,
  onResponderChance,
  onResponderEvento,
  onConfirmarFimDeJogo,
}: {
  partida: PartidaAoVivoEmAndamento;
  clubePorId: Map<string, Club>;
  status: StatusNoClube;
  prompt: Extract<PromptPendente, { tipo: "chance_ao_vivo" | "evento_ao_vivo" }> | undefined;
  velocidade: VelocidadeAoVivo;
  onDefinirVelocidade: (velocidade: VelocidadeAoVivo) => void;
  onResponderChance: (resultado: ResultadoDecisaoChance) => void;
  onResponderEvento: (opcao: Opcao) => void;
  onConfirmarFimDeJogo: () => void;
}) {
  const mandanteNome = nomeDoClube(clubePorId, partida.mandanteId);
  const visitanteNome = nomeDoClube(clubePorId, partida.visitanteId);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" });
  }, [partida.eventos.length]);

  return (
    <div className={`rounded-2xl bg-slate-900 border shadow-xl p-4 flex flex-col gap-3 text-slate-100 ${partida.finalizada ? "border-slate-700" : "border-emerald-700"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {partida.finalizada ? (
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fim de jogo</div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Ao vivo — {partida.minutoAtual}'
            </div>
          )}
          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300" title="Seu status no elenco nesta partida">
            {ROTULO_STATUS[status]}
          </span>
          {(partida.etapa || partida.rodada !== undefined) && (
            <span className="text-xs text-slate-400">{partida.etapa ? rotuloEtapa(partida.etapa) : `Rodada ${partida.rodada}`}</span>
          )}
        </div>
        {!partida.finalizada && <SeletorDeVelocidade velocidade={velocidade} onDefinirVelocidade={onDefinirVelocidade} />}
      </div>
      <div className="flex items-center justify-center gap-4">
        <span className="text-right flex-1 font-medium flex items-center justify-end gap-1.5">
          {mandanteNome}
          <Escudo url={escudoDoClube(clubePorId, partida.mandanteId)} alt={mandanteNome} />
        </span>
        <span className="tabular-nums text-2xl font-bold px-2">
          {partida.golsCasa} x {partida.golsFora}
        </span>
        <span className="text-left flex-1 font-medium flex items-center gap-1.5">
          <Escudo url={escudoDoClube(clubePorId, partida.visitanteId)} alt={visitanteNome} />
          {visitanteNome}
        </span>
      </div>
      <div ref={listaRef} className="flex flex-col gap-1 max-h-56 overflow-y-auto text-sm text-slate-300 border-t border-slate-800 pt-2">
        {partida.eventos.length === 0 ? (
          <p className="text-slate-500">Bola rolando...</p>
        ) : (
          partida.eventos.map((evento, indice) => <LinhaDeEvento key={indice} evento={evento} mandanteNome={mandanteNome} visitanteNome={visitanteNome} />)
        )}
      </div>
      {prompt?.tipo === "chance_ao_vivo" && <DecisaoDeChance contexto={prompt.contexto} onEscolher={onResponderChance} />}
      {prompt?.tipo === "evento_ao_vivo" && (
        <div className="border-t border-slate-800 pt-3">
          <PromptCenario titulo={prompt.cenario.titulo} descricao={prompt.cenario.descricao} opcoes={prompt.cenario.opcoes} onEscolher={onResponderEvento} />
        </div>
      )}
      {partida.finalizada && !prompt && (
        <button type="button" onClick={onConfirmarFimDeJogo} className="self-start rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors px-4 py-2.5 font-medium text-sm">
          Continuar
        </button>
      )}
    </div>
  );
}

/** Frases de lance perdido, no lugar do número de probabilidade (pedido do usuário: "não quero que
 * apareça a probabilidade de gol nos lances mas quero algo mais narrado"). Não há nenhum dado real
 * de "como" a chance foi perdida vindo do motor (só o resultado sucesso/fracasso) — a escolha da
 * frase aqui é só flavor textual, sorteada de forma determinística a partir do próprio evento
 * (minuto + um traço do evento) pra não mudar a cada re-render nem precisar de estado novo. */
const NARRACOES_DE_CHANCE_PERDIDA = [
  "chute pra fora",
  "defesa segura do goleiro",
  "bola no travessão",
  "bloqueio da zaga",
  "escanteio",
  "chute travado, sem força",
  "goleiro espalma, escanteio",
  "cabeceada por cima do gol",
];

function narracaoDeChancePerdida(semente: number): string {
  const indice = ((semente % NARRACOES_DE_CHANCE_PERDIDA.length) + NARRACOES_DE_CHANCE_PERDIDA.length) % NARRACOES_DE_CHANCE_PERDIDA.length;
  return NARRACOES_DE_CHANCE_PERDIDA[indice];
}

function LinhaDeEvento({ evento, mandanteNome, visitanteNome }: { evento: EventoAoVivo; mandanteNome: string; visitanteNome: string }) {
  switch (evento.tipo) {
    case "chance_generica": {
      const time = evento.lado === "casa" ? mandanteNome : visitanteNome;
      return (
        <p>
          {evento.minuto}'{" "}
          {evento.gol ? (
            <span className="text-emerald-400 font-medium">GOL do {time}!</span>
          ) : (
            <>
              Chance do {time} — {narracaoDeChancePerdida(evento.minuto * 7 + (evento.lado === "casa" ? 1 : 3))}.
            </>
          )}
        </p>
      );
    }
    case "chance_jogador": {
      const rotulo = LABEL_SUBTIPO[evento.chance.subtipo];
      const finalizacao = evento.chance.subtipo === "voleio" || evento.chance.subtipo === "cabeceio" || evento.chance.subtipo === "chute_de_fora" || evento.chance.subtipo === "jogada_individual";
      const semente = evento.minuto * 11 + rotulo.length;
      let texto: string;
      if (finalizacao) texto = evento.chance.sucesso ? `GOL SEU! (${rotulo})` : `Você não converteu (${rotulo}) — ${narracaoDeChancePerdida(semente)}.`;
      else if (evento.chance.subtipo === "passe_decisivo") texto = evento.chance.sucesso ? "Assistência sua!" : "Seu passe decisivo não deu certo — a defesa cortou antes.";
      else texto = evento.chance.sucesso ? "Desarme decisivo seu!" : "Você não conseguiu desarmar dessa vez.";
      return (
        <p className={evento.chance.sucesso ? "text-emerald-400 font-medium" : ""}>
          {evento.minuto}' {texto}
        </p>
      );
    }
    case "evento_de_contexto": {
      const efeitoDeGol = evento.escolha.resultado.impacto.efeitoDeGol;
      return (
        <p className={efeitoDeGol === "a_favor" ? "text-emerald-400 font-medium" : efeitoDeGol === "contra" ? "text-red-400 font-medium" : ""}>
          {evento.minuto}' {efeitoDeGol === "a_favor" ? "GOL! " : efeitoDeGol === "contra" ? "GOL CONTRA! " : ""}
          {evento.escolha.resultado.impacto.narrativa}
        </p>
      );
    }
    case "incidente_jogador":
      return (
        <p className={evento.incidente.tipo === "cartao_vermelho" || evento.incidente.tipo === "lesao" ? "text-red-400 font-medium" : ""}>
          {evento.minuto}' {evento.escolha.resultado.impacto.narrativa}
        </p>
      );
    case "apito_final":
      return (
        <p className="font-medium">
          Apito final: {mandanteNome} {evento.golsCasa} x {evento.golsFora} {visitanteNome}
        </p>
      );
  }
}

function DecisaoDeChance({ contexto, onEscolher }: { contexto: ContextoDecisaoChance; onEscolher: (resultado: ResultadoDecisaoChance) => void }) {
  const opcoes: { rotulo: string; ajuste: ResultadoDecisaoChance }[] = [
    { rotulo: "Arriscar, ir com tudo", ajuste: { ajusteForcaJogador: 150, ajusteForcaDefensiva: 0 } },
    { rotulo: "Ajeitar antes de bater, com mais categoria", ajuste: { ajusteForcaJogador: 60, ajusteForcaDefensiva: -60 } },
  ];

  return (
    <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
      <p className="text-sm font-medium">
        {contexto.minuto}' — chance sua! ({LABEL_SUBTIPO[contexto.subtipo]})
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {opcoes.map(({ rotulo, ajuste }) => {
          const percentual = Math.round(probabilidadeDeDuelo(contexto.forcaJogadorBase + ajuste.ajusteForcaJogador, contexto.forcaDefensivaBase + ajuste.ajusteForcaDefensiva) * 100);
          return (
            <button
              key={rotulo}
              type="button"
              onClick={() => onEscolher(ajuste)}
              className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-left hover:border-emerald-500 hover:bg-slate-800/70 transition-colors text-sm"
            >
              {rotulo}
              <div className="mt-1 text-xs text-slate-500">{percentual}% de chance</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PromptDistribuicaoDePontos({ estado, onConfirmar }: { estado: EstadoDeCarreira; onConfirmar: (alocacoes: AlocacaoDePontos[]) => void }) {
  const arquetipo = buscarArquetipo(estado.jogador.arquetipo_id);
  const atributosDaPosicao = ATRIBUTOS_POR_POSICAO[estado.jogador.posicao];
  const [alocado, setAlocado] = useState<Partial<Record<Atributo, number>>>({});

  const somaAlocada = Object.values(alocado).reduce((soma, v) => soma + (v ?? 0), 0);
  const pontosRestantes = estado.pontosDisponiveis - somaAlocada;

  function investirUm(atributo: Atributo): void {
    if (pontosRestantes <= 0) return;
    setAlocado((atual) => ({ ...atual, [atributo]: (atual[atributo] ?? 0) + 1 }));
  }

  function confirmar(): void {
    const alocacoes: AlocacaoDePontos[] = Object.entries(alocado)
      .filter(([, quantidade]) => (quantidade ?? 0) > 0)
      .map(([atributo, quantidade]) => ({ atributo: atributo as Atributo, quantidade: quantidade! }));
    onConfirmar(alocacoes);
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Distribuir pontos de atributo ({pontosRestantes} restante{pontosRestantes === 1 ? "" : "s"})</h2>
      <div className="grid gap-2 max-h-80 overflow-y-auto pr-1">
        {atributosDaPosicao.map((atributo) => {
          const prioritario = arquetipo.atributos_prioritarios.includes(atributo);
          const valorAtual = estado.jogador.atributos[atributo] ?? 0;
          const jaAlocado = alocado[atributo] ?? 0;
          return (
            <button
              key={atributo}
              type="button"
              disabled={pontosRestantes <= 0}
              onClick={() => investirUm(atributo)}
              className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-left hover:border-emerald-500 hover:bg-slate-800/70 transition-colors disabled:opacity-40 disabled:hover:border-slate-700 flex items-center justify-between"
            >
              <span>
                {atributo.replaceAll("_", " ")}
                <span className="text-xs text-slate-400 ml-2">{prioritario ? "prioritário, +1.5/ponto" : "+1/ponto"}</span>
              </span>
              <span className="font-medium tabular-nums">
                {Math.round(valorAtual)}
                {jaAlocado > 0 && <span className="text-emerald-400"> (+{jaAlocado})</span>}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={somaAlocada === 0}
        onClick={confirmar}
        className="mt-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 transition-colors px-4 py-2.5 font-medium"
      >
        Confirmar
      </button>
    </div>
  );
}

function PromptCenario({ titulo, descricao, opcoes, onEscolher }: { titulo: string; descricao: string; opcoes: Opcao[]; onEscolher: (opcao: Opcao) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <p className="text-sm text-slate-400">{descricao}</p>
      <div className="grid gap-2">
        {opcoes.map((opcao) => (
          <button
            key={opcao.id}
            type="button"
            onClick={() => onEscolher(opcao)}
            className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-left hover:border-emerald-500 hover:bg-slate-800/70 transition-colors"
          >
            <div className="font-medium">{opcao.texto}</div>
            {formatarProbabilidadeSimNao(opcao.resultados) && <div className="mt-1 text-xs font-medium text-emerald-400">{formatarProbabilidadeSimNao(opcao.resultados)}</div>}
            <div className="mt-1 flex flex-col gap-0.5">
              {opcao.resultados.map((resultado, indice) => (
                <span key={indice} className="text-xs text-slate-400">
                  {formatarImpactoResumido(resultado.impacto)}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Feed({
  eventos,
  clubePorId,
  nomePorCampeonato,
  faixasPorCampeonato,
}: {
  eventos: EventoDeFeed[];
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
  faixasPorCampeonato: Map<string, FaixasDeDestaqueDaTabela>;
}) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-4 flex flex-col gap-2 text-slate-100">
      <h2 className="text-sm font-semibold text-slate-400 px-1">Partidas e eventos da temporada</h2>
      <div className="flex flex-col gap-2 max-h-[28rem] overflow-y-auto pr-1">
        {eventos.length === 0 ? (
          <p className="text-sm text-slate-500 px-1 py-2">Nada aconteceu ainda — os placares e eventos vão aparecer aqui, mais recentes primeiro.</p>
        ) : (
          eventos.map((evento) => (
            <EventoCard key={evento.id} evento={evento} clubePorId={clubePorId} nomePorCampeonato={nomePorCampeonato} faixasPorCampeonato={faixasPorCampeonato} />
          ))
        )}
      </div>
    </div>
  );
}

function EventoCard({
  evento,
  clubePorId,
  nomePorCampeonato,
  faixasPorCampeonato,
}: {
  evento: EventoDeFeed;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
  faixasPorCampeonato: Map<string, FaixasDeDestaqueDaTabela>;
}) {
  switch (evento.tipo) {
    case "nivel":
      return (
        <Card destaque>
          🎉 Subiu para o nível {evento.info.nivelNovo}! (+{evento.info.pontosGanhos} ponto(s))
        </Card>
      );
    case "cenario":
      return (
        <Card>
          <span className="font-medium">{evento.cenario.titulo}</span> — "{evento.opcao.texto}" → {evento.narrativa}
        </Card>
      );
    case "negociacao": {
      const { negociacao } = evento;
      const rotulo = negociacao.tipo === "venda_forcada" ? "Venda forçada" : "Proposta de transferência";
      if (negociacao.contrapropostaJogador === "recusar" || !negociacao.resultado) {
        return (
          <Card>
            [{rotulo}] {nomeDoClube(clubePorId, negociacao.clubeOfertanteId)} — recusada sem negociar, seguiu no clube atual
          </Card>
        );
      }
      const desfecho = negociacao.resultado.aceito ? "ACEITA!" : "recusada";
      return (
        <Card destaque={negociacao.resultado.aceito}>
          [{rotulo}] {nomeDoClube(clubePorId, negociacao.clubeOfertanteId)} — {desfecho}
        </Card>
      );
    }
    case "partida_propria": {
      const { confronto, resultado } = evento.info.evento;
      return (
        <Card destaque>
          {nomeDoClube(clubePorId, confronto.mandante)} {resultado.golsCasa} x {resultado.golsFora} {nomeDoClube(clubePorId, confronto.visitante)}
          {resultado.chancesJogador.length > 0 && (
            <span className="text-slate-400"> — suas chances: {resultado.chancesJogador.length} ({resultado.chancesJogador.filter((c) => c.sucesso).length} bem-sucedidas)</span>
          )}{" "}
          <RotuloTitular titular={evento.info.titular} />
        </Card>
      );
    }
    case "partida_rodada": {
      const { confronto, resultado } = evento.info.evento;
      return (
        <Card sutil>
          {nomeDoClube(clubePorId, confronto.mandante)} {resultado.golsCasa} x {resultado.golsFora} {nomeDoClube(clubePorId, confronto.visitante)}
        </Card>
      );
    }
    case "partida_mata_mata": {
      const { etapa, confronto } = evento.info.evento;
      const decisao = confronto.decididoNosPenaltis ? ` (nos pênaltis${confronto.penaltis ? `, ${confronto.penaltis.golsA} x ${confronto.penaltis.golsB}` : ""})` : "";
      const titularPorPartida = evento.info.titularPorPartida ?? [];
      return (
        <Card destaque>
          [{rotuloEtapa(etapa)}] {nomeDoClube(clubePorId, confronto.timeA)} {confronto.golsA} x {confronto.golsB} {nomeDoClube(clubePorId, confronto.timeB)}
          {decisao} — vencedor: {nomeDoClube(clubePorId, confronto.vencedor)}{" "}
          {titularPorPartida.length === 2 ? (
            <>
              <RotuloTitular titular={titularPorPartida[0]} /> (ida) <RotuloTitular titular={titularPorPartida[1]} /> (volta)
            </>
          ) : (
            <RotuloTitular titular={titularPorPartida[0]} />
          )}
        </Card>
      );
    }
    case "status":
      return (
        <Card>
          Status no elenco: {evento.info.statusAnterior} → {evento.info.statusNovo} (nota média {evento.info.notaMedia.toFixed(1)})
        </Card>
      );
    case "tabela":
      return (
        <TabelaCard
          campeonatoId={evento.campeonatoId}
          periodo={evento.periodo}
          tabela={evento.tabela}
          clubePorId={clubePorId}
          nomePorCampeonato={nomePorCampeonato}
          faixas={faixasPorCampeonato.get(evento.campeonatoId)}
        />
      );
  }
}

/**
 * Gira mostrando CADA possibilidade por `TEMPO_POR_CANDIDATO_MS` (tempo suficiente pra ler a
 * narrativa de cada uma, não só o número — pedido do usuário: "os spins estão muito rápidos e não
 * dá pra ler o output"), completando pelo menos `VOLTAS_MINIMAS` voltas pela lista inteira antes de
 * parar — sempre no `indiceResultado` de verdade (nunca no índice errado por coincidência de
 * tempo, já que o nº de passos é calculado, não medido por relógio). Só então chama `onConcluir`
 * (com um atraso extra pro jogador terminar de ler onde parou antes da tela sumir).
 */
const TEMPO_POR_CANDIDATO_MS = 550;
const VOLTAS_MINIMAS = 1;
const PAUSA_APOS_PARAR_MS = 700;

function PainelAnimacaoDeEscolha({ animacao, onConcluir }: { animacao: AnimacaoDeEscolhaPendente; onConcluir: () => void }) {
  const { cenarioResolvido, indiceResultado } = animacao;
  const { cenario, escolha } = cenarioResolvido;
  const { opcao } = escolha;
  const totalCandidatos = opcao.resultados.length;
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [parou, setParou] = useState(false);

  useEffect(() => {
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout>;

    function parar(): void {
      setIndiceAtual(indiceResultado);
      setParou(true);
      timer = setTimeout(() => {
        if (!cancelado) onConcluir();
      }, PAUSA_APOS_PARAR_MS);
    }

    // Opção "garantida" (probabilidade 1, 1 resultado só) não tem o que girar — revela direto, sem
    // fingir suspense onde não existe.
    if (totalCandidatos <= 1) {
      parar();
      return () => {
        cancelado = true;
        clearTimeout(timer);
      };
    }

    // Passos suficientes pra passar pela lista inteira `VOLTAS_MINIMAS` vezes e ainda assim
    // terminar EXATAMENTE no `indiceResultado` (índice do passo N = N % totalCandidatos).
    const passosTotais = VOLTAS_MINIMAS * totalCandidatos + indiceResultado;
    let passo = 0;

    function tick(): void {
      if (cancelado) return;
      if (passo >= passosTotais) {
        parar();
        return;
      }
      passo++;
      setIndiceAtual(passo % totalCandidatos);
      timer = setTimeout(tick, TEMPO_POR_CANDIDATO_MS);
    }

    timer = setTimeout(tick, TEMPO_POR_CANDIDATO_MS);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
    // Roda 1x por montagem (o painel só existe enquanto há uma animação pendente — uma nova
    // animação sempre remonta o componente do zero, ver o `animacaoDeEscolha ?` no render principal).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6 flex flex-col gap-4 items-center text-center text-slate-100">
      <h2 className="text-lg font-semibold">{cenario.titulo}</h2>
      <p className="text-sm text-slate-400">{opcao.texto}</p>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {opcao.resultados.map((resultado, indice) => (
          <div
            key={indice}
            className={`rounded-lg border px-4 py-3 transition-colors ${
              indice !== indiceAtual ? "bg-slate-800/40 border-slate-800 opacity-50" : parou ? "bg-emerald-950/60 border-emerald-500" : "bg-slate-800 border-emerald-600"
            }`}
          >
            <div className="text-sm font-medium">{Math.round(resultado.probabilidade * 100)}%</div>
            <div className="text-sm mt-1">{resultado.impacto.narrativa}</div>
            <div className="text-xs text-slate-400 mt-1">{formatarImpactoResumido(resultado.impacto)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Pausa entre a revelação da ida e da volta — o motor já resolveu as 2 pernas de uma vez (mesmo em "simulação rápida"), isto é puro ritmo de apresentação (pedido do usuário: mostrar a ida separada da volta, com uma pausa entre elas). */
const PAUSA_ENTRE_IDA_E_VOLTA_MS = 1400;

/** Selo "Titular"/"Reserva" NESSA partida específica — diferente do "Status no elenco" (contrato/temporada inteira, ver `career/status.ts`). Pedido do usuário: mostrar se ele jogou como titular ou reserva naquela partida, não seu status de contrato com o clube. */
function RotuloTitular({ titular }: { titular?: boolean }) {
  if (titular === undefined) return null;
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${titular ? "bg-emerald-800/60 text-emerald-300" : "bg-slate-700/60 text-slate-300"}`}>{titular ? "Titular" : "Reserva"}</span>;
}

/** Placar entre parênteses de UM time (ida do mandante/visitante) — só aparece na linha da Volta, ao lado do nome do respectivo time, pra deixar claro o placar acumulado sem precisar de uma 3ª linha antes do agregado. Pedido do usuário: "(1) Santos X x Y Palmeiras (0)". */
function PlacarDaIdaEntreParenteses({ gols }: { gols: number }) {
  return <span className="text-slate-500 tabular-nums text-xs">({gols})</span>;
}

function LinhaDeConfrontoMataMata({
  rotulo,
  clubePorId,
  mandanteId,
  visitanteId,
  golsCasa,
  golsFora,
  pendente,
  titular,
  /** Placar da IDA do mandante/visitante — só passado na linha da Volta (pedido do usuário: mostrar o placar da ida ao lado do nome de cada time na linha da volta, em vez de uma linha "Ida" separada de novo). `undefined` na própria linha da Ida (mostrada normal, sem anotação) e em jogo único. */
  golsIdaMandante,
  golsIdaVisitante,
}: {
  rotulo: string;
  clubePorId: Map<string, Club>;
  mandanteId: string;
  visitanteId: string;
  golsCasa: number;
  golsFora: number;
  pendente?: boolean;
  titular?: boolean;
  golsIdaMandante?: number;
  golsIdaVisitante?: number;
}) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-1.5 border text-sm transition-opacity duration-300 ${pendente ? "opacity-40 bg-slate-800/40 border-slate-800" : "bg-slate-800/60 border-slate-700"}`}>
      <span className="text-xs font-semibold text-slate-400 w-12 shrink-0">{rotulo}</span>
      <span className="flex-1 flex items-center justify-end gap-1.5 text-right truncate">
        {golsIdaMandante !== undefined && <PlacarDaIdaEntreParenteses gols={golsIdaMandante} />}
        {nomeDoClube(clubePorId, mandanteId)}
        <Escudo url={escudoDoClube(clubePorId, mandanteId)} alt="" tamanho={16} />
      </span>
      <span className="px-3 font-medium tabular-nums shrink-0">{pendente ? "? x ?" : `${golsCasa} x ${golsFora}`}</span>
      <span className="flex-1 flex items-center gap-1.5 truncate">
        <Escudo url={escudoDoClube(clubePorId, visitanteId)} alt="" tamanho={16} />
        {nomeDoClube(clubePorId, visitanteId)}
        {golsIdaVisitante !== undefined && <PlacarDaIdaEntreParenteses gols={golsIdaVisitante} />}
      </span>
      {!pendente && <RotuloTitular titular={titular} />}
    </div>
  );
}

function PainelResultadoDaRodada({
  resultadoDaRodada,
  clubePorId,
  nomePorCampeonato,
  faixasPorCampeonato,
  onAvancar,
}: {
  resultadoDaRodada: ResultadoDaRodadaExibido;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
  faixasPorCampeonato: Map<string, FaixasDeDestaqueDaTabela>;
  onAvancar: () => void;
}) {
  const temIdaEVolta = resultadoDaRodada.tipo === "mata_mata" && !!resultadoDaRodada.ida && !!resultadoDaRodada.volta;
  const [voltaRevelada, setVoltaRevelada] = useState(false);

  useEffect(() => {
    if (!temIdaEVolta || voltaRevelada) return;
    const timer = setTimeout(() => setVoltaRevelada(true), PAUSA_ENTRE_IDA_E_VOLTA_MS);
    return () => clearTimeout(timer);
  }, [temIdaEVolta, voltaRevelada]);

  const aguardandoVolta = temIdaEVolta && !voltaRevelada;

  return (
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6 flex flex-col gap-4 text-slate-100">
      {resultadoDaRodada.tipo === "pontos_corridos" ? (
        <>
          <h2 className="text-lg font-semibold">
            {nomeDoCampeonato(nomePorCampeonato, resultadoDaRodada.campeonatoId)} — Rodada {resultadoDaRodada.rodada}, resultados
          </h2>
          <div className="flex flex-col gap-1.5 text-sm">
            {resultadoDaRodada.confrontos.map((c, indice) => (
              <div
                key={indice}
                className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${c.ehDoJogador ? "bg-emerald-950/60 border border-emerald-800" : "bg-slate-800/60"}`}
              >
                <span className="flex-1 flex items-center justify-end gap-1.5 text-right truncate">
                  {nomeDoClube(clubePorId, c.mandanteId)}
                  <Escudo url={escudoDoClube(clubePorId, c.mandanteId)} alt="" tamanho={16} />
                </span>
                <span className="px-3 font-medium tabular-nums shrink-0">
                  {c.golsCasa} x {c.golsFora}
                </span>
                <span className="flex-1 flex items-center gap-1.5 truncate">
                  <Escudo url={escudoDoClube(clubePorId, c.visitanteId)} alt="" tamanho={16} />
                  {nomeDoClube(clubePorId, c.visitanteId)}
                </span>
                {c.ehDoJogador && <RotuloTitular titular={c.titular} />}
              </div>
            ))}
          </div>
          {resultadoDaRodada.tabela && (
            <div>
              <div className="text-sm font-medium text-slate-300 mb-1.5">Classificação</div>
              <TabelaCard
                campeonatoId={resultadoDaRodada.campeonatoId}
                periodo={`rodada ${resultadoDaRodada.rodada}`}
                tabela={resultadoDaRodada.tabela}
                clubePorId={clubePorId}
                nomePorCampeonato={nomePorCampeonato}
                faixas={faixasPorCampeonato.get(resultadoDaRodada.campeonatoId)}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold">
            {nomeDoCampeonato(nomePorCampeonato, resultadoDaRodada.campeonatoId)} — {rotuloEtapa(resultadoDaRodada.etapa)}, resultado
          </h2>
          {temIdaEVolta && resultadoDaRodada.ida && resultadoDaRodada.volta ? (
            <div className="flex flex-col gap-1.5">
              <LinhaDeConfrontoMataMata
                rotulo="Ida"
                clubePorId={clubePorId}
                mandanteId={resultadoDaRodada.confrontoDoJogador.mandanteId}
                visitanteId={resultadoDaRodada.confrontoDoJogador.visitanteId}
                golsCasa={resultadoDaRodada.ida.golsCasa}
                golsFora={resultadoDaRodada.ida.golsFora}
                titular={resultadoDaRodada.titularIda}
              />
              <LinhaDeConfrontoMataMata
                rotulo="Volta"
                clubePorId={clubePorId}
                mandanteId={resultadoDaRodada.confrontoDoJogador.mandanteId}
                visitanteId={resultadoDaRodada.confrontoDoJogador.visitanteId}
                golsCasa={resultadoDaRodada.volta.golsCasa}
                golsFora={resultadoDaRodada.volta.golsFora}
                pendente={aguardandoVolta}
                titular={resultadoDaRodada.titularVolta}
                golsIdaMandante={resultadoDaRodada.ida.golsCasa}
                golsIdaVisitante={resultadoDaRodada.ida.golsFora}
              />
              {voltaRevelada && (
                <>
                  <div
                    className={`flex items-center justify-between rounded-lg px-3 py-1.5 border text-sm font-medium ${resultadoDaRodada.eliminado ? "bg-red-950/40 border-red-800" : "bg-emerald-950/60 border-emerald-800"}`}
                  >
                    <span>Agregado</span>
                    <span className="tabular-nums">
                      {resultadoDaRodada.confrontoDoJogador.golsCasa} x {resultadoDaRodada.confrontoDoJogador.golsFora}
                    </span>
                  </div>
                  {resultadoDaRodada.decididoNosPenaltis && resultadoDaRodada.penaltis && (
                    <div className="flex items-center justify-between rounded-lg px-3 py-1.5 border border-slate-700 bg-slate-800/60 text-sm text-slate-300">
                      <span>Pênaltis</span>
                      <span className="tabular-nums">
                        {resultadoDaRodada.penaltis.golsCasa} x {resultadoDaRodada.penaltis.golsFora}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div
              className={`flex items-center justify-between rounded-lg px-3 py-1.5 border text-sm ${resultadoDaRodada.eliminado ? "bg-red-950/40 border-red-800" : "bg-emerald-950/60 border-emerald-800"}`}
            >
              <span className="flex-1 flex items-center justify-end gap-1.5 text-right truncate">
                {nomeDoClube(clubePorId, resultadoDaRodada.confrontoDoJogador.mandanteId)}
                <Escudo url={escudoDoClube(clubePorId, resultadoDaRodada.confrontoDoJogador.mandanteId)} alt="" tamanho={16} />
              </span>
              <span className="px-3 font-medium tabular-nums shrink-0">
                {resultadoDaRodada.confrontoDoJogador.golsCasa} x {resultadoDaRodada.confrontoDoJogador.golsFora}
              </span>
              <span className="flex-1 flex items-center gap-1.5 truncate">
                <Escudo url={escudoDoClube(clubePorId, resultadoDaRodada.confrontoDoJogador.visitanteId)} alt="" tamanho={16} />
                {nomeDoClube(clubePorId, resultadoDaRodada.confrontoDoJogador.visitanteId)}
              </span>
              <RotuloTitular titular={resultadoDaRodada.titularIda} />
            </div>
          )}
          {!temIdaEVolta && resultadoDaRodada.decididoNosPenaltis && resultadoDaRodada.penaltis && (
            <div className="flex items-center justify-between rounded-lg px-3 py-1.5 border border-slate-700 bg-slate-800/60 text-sm text-slate-300">
              <span>Pênaltis</span>
              <span className="tabular-nums">
                {resultadoDaRodada.penaltis.golsCasa} x {resultadoDaRodada.penaltis.golsFora}
              </span>
            </div>
          )}
          {!aguardandoVolta && (
            <p className={resultadoDaRodada.eliminado ? "text-red-400 text-sm font-medium" : "text-emerald-400 text-sm font-medium"}>
              {resultadoDaRodada.eliminado ? "Eliminado(a) dessa competição." : "Avançou para a próxima fase!"}
            </p>
          )}
        </>
      )}
      <button
        type="button"
        onClick={onAvancar}
        disabled={aguardandoVolta}
        className="self-start rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-4 py-2.5 font-medium text-sm"
      >
        Avançar pra próxima semana
      </button>
    </div>
  );
}

/** Tempo entre a revelação de cada grupo — o motor já sorteou tudo antes deste painel aparecer (ver `useTemporada.ts` `onSorteioDeGrupos`), isto é puro ritmo de apresentação. */
const INTERVALO_REVELACAO_GRUPO_MS = 450;

function PainelSorteio({
  sorteio,
  clubePorId,
  nomePorCampeonato,
  onContinuar,
}: {
  sorteio: SorteioDeGruposNaTemporada;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
  onContinuar: () => void;
}) {
  const [gruposRevelados, setGruposRevelados] = useState(0);

  useEffect(() => {
    if (gruposRevelados >= sorteio.grupos.length) return;
    const timer = setTimeout(() => setGruposRevelados((atual) => atual + 1), INTERVALO_REVELACAO_GRUPO_MS);
    return () => clearTimeout(timer);
  }, [gruposRevelados, sorteio.grupos.length]);

  const concluido = gruposRevelados >= sorteio.grupos.length;

  return (
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6 flex flex-col gap-4 items-center text-center text-slate-100">
      <h2 className="text-lg font-semibold">Sorteio dos grupos — {nomeDoCampeonato(nomePorCampeonato, sorteio.campeonatoId)}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        {sorteio.grupos.map((grupo, indice) => (
          <div
            key={grupo.nome}
            className={`rounded-lg border px-3 py-2.5 text-left transition-opacity duration-300 ${
              indice < gruposRevelados ? "opacity-100 bg-slate-800 border-emerald-700" : "opacity-40 bg-slate-800/40 border-slate-800"
            }`}
          >
            <div className="text-xs font-semibold text-emerald-400 mb-1">{grupo.nome}</div>
            {indice < gruposRevelados ? (
              <ul className="text-xs text-slate-300 flex flex-col gap-0.5">
                {grupo.times.map((clubeId) => (
                  <li key={clubeId} className="flex items-center gap-1.5">
                    <Escudo url={escudoDoClube(clubePorId, clubeId)} alt="" tamanho={14} />
                    {nomeDoClube(clubePorId, clubeId)}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-slate-600">sorteando...</div>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onContinuar}
        disabled={!concluido}
        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-4 py-2.5 font-medium text-sm"
      >
        Continuar
      </button>
    </div>
  );
}

function PainelChaveamento({
  chaveamento,
  clubePorId,
  nomePorCampeonato,
  onContinuar,
}: {
  chaveamento: ChaveamentoDeMataMataNaTemporada;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
  onContinuar: () => void;
}) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6 flex flex-col gap-4 items-center text-center text-slate-100">
      <h2 className="text-lg font-semibold">Chaveamento definido — {nomeDoCampeonato(nomePorCampeonato, chaveamento.campeonatoId)}</h2>
      <p className="text-sm text-slate-400">{rotuloEtapa(chaveamento.etapaNome)}</p>
      <div className="flex flex-col gap-1.5 w-full max-w-sm text-sm">
        {chaveamento.pares.map(([mandanteId, visitanteId], indice) => (
          <div key={indice} className="flex items-center justify-between rounded-lg px-3 py-1.5 bg-slate-800/60">
            <span className="flex-1 flex items-center justify-end gap-1.5 text-right truncate">
              {nomeDoClube(clubePorId, mandanteId)}
              <Escudo url={escudoDoClube(clubePorId, mandanteId)} alt="" tamanho={16} />
            </span>
            <span className="px-3 text-slate-500 text-xs shrink-0">x</span>
            <span className="flex-1 flex items-center gap-1.5 truncate">
              <Escudo url={escudoDoClube(clubePorId, visitanteId)} alt="" tamanho={16} />
              {nomeDoClube(clubePorId, visitanteId)}
            </span>
          </div>
        ))}
      </div>
      <button type="button" onClick={onContinuar} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors px-4 py-2.5 font-medium text-sm">
        Continuar
      </button>
    </div>
  );
}

function TabelaCard({
  campeonatoId,
  periodo,
  tabela,
  clubePorId,
  nomePorCampeonato,
  faixas,
}: {
  campeonatoId: string;
  periodo: string;
  tabela: LinhaTabela[];
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
  faixas?: FaixasDeDestaqueDaTabela;
}) {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 text-slate-100">
      <div className="text-sm font-medium mb-2">
        {nomeDoCampeonato(nomePorCampeonato, campeonatoId)} — resumo do período {periodo}
      </div>
      <div className="overflow-x-auto overflow-y-auto max-h-72">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="text-slate-400 text-left sticky top-0 bg-slate-900">
              <th className="pr-2 py-1">Pos</th>
              <th className="pr-2 py-1">Clube</th>
              <th className="pr-2 py-1 text-right">Pts</th>
              <th className="pr-2 py-1 text-right">J</th>
              <th className="pr-2 py-1 text-right">V</th>
              <th className="pr-2 py-1 text-right">E</th>
              <th className="pr-2 py-1 text-right">D</th>
            </tr>
          </thead>
          <tbody>
            {tabela.map((linha, indice) => (
              <tr key={linha.clubeId} className={`border-t border-slate-800 ${classeFaixaDaLinha(indice, tabela.length, faixas)}`}>
                <td className="pr-2 py-1">{indice + 1}</td>
                <td className="pr-2 py-1">
                  <span className="flex items-center gap-1.5">
                    <Escudo url={escudoDoClube(clubePorId, linha.clubeId)} alt="" tamanho={14} />
                    {nomeDoClube(clubePorId, linha.clubeId)}
                  </span>
                </td>
                <td className="pr-2 py-1 text-right">{linha.pontos}</td>
                <td className="pr-2 py-1 text-right">{linha.jogos}</td>
                <td className="pr-2 py-1 text-right">{linha.vitorias}</td>
                <td className="pr-2 py-1 text-right">{linha.empates}</td>
                <td className="pr-2 py-1 text-right">{linha.derrotas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LegendaDeFaixas faixas={faixas} />
    </div>
  );
}

function Card({ children, destaque, sutil }: { children: React.ReactNode; destaque?: boolean; sutil?: boolean }) {
  return (
    <div
      className={`rounded-lg px-4 py-2.5 text-sm border ${
        destaque ? "bg-emerald-950/40 border-emerald-800" : sutil ? "bg-slate-900/50 border-slate-800/50 text-slate-400" : "bg-slate-900 border-slate-800"
      }`}
    >
      {children}
    </div>
  );
}

function ResumoDeTemporada({
  resultado,
  clubePorId,
  nomePorCampeonato,
  tacaPorCampeonato,
  estatisticasCarreira,
  onVerPropostas,
}: {
  resultado: NonNullable<ReturnType<typeof useTemporada>["resultado"]>;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
  tacaPorCampeonato: Map<string, InfoTacasDaCompeticao>;
  estatisticasCarreira: EstatisticasCarreira;
  onVerPropostas: () => void;
}) {
  const [resumoDeCampeoesAberto, setResumoDeCampeoesAberto] = useState(false);

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-6 flex flex-col gap-4 text-slate-100">
      <h2 className="text-xl font-semibold">Fim da temporada {resultado.resultadoTemporada.temporada}</h2>
      <p className="text-sm text-slate-400">
        Overall {resultado.resumoPartidas.overallAntes} → {resultado.resumoPartidas.overallDepois}
      </p>

      {/* Fechado por padrão — pedido do usuário: "o resumo dos campeões de cada temporada não
          precisa aparecer, pode ser uma aba que fica fechada mas o player pode expandir" (a lista
          cobre TODAS as competições do jogo, não só as do jogador — dezenas de linhas). Os títulos
          do PRÓPRIO jogador continuam sempre visíveis, sem precisar expandir (`PainelEstatisticas`
          "Títulos" logo abaixo). */}
      <button
        type="button"
        onClick={() => setResumoDeCampeoesAberto((atual) => !atual)}
        className="flex items-center justify-between rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-colors px-3 py-2 text-sm text-slate-300"
      >
        <span>Campeões de todas as competições ({resultado.resumoPartidas.competicoes.length})</span>
        <span className="text-slate-500">{resumoDeCampeoesAberto ? "▲ recolher" : "▼ expandir"}</span>
      </button>
      {resumoDeCampeoesAberto && (
        <div className="flex flex-col gap-2">
          {resultado.resumoPartidas.competicoes.map((c) => (
            <div key={c.campeonatoId} className="rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
              {c.erro ? (
                <span className="text-slate-500">
                  ✗ {nomeDoCampeonato(nomePorCampeonato, c.campeonatoId)}: não simulada ({c.erro})
                </span>
              ) : (
                <span>
                  ✓ {nomeDoCampeonato(nomePorCampeonato, c.campeonatoId)}: campeão {nomeDoClube(clubePorId, c.campeao!)}
                  {c.partidasDoJogador > 0 && (
                    <span className="text-slate-400">
                      {" "}
                      — você jogou {c.partidasDoJogador} partida(s), {c.golsDoJogador} gol(s), {c.assistenciasDoJogador} assistência(s)
                    </span>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {resultado.statusAtualizado && (
        <p className="text-sm text-slate-400 border-t border-slate-800 pt-3">
          Status no elenco: {resultado.statusAtualizado.statusAnterior} → {resultado.statusAtualizado.statusNovo} (nota média {resultado.statusAtualizado.notaMedia.toFixed(1)})
        </p>
      )}

      <div className="border-t border-slate-800 pt-3">
        <PainelEstatisticas estatisticas={estatisticasCarreira} nomePorCampeonato={nomePorCampeonato} tacaPorCampeonato={tacaPorCampeonato} />
      </div>

      <button type="button" onClick={onVerPropostas} className="mt-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors px-4 py-2.5 font-medium">
        Ver propostas
      </button>
    </div>
  );
}

function PainelPropostasFimDeTemporada({
  propostas,
  clubePorId,
  nomeClubeAtual,
  onResponder,
}: {
  propostas: PropostasDeFimDeTemporada;
  clubePorId: Map<string, Club>;
  nomeClubeAtual: string;
  onResponder: (escolha: EscolhaDeFimDeTemporada) => void;
}) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-6 flex flex-col gap-4 text-slate-100">
      <h2 className="text-xl font-semibold">Propostas de fim de temporada</h2>
      <p className="text-sm text-slate-400">Escolha renovar com {nomeClubeAtual} ou aceitar a proposta de outro clube antes de seguir pra próxima temporada.</p>

      {propostas.renovacao && (
        <CardDePropostaFimDeTemporada
          titulo={`Renovar com ${nomeClubeAtual}`}
          proposta={propostas.renovacao}
          clubePorId={clubePorId}
          destaque
          onAceitar={() => onResponder({ tipo: "renovar" })}
        />
      )}

      {propostas.propostas.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
          <h3 className="text-sm font-semibold text-slate-300">Propostas de outros clubes</h3>
          {propostas.propostas.map((proposta) => (
            <CardDePropostaFimDeTemporada
              key={proposta.clubeOfertanteId}
              titulo={nomeDoClube(clubePorId, proposta.clubeOfertanteId)}
              proposta={proposta}
              clubePorId={clubePorId}
              onAceitar={() => onResponder({ tipo: "transferir", clubeOfertanteId: proposta.clubeOfertanteId })}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onResponder({ tipo: "ficar_sem_assinar" })}
        className="mt-2 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm hover:border-emerald-500 hover:bg-slate-800/70 transition-colors"
      >
        Recusar tudo e continuar em {nomeClubeAtual}
      </button>
    </div>
  );
}

function CardDePropostaFimDeTemporada({
  titulo,
  proposta,
  clubePorId,
  destaque,
  onAceitar,
}: {
  titulo: string;
  proposta: PropostaTransferencia;
  clubePorId: Map<string, Club>;
  destaque?: boolean;
  onAceitar: () => void;
}) {
  const termos = proposta.propostaInicial;
  return (
    <div className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 ${destaque ? "bg-emerald-950/40 border-emerald-700" : "bg-slate-800/60 border-slate-700"}`}>
      <div className="flex items-center gap-2 min-w-0">
        <Escudo url={escudoDoClube(clubePorId, proposta.clubeOfertanteId)} alt={titulo} tamanho={22} />
        <div className="min-w-0">
          <div className="font-medium truncate">{titulo}</div>
          <div className="text-xs text-slate-400">
            {ROTULO_STATUS[proposta.statusOferecido]} · R${formatarMoeda(termos.salarioMensal)}/mês + R${formatarMoeda(termos.luvas)} luvas · {termos.anos} anos
          </div>
        </div>
      </div>
      <button type="button" onClick={onAceitar} className="shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors px-3 py-1.5 text-sm font-medium">
        Aceitar
      </button>
    </div>
  );
}
