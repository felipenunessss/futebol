import type { Premiacao } from "../schemas/championship.js";
import type { LinhaTabela } from "../simulation/season.js";

/**
 * Promoção/rebaixamento entre temporadas — sem isso, toda temporada nova recarregava a MESMA lista
 * estática de `times` por competição (`src/data/estaduais/*.json`/`campeonatos-nacionais/*.json`),
 * então nenhum clube subia/descia de verdade entre temporadas simuladas (bug relatado pelo usuário:
 * "não estou vendo os rebaixamentos/promoções/premiações funcionarem"). Este módulo calcula as
 * mudanças de divisão a partir da classificação final de cada competição e aplica isso na
 * composição efetiva da temporada seguinte — sem tocar nos arquivos de dado (que continuam sendo a
 * referência "ano X" original), só numa sobreposição (`EstadoDeCarreira.composicaoDasCompeticoes`)
 * carregada entre temporadas da mesma carreira.
 *
 * **Escopo desta 1ª versão, de propósito**: só cobre promoção/rebaixamento ENTRE DIVISÕES DA MESMA
 * hierarquia (ligadas por `nivel` dentro da mesma `chaveDeHierarquia` — quem chama monta essa
 * chave: estado, pro Brasil, ou país, pra competições nacionais) E só quando as DUAS divisões do
 * par conseguem expor uma `tabelaFinal` (hoje só `pontos_corridos` puro, sem mata-mata — ver
 * `simulation/incremental.ts` `ContextoDePrograma.tabelaFinal`); se só uma das duas suportar,
 * nenhuma troca acontece nesse par (evita drenar/inchar uma divisão ao longo de várias temporadas
 * recebendo de um lado sem nunca devolver do outro). Confirmado funcionando: Brasileirão Série A/B
 * (as duas são `pontos_corridos` puro), e Série B/C/D em cadeia — Série D não tem `tabelaFinal`
 * (fase_grupos com 16 grupos, sem classificação ordenada), mas expõe `semifinalistas` como sinal
 * alternativo pra ACESSO (ver campo abaixo); Série C ganhou `tabelaFinal` da sua fase de grupos
 * único, que habilita tanto o acesso dela própria pra B quanto o REBAIXAMENTO dela pra D — o
 * rebaixamento entrando numa divisão que só tem `semifinalistas` (não `tabelaFinal`) funciona
 * porque a checagem de "divisão vizinha rastreável" aceita QUALQUER um dos dois sinais como prova
 * de que a divisão foi simulada essa temporada (não precisa ordem pra RECEBER times, só pra decidir
 * quem SAI de uma). Sem isso, a Série D promoveria 4 semifinalistas/temporada pra C sem nunca
 * receber de volta os 4 que a C rebaixa — bug real encontrado com dado real (Série D caindo de 96
 * pra 92 times já na 1ª aplicação). **Ainda não cobre**: a maioria dos estaduais (fase_suica/
 * fase_grupos/turno-retorno não têm `tabelaFinal` ainda). Também não cobre vagas de Copa do
 * Brasil/Série D concedidas a um estadual (`Premiacao.vaga_copa_do_brasil`/`vaga_serie_d`) —
 * inserções cross-competição em competições já complexas (fases escalonadas, sorteio de grupos),
 * fora de escopo por ora.
 *
 * **Vagas de Libertadores/Sul-Americana** (`Premiacao.vaga_libertadores`/`vaga_sulamericana`) têm um
 * mecanismo PRÓPRIO nesse mesmo arquivo (`calcularMudancasContinentais`) — não é promoção/
 * rebaixamento entre níveis de uma hierarquia, é uma competição nacional alimentando uma competição
 * continental de um país inteiro (várias competições podem contribuir pro mesmo país). Mesma
 * ressalva de escopo condicional: só resolve quando o formato da competição de origem suporta
 * `tabelaFinal` OU quando é uma vaga única pro campeão de um mata-mata (ver doc da função).
 */

