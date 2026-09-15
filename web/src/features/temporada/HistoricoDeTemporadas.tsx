import { useEffect, useRef } from "react";
import { Escudo } from "../../components/Escudo.js";
import type { RegistroDeTemporada } from "./useTemporada.js";

export type FaixaDeOvr = "bronze" | "prata" | "ouro";

/** Bronze até 69, Prata 70-79, Ouro 80+. */
export function getCorPorOvr(ovr: number): FaixaDeOvr {
  if (ovr >= 80) return "ouro";
  if (ovr >= 70) return "prata";
  return "bronze";
}

const CLASSES_POR_FAIXA: Record<FaixaDeOvr, string> = {
  bronze: "bg-amber-900/60 border-amber-700 text-amber-300",
  prata: "bg-slate-400/20 border-slate-400 text-slate-200",
  ouro: "bg-yellow-500/20 border-yellow-400 text-yellow-300",
};

/**
 * Painel "Histórico de temporadas" (estilo Copero.net) — lista rolável com uma linha por
 * temporada da carreira, cabeçalho de colunas fixo no topo. Puramente apresentacional: todos os
 * números já vêm prontos do motor via `useTemporada` (`RegistroDeTemporada`), sem cálculo aqui.
 */
export function HistoricoDeTemporadas({ registros, onFechar }: { registros: RegistroDeTemporada[]; onFechar: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Ao abrir, rola até a temporada mais recente — registros vêm em ordem cronológica, então é o
  // fim da lista. Roda de novo toda vez que o painel monta (montagem condicional, não CSS
  // escondida) — pedido do usuário: "ao carregar a tela, rolar automaticamente até a temporada
  // mais recente/atual".
  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight });
  }, []);

  return (
    <div className="fixed inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={onFechar}>
      <div
        className="mx-auto w-full max-w-2xl max-h-[85vh] rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col text-slate-100"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <h2 className="text-lg font-semibold">Histórico de temporadas</h2>
          <button type="button" onClick={onFechar} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            Fechar
          </button>
        </div>

        {registros.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">Nenhuma temporada concluída ainda.</p>
        ) : (
          <>
            <div className="grid grid-cols-[3rem_1fr_3.5rem_2.5rem_2.5rem_3rem] gap-2 px-5 py-2 text-xs font-medium text-slate-400 border-b border-slate-800 shrink-0">
              <span>Idade</span>
              <span>Clube</span>
              <span className="text-right">OVR</span>
              <span className="text-right">J</span>
              <span className="text-right">G</span>
              <span className="text-right">A</span>
            </div>
            <div ref={containerRef} className="overflow-y-auto">
              {registros.map((registro) => (
                <LinhaDeTemporada key={registro.temporada} registro={registro} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LinhaDeTemporada({ registro }: { registro: RegistroDeTemporada }) {
  const faixa = getCorPorOvr(registro.ovr);
  const transferencia = registro.transferencia;
  const ehEmprestimo = transferencia?.tipo === "emprestimo";
  const tituloDaTransferencia =
    transferencia?.tipo === "emprestimo" ? "Empréstimo" : transferencia?.tipo === "volta_emprestimo" ? "Retorno de empréstimo" : transferencia?.tipo === "definitiva" ? "Transferência" : undefined;

  return (
    <div
      className="grid grid-cols-[3rem_1fr_3.5rem_2.5rem_2.5rem_3rem] gap-2 items-center px-5 py-2 text-sm border-b border-slate-800/60 last:border-b-0 tabular-nums"
      title={tituloDaTransferencia}
    >
      <span className="text-slate-400">{registro.idade}</span>
      <span className="flex items-center gap-1.5 min-w-0">
        {ehEmprestimo && (
          <span className="text-sky-400 shrink-0" aria-hidden="true">
            →
          </span>
        )}
        <Escudo url={registro.clube.escudoUrl} alt="" tamanho={16} />
        <span className="truncate">{registro.clube.nome}</span>
        {registro.titulos.length > 0 && (
          <span className="flex items-center gap-0.5 shrink-0" title={`${registro.titulos.length} título(s) nessa temporada`}>
            {registro.titulos.map((_, indice) => (
              <TrofeuPequeno key={indice} />
            ))}
          </span>
        )}
      </span>
      <span className={`text-right rounded px-1.5 py-0.5 border text-xs font-semibold ${CLASSES_POR_FAIXA[faixa]}`}>{registro.ovr}</span>
      <span className="text-right text-slate-200">{registro.jogos}</span>
      <span className="text-right text-slate-200">{registro.gols}</span>
      <span className="text-right text-slate-200">{registro.assistencias}</span>
    </div>
  );
}

function TrofeuPequeno() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
      <path d="M9 19h6" />
      <path d="M12 15v4" />
    </svg>
  );
}
