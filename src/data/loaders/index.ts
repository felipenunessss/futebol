import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Club } from "../../schemas/club.js";
import type { Classico, CampeonatoEstadual } from "../../schemas/championship.js";
import type { CampeonatoNacional } from "../../schemas/national-championship.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..");

export function loadClubes(): Club[] {
  const dir = join(DATA_DIR, "clubes");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as Club[]);
}

export function loadEstaduais(): CampeonatoEstadual[] {
  const dir = join(DATA_DIR, "estaduais");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as CampeonatoEstadual);
}

export function loadCampeonatosNacionais(): CampeonatoNacional[] {
  const dir = join(DATA_DIR, "campeonatos-nacionais");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as CampeonatoNacional);
}

/** Retorna os ids de clube que aparecem em mais de um arquivo/fonte da base. */
export function encontrarIdsDuplicados(clubes: Club[]): string[] {
  const vistos = new Set<string>();
  const duplicados = new Set<string>();
  for (const clube of clubes) {
    if (vistos.has(clube.id)) duplicados.add(clube.id);
    vistos.add(clube.id);
  }
  return [...duplicados];
}

interface CampeonatoComTimes {
  id: string;
  times: string[];
  classicos: Classico[];
}

/**
 * Confere se todo id em times/clássicos de um campeonato (estadual ou
 * nacional) existe na base de clubes. Retorna a lista de erros encontrados
 * (vazia se tudo estiver consistente).
 */
export function validarReferenciasDeTimes(
  clubes: Club[],
  campeonatos: CampeonatoComTimes[],
): string[] {
  const idsValidos = new Set(clubes.map((c) => c.id));
  const erros: string[] = [];

  for (const campeonato of campeonatos) {
    for (const timeId of campeonato.times) {
      if (!idsValidos.has(timeId)) {
        erros.push(`${campeonato.id}: time "${timeId}" não existe na base de clubes`);
      }
    }
    for (const classico of campeonato.classicos) {
      for (const timeId of [classico.time_a, classico.time_b]) {
        if (!idsValidos.has(timeId)) {
          erros.push(`${campeonato.id}: clássico "${classico.nome}" referencia time inexistente "${timeId}"`);
        }
      }
    }
  }

  return erros;
}
