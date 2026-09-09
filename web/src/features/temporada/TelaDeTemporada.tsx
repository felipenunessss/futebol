import { useEffect, useRef, useState } from "react";
import type { Club } from "@motor/schemas/club.js";
import { ATRIBUTOS_POR_POSICAO, buscarArquetipo, NACIONALIDADES_CONMEBOL, type Atributo, type Posicao } from "@motor/schemas/player.js";
import { overallAtual, type EstadoDeCarreira } from "@motor/career/Player.js";
import { xpParaProximoNivel, type FocoDeTreino } from "@motor/progression/xp.js";
import type { ImpactoCarreira, Opcao } from "@motor/progression/scenarios.js";
import type { LinhaTabela } from "@motor/simulation/season.js";
import type { ContextoDecisaoChance, EventoAoVivo, ResultadoDecisaoChance } from "@motor/simulation/live-match.js";
import type { SubtipoChance } from "@motor/simulation/tactics.js";
import type { AlocacaoDePontos, AoIniciarSemanaInfo, ContextoPartidaDoJogadorSemanal } from "@motor/career/career-loop.js";
import { useTemporada, type EscolhaDePrePartida, type EstatisticasCarreira, type EventoDeFeed, type PartidaAoVivoEmAndamento, type PromptPendente } from "./useTemporada.js";
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {competicoesDoJogador.length > 0 && (
        <PainelDeCompeticoes competicoesDoJogador={competicoesDoJogador} tabelaPorCampeonato={tabelaPorCampeonato} faseMataMataPorCampeonato={faseMataMataPorCampeonato} clubeId={estadoAtual.clubeAtualId} nomePorCampeonato={nomePorCampeonato} />
      )}
      <div className="mx-auto max-w-3xl flex flex-col gap-4">
        <Cabecalho estado={estadoAtual} nomeClube={nomeDoClube(clubePorId, estadoAtual.clubeAtualId)} nomeDaNacionalidade={nomeDaNacionalidade} estatisticasCarreira={estatisticasCarreira} nomePorCampeonato={nomePorCampeonato} />

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
          <ResumoDeTemporada resultado={resultado} clubePorId={clubePorId} nomePorCampeonato={nomePorCampeonato} onJogarProxima={() => void temporada.jogarTemporada()} />
        )}

        {/* O feed fica sempre visível (durante a temporada E depois do resumo) — é aqui que os
            placares das suas partidas aparecem conforme a temporada avança. */}
        <Feed eventos={feed} clubePorId={clubePorId} nomePorCampeonato={nomePorCampeonato} />
      </div>
    </div>
  );
}

function PainelDeCompeticoes({
  competicoesDoJogador,
  tabelaPorCampeonato,
  faseMataMataPorCampeonato,
  clubeId,
  nomePorCampeonato,
}: {
  competicoesDoJogador: string[];
  tabelaPorCampeonato: Map<string, LinhaTabela[]>;
  faseMataMataPorCampeonato: Map<string, { etapa: string; eliminado: boolean }>;
  clubeId: string;
  nomePorCampeonato: Map<string, string>;
}) {
  return (
    <div className="fixed top-4 right-4 z-10 w-56 rounded-xl bg-slate-900/95 border border-slate-800 shadow-xl p-3 flex flex-col gap-2 text-xs backdrop-blur">
      <h2 className="font-semibold text-slate-400">Suas competições</h2>
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
  );
}

