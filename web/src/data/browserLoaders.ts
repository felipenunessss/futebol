import type { Club } from "@motor/schemas/club.js";
import type { CampeonatoEstadual } from "@motor/schemas/championship.js";
import type { CampeonatoNacional } from "@motor/schemas/national-championship.js";

/**
 * Equivalente, pro navegador, de `src/data/loaders/index.ts` — aquele
 * usa `node:fs`/`node:path` pra ler os JSON em disco (não roda no
 * browser); aqui o Vite bundla os mesmos arquivos em build/dev time via
 * `import.meta.glob` (eager: os dados entram direto no bundle, sem
 * round-trip de rede). Mesma forma de retorno, mesma fonte de dado —
 * só muda ONDE o JSON é lido. Não mexe no loader Node original (que
 * continua servindo a CLI e os testes em `tests/`).
 */

const arquivosDeClubes = import.meta.glob<Club[]>("../../../src/data/clubes/*.json", { eager: true, import: "default" });
const arquivosDeEstaduais = import.meta.glob<CampeonatoEstadual>("../../../src/data/estaduais/*.json", { eager: true, import: "default" });
const arquivosDeCampeonatosNacionais = import.meta.glob<CampeonatoNacional>("../../../src/data/campeonatos-nacionais/*.json", { eager: true, import: "default" });

export function loadClubes(): Club[] {
  return Object.values(arquivosDeClubes).flat();
}

export function loadEstaduais(): CampeonatoEstadual[] {
  return Object.values(arquivosDeEstaduais);
}

export function loadCampeonatosNacionais(): CampeonatoNacional[] {
  return Object.values(arquivosDeCampeonatosNacionais);
}
