import type { Classico, FormatoEstadual, Premiacao } from "./championship.js";

/**
 * Competição nacional de qualquer país da CONMEBOL (ligas + copas
 * domésticas/regionais) — mesma forma de CampeonatoEstadual, mas sem
 * `estado` (é nacional, ou multi-nacional no caso de copas regionais) e
 * reaproveitando os mesmos blocos de formato/premiação/clássico.
 */
export interface CampeonatoNacional {
  id: string;
  nome: string;
  pais: string; // ISO 3166-1 alpha-2, ex: "BR", "AR" — código do país-sede pra copas regionais multi-país
  /** Nível relativo ao país: 1 = elite, 2 = segunda divisão, ... 0 = copa de mata-mata fora da hierarquia vertical. */
  nivel: number;
  ano_referencia: number;
  formato: FormatoEstadual;
  premiacao: Premiacao;
  classicos: Classico[];
  times: string[]; // Club.id[]
  /** URL externa do escudo/emblema da competição (ver `schemas/club.ts` `Club.escudo_url` — mesma fonte/convenção, mesma ausência esperada pra maioria). */
  escudo_url?: string;
  /** URL da imagem da TAÇA/troféu da competição (distinta do escudo/emblema) — usada na sala de troféus do jogador quando ele conquista o título (`web/src/features/temporada`). Pode ser externa (ver `scripts/buscar-tacas.ts`) ou local (`/trofeus/<slug>.svg`, servido de `web/public/trofeus/`, cópia de `src/data/trofeus/` — ver `docs/dados-a-verificar.md`). Só as competições nacionais mais conhecidas têm; ausência é o esperado pra maioria — a UI cai pra um ícone genérico de taça. Pra formatos `turno`+`returno` somados (Argentina, Paraguai), essa é a taça da TABLA ANUAL/campeão geral — ver `taca_apertura_url`/`taca_clausura_url` pros títulos de cada meio-turno. */
  taca_url?: string;
  /** Taça própria do Apertura (líder do 1º meio-turno) — só faz sentido pra competições `turno`+`returno` somadas (`simulation/incremental.ts` `passosTurnoRetornoSomado`); ausente = ícone genérico. */
  taca_apertura_url?: string;
  /** Taça própria do Clausura (líder do 2º meio-turno) — mesma ressalva de `taca_apertura_url`. */
  taca_clausura_url?: string;
}
