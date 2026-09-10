import { useEffect, useMemo, useRef, useState } from "react";
import type { PeriodoCalendario } from "@motor/schemas/calendar.js";
import { construirCalendarioPadrao } from "@motor/data/loaders/calendario.js";
import type { Club } from "@motor/schemas/club.js";
import { ATRIBUTOS_POR_POSICAO, buscarArquetipo, NACIONALIDADES_CONMEBOL, type Atributo, type Posicao } from "@motor/schemas/player.js";
import { overallAtual, type EstadoDeCarreira } from "@motor/career/Player.js";
import { xpParaProximoNivel, type FocoDeTreino } from "@motor/progression/xp.js";
import type { ImpactoCarreira, Opcao } from "@motor/progression/scenarios.js";
import type { LinhaTabela } from "@motor/simulation/season.js";
import type { ContextoDecisaoChance, EventoAoVivo, ResultadoDecisaoChance } from "@motor/simulation/live-match.js";
import { probabilidadeDeDuelo } from "@motor/simulation/match.js";
import type { SubtipoChance } from "@motor/simulation/tactics.js";
import type { AlocacaoDePontos, AoIniciarSemanaInfo, ChaveamentoDeMataMataNaTemporada, ContextoPartidaDoJogadorSemanal, SorteioDeGruposNaTemporada } from "@motor/career/career-loop.js";
import { contrapropostaPadrao } from "@motor/market/negotiation.js";
import type { PropostaTransferencia, TermosDeContrato } from "@motor/market/transfers.js";
import { temporadaDeVencimento } from "@motor/schemas/contract.js";
import {
  useTemporada,
  type AnimacaoDeEscolhaPendente,
  type EscolhaDePrePartida,
  type EstatisticasCarreira,
  type EventoDeFeed,
  type JogoDaSemana,
  type PartidaAoVivoEmAndamento,
  type PromptPendente,
  type ResultadoDaRodadaExibido,
} from "./useTemporada.js";
import { Escudo } from "../../components/Escudo.js";
import { corDeTextoContrastante } from "../../lib/contraste.js";
import { RadarDeAtributos } from "./RadarDeAtributos.js";
import type { StatusNoClube } from "@motor/career/status.js";

const ROTULO_POSICAO: Record<Posicao, string> = {
  goleiro: "Goleiro",
  zagueiro: "Zagueiro",
  lateral: "Lateral",
  volante: "Volante",
  meia: "Meia",
  atacante: "Atacante",
};

