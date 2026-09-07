import { useState } from "react";
import { ARQUETIPOS, type Posicao } from "@motor/schemas/player.js";
import { overallAtual } from "@motor/career/Player.js";
import { ROTULO_POTENCIAL } from "@motor/progression/potencial.js";
import type { PropostaTransferencia } from "@motor/market/transfers.js";
import { useCriacaoDeCarreira } from "./useCriacaoDeCarreira.js";

const POSICOES: Posicao[] = ["goleiro", "zagueiro", "lateral", "volante", "meia", "atacante"];

const ROTULO_POSICAO: Record<Posicao, string> = {
  goleiro: "Goleiro",
  zagueiro: "Zagueiro",
  lateral: "Lateral",
  volante: "Volante",
  meia: "Meia",
  atacante: "Atacante",
};

const PASSOS_EM_ORDEM = ["nome", "posicao", "arquetipo", "proposta", "resumo"] as const;

function nomeDoClube(clube: { nome: string; nome_popular?: string } | undefined, id: string): string {
  return clube?.nome_popular ?? clube?.nome ?? id;
}

export function CriacaoDeCarreira({ onCarreiraCriada }: { onCarreiraCriada?: (estado: ReturnType<typeof useCriacaoDeCarreira>["estadoFinal"]) => void }) {
  const criacao = useCriacaoDeCarreira();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <Progresso passoAtual={criacao.passo} />

        <div className="mt-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-8">
          {criacao.passo === "nome" && <PassoNome onConfirmar={criacao.confirmarNome} />}
          {criacao.passo === "posicao" && <PassoPosicao onEscolher={criacao.escolherPosicao} />}
          {criacao.passo === "arquetipo" && criacao.posicao && <PassoArquetipo posicao={criacao.posicao} onEscolher={criacao.escolherArquetipo} />}
          {criacao.passo === "proposta" && (
            <PassoProposta propostas={criacao.propostas} clubePorId={criacao.clubePorId} clubes={criacao.clubes} onAceitar={criacao.aceitarProposta} onEscolherManualmente={criacao.escolherClubeManualmente} />
          )}
          {criacao.passo === "resumo" && criacao.estadoFinal && (
            <PassoResumo estado={criacao.estadoFinal} nomeClube={nomeDoClube(criacao.clubePorId.get(criacao.estadoFinal.clubeAtualId), criacao.estadoFinal.clubeAtualId)} onFinalizar={() => onCarreiraCriada?.(criacao.estadoFinal)} />
          )}
        </div>
      </div>
    </div>
  );
}

function Progresso({ passoAtual }: { passoAtual: (typeof PASSOS_EM_ORDEM)[number] }) {
  const indiceAtual = PASSOS_EM_ORDEM.indexOf(passoAtual);
  return (
    <div className="flex items-center gap-2">
      {PASSOS_EM_ORDEM.map((passo, indice) => (
        <div key={passo} className={`h-1.5 flex-1 rounded-full ${indice <= indiceAtual ? "bg-emerald-500" : "bg-slate-800"}`} />
      ))}
    </div>
  );
}

function PassoNome({ onConfirmar }: { onConfirmar: (nome: string) => void }) {
  const [valor, setValor] = useState("");

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        onConfirmar(valor);
      }}
    >
      <h1 className="text-2xl font-semibold">Criação de carreira</h1>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-slate-400">Nome do jogador</span>
        <input
          autoFocus
          value={valor}
          onChange={(evento) => setValor(evento.target.value)}
          placeholder="Seu nome"
          className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 outline-none focus:border-emerald-500"
        />
      </label>
      <button type="submit" className="mt-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors px-4 py-2.5 font-medium">
        Continuar
      </button>
    </form>
  );
}

function PassoPosicao({ onEscolher }: { onEscolher: (posicao: Posicao) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Qual sua posição?</h2>
      <div className="grid grid-cols-2 gap-3">
        {POSICOES.map((posicao) => (
          <button
            key={posicao}
            type="button"
            onClick={() => onEscolher(posicao)}
            className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-left hover:border-emerald-500 hover:bg-slate-800/70 transition-colors"
          >
            {ROTULO_POSICAO[posicao]}
          </button>
        ))}
      </div>
    </div>
  );
}

