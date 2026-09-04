/**
 * Resolve quais clubes ocupam vagas de acesso a uma competição nacional
 * (Série D, Copa do Brasil) concedidas por um estadual via
 * `premiacao.vaga_serie_d` / `premiacao.vaga_copa_do_brasil`.
 *
 * Regra geral (usada por quase todas as federações quando não há um
 * critério mais específico documentado em `*_criterio`): os N melhores
 * colocados do estadual que ainda não disputam nenhuma competição
 * nacional ocupam as vagas, na ordem da tabela — pulando quem já está
 * em Série A/B/C/D. Isso cobre tanto "campeão" (N=1) quanto "campeão e
 * vice" (N=2) sem precisar de um branch por critério, já que a posição
 * exata só muda o N, não o mecanismo.
 *
 * Não sorteia nada: a temporada 1 da carreira usa o elenco fixo de cada
 * competição nacional (ver `docs/regras-competicoes.md`), então essa
 * resolução por classificação estadual só se aplica a partir da temporada
 * 2 em diante, quando a competição nacional já tem vagas dinâmicas.
 *
 * Depende da classificação final do estadual, que só existe depois que o
 * motor de simulação (Fase 2) rodar a temporada — por isso esta função é
 * pura (recebe a classificação pronta) e não sabe nada de partidas.
 */
export interface OpcaoResolucaoVagas {
  clubesBrasileiros?: ReadonlySet<string>;
}

export interface CampeonatoComTimesBasicos {
  id: string;
  times: string[];
}

export function listarCandidatosSerieD(
  clubesEmCompeticaoNacional: ReadonlySet<string>,
  clubesBrasileiros: ReadonlySet<string>,
  campeonatos: CampeonatoComTimesBasicos[],
): string[] {
  return listarCandidatosVagasEstaduais(clubesEmCompeticaoNacional, campeonatos, clubesBrasileiros);
}

export function listarCandidatosVagasEstaduais(
  clubesEmCompeticaoNacional: ReadonlySet<string>,
  campeonatos: CampeonatoComTimesBasicos[],
  clubesBrasileiros: ReadonlySet<string> = new Set(),
): string[] {
  const candidatos = new Set<string>();

  for (const campeonato of campeonatos) {
    for (const timeId of campeonato.times) {
      if (clubesBrasileiros.size > 0 && !clubesBrasileiros.has(timeId)) {
        continue;
      }
      if (!clubesEmCompeticaoNacional.has(timeId)) {
        candidatos.add(timeId);
      }
    }
  }

  return [...candidatos];
}

export function resolverVagasEstaduais(
  quantidadeDeVagas: number,
  classificacaoFinal: string[], // Club.id[], do 1º ao último colocado
  clubesEmCompeticaoNacional: ReadonlySet<string>,
  opcoes: OpcaoResolucaoVagas = {},
): string[] {
  const { clubesBrasileiros = new Set() } = opcoes;

  const vencedores: string[] = [];
  for (const timeId of classificacaoFinal) {
    if (vencedores.length >= quantidadeDeVagas) break;
    if (clubesBrasileiros.size > 0 && !clubesBrasileiros.has(timeId)) continue;
    if (!clubesEmCompeticaoNacional.has(timeId)) vencedores.push(timeId);
  }
  return vencedores;
}
