import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Club } from "../../schemas/club.js";
import type { CampeonatoEstadual } from "../../schemas/championship.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..");

export function loadClubes(): Club[] {
  const raw = readFileSync(join(DATA_DIR, "clubes", "brasil.json"), "utf-8");
  return JSON.parse(raw) as Club[];
}

export function loadEstaduais(): CampeonatoEstadual[] {
  const dir = join(DATA_DIR, "estaduais");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as CampeonatoEstadual);
}

/**
 * Confere se todo id em CampeonatoEstadual.times existe na base de clubes.
 * Retorna a lista de erros encontrados (vazia se tudo estiver consistente).
 */
export function validarReferenciasDeTimes(
  clubes: Club[],
  estaduais: CampeonatoEstadual[],
): string[] {
  const idsValidos = new Set(clubes.map((c) => c.id));
  const erros: string[] = [];

  for (const estadual of estaduais) {
    for (const timeId of estadual.times) {
      if (!idsValidos.has(timeId)) {
        erros.push(`${estadual.id}: time "${timeId}" não existe na base de clubes`);
      }
    }
    for (const classico of estadual.classicos) {
      for (const timeId of [classico.time_a, classico.time_b]) {
        if (!idsValidos.has(timeId)) {
          erros.push(`${estadual.id}: clássico "${classico.nome}" referencia time inexistente "${timeId}"`);
        }
      }
    }
  }

  return erros;
}