const ROTULO_FOCO: Record<FocoDeTreino, string> = {
  fisico: "Físico",
  tecnico: "Técnico",
  tatico: "Tático",
  descanso: "Descanso",
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
  } = temporada;
  const nomeDaNacionalidade = NACIONALIDADES_CONMEBOL.find((n) => n.codigo === estadoAtual.jogador.nacionalidade)?.nome ?? estadoAtual.jogador.nacionalidade;
  const promptSemana = promptPendente?.tipo === "semana" ? promptPendente : undefined;
  const promptPrePartida = promptPendente?.tipo === "pre_partida" ? promptPendente : undefined;
  const promptSeguirCampeonatos = promptPendente?.tipo === "seguir_campeonatos" ? promptPendente : undefined;
  const promptDaPartidaAoVivo = promptPendente?.tipo === "chance_ao_vivo" || promptPendente?.tipo === "evento_ao_vivo" ? promptPendente : undefined;
  const promptDeCarreira = promptPendente && !promptSemana && !promptPrePartida && !promptSeguirCampeonatos && !promptDaPartidaAoVivo ? promptPendente : undefined;
  const lesionado = estadoAtual.bandeirasNarrativas.includes("lesionado");
  const { resultadoDaRodada, animacaoDeEscolha, sorteioPendente, chaveamentoPendente } = temporada;
  const corDeFundo = clubePorId.get(estadoAtual.clubeAtualId)?.cor_primaria;

  return (
    <div
      className="min-h-screen p-6 transition-colors"
      style={{ backgroundColor: corDeFundo ?? "#020617", color: corDeFundo ? corDeTextoContrastante(corDeFundo) : "#f1f5f9" }}
    >
      <CalendarioSemanalLateral
        temporada={estadoAtual.temporada}
        semanaAtual={temporada.semanaAtual}
        jogoDaSemana={temporada.jogoDaSemana}
        clubePorId={clubePorId}
        nomePorCampeonato={nomePorCampeonato}
      />
      {temporada.simulandoAutomaticamente && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-full bg-slate-900/95 border border-slate-800 shadow-xl px-4 py-2 text-xs backdrop-blur">
          <span className="text-slate-300">Simulando semanas automaticamente…</span>
          <button type="button" onClick={temporada.pararSimulacaoAutomatica} className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
            Parar e voltar ao normal
          </button>
        </div>
      )}
      {competicoesDoJogador.length > 0 && (
        <PainelDeCompeticoes
          competicoesDoJogador={competicoesDoJogador}
          tabelaPorCampeonato={tabelaPorCampeonato}
          faseMataMataPorCampeonato={faseMataMataPorCampeonato}
          grupoDoJogadorPorCampeonato={grupoDoJogadorPorCampeonato}
          clubeId={estadoAtual.clubeAtualId}
          clubePorId={clubePorId}
          nomePorCampeonato={nomePorCampeonato}
        />
      )}
      <div className="mx-auto max-w-3xl flex flex-col gap-4">
        <Cabecalho
          estado={estadoAtual}
          nomeClube={nomeDoClube(clubePorId, estadoAtual.clubeAtualId)}
          escudoClube={escudoDoClube(clubePorId, estadoAtual.clubeAtualId)}
          nomeDaNacionalidade={nomeDaNacionalidade}
          estatisticasCarreira={estatisticasCarreira}
          nomePorCampeonato={nomePorCampeonato}
          focoAutomatico={temporada.focoAutomatico}
          onDesligarTreinoAutomatico={temporada.desligarTreinoAutomatico}
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
        ) : sorteioPendente ? (
          <PainelSorteio sorteio={sorteioPendente} clubePorId={clubePorId} nomePorCampeonato={nomePorCampeonato} onContinuar={temporada.fecharSorteioDeGrupos} />
        ) : chaveamentoPendente ? (
          <PainelChaveamento chaveamento={chaveamentoPendente} clubePorId={clubePorId} nomePorCampeonato={nomePorCampeonato} onContinuar={temporada.fecharChaveamento} />
        ) : resultadoDaRodada ? (
          <PainelResultadoDaRodada resultadoDaRodada={resultadoDaRodada} clubePorId={clubePorId} nomePorCampeonato={nomePorCampeonato} onAvancar={temporada.responderResultadoDaRodada} />
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
                status={estadoAtual.statusNoClube}
                lesionado={lesionado}
                onEscolher={temporada.responderPrePartida}
              />
            )}
            {partidaAoVivo && (
              <PainelPartidaAoVivo
                partida={partidaAoVivo}
                clubePorId={clubePorId}
                prompt={promptDaPartidaAoVivo}
                onResponderChance={temporada.responderChanceAoVivo}
                onResponderEvento={temporada.responderEventoAoVivo}
              />
            )}
            {promptDeCarreira && <PainelDePrompt prompt={promptDeCarreira} temporada={temporada} />}
            {fase === "resumo" && resultado && (
              <ResumoDeTemporada
                resultado={resultado}
                clubePorId={clubePorId}
                nomePorCampeonato={nomePorCampeonato}
                estatisticasCarreira={estatisticasCarreira}
                onJogarProxima={() => void temporada.jogarTemporada()}
              />
            )}
          </>
        )}

        {/* O feed fica sempre visível (durante a temporada E depois do resumo) — é aqui que os
            placares das suas partidas aparecem conforme a temporada avança. */}
        <Feed eventos={feed} clubePorId={clubePorId} nomePorCampeonato={nomePorCampeonato} />
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
}: {
  temporada: number;
  semanaAtual: number;
  jogoDaSemana: JogoDaSemana | undefined;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
}) {
  const periodos = useMemo(() => construirCalendarioPadrao(temporada).calendario, [temporada]);
  const temTreino = periodos.some((p) => p.semanaInicio === semanaAtual && p.pontoDeTreino !== false);
  const { inicio } = intervaloDeSemana(temporada, semanaAtual);

  return (
    <div className="fixed top-4 left-4 z-10 w-56 rounded-xl bg-slate-900/95 border border-slate-800 shadow-xl p-3 flex flex-col gap-2 text-xs backdrop-blur">
      <h2 className="font-semibold text-slate-400">Semana {semanaAtual}</h2>
      <div className="flex flex-col gap-1">
        {ROTULOS_DIA_SEMANA.map((rotulo, indice) => {
          const data = new Date(inicio);
          data.setUTCDate(data.getUTCDate() + indice);
          const ehTreino = indice === INDICE_DIA_TREINO && temTreino;
          const ehJogo = indice === INDICE_DIA_JOGO && !!jogoDaSemana;

          return (
            <div key={rotulo} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${ehJogo ? "bg-emerald-950/60 border border-emerald-800" : ""}`}>
              <span className="w-14 shrink-0 text-slate-400">
                {rotulo} {formatarData(data)}
              </span>
              {ehJogo && jogoDaSemana && (
                <span className="text-emerald-400 truncate" title={`${nomeDoClube(clubePorId, jogoDaSemana.mandanteId)} x ${nomeDoClube(clubePorId, jogoDaSemana.visitanteId)}`}>
                  ⚽ {nomeDoCampeonato(nomePorCampeonato, jogoDaSemana.campeonatoId)}
                  {jogoDaSemana.resultado && ` (${jogoDaSemana.resultado.golsCasa}-${jogoDaSemana.resultado.golsFora})`}
                </span>
              )}
              {ehTreino && !ehJogo && <span className="text-slate-500">🏋️ treino</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PainelDeCompeticoes({
  competicoesDoJogador,
  tabelaPorCampeonato,
  faseMataMataPorCampeonato,
  grupoDoJogadorPorCampeonato,
  clubeId,
  clubePorId,
  nomePorCampeonato,
}: {
  competicoesDoJogador: string[];
  tabelaPorCampeonato: Map<string, LinhaTabela[]>;
  faseMataMataPorCampeonato: Map<string, { etapa: string; eliminado: boolean }>;
  grupoDoJogadorPorCampeonato: Map<string, string>;
  clubeId: string;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
}) {
  const [classificacaoAberta, setClassificacaoAberta] = useState(false);

  return (
    <>
      <div className="fixed top-4 right-4 z-10 w-56 rounded-xl bg-slate-900/95 border border-slate-800 shadow-xl p-3 flex flex-col gap-2 text-xs backdrop-blur">
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
            <div key={campeonatoId} className="border-t border-slate-800 pt-2 first:border-t-0 first:pt-0">
              <div className="font-medium text-slate-200">{nomeDoCampeonato(nomePorCampeonato, campeonatoId)}</div>
              {fase ? (
                <div className={fase.eliminado ? "text-slate-500" : "text-emerald-400"}>{fase.eliminado ? `Eliminado (${fase.etapa})` : fase.etapa}</div>
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
          grupoDoJogadorPorCampeonato={grupoDoJogadorPorCampeonato}
          clubeId={clubeId}
          clubePorId={clubePorId}
          nomePorCampeonato={nomePorCampeonato}
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
  grupoDoJogadorPorCampeonato,
  clubeId,
  clubePorId,
  nomePorCampeonato,
  onFechar,
}: {
  competicoesDoJogador: string[];
  tabelaPorCampeonato: Map<string, LinhaTabela[]>;
  faseMataMataPorCampeonato: Map<string, { etapa: string; eliminado: boolean }>;
  grupoDoJogadorPorCampeonato: Map<string, string>;
  clubeId: string;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
  onFechar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-4 sm:p-6" onClick={onFechar}>
      <div className="mx-auto max-w-2xl mt-6 mb-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-6 flex flex-col gap-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Classificação</h2>
          <button type="button" onClick={onFechar} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            Fechar
          </button>
        </div>
        {competicoesDoJogador.map((campeonatoId) => {
          const grupo = grupoDoJogadorPorCampeonato.get(campeonatoId);
          const mostrarGrupo = grupo && PADRAO_NOME_DE_GRUPO.test(grupo);
          const fase = faseMataMataPorCampeonato.get(campeonatoId);
          const tabela = tabelaPorCampeonato.get(campeonatoId);
          return (
            <div key={campeonatoId} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-200">
                {nomeDoCampeonato(nomePorCampeonato, campeonatoId)}
                {mostrarGrupo && <span className="text-slate-400 font-normal"> — {grupo}</span>}
              </h3>
              {fase ? (
                <p className={`text-sm ${fase.eliminado ? "text-slate-500" : "text-emerald-400"}`}>{fase.eliminado ? `Eliminado(a) na fase: ${fase.etapa}` : `Fase atual: ${fase.etapa}`}</p>
              ) : tabela ? (
                <TabelaCompleta tabela={tabela} clubeId={clubeId} clubePorId={clubePorId} />
              ) : (
                <p className="text-sm text-slate-500">Aguardando dados.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabelaCompleta({ tabela, clubeId, clubePorId }: { tabela: LinhaTabela[]; clubeId: string; clubePorId: Map<string, Club> }) {
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
            <tr key={linha.clubeId} className={`border-t border-slate-800 ${linha.clubeId === clubeId ? "bg-emerald-950/60 text-emerald-300 font-medium" : ""}`}>
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
    </div>
  );
}

function Cabecalho({
  estado,
  nomeClube,
  escudoClube,
  nomeDaNacionalidade,
  estatisticasCarreira,
  nomePorCampeonato,
  focoAutomatico,
  onDesligarTreinoAutomatico,
}: {
  estado: EstadoDeCarreira;
  nomeClube: string;
  escudoClube: string | undefined;
  nomeDaNacionalidade: string | undefined;
  estatisticasCarreira: EstatisticasCarreira;
  nomePorCampeonato: Map<string, string>;
  focoAutomatico: FocoDeTreino | undefined;
  onDesligarTreinoAutomatico: () => void;
}) {
  const xpNecessario = xpParaProximoNivel(estado.nivel);
  const progresso = Math.min(100, Math.round((estado.xpAcumulado / xpNecessario) * 100));
  const [mostrarEstatisticas, setMostrarEstatisticas] = useState(false);
  const [mostrarAtributos, setMostrarAtributos] = useState(false);

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-6 flex flex-col gap-3">
      <div className="flex items-baseline justify-between flex-wrap gap-x-4 gap-y-1">
        <h1 className="text-xl font-semibold">
          {estado.jogador.nome} #{estado.jogador.numero} — {ROTULO_POSICAO[estado.jogador.posicao]}, {nomeDaNacionalidade}
        </h1>
        <span className="text-sm text-slate-400 flex items-center gap-1.5">
          <Escudo url={escudoClube} alt={nomeClube} tamanho={18} />
          {nomeClube} · Temporada {estado.temporada}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Stat rotulo="Overall" valor={overallAtual(estado)} />
        <Stat rotulo="Status" valor={estado.statusNoClube} />
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
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => setMostrarEstatisticas((atual) => !atual)} className="self-start text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
          {mostrarEstatisticas ? "Ocultar" : "Ver"} estatísticas da carreira
        </button>
        <button type="button" onClick={() => setMostrarAtributos((atual) => !atual)} className="self-start text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
          {mostrarAtributos ? "Ocultar" : "Ver"} atributos
        </button>
        {focoAutomatico && (
          <span className="text-xs text-slate-400">
            Treino rápido ativado ({ROTULO_FOCO[focoAutomatico]}) ·{" "}
            <button type="button" onClick={onDesligarTreinoAutomatico} className="text-emerald-400 hover:text-emerald-300 transition-colors">
              voltar a perguntar
            </button>
          </span>
        )}
      </div>
      {mostrarEstatisticas && <PainelEstatisticas estatisticas={estatisticasCarreira} nomePorCampeonato={nomePorCampeonato} />}
      {mostrarAtributos && (
        <div className="rounded-lg bg-slate-800/60 p-3">
          <RadarDeAtributos atributos={estado.jogador.atributos} atributosDaPosicao={ATRIBUTOS_POR_POSICAO[estado.jogador.posicao]} />
        </div>
      )}
    </div>
  );
}

function PainelEstatisticas({ estatisticas, nomePorCampeonato }: { estatisticas: EstatisticasCarreira; nomePorCampeonato: Map<string, string> }) {
  return (
    <div className="rounded-lg bg-slate-800/60 p-3 text-sm flex flex-col gap-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
          <ul className="text-xs text-slate-300 flex flex-col gap-0.5">
            {estatisticas.titulos.map((t, indice) => (
              <li key={indice}>
                🏆 {nomeDoCampeonato(nomePorCampeonato, t.campeonatoId)} — {t.temporada}
              </li>
            ))}
          </ul>
        )}
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
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6">
      {prompt.tipo === "foco" && <PromptFoco onEscolher={temporada.responderFoco} />}
      {prompt.tipo === "pontos" && <PromptDistribuicaoDePontos estado={prompt.estado} onConfirmar={temporada.responderDistribuicaoDePontos} />}
      {prompt.tipo === "cenario" && <PromptCenario titulo={prompt.cenario.titulo} descricao={prompt.cenario.descricao} opcoes={prompt.cenario.opcoes} onEscolher={temporada.responderCenario} />}
      {prompt.tipo === "proposta_de_transferencia" && (
        <PromptPropostaDeTransferencia proposta={prompt.proposta} estado={temporada.estadoAtual} clubePorId={temporada.clubePorId} onResponder={temporada.responderPropostaDeTransferencia} />
      )}
    </div>
  );
}

/**
 * Só aparece durante a janela de transferência com interesse real de
 * mercado (`career-loop.ts` `estaNaJanelaDeTransferencia`/`responderProposta`)
 * — dá a decisão de verdade: negociar (contraproposta padrão) ou recusar
 * e seguir cumprindo contrato no clube atual.
 */
function PromptPropostaDeTransferencia({
  proposta,
  estado,
  clubePorId,
  onResponder,
}: {
  proposta: PropostaTransferencia;
  estado: EstadoDeCarreira;
  clubePorId: Map<string, Club>;
  onResponder: (resposta: TermosDeContrato | "recusar") => void;
}) {
  const termos = proposta.propostaInicial;
  const nomeClubeOfertante = nomeDoClube(clubePorId, proposta.clubeOfertanteId);
  const nomeClubeAtual = nomeDoClube(clubePorId, estado.clubeAtualId);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Escudo url={escudoDoClube(clubePorId, proposta.clubeOfertanteId)} alt={nomeClubeOfertante} tamanho={22} />
        {nomeClubeOfertante} fez uma proposta
      </h2>
      <p className="text-sm text-slate-400">
        Status oferecido: <span className="text-slate-200">{ROTULO_STATUS[proposta.statusOferecido]}</span> · R${termos.salarioMensal}/mês + R${termos.luvas} luvas · {termos.anos} anos
      </p>
      {estado.contratoAtual && (
        <p className="text-xs text-slate-500">
          Seu contrato atual com {nomeClubeAtual} vale até a temporada {temporadaDeVencimento(estado.contratoAtual)}.
        </p>
      )}
      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => onResponder(contrapropostaPadrao(proposta))}
          className="rounded-lg bg-emerald-900/40 border border-emerald-700 px-4 py-2.5 text-left hover:border-emerald-500 transition-colors"
        >
          Negociar (pedir mais salário e luvas)
        </button>
        <button type="button" onClick={() => onResponder("recusar")} className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-left hover:border-emerald-500 hover:bg-slate-800/70 transition-colors">
          Recusar — continuar em {nomeClubeAtual}, cumprindo o contrato atual
        </button>
      </div>
    </div>
  );
}

const ROTULO_PERIODO: Record<string, string> = {
  "jan-1a_quinz": "Janeiro (1ª quinzena)",
  fev: "Fevereiro",
  mar: "Março",
  abr: "Abril",
  "mai-nov": "Maio a novembro",
  "temporada-conmebol": "Ligas CONMEBOL (fora do Brasil)",
};

function rotuloPeriodo(periodo: string): string {
  return ROTULO_PERIODO[periodo] ?? periodo.replaceAll("_", " ").replaceAll("-", " ");
}

/**
 * Calendário da TEMPORADA (não semana a semana — o motor não tem granularidade diária/semanal
 * de "treino terça, jogo sábado", só janelas de período, ver `data/loaders/calendario.ts`) —
 * mostra em qual período cada treino/cenário acontece (`pontoDeTreino`) e em quais janelas o
 * clube do jogador tem competição ativa, com o período atual destacado.
 */
function CalendarioDaTemporada({
  periodos,
  semanaAtual,
  competicoesDoJogador,
  nomePorCampeonato,
}: {
  periodos: PeriodoCalendario[];
  semanaAtual: number;
  competicoesDoJogador: string[];
  nomePorCampeonato: Map<string, string>;
}) {
  return (
    <div className="rounded-lg bg-slate-800/60 p-3">
      <div className="text-xs font-medium text-slate-400 mb-2">Calendário da temporada</div>
      <div className="flex flex-col gap-1.5">
        {periodos.map((periodo) => {
          const ehPeriodoAtual = semanaAtual >= periodo.semanaInicio && semanaAtual <= periodo.semanaFim;
          const temTreino = periodo.pontoDeTreino !== false;
          const competicoesDoJogadorNoPeriodo = periodo.competicoes_ativas.filter((id) => competicoesDoJogador.includes(id));

          return (
            <div
              key={periodo.periodo}
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-1.5 text-xs ${ehPeriodoAtual ? "bg-emerald-950/60 border border-emerald-700" : "bg-slate-900/60"}`}
            >
              <span className="w-40 shrink-0 text-slate-300 font-medium">{rotuloPeriodo(periodo.periodo)}</span>
              <span className="text-slate-500 tabular-nums shrink-0">sem. {periodo.semanaInicio}-{periodo.semanaFim}</span>
              {temTreino && <span title="Treino/cenário toda semana desse período">🏋️ treino</span>}
              {competicoesDoJogadorNoPeriodo.length > 0 ? (
                <span className="text-emerald-400">⚽ {competicoesDoJogadorNoPeriodo.map((id) => nomeDoCampeonato(nomePorCampeonato, id)).join(", ")}</span>
              ) : (
                <span className="text-slate-500">sem jogo do seu clube</span>
              )}
              {ehPeriodoAtual && <span className="text-emerald-400 font-medium ml-auto">você está aqui</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const periodos = useMemo(() => construirCalendarioPadrao(temporada).calendario, [temporada]);

  return (
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6 flex flex-col gap-3">
      <h2 className="text-lg font-semibold">
        Semana {info.semana} — {formatarData(inicio)} a {formatarData(fim)}
      </h2>
      {info.competicoesDoJogador.length > 0 ? (
        <p className="text-sm text-slate-400">Competições do seu clube: {info.competicoesDoJogador.map((id) => nomeDoCampeonato(nomePorCampeonato, id)).join(", ")}</p>
      ) : (
        <p className="text-sm text-slate-500">Seu clube não tem competição ativa no momento.</p>
      )}
      <CalendarioDaTemporada periodos={periodos} semanaAtual={info.semana} competicoesDoJogador={info.competicoesDoJogador} nomePorCampeonato={nomePorCampeonato} />
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
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6 flex flex-col gap-3">
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
  status,
  lesionado,
  onEscolher,
}: {
  contexto: ContextoPartidaDoJogadorSemanal;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
  tabelaPorCampeonato: Map<string, LinhaTabela[]>;
  status: StatusNoClube;
  lesionado: boolean;
  onEscolher: (escolha: EscolhaDePrePartida) => void;
}) {
  const mandanteNome = nomeDoClube(clubePorId, contexto.mandanteId);
  const visitanteNome = nomeDoClube(clubePorId, contexto.visitanteId);
  const tabela = tabelaPorCampeonato.get(contexto.campeonatoId);
  const posicaoMandante = posicaoNaTabela(tabela, contexto.mandanteId);
  const posicaoVisitante = posicaoNaTabela(tabela, contexto.visitanteId);

  return (
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6 flex flex-col gap-4">
      <div className="text-xs uppercase tracking-wide text-emerald-400">
        {nomeDoCampeonato(nomePorCampeonato, contexto.campeonatoId)} — semana {contexto.semana}
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
      <p className="text-xs text-slate-500 text-center">
        Você joga {contexto.lado === "casa" ? "em casa" : "fora"} — status no elenco: <span className="text-slate-300">{ROTULO_STATUS[status]}</span>
      </p>
      {lesionado && <p className="text-xs text-amber-400 text-center">⚠️ Você está jogando lesionado — cuidado com as decisões durante a partida.</p>}
      <div className="grid gap-2">
        <button type="button" onClick={() => onEscolher("rapida")} className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-left hover:border-emerald-500 hover:bg-slate-800/70 transition-colors">
          Simulação rápida (direto pro resultado)
        </button>
        <button
          type="button"
          onClick={() => onEscolher("ate_a_metade")}
          className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-left hover:border-emerald-500 hover:bg-slate-800/70 transition-colors"
        >
          Simular até a metade da temporada (não pergunta de novo até lá)
        </button>
        <button
          type="button"
          onClick={() => onEscolher("ate_o_final")}
          className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-left hover:border-emerald-500 hover:bg-slate-800/70 transition-colors"
        >
          Simular até o final da temporada direto (não pergunta mais nada este ano)
        </button>
        <button type="button" onClick={() => onEscolher("ao_vivo")} className="rounded-lg bg-emerald-900/40 border border-emerald-700 px-4 py-2.5 text-left hover:border-emerald-500 transition-colors">
          Simular o jogo (ao vivo — pausa em lances importantes)
        </button>
      </div>
    </div>
  );
}

function PainelPartidaAoVivo({
  partida,
  clubePorId,
  prompt,
  onResponderChance,
  onResponderEvento,
}: {
  partida: PartidaAoVivoEmAndamento;
  clubePorId: Map<string, Club>;
  prompt: Extract<PromptPendente, { tipo: "chance_ao_vivo" | "evento_ao_vivo" }> | undefined;
  onResponderChance: (resultado: ResultadoDecisaoChance) => void;
  onResponderEvento: (opcao: Opcao) => void;
}) {
  const mandanteNome = nomeDoClube(clubePorId, partida.mandanteId);
  const visitanteNome = nomeDoClube(clubePorId, partida.visitanteId);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" });
  }, [partida.eventos.length]);

  return (
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Ao vivo — {partida.minutoAtual}'
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
    </div>
  );
}

function LinhaDeEvento({ evento, mandanteNome, visitanteNome }: { evento: EventoAoVivo; mandanteNome: string; visitanteNome: string }) {
  switch (evento.tipo) {
    case "chance_generica": {
      const time = evento.lado === "casa" ? mandanteNome : visitanteNome;
      const percentual = Math.round(evento.probabilidade * 100);
      return (
        <p>
          {evento.minuto}' {evento.gol ? <span className="text-emerald-400 font-medium">GOL do {time}!</span> : <>Chance perdida do {time}.</>}{" "}
          <span className="text-slate-500">({percentual}% de chance de gol)</span>
        </p>
      );
    }
    case "chance_jogador": {
      const rotulo = LABEL_SUBTIPO[evento.chance.subtipo];
      const finalizacao = evento.chance.subtipo === "voleio" || evento.chance.subtipo === "cabeceio" || evento.chance.subtipo === "chute_de_fora" || evento.chance.subtipo === "jogada_individual";
      let texto: string;
      if (finalizacao) texto = evento.chance.sucesso ? `GOL SEU! (${rotulo})` : `Você não converteu (${rotulo}).`;
      else if (evento.chance.subtipo === "passe_decisivo") texto = evento.chance.sucesso ? "Assistência sua!" : "Seu passe decisivo não deu certo.";
      else texto = evento.chance.sucesso ? "Desarme decisivo seu!" : "Você não conseguiu desarmar dessa vez.";
      const percentual = Math.round(evento.probabilidade * 100);
      return (
        <p className={evento.chance.sucesso ? "text-emerald-400 font-medium" : ""}>
          {evento.minuto}' {texto} <span className="text-slate-500">({percentual}% de chance)</span>
        </p>
      );
    }
    case "evento_de_contexto":
      return (
        <p>
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

function PromptFoco({ onEscolher }: { onEscolher: (foco: FocoDeTreino, manterAutomatico: boolean) => void }) {
  const focos: { foco: FocoDeTreino; descricao: string }[] = [
    { foco: "fisico", descricao: "velocidade, força, resistência, jogo aéreo, reflexos" },
    { foco: "tecnico", descricao: "finalização, drible, cruzamento, passe, cabeceio, etc — depende da posição" },
    { foco: "tatico", descricao: "visão de jogo, frieza, marcação, desarme, posicionamento, liderança" },
    { foco: "descanso", descricao: "recupera moral, não gera XP" },
  ];
  const [treinoRapido, setTreinoRapido] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Sessão de treino — qual o foco?</h2>
      <div className="grid gap-2">
        {focos.map((f) => (
          <button
            key={f.foco}
            type="button"
            onClick={() => onEscolher(f.foco, treinoRapido)}
            className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-left hover:border-emerald-500 hover:bg-slate-800/70 transition-colors"
          >
            <div className="font-medium">{ROTULO_FOCO[f.foco]}</div>
            <div className="text-xs text-slate-400">{f.descricao}</div>
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-400 mt-1">
        <input type="checkbox" checked={treinoRapido} onChange={(evento) => setTreinoRapido(evento.target.checked)} className="accent-emerald-500" />
        Treino rápido — usar essa escolha em todos os treinos seguintes, sem perguntar de novo
      </label>
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
                {valorAtual}
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

function Feed({ eventos, clubePorId, nomePorCampeonato }: { eventos: EventoDeFeed[]; clubePorId: Map<string, Club>; nomePorCampeonato: Map<string, string> }) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-4 flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-slate-400 px-1">Partidas e eventos da temporada</h2>
      <div className="flex flex-col gap-2 max-h-[28rem] overflow-y-auto pr-1">
        {eventos.length === 0 ? (
          <p className="text-sm text-slate-500 px-1 py-2">Nada aconteceu ainda — os placares e eventos vão aparecer aqui, mais recentes primeiro.</p>
        ) : (
          eventos.map((evento) => <EventoCard key={evento.id} evento={evento} clubePorId={clubePorId} nomePorCampeonato={nomePorCampeonato} />)
        )}
      </div>
    </div>
  );
}

function EventoCard({ evento, clubePorId, nomePorCampeonato }: { evento: EventoDeFeed; clubePorId: Map<string, Club>; nomePorCampeonato: Map<string, string> }) {
  switch (evento.tipo) {
    case "treino":
      return (
        <Card>
          {evento.treino.foco === "descanso" ? (
            <>
              Descanso — moral {evento.treino.moralAntes} → {evento.treino.moralDepois}
            </>
          ) : (
            <>Sessão de treino ({ROTULO_FOCO[evento.treino.foco]})</>
          )}
        </Card>
      );
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
          )}
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
      const decisao = confronto.decididoNosPenaltis ? " (nos pênaltis)" : "";
      return (
        <Card destaque>
          [{etapa}] {nomeDoClube(clubePorId, confronto.timeA)} {confronto.golsA} x {confronto.golsB} {nomeDoClube(clubePorId, confronto.timeB)}
          {decisao} — vencedor: {nomeDoClube(clubePorId, confronto.vencedor)}
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
      return <TabelaCard campeonatoId={evento.campeonatoId} periodo={evento.periodo} tabela={evento.tabela} clubePorId={clubePorId} nomePorCampeonato={nomePorCampeonato} />;
  }
}

/** Alterna a cada tanto tempo (ver `INTERVALO_TROCA_MS`) até completar `DURACAO_ANIMACAO_MS`, então "para" no `indiceResultado` de verdade — só então chama `onConcluir` (com um pequeno atraso extra pro jogador ver onde parou antes da tela sumir e o resultado entrar no feed). */
const DURACAO_ANIMACAO_MS = 1400;
const INTERVALO_TROCA_MS = 130;
const PAUSA_APOS_PARAR_MS = 550;

function PainelAnimacaoDeEscolha({ animacao, onConcluir }: { animacao: AnimacaoDeEscolhaPendente; onConcluir: () => void }) {
  const { cenarioResolvido, indiceResultado } = animacao;
  const { cenario, escolha } = cenarioResolvido;
  const { opcao } = escolha;
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [parou, setParou] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const inicio = Date.now();
    let indice = 0;
    let timer: ReturnType<typeof setTimeout>;

    function tick(): void {
      if (cancelado) return;
      if (Date.now() - inicio >= DURACAO_ANIMACAO_MS) {
        setIndiceAtual(indiceResultado);
        setParou(true);
        timer = setTimeout(() => {
          if (!cancelado) onConcluir();
        }, PAUSA_APOS_PARAR_MS);
        return;
      }
      indice = (indice + 1) % opcao.resultados.length;
      setIndiceAtual(indice);
      timer = setTimeout(tick, INTERVALO_TROCA_MS);
    }

    timer = setTimeout(tick, INTERVALO_TROCA_MS);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
    // Roda 1x por montagem (o painel só existe enquanto há uma animação pendente — uma nova
    // animação sempre remonta o componente do zero, ver o `animacaoDeEscolha ?` no render principal).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6 flex flex-col gap-4 items-center text-center">
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
            <div className="text-xs text-slate-400 mt-0.5">{formatarImpactoResumido(resultado.impacto)}</div>
          </div>
        ))}
      </div>
      {parou && <p className="text-xs text-emerald-400">{escolha.resultado.impacto.narrativa}</p>}
    </div>
  );
}

function PainelResultadoDaRodada({
  resultadoDaRodada,
  clubePorId,
  nomePorCampeonato,
  onAvancar,
}: {
  resultadoDaRodada: ResultadoDaRodadaExibido;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
  onAvancar: () => void;
}) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6 flex flex-col gap-4">
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
              </div>
            ))}
          </div>
          {resultadoDaRodada.tabela && (
            <div>
              <div className="text-sm font-medium text-slate-300 mb-1.5">Classificação</div>
              <TabelaCard campeonatoId={resultadoDaRodada.campeonatoId} periodo={`rodada ${resultadoDaRodada.rodada}`} tabela={resultadoDaRodada.tabela} clubePorId={clubePorId} nomePorCampeonato={nomePorCampeonato} />
            </div>
          )}
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold">
            {nomeDoCampeonato(nomePorCampeonato, resultadoDaRodada.campeonatoId)} — {resultadoDaRodada.etapa}, resultado
          </h2>
          <div className="flex items-center justify-between rounded-lg px-3 py-1.5 bg-emerald-950/60 border border-emerald-800 text-sm">
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
          </div>
          <p className={resultadoDaRodada.eliminado ? "text-slate-400 text-sm" : "text-emerald-400 text-sm font-medium"}>
            {resultadoDaRodada.eliminado ? "Eliminado(a) dessa competição." : "Avançou para a próxima fase!"}
          </p>
        </>
      )}
      <button type="button" onClick={onAvancar} className="self-start rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors px-4 py-2.5 font-medium text-sm">
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
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6 flex flex-col gap-4 items-center text-center">
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
    <div className="rounded-2xl bg-slate-900 border border-emerald-700 shadow-xl p-6 flex flex-col gap-4 items-center text-center">
      <h2 className="text-lg font-semibold">Chaveamento definido — {nomeDoCampeonato(nomePorCampeonato, chaveamento.campeonatoId)}</h2>
      <p className="text-sm text-slate-400 capitalize">{chaveamento.etapaNome.replaceAll("_", " ")}</p>
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
}: {
  campeonatoId: string;
  periodo: string;
  tabela: LinhaTabela[];
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
}) {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
      <div className="text-sm font-medium mb-2">
        {nomeDoCampeonato(nomePorCampeonato, campeonatoId)} — resumo do período {periodo}
      </div>
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
            </tr>
          </thead>
          <tbody>
            {tabela.slice(0, 10).map((linha, indice) => (
              <tr key={linha.clubeId} className="border-t border-slate-800">
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
  estatisticasCarreira,
  onJogarProxima,
}: {
  resultado: NonNullable<ReturnType<typeof useTemporada>["resultado"]>;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
  estatisticasCarreira: EstatisticasCarreira;
  onJogarProxima: () => void;
}) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-6 flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Fim da temporada {resultado.resultadoTemporada.temporada}</h2>
      <p className="text-sm text-slate-400">
        Overall {resultado.resumoPartidas.overallAntes} → {resultado.resumoPartidas.overallDepois}
      </p>

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

      {resultado.statusAtualizado && (
        <p className="text-sm text-slate-400 border-t border-slate-800 pt-3">
          Status no elenco: {resultado.statusAtualizado.statusAnterior} → {resultado.statusAtualizado.statusNovo} (nota média {resultado.statusAtualizado.notaMedia.toFixed(1)})
        </p>
      )}

      <div className="border-t border-slate-800 pt-3">
        <PainelEstatisticas estatisticas={estatisticasCarreira} nomePorCampeonato={nomePorCampeonato} />
      </div>

      <button type="button" onClick={onJogarProxima} className="mt-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors px-4 py-2.5 font-medium">
        Jogar próxima temporada
      </button>
    </div>
  );
}