function Cabecalho({
  estado,
  nomeClube,
  nomeDaNacionalidade,
  estatisticasCarreira,
  nomePorCampeonato,
}: {
  estado: EstadoDeCarreira;
  nomeClube: string;
  nomeDaNacionalidade: string | undefined;
  estatisticasCarreira: EstatisticasCarreira;
  nomePorCampeonato: Map<string, string>;
}) {
  const xpNecessario = xpParaProximoNivel(estado.nivel);
  const progresso = Math.min(100, Math.round((estado.xpAcumulado / xpNecessario) * 100));
  const [mostrarEstatisticas, setMostrarEstatisticas] = useState(false);

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-6 flex flex-col gap-3">
      <div className="flex items-baseline justify-between flex-wrap gap-x-4 gap-y-1">
        <h1 className="text-xl font-semibold">
          {estado.jogador.nome} #{estado.jogador.numero} — {ROTULO_POSICAO[estado.jogador.posicao]}, {nomeDaNacionalidade}
        </h1>
        <span className="text-sm text-slate-400">
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
      <button type="button" onClick={() => setMostrarEstatisticas((atual) => !atual)} className="self-start text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
        {mostrarEstatisticas ? "Ocultar" : "Ver"} estatísticas da carreira
      </button>
      {mostrarEstatisticas && <PainelEstatisticas estatisticas={estatisticasCarreira} nomePorCampeonato={nomePorCampeonato} />}
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
  onContinuar: () => void;
}) {
  const { inicio, fim } = intervaloDeSemana(temporada, info.semana);

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
      <button type="button" onClick={onContinuar} className="mt-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors px-4 py-2.5 font-medium self-start">
        Continuar
      </button>
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
          <div className="font-semibold">{mandanteNome}</div>
          <div className="text-xs text-slate-400">{posicaoMandante ? `${posicaoMandante}º colocado` : "posição ainda não disponível"}</div>
        </div>
        <span className="text-slate-500 text-sm">x</span>
        <div className="text-left flex-1">
          <div className="font-semibold">{visitanteNome}</div>
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
        <span className="text-right flex-1 font-medium">{mandanteNome}</span>
        <span className="tabular-nums text-2xl font-bold px-2">
          {partida.golsCasa} x {partida.golsFora}
        </span>
        <span className="text-left flex-1 font-medium">{visitanteNome}</span>
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
      return (
        <p>
          {evento.minuto}' {evento.gol ? <span className="text-emerald-400 font-medium">GOL do {time}!</span> : <>Chance perdida do {time}.</>}
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
      return (
        <p className={evento.chance.sucesso ? "text-emerald-400 font-medium" : ""}>
          {evento.minuto}' {texto}
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
  return (
    <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
      <p className="text-sm font-medium">
        {contexto.minuto}' — chance sua! ({LABEL_SUBTIPO[contexto.subtipo]})
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onEscolher({ ajusteForcaJogador: 150, ajusteForcaDefensiva: 0 })}
          className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-left hover:border-emerald-500 hover:bg-slate-800/70 transition-colors text-sm"
        >
          Arriscar, ir com tudo
        </button>
        <button
          type="button"
          onClick={() => onEscolher({ ajusteForcaJogador: 60, ajusteForcaDefensiva: -60 })}
          className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-left hover:border-emerald-500 hover:bg-slate-800/70 transition-colors text-sm"
        >
          Ajeitar antes de bater, com mais categoria
        </button>
      </div>
    </div>
  );
}

function PromptFoco({ onEscolher }: { onEscolher: (foco: FocoDeTreino) => void }) {
  const focos: { foco: FocoDeTreino; descricao: string }[] = [
    { foco: "fisico", descricao: "velocidade, força, resistência, jogo aéreo, reflexos" },
    { foco: "tecnico", descricao: "finalização, drible, passe, marcação, etc — depende da posição" },
    { foco: "tatico", descricao: "visão de jogo, frieza, posicionamento, liderança" },
    { foco: "descanso", descricao: "recupera moral, não gera XP" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Sessão de treino — qual o foco?</h2>
      <div className="grid gap-2">
        {focos.map((f) => (
          <button
            key={f.foco}
            type="button"
            onClick={() => onEscolher(f.foco)}
            className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-left hover:border-emerald-500 hover:bg-slate-800/70 transition-colors"
          >
            <div className="font-medium">{ROTULO_FOCO[f.foco]}</div>
            <div className="text-xs text-slate-400">{f.descricao}</div>
          </button>
        ))}
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
            <div className="mt-1 flex flex-col gap-0.5">
              {opcao.resultados.map((resultado, indice) => (
                <span key={indice} className="text-xs text-slate-400">
                  {Math.round(resultado.probabilidade * 100)}% — {formatarImpactoResumido(resultado.impacto)}
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
                <td className="pr-2 py-1">{nomeDoClube(clubePorId, linha.clubeId)}</td>
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
  onJogarProxima,
}: {
  resultado: NonNullable<ReturnType<typeof useTemporada>["resultado"]>;
  clubePorId: Map<string, Club>;
  nomePorCampeonato: Map<string, string>;
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

      <button type="button" onClick={onJogarProxima} className="mt-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors px-4 py-2.5 font-medium">
        Jogar próxima temporada
      </button>
    </div>
  );
}