function PassoArquetipo({ posicao, onEscolher }: { posicao: Posicao; onEscolher: (arquetipoId: string) => void }) {
  const arquetiposDaPosicao = ARQUETIPOS.filter((a) => a.posicao === posicao);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Arquétipo de {ROTULO_POSICAO[posicao]}</h2>
      <div className="flex flex-col gap-3">
        {arquetiposDaPosicao.map((arquetipo) => (
          <button
            key={arquetipo.id}
            type="button"
            onClick={() => onEscolher(arquetipo.id)}
            className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-left hover:border-emerald-500 hover:bg-slate-800/70 transition-colors"
          >
            <div className="font-medium">{arquetipo.nome}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {arquetipo.atributos_prioritarios.map((atributo) => (
                <span key={atributo} className="text-xs rounded-full bg-emerald-950 text-emerald-400 px-2 py-0.5">
                  {atributo.replaceAll("_", " ")}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PassoProposta({
  propostas,
  clubePorId,
  clubes,
  onAceitar,
  onEscolherManualmente,
}: {
  propostas: PropostaTransferencia[];
  clubePorId: Map<string, { nome: string; nome_popular?: string }>;
  clubes: { id: string; nome: string; nome_popular?: string }[];
  onAceitar: (proposta: PropostaTransferencia) => void;
  onEscolherManualmente: (clubeId: string) => void;
}) {
  const [busca, setBusca] = useState("");

  if (propostas.length === 0) {
    const clubesFiltrados = busca.trim() ? clubes.filter((c) => nomeDoClube(c, c.id).toLowerCase().includes(busca.toLowerCase())).slice(0, 20) : clubes.slice(0, 20);

    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Nenhuma proposta chegou ainda</h2>
        <p className="text-sm text-slate-400">Escolha um clube pra tentar a sorte.</p>
        <input
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar clube..."
          className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 outline-none focus:border-emerald-500"
        />
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
          {clubesFiltrados.map((clube) => (
            <button
              key={clube.id}
              type="button"
              onClick={() => onEscolherManualmente(clube.id)}
              className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-left hover:border-emerald-500 transition-colors"
            >
              {nomeDoClube(clube, clube.id)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Propostas iniciais</h2>
      <div className="flex flex-col gap-3">
        {propostas.map((proposta) => {
          const termos = proposta.propostaInicial;
          return (
            <button
              key={proposta.clubeOfertanteId}
              type="button"
              onClick={() => onAceitar(proposta)}
              className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-left hover:border-emerald-500 hover:bg-slate-800/70 transition-colors"
            >
              <div className="font-medium">{nomeDoClube(clubePorId.get(proposta.clubeOfertanteId), proposta.clubeOfertanteId)}</div>
              <div className="mt-1 text-sm text-slate-400">
                Status: {proposta.statusOferecido} · R${termos.salarioMensal}/mês + R${termos.luvas} luvas · {termos.anos} anos
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PassoResumo({ estado, nomeClube, onFinalizar }: { estado: NonNullable<ReturnType<typeof useCriacaoDeCarreira>["estadoFinal"]>; nomeClube: string; onFinalizar: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Carreira criada!</h2>
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-slate-400">Jogador</dt>
        <dd>{estado.jogador.nome}</dd>
        <dt className="text-slate-400">Posição</dt>
        <dd>{ROTULO_POSICAO[estado.jogador.posicao]}</dd>
        <dt className="text-slate-400">Clube</dt>
        <dd>{nomeClube}</dd>
        <dt className="text-slate-400">Idade</dt>
        <dd>{estado.jogador.idade}</dd>
        <dt className="text-slate-400">Overall</dt>
        <dd>{overallAtual(estado)}</dd>
        <dt className="text-slate-400">Status</dt>
        <dd>{estado.statusNoClube}</dd>
        <dt className="text-slate-400">Temporada</dt>
        <dd>{estado.temporada}</dd>
      </dl>
      <p className="text-sm text-slate-400 border-t border-slate-800 pt-3">
        Avaliação dos olheiros sobre seu potencial de desenvolvimento: <span className="text-slate-200 font-medium">{ROTULO_POTENCIAL[estado.avaliacaoDeOlheiros]}</span>
        <br />
        <span className="text-xs">Essa avaliação pode não ser exata ainda — vai ficando mais precisa conforme você joga.</span>
      </p>
      <button type="button" onClick={onFinalizar} className="mt-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors px-4 py-2.5 font-medium">
        Começar a carreira
      </button>
    </div>
  );
}
