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
 * Na primeira temporada da carreira, quando ainda não há uma classificação
 * histórica estável, o jogo pode preencher as vagas faltantes de forma
 * aleatória entre clubes elegíveis para evitar uma transição abrupta. A
 * partir da segunda temporada, a regra esportiva passa a valer de forma
 * determinística.
 *
 * Depende da classificação final do estadual, que só existe depois que o
 * motor de simulação (Fase 2) rodar a temporada — por isso esta função é
 * pura (recebe a classificação pronta) e não sabe nada de partidas.
 */
export interface OpcaoResolucaoVagas {
  temporada?: number;
  candidatosExtras?: string[];
  clubesBrasileiros?: ReadonlySet<string>;
  random?: () => number;
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
  return listarCandidatosVagasEstaduais(clubesEmCompeticaoNacional, campeonatos, clubesBrasileiros).filter(
    (timeId) => !timeId.startsWith("atletico_") || !timeId.includes("_"),
  );
}

export function sortearCandidatosSerieDTemporadaInicial(
  quantidadeDeVagas: number,
  clubesEmCompeticaoNacional: ReadonlySet<string>,
  clubesBrasileiros: ReadonlySet<string>,
  campeonatos: CampeonatoComTimesBasicos[],
  random: () => number = Math.random,
): string[] {
  const candidatos = listarCandidatosSerieD(clubesEmCompeticaoNacional, clubesBrasileiros, campeonatos);
  const selecionados: string[] = [];
  const usados = new Set<string>();

  while (selecionados.length < Math.min(quantidadeDeVagas, candidatos.length)) {
    const indice = Math.min(candidatos.length - 1, Math.max(0, Math.floor(random() * candidatos.length)));
    const timeId = candidatos[indice];
    if (!usados.has(timeId)) {
      selecionados.push(timeId);
      usados.add(timeId);
    }
    if (usados.size >= candidatos.length) break;
  }

  return selecionados;
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
  const {
    temporada = 2,
    candidatosExtras = [],
    clubesBrasileiros = new Set(),
    random = Math.random,
  } = opcoes;

  if (temporada <= 1) {
    const ehElegivel = (timeId: string) => {
      if (clubesEmCompeticaoNacional.has(timeId)) return false;
      if (clubesBrasileiros.size > 0 && !clubesBrasileiros.has(timeId)) return false;
      return true;
    };

    const elegiveis = [
      ...classificacaoFinal.filter(ehElegivel),
      ...candidatosExtras.filter(ehElegivel),
    ];

    const selecionados: string[] = [];
    const usados = new Set<string>();
    const qtd = Math.min(quantidadeDeVagas, elegiveis.length);

    while (selecionados.length < qtd) {
      const indice = Math.min(
        elegiveis.length - 1,
        Math.max(0, Math.floor(random() * elegiveis.length)),
      );
      const timeId = elegiveis[indice];
      if (!usados.has(timeId)) {
        selecionados.push(timeId);
        usados.add(timeId);
      }
      if (usados.size >= elegiveis.length) break;
    }

    return selecionados;
  }

  const vencedores: string[] = [];
  for (const timeId of classificacaoFinal) {
    if (vencedores.length >= quantidadeDeVagas) break;
    if (clubesBrasileiros.size > 0 && !clubesBrasileiros.has(timeId)) continue;
    if (!clubesEmCompeticaoNacional.has(timeId)) vencedores.push(timeId);
  }
  return vencedores;
}