export interface CompeticaoParaMundoPersistente {
  id: string;
  /** Chave de agrupamento hierárquico — competições da MESMA chave promovem/rebaixam entre si por
   * `nivel` adjacente (ex: `"estadual:MG"` pro Mineiro Módulo I/II, `"nacional:BR"` pro Brasileirão
   * A/B/C/D). Quem monta a chave decide o que conta como "mesma hierarquia" — este módulo só agrupa
   * por igualdade de string. */
  chaveDeHierarquia: string;
  nivel: number;
  premiacao: Premiacao;
  /** Classificação final desta temporada, do 1º ao último colocado — `undefined` quando o formato
   * não suporta extração ainda (ver docs no topo do arquivo). Sem isso, a competição não participa
   * de nenhuma mudança de divisão nesta rodada (nem como origem nem como destino), A NÃO SER que
   * `semifinalistas` esteja presente (ver campo abaixo). */
  tabelaFinal?: LinhaTabela[];
  /** Alternativa a `tabelaFinal` pra `acesso_proxima_divisao` quando o formato não tem uma
   * classificação ordenada (`fase_grupos`+`mata_mata` com mais de 1 grupo, ex: Brasileirão Série D:
   * "os 4 semifinalistas sobem", não uma posição em tabela — ver `simulation/incremental.ts`
   * `semifinalistasDaFase`). Só usado quando `acesso_proxima_divisao` bate EXATAMENTE com
   * `semifinalistas.length` (ex: 4 semifinalistas pra 4 vagas) — sem essa checagem, um número de
   * vagas diferente do de semifinalistas reais seria ambíguo (quem dos 4 fica de fora?). NUNCA usado
   * pra `rebaixamento_proxima_divisao` (não tem "piores colocados" num conjunto sem ordem). */
  semifinalistas?: string[];
}

export interface MudancaDeDivisao {
  competicaoId: string;
  /** Club.id[] que passam a fazer parte desta competição na temporada seguinte. */
  entram: string[];
  /** Club.id[] que saem desta competição na temporada seguinte. */
  saem: string[];
}

function adicionar(mapa: Map<string, { entram: Set<string>; saem: Set<string> }>, id: string, campo: "entram" | "saem", times: string[]): void {
  let atual = mapa.get(id);
  if (!atual) {
    atual = { entram: new Set(), saem: new Set() };
    mapa.set(id, atual);
  }
  for (const time of times) atual[campo].add(time);
}

/**
 * Calcula quem sobe/desce a partir da classificação final desta temporada — pura, não aplica nada
 * sozinha (ver `aplicarMudancasDeDivisao`). `rebaixamento_proxima_divisao: N` manda os N últimos
 * colocados pra divisão de `nivel + 1` da mesma `chaveDeHierarquia` (se existir); `acesso_proxima_divisao: N`
 * manda os N primeiros colocados pra divisão de `nivel - 1`. As duas regras podem coexistir na
 * mesma competição (ex: uma 2ª divisão sobe alguns times pra 1ª E desce outros pra 3ª).
 */
