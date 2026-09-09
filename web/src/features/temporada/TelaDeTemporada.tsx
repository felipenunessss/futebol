import { useState } from "react";
import type { Club } from "@motor/schemas/club.js";
import { ATRIBUTOS_POR_POSICAO, buscarArquetipo, NACIONALIDADES_CONMEBOL, type Atributo, type Posicao } from "@motor/schemas/player.js";
import { overallAtual, type EstadoDeCarreira } from "@motor/career/Player.js";
import { xpParaProximoNivel, type FocoDeTreino } from "@motor/progression/xp.js";
import type { Opcao } from "@motor/progression/scenarios.js";
import type { LinhaTabela } from "@motor/simulation/season.js";
import type { AlocacaoDePontos } from "@motor/career/career-loop.js";
import { useTemporada, type EventoDeFeed, type PromptPendente } from "./useTemporada.js";

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

function nomeDoClube(clubePorId: Map<string, Club>, id: string): string {
  const clube = clubePorId.get(id);
  return clube?.nome_popular ?? clube?.nome ?? id;
}

export function TelaDeTemporada({ estadoInicial }: { estadoInicial: EstadoDeCarreira }) {
  const temporada = useTemporada(estadoInicial);
  const { estadoAtual, fase, feed, promptPendente, resultado, clubePorId } = temporada;
  const nomeDaNacionalidade = NACIONALIDADES_CONMEBOL.find((n) => n.codigo === estadoAtual.jogador.nacionalidade)?.nome ?? estadoAtual.jogador.nacionalidade;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-3xl flex flex-col gap-4">
        <Cabecalho estado={estadoAtual} nomeClube={nomeDoClube(clubePorId, estadoAtual.clubeAtualId)} nomeDaNacionalidade={nomeDaNacionalidade} />

        {promptPendente && <PainelDePrompt prompt={promptPendente} temporada={temporada} />}
        {fase === "resumo" && resultado && <ResumoDeTemporada resultado={resultado} clubePorId={clubePorId} onJogarProxima={() => void temporada.jogarTemporada()} />}

        {/* O feed fica sempre visível (durante a temporada E depois do resumo) — é aqui que os
            placares das suas partidas aparecem conforme a temporada avança. */}
        <Feed eventos={feed} clubePorId={clubePorId} />
      </div>
    </div>
  );
}

function Cabecalho({ estado, nomeClube, nomeDaNacionalidade }: { estado: EstadoDeCarreira; nomeClube: string; nomeDaNacionalidade: string | undefined }) {
  const xpNecessario = xpParaProximoNivel(estado.nivel);
  const progresso = Math.min(100, Math.round((estado.xpAcumulado / xpNecessario) * 100));

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
            {opcao.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

function Feed({ eventos, clubePorId }: { eventos: EventoDeFeed[]; clubePorId: Map<string, Club> }) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-4 flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-slate-400 px-1">Partidas e eventos da temporada</h2>
      <div className="flex flex-col gap-2 max-h-[28rem] overflow-y-auto pr-1">
        {eventos.length === 0 ? (
          <p className="text-sm text-slate-500 px-1 py-2">Nada aconteceu ainda — os placares e eventos vão aparecer aqui, mais recentes primeiro.</p>
        ) : (
          eventos.map((evento) => <EventoCard key={evento.id} evento={evento} clubePorId={clubePorId} />)
        )}
      </div>
    </div>
  );
}

function EventoCard({ evento, clubePorId }: { evento: EventoDeFeed; clubePorId: Map<string, Club> }) {
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
    case "status":
      return (
        <Card>
          Status no elenco: {evento.info.statusAnterior} → {evento.info.statusNovo} (nota média {evento.info.notaMedia.toFixed(1)})
        </Card>
      );
    case "tabela":
      return <TabelaCard campeonatoId={evento.campeonatoId} periodo={evento.periodo} tabela={evento.tabela} clubePorId={clubePorId} />;
  }
}

function TabelaCard({ campeonatoId, periodo, tabela, clubePorId }: { campeonatoId: string; periodo: string; tabela: LinhaTabela[]; clubePorId: Map<string, Club> }) {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
      <div className="text-sm font-medium mb-2">
        {campeonatoId} — resumo do período {periodo}
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
  onJogarProxima,
}: {
  resultado: NonNullable<ReturnType<typeof useTemporada>["resultado"]>;
  clubePorId: Map<string, Club>;
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
              <span className="text-slate-500">✗ {c.campeonatoId}: não simulada ({c.erro})</span>
            ) : (
              <span>
                ✓ {c.campeonatoId}: campeão {nomeDoClube(clubePorId, c.campeao!)}
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
