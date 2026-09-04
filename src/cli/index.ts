import { loadCampeonatosNacionais, loadClubes } from "../data/loaders/index.js";
import { simularMataMataDoFormato, type ResultadoMataMata } from "../simulation/knockout.js";
import { obterRating } from "../simulation/rating.js";

const clubes = loadClubes();
const clubePorId = new Map(clubes.map((c) => [c.id, c]));

function nomeDoClube(id: string): string {
  const clube = clubePorId.get(id);
  return clube?.nome_popular ?? clube?.nome ?? id;
}

function simularCopaDoBrasil(): void {
  const nacionais = loadCampeonatosNacionais();
  const copaDoBrasil = nacionais.find((n) => n.id === "copa_do_brasil");
  if (!copaDoBrasil) throw new Error("Copa do Brasil não encontrada em loadCampeonatosNacionais()");

  const ratings = Object.fromEntries(copaDoBrasil.times.map((id) => [id, obterRating(clubePorId.get(id)!)]));

  const resultado: ResultadoMataMata = simularMataMataDoFormato(copaDoBrasil.formato.mata_mata!, ratings, copaDoBrasil.times);

  console.log(`\n=== ${copaDoBrasil.nome} ${copaDoBrasil.ano_referencia} — simulação ===`);
  console.log(`${copaDoBrasil.times.length} clubes reais na disputa\n`);

  for (const etapa of resultado.etapas) {
    if (etapa.confrontos.length === 0) continue;

    console.log(`--- ${etapa.nome} (${etapa.confrontos.length} confronto${etapa.confrontos.length > 1 ? "s" : ""}) ---`);
    for (const confronto of etapa.confrontos) {
      const decisao = confronto.decididoNosPenaltis ? " (pênaltis)" : "";
      console.log(
        `  ${nomeDoClube(confronto.timeA)} ${confronto.golsA} x ${confronto.golsB} ${nomeDoClube(confronto.timeB)}${decisao} — vence ${nomeDoClube(confronto.vencedor)}`,
      );
    }
    console.log();
  }

  console.log(`Campeão: ${nomeDoClube(resultado.campeao)}`);
}

simularCopaDoBrasil();