export function calcularMudancasDeDivisao(competicoes: CompeticaoParaMundoPersistente[]): MudancaDeDivisao[] {
  const porChave = new Map<string, CompeticaoParaMundoPersistente[]>();
  for (const competicao of competicoes) {
    const lista = porChave.get(competicao.chaveDeHierarquia) ?? [];
    lista.push(competicao);
    porChave.set(competicao.chaveDeHierarquia, lista);
  }

  const mudancas = new Map<string, { entram: Set<string>; saem: Set<string> }>();

  for (const grupo of porChave.values()) {
    const porNivel = new Map(grupo.map((competicao) => [competicao.nivel, competicao] as const));
    for (const competicao of grupo) {
      const temTabelaFinal = !!competicao.tabelaFinal && competicao.tabelaFinal.length > 0;
      // `semifinalistas` só serve pra ACESSO (promoção) — sem ordem dentro do conjunto, não dá pra
      // tirar "os piores colocados" dele pra rebaixamento (ver doc do campo).
      const temSemifinalistas = !!competicao.semifinalistas && competicao.semifinalistas.length > 0;
      if (!temTabelaFinal && !temSemifinalistas) continue;

      // A divisão VIZINHA também precisa estar "rastreável" nesta temporada (`tabelaFinal` OU
      // `semifinalistas` — QUALQUER um prova que ela foi simulada com sucesso, mesmo se não dá pra
      // usá-la como ORIGEM de troca — ver `temTabelaFinal`/`temSemifinalistas` acima) pra uma troca
      // ser aplicada num sentido — sem essa checagem, uma divisão suportada podia mandar times pra
      // uma vizinha não rastreável (ou receber dela) só nesse UM sentido, drenando/inchando a
      // vizinha ao longo de várias temporadas (ex: Série B rebaixando 4/ano pra Série C pra sempre,
      // sem nunca receber de volta os 4 que a Série C promoveria — ou, o bug real que motivou esta
      // checagem incluir `semifinalistas`: Série D promovendo 4 semifinalistas pra Série C todo ano
      // sem nunca receber de volta os 4 que a Série C rebaixa, porque o rebaixamento exigia
      // `tabelaFinal` da Série D, que ela nunca tem).
      const divisaoRastreavel = (divisao: CompeticaoParaMundoPersistente | undefined): boolean => !!divisao && (!!divisao.tabelaFinal || !!divisao.semifinalistas);

      const rebaixamento = competicao.premiacao.rebaixamento_proxima_divisao ?? 0;
      const divisaoDeBaixo = porNivel.get(competicao.nivel + 1);
      if (rebaixamento > 0 && temTabelaFinal && divisaoRastreavel(divisaoDeBaixo)) {
        const times = competicao.tabelaFinal!.slice(-rebaixamento).map((linha) => linha.clubeId);
        adicionar(mudancas, competicao.id, "saem", times);
        adicionar(mudancas, divisaoDeBaixo!.id, "entram", times);
      }

      const acesso = competicao.premiacao.acesso_proxima_divisao ?? 0;
      const divisaoDeCima = porNivel.get(competicao.nivel - 1);
      if (acesso > 0 && divisaoRastreavel(divisaoDeCima)) {
        const times = temTabelaFinal
          ? competicao.tabelaFinal!.slice(0, acesso).map((linha) => linha.clubeId)
          : competicao.semifinalistas!.length === acesso
            ? competicao.semifinalistas!
            : undefined;
        if (times) {
          adicionar(mudancas, competicao.id, "saem", times);
          adicionar(mudancas, divisaoDeCima!.id, "entram", times);
        }
      }
    }
  }

  return [...mudancas.entries()].map(([competicaoId, { entram, saem }]) => ({ competicaoId, entram: [...entram], saem: [...saem] }));
}

/**
 * Uma competição NACIONAL candidata a conceder vaga de Libertadores/Sul-Americana nesta temporada
 * (ver `calcularMudancasContinentais`) — `pais` é `CampeonatoNacional.pais` (código ISO, ex: "BR",
 * "CL"), não `chaveDeHierarquia` (que serve só pra `calcularMudancasDeDivisao`, um conceito
 * diferente). `tabelaFinal`/`campeao` seguem a mesma disponibilidade condicional de
 * `CompeticaoParaMundoPersistente` (só formatos suportados pelo motor incremental).
 */
export interface CompeticaoParaVagaContinental {
  id: string;
  pais: string;
  premiacao: Premiacao;
  /** Só quando o formato é `pontos_corridos` de fase única (mesma restrição de `tabelaFinal` em `calcularMudancasDeDivisao`) — usado pra tirar os N primeiros (Libertadores) e os M seguintes (Sul-Americana) colocados. */
  tabelaFinal?: LinhaTabela[];
  /** Campeão da competição — disponível mesmo pra formatos sem `tabelaFinal` (mata-mata inclusive, via `ResultadoCampeonatoSimples.campeao`). Só usado quando `premiacao.vaga_libertadores === 1` (regra inequívoca "campeão leva a vaga", ex: Copa do Brasil) — sem tabela pra ordenar 2º/3º/etc, uma vaga_sulamericana>0 sem `tabelaFinal` não é resolvida (ficaria ambíguo quem é o "vice"). */
  campeao?: string;
}

