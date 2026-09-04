/**
 * Monta o times[] de uma copa regional (Copa do Nordeste, Copa Verde,
 * Copa Sul-Sudeste) a partir de vagas já resolvidas — cada vaga aponta
 * pra um clube que ocupa aquela posição (campeão, vice, vaga extra por
 * ranking, etc.) num estado/federação.
 *
 * Isso é a mesma ideia de resolverVagasEstaduais (vagas-nacionais.ts),
 * mas para o caso em que a vaga já foi resolvida externamente — hoje via
 * pesquisa de resultados reais dos estaduais 2025 (ver
 * scripts/gerar-copas-regionais.ts), amanhã via classificação real vinda
 * do motor de simulação (Fase 2). A função não decide "quem" ocupa a
 * vaga — só valida que o clube indicado existe na base e monta a lista.
 */
export interface VagaCopaRegional {
  origem: string; // estado/federação, ex: "BA", "Copa Norte"
  clubeId: string;
  criterio: string; // ex: "campeão estadual 2025", "vice-campeão estadual 2025"
}

export interface ResultadoGeracaoCopa {
  times: string[];
  erros: string[];
}

export function gerarTimesDaCopa(
  vagas: VagaCopaRegional[],
  clubesValidos: ReadonlySet<string>,
): ResultadoGeracaoCopa {
  const times: string[] = [];
  const erros: string[] = [];
  const vistos = new Set<string>();

  for (const vaga of vagas) {
    if (!clubesValidos.has(vaga.clubeId)) {
      erros.push(
        `${vaga.origem} (${vaga.criterio}): clube "${vaga.clubeId}" não existe na base de clubes`,
      );
      continue;
    }
    if (vistos.has(vaga.clubeId)) {
      erros.push(`${vaga.origem}: clube "${vaga.clubeId}" duplicado nas vagas informadas`);
      continue;
    }
    vistos.add(vaga.clubeId);
    times.push(vaga.clubeId);
  }

  return { times, erros };
}