/** Uma competição continental (Libertadores/Sul-Americana) e sua composição atual — usada como entrada e como saída de `calcularMudancasContinentais`. */
export interface CompeticaoContinental {
  id: string;
  timesAtuais: string[];
}

/**
 * Calcula a nova composição de Libertadores/Sul-Americana a partir das vagas concedidas por
 * competições nacionais nesta temporada (`Premiacao.vaga_libertadores`/`vaga_sulamericana`) — sem
 * isso, essas duas competições sempre recarregavam a MESMA lista estática de `times`, mesmo com
 * campeonatos concedendo vaga de verdade (bug relatado pelo usuário: "validar se as premiações [de
 * Libertadores/Sul-Americana] estão funcionando" — não estavam, só serviam pra destacar linha na
 * tabela, sem efeito nenhum na temporada seguinte).
 *
 * **Escopo, de propósito, pra não arriscar ENCOLHER a representação de um país por acidente**: só
 * troca a fatia de um país numa competição continental quando a soma das vagas RESOLVIDAS desta
 * temporada bate EXATAMENTE com o tamanho atual da fatia desse país nela — se um país tem hoje 8
 * clubes na Libertadores mas só uma das competições dele (ex: só a copa nacional, não a liga) tem
 * `vaga_libertadores` modelada, a soma resolvida (1) não bate com 8, e a fatia desse país fica
 * INTOCADA nesta rodada (mesmo comportamento de sempre) — evita o cenário de uma cobertura parcial
 * substituir um país inteiro por 1 clube só. Fica documentado como pendência quando isso acontece
 * (ver `docs/dados-a-verificar.md`, ex: Brasil — Série A não tem `vaga_libertadores`/
 * `vaga_sulamericana` modelados, só a Copa do Brasil tem, então o Brasil nunca é tocado por este
 * mecanismo até a Série A ganhar os campos).
 */
export function calcularMudancasContinentais(
  competicoesNacionais: CompeticaoParaVagaContinental[],
  paisPorClube: Map<string, string>,
  libertadores: CompeticaoContinental,
  sulamericana: CompeticaoContinental,
  /**
   * Clubes com um papel estrutural fixo na fase pré-classificatória/mata-mata de Libertadores/Sul-
   * Americana (`formato.mata_mata.etapas[].entrantes`, ver `simulation/incremental.ts`
   * `derivarCortePreClassificatorio`) — nunca trocados por este mecanismo, mesmo que o país deles
   * mude de composição. Sem isso, um clube "direto" (vaga_libertadores/vaga_sulamericana = entrada
   * direta na fase de grupos) podia acabar sendo trocado por um clube que na verdade tinha papel de
   * pré-classificatório (ou vice-versa) — o total de clubes da competição continua batendo (a troca é
   * sempre N-por-N dentro do mesmo país), mas o EQUILÍBRIO entre "quantos entram direto" e "quantos
   * vêm de pré-classificatória" quebra, e `derivarCortePreClassificatorio` não consegue mais achar o
   * corte exato entre as duas fases — quebrando a competição inteira (bug real: clube brasileiro
   * ganhando vaga de Sul-Americana, temporada seguinte a competição sumia da lista do jogador, porque
   * a troca de país (Chile/Bolívia, que têm clubes com papel fixo de pré-classificatória) trocou um
   * clube pré-classificatório por um "direto" sem querer). Passe vazio/undefined se a competição não
   * tiver etapas pré-classificatórias nomeadas (maioria dos casos).
   */
  clubesProtegidos?: Set<string>,
): MudancaDeDivisao[] {
  const protegido = (id: string) => clubesProtegidos?.has(id) ?? false;

  const porPais = new Map<string, CompeticaoParaVagaContinental[]>();
  for (const competicao of competicoesNacionais) {
    const lista = porPais.get(competicao.pais) ?? [];
    lista.push(competicao);
    porPais.set(competicao.pais, lista);
  }

  const libertadoresEntram: string[] = [];
  const libertadoresSaem: string[] = [];
  const sulamericanaEntram: string[] = [];
  const sulamericanaSaem: string[] = [];

  for (const [pais, competicoes] of porPais) {
    const atuaisLibertadores = libertadores.timesAtuais.filter((id) => paisPorClube.get(id) === pais && !protegido(id));
    const atuaisSulamericana = sulamericana.timesAtuais.filter((id) => paisPorClube.get(id) === pais && !protegido(id));

    const novosLibertadoresBruto: string[] = [];
    const novosSulamericanaBruto: string[] = [];
    for (const competicao of competicoes) {
      const vagaLibertadores = competicao.premiacao.vaga_libertadores ?? 0;
      const vagaSulamericana = competicao.premiacao.vaga_sulamericana ?? 0;
      if (competicao.tabelaFinal) {
        if (vagaLibertadores > 0) novosLibertadoresBruto.push(...competicao.tabelaFinal.slice(0, vagaLibertadores).map((linha) => linha.clubeId).filter((id) => !protegido(id)));
        if (vagaSulamericana > 0) novosSulamericanaBruto.push(...competicao.tabelaFinal.slice(vagaLibertadores, vagaLibertadores + vagaSulamericana).map((linha) => linha.clubeId).filter((id) => !protegido(id)));
      } else if (competicao.campeao && vagaLibertadores === 1 && !protegido(competicao.campeao)) {
        novosLibertadoresBruto.push(competicao.campeao);
      }
    }

    // Um clube pode se qualificar por MAIS DE UMA via na mesma temporada (ex: campeão da Copa do
    // Brasil que TAMBÉM termina entre os 7 primeiros do Brasileirão) — sem deduplicar, ele apareceria
    // 2x na mesma competição continental (bug real encontrado com dado de verdade: Flamengo
    // duplicado em Libertadores). Não tenta promover o "próximo da fila" pro lugar que sobrou (regra
    // real faria isso, mas depende de saber a ordem de prioridade entre critérios, fora de escopo) —
    // só deduplica; se isso fizer a contagem não bater mais com a fatia atual do país, a troca é
    // pulada nesta rodada (mesma rede de segurança de sempre, ver comentário da função).
    const novosLibertadores = [...new Set(novosLibertadoresBruto)];
    const novosSulamericana = [...new Set(novosSulamericanaBruto)];

    if (novosLibertadores.length > 0 && novosLibertadores.length === atuaisLibertadores.length) {
      libertadoresEntram.push(...novosLibertadores);
      libertadoresSaem.push(...atuaisLibertadores);
    }
    if (novosSulamericana.length > 0 && novosSulamericana.length === atuaisSulamericana.length) {
      sulamericanaEntram.push(...novosSulamericana);
      sulamericanaSaem.push(...atuaisSulamericana);
    }
  }

  const resultado: MudancaDeDivisao[] = [];
  if (libertadoresEntram.length > 0) resultado.push({ competicaoId: libertadores.id, entram: libertadoresEntram, saem: libertadoresSaem });
  if (sulamericanaEntram.length > 0) resultado.push({ competicaoId: sulamericana.id, entram: sulamericanaEntram, saem: sulamericanaSaem });
  return resultado;
}

/**
 * Aplica as mudanças calculadas por `calcularMudancasDeDivisao` sobre a composição atual (Club.id[]
 * por campeonatoId — já com qualquer sobreposição de temporadas anteriores refletida, ver
 * `EstadoDeCarreira.composicaoDasCompeticoes`), devolvendo a composição da PRÓXIMA temporada. Pura —
 * não muta `composicaoAtual`.
 */
export function aplicarMudancasDeDivisao(composicaoAtual: Map<string, string[]>, mudancas: MudancaDeDivisao[]): Map<string, string[]> {
  const nova = new Map(composicaoAtual);
  for (const { competicaoId, entram, saem } of mudancas) {
    const atuais = nova.get(competicaoId) ?? [];
    const saemSet = new Set(saem);
    const restantes = atuais.filter((id) => !saemSet.has(id));
    nova.set(competicaoId, [...restantes, ...entram]);
  }
  return nova;
}
