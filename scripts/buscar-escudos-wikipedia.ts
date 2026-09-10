import { readFileSync, writeFileSync, appendFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Club } from "../src/schemas/club.js";
import type { CampeonatoEstadual } from "../src/schemas/championship.js";
import type { CampeonatoNacional } from "../src/schemas/national-championship.js";

/**
 * Segunda fonte de `escudo_url`, só pra quem `scripts/buscar-escudos.ts`
 * (TheSportsDB) não achou — a API gratuita do TheSportsDB simplesmente não
 * cataloga a maioria dos clubes pequenos de estaduais regionais (ver
 * docs/dados-a-verificar.md, "Escudos e cores"). Busca na Wikipédia
 * (pt/es conforme o país) a imagem principal do artigo (normalmente o
 * escudo, quando o artigo é sobre um clube de futebol de verdade) via
 * `action=query&prop=pageimages`, com uma checagem de confiança (o resumo
 * do artigo precisa mencionar futebol/fútbol) antes de aceitar — evita
 * gravar imagem de um artigo errado (nome ambíguo bate com outra coisa).
 * Não baixa/guarda a imagem em si, só grava a URL externa (mesma decisão
 * já registrada pro script do TheSportsDB). Roda uma vez, sob demanda;
 * reexecutar é seguro (só toca registros que ainda não têm `escudo_url`).
 *
 * ATENÇÃO — três rodadas completas já feitas nesta base, TODAS com falsos positivos reais achados só
 * por amostragem manual depois (todos revertidos; NENHUM ficou nos dados nem foi commitado). Categorias
 * já vistas, uma por rodada, cada correção seguinte fechando a anterior mas abrindo uma nova:
 *   1) nome só com palavra genérica ("Esporte" sozinho batendo com "Cruzeiro Esporte Clube"; "Athletic"
 *      com "Athletic Club de Bilbao"); logo de competição indo parar num clube; país sozinho não
 *      distinguindo nada ("Peru" com a cidade de Trujillo); divisão errada da mesma competição (Série A
 *      vs A2, Módulo I vs II) — fechado por `bateComONome` (nível de divisão + rejeita nome vazio/país
 *      isolado).
 *   2) foto de jogador/cidade batendo por coincidência de sobrenome/nome ("Pereira" com o jogador
 *      Andreas Pereira; "San Miguel" com foto de amistoso Leipzig-Liverpool; "Uberaba" com o artigo da
 *      CIDADE) — fechado por `extractConfirmaNome` + `extractIndicaOutraCoisa` + `\bfutebol\b` com
 *      fronteira de palavra (substring pegava "futebolista").
 *   3) [NÃO FECHADO] apelido genérico de clube pequeno batendo com um clube BEM mais famoso que usa o
 *      mesmo apelido/nome em outro país/estado — "Wanderers" (Uruguai) com "Wolverhampton Wanderers"
 *      (Inglaterra); "Barcelona" (Ilhéus-BA) com o "Futbol Club Barcelona"; "Internacional" (Bogotá) com
 *      o "Sport Club Internacional" (Porto Alegre); "River" (Roraima) com "River Plate" (Argentina);
 *      "Ferroviário" (Ceará) com "Ferroviário" do Paraná. Nenhuma checagem atual pega isso — o artigo
 *      batido É de um clube de futebol de verdade, só que o ERRADO, e não tem palavra "genérica" nem
 *      "país isolado" pra reprovar automaticamente. Precisaria de contexto adicional que não temos de
 *      graça (ex: nome completo com UF/cidade, que normalmente não está em `nome_popular`) — não
 *      resolvido, não tentar de novo sem uma ideia nova validada num piloto pequeno primeiro.
 * Dado esse histórico, NÃO confie cegamente numa rodada nova — sempre reveja
 * `relatorio-escudos-wikipedia.txt` E faça uma amostragem aleatória grande (40+) nos dados alterados
 * antes de commitar. As três rodadas reais tiveram taxa de erro de ~10-12% cada uma, só visível por
 * amostragem (nunca ficou óbvio olhando resumos agregados).
 */

const CLUBES_DIR = join(import.meta.dirname, "../src/data/clubes");
const ESTADUAIS_DIR = join(import.meta.dirname, "../src/data/estaduais");
const NACIONAIS_DIR = join(import.meta.dirname, "../src/data/campeonatos-nacionais");

/** pt.wikipedia.org cobre bem clubes brasileiros e boa parte dos sul-americanos (muitos artigos de
 * clubes argentinos/uruguaios etc. existem em português) — tentado primeiro sempre; es.wikipedia.org
 * como fallback pros países de língua espanhola quando pt não acha nada. */
const WIKI_ES_PARA: Set<string> = new Set(["AR", "BO", "CL", "CO", "EC", "PY", "PE", "UY", "VE"]);

const PALAVRAS_FUTEBOL = ["futebol", "fútbol", "football club", "clube de futebol", "club de fútbol", "clube esportivo", "club deportivo", "sociedade esportiva", "associação atlética"];

/** Precisa ser descritivo e incluir contato, senão a Wikimedia derruba a maioria das requisições com
 * 429 quase de imediato (ver https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits) — foi a causa
 * real de um piloto anterior reportar "sem resultado de busca" pra clubes famosos (San Lorenzo, Lanús
 * etc.) que na verdade têm artigo na Wikipédia. */
const USER_AGENT = "futebol-carreira-data-script/1.0 (felipe_nuness@icloud.com; personal hobby project, low-volume, ver docs/dados-a-verificar.md)";

const DELAY_ENTRE_REQUISICOES_MS = 400;
const MAX_TENTATIVAS = 4;

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buscarJson(url: string): Promise<unknown> {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const resposta = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (resposta.status === 429 || resposta.status >= 500) {
        await dormir(1500 * tentativa);
        continue;
      }
      if (!resposta.ok) return null;
      const texto = await resposta.text();
      try {
        return JSON.parse(texto);
      } catch {
        // resposta 200 com corpo não-JSON (ex: aviso de rate limit em texto puro) — trata como falha
        await dormir(1500 * tentativa);
      }
    } catch {
      await dormir(1500 * tentativa);
    }
  }
  return null;
}

const PALAVRAS_GENERICAS = new Set([
  "futebol", "clube", "esporte", "esportivo", "associação", "atlético", "atletico", "clube de futebol",
  "sociedade", "esportiva", "sport", "club", "sporting", "grêmio", "gremio", "athletic", "de", "do", "da", "dos", "das", "e",
  "campeonato", "liga", "torneio", "torneo", "copa",
]);

/** Nomes de país/região que, SOZINHOS (única palavra "significativa" restante depois de tirar as
 * genéricas), não distinguem nada — qualquer clube/artigo daquele lugar bateria (achado real: "Liga 1
 * do Peru" ~ "Peru" sozinho casou com o artigo da cidade de Trujillo, que só menciona futebol de
 * passagem). Lista deliberadamente pequena (só o que já apareceu nos dados) — o objetivo não é ser
 * exaustiva, é recusar automaticamente os casos mais óbvios; qualquer outro nome "fraco" ainda cai no
 * `alvo.length === 0` acima ou fica dependendo da checagem de início do resumo abaixo. */
const PAISES_OU_REGIOES_ISOLADOS = new Set([
  "brasil", "argentina", "peru", "venezuela", "chile", "colombia", "bolivia", "equador", "paraguai",
  "uruguai", "amazonas", "amapa", "acre", "goias", "para", "roraima", "rondonia", "sergipe", "tocantins",
]);

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function palavrasSignificativas(nome: string): string[] {
  return normalizar(nome).split(/\s+/).filter((p) => p.length >= 3 && !PALAVRAS_GENERICAS.has(p));
}

/** Extrai um "nível" de divisão (Série A/A2, Módulo I/II, Segunda Divisão vs Segunda Divisão B etc.)
 * do nome — usado só pra competições, pra não deixar o escudo de uma série errada ir parar na outra
 * (achado real: "Campeonato Carioca - Série A" casou com o artigo da "Série A2"; "Segunda División da
 * Venezuela" casou com "Segunda División B", um nível abaixo do que devia). */
function extrairNivel(texto: string): string | null {
  const t = normalizar(texto);
  let m = t.match(/serie ([a-z0-9]+)/);
  if (m) return `serie-${m[1]}`;
  m = t.match(/modulo ([ivx]+|\d+)/);
  if (m) return `modulo-${m[1]}`;
  m = t.match(/segunda divisao( b)?/);
  if (m) return `segunda-divisao${m[1] ? "-b" : ""}`;
  m = t.match(/primeira divisao/);
  if (m) return "primeira-divisao";
  m = t.match(/segunda division( b)?/);
  if (m) return `segunda-division${m[1] ? "-b" : ""}`;
  m = t.match(/primera division/);
  if (m) return "primera-division";
  return null;
}

/** Exige que TODAS as palavras "significativas" (nome próprio, não genérica tipo "clube"/"futebol") do
 * nome buscado apareçam no TÍTULO do artigo — checar só o resumo/extract deixava passar coincidência
 * de nome de fundador/rival/cidade (caso real pego num piloto: "São Francisco Futebol Clube (AC)"
 * casando com o artigo errado "Nacional Futebol Clube (Amazonas)", cujo resumo mencionava "Francisco"
 * só por acaso, num nome de pessoa). Sem palavra significativa nenhuma (nome só com termos genéricos,
 * tipo "Esporte" sozinho) OU com uma única palavra que é nome de país/região: rejeita — não tem como
 * confirmar automaticamente, mais vale documentar como pendência do que arriscar gravar o clube/artigo
 * errado (violaria a convenção do projeto de nunca inventar/confundir dado; foi exatamente assim que
 * "Esporte" (PB) quase levou o escudo do Cruzeiro Esporte Clube, um clube completamente diferente). */
function bateComONome(nomeOriginal: string, titulo: string): boolean {
  const alvo = palavrasSignificativas(nomeOriginal);
  if (alvo.length === 0) return false;
  if (alvo.length === 1 && PAISES_OU_REGIOES_ISOLADOS.has(alvo[0])) return false;
  const tituloNormalizado = normalizar(titulo);
  if (!alvo.every((p) => tituloNormalizado.includes(p))) return false;
  const nivelFonte = extrairNivel(nomeOriginal);
  const nivelTitulo = extrairNivel(titulo);
  if (nivelFonte && nivelFonte !== nivelTitulo) return false;
  return true;
}

/** Confirmação extra além do título: as palavras significativas também precisam aparecer logo no
 * INÍCIO do resumo do artigo (não só em qualquer lugar do título/resumo) — a maioria dos artigos de
 * clube reais começa com "O <nome> é um clube..."/"El <nome> es un club...". Isso pega casos em que o
 * título bate por coincidência mas o artigo não é sobre o clube de verdade (achado real: "San Miguel"
 * casou com uma legenda de foto de um amistoso Leipzig-Liverpool cujo texto só cita "futebol" de
 * relance; "Pereira" casou com a foto de um jogador de sobrenome Pereira, não com o clube colombiano). */
function extractConfirmaNome(nomeOriginal: string, extract: string): boolean {
  const alvo = palavrasSignificativas(nomeOriginal);
  if (alvo.length === 0) return false;
  const inicioNormalizado = normalizar(extract).slice(0, 150);
  return alvo.every((p) => inicioNormalizado.includes(p));
}

/** Palavras cujo INÍCIO do resumo denuncia que o artigo é sobre outra coisa que não um clube/competição
 * de futebol — mesmo que o nome bata (achados reais: "Uberaba" casou com o artigo da CIDADE de Uberaba,
 * cujo resumo cedo diz "é um município"; "San Miguel"/"Pereira" casaram com o artigo de um JOGADOR,
 * cujo resumo cedo diz "é um futebolista"). Rejeita mesmo que o resto das checagens passe. */
const PALAVRAS_EXCLUSAO_INICIO = [
  "futebolista", "futbolista", "jogador de futebol", "ex futebolista",
  "e um municipio", "e uma cidade", "es un municipio", "es una ciudad", "capital do estado", "capital de",
];

function extractIndicaOutraCoisa(extract: string): boolean {
  const inicioNormalizado = normalizar(extract).slice(0, 150);
  return PALAVRAS_EXCLUSAO_INICIO.some((p) => inicioNormalizado.includes(p));
}

/** "futebol"/"fútbol" soltos (sem fazer parte de uma frase mais específica tipo "clube de futebol")
 * precisam bater como PALAVRA INTEIRA — como substring, "futebol" também "bate" dentro de
 * "futebolista" (jogador, não clube), o que já deixou passar 2 bios de jogador reais num teste. */
function contemPalavraDeConfirmacao(textoNormalizado: string, palavras: string[]): boolean {
  return palavras.some((p) => {
    if (p === "futebol" || p === "fútbol") return new RegExp(`\\b${p}\\b`).test(textoNormalizado);
    return textoNormalizado.includes(p);
  });
}

interface ResultadoBuscaWiki {
  encontrado: boolean;
  url?: string;
  titulo?: string;
  motivo?: string;
}

interface PaginaWiki {
  title: string;
  thumbnail?: { source: string };
  extract?: string;
}

async function buscarNaWikipedia(lingua: "pt" | "es", termoBusca: string, nomeOriginal: string, palavrasConfirmacao: string[]): Promise<ResultadoBuscaWiki> {
  const base = `https://${lingua}.wikipedia.org/w/api.php`;
  const busca = (await buscarJson(`${base}?action=query&list=search&srsearch=${encodeURIComponent(termoBusca)}&srlimit=5&format=json`)) as {
    query?: { search?: { title: string }[] };
  } | null;
  const candidatos = busca?.query?.search ?? [];
  if (candidatos.length === 0) return { encontrado: false, motivo: "sem resultado de busca" };

  for (const candidato of candidatos) {
    const detalhe = (await buscarJson(
      `${base}?action=query&prop=pageimages|extracts&exintro=1&explaintext=1&pithumbsize=400&titles=${encodeURIComponent(candidato.title)}&format=json`,
    )) as { query?: { pages?: Record<string, PaginaWiki> } } | null;
    await dormir(DELAY_ENTRE_REQUISICOES_MS);
    const pagina = Object.values(detalhe?.query?.pages ?? {})[0];
    if (!bateComONome(nomeOriginal, pagina?.title ?? "")) continue;
    if (!pagina?.thumbnail?.source) continue;
    if (!extractConfirmaNome(nomeOriginal, pagina.extract ?? "")) continue;
    if (extractIndicaOutraCoisa(pagina.extract ?? "")) continue;

    const extractNormalizado = (pagina.extract ?? "").toLowerCase();
    const confirma = contemPalavraDeConfirmacao(extractNormalizado, palavrasConfirmacao);
    if (!confirma) continue;

    return { encontrado: true, url: pagina.thumbnail.source, titulo: pagina.title };
  }

  return { encontrado: false, motivo: `${candidatos.length} candidato(s), nenhum passou (nome/tema/imagem)` };
}

async function buscarEscudoDeClube(clube: Club): Promise<ResultadoBuscaWiki> {
  const nome = clube.nome_popular ?? clube.nome;
  const linguas: ("pt" | "es")[] = WIKI_ES_PARA.has(clube.pais) ? ["pt", "es"] : ["pt"];
  for (const lingua of linguas) {
    // Sem sufixo de idioma ("futebol"/"fútbol") na query: testado direto contra a API, o sufixo
    // reordena os resultados e chega a tirar o próprio clube do topo pra clubes famosos (ex: San
    // Lorenzo) — o nome sozinho já é específico o bastante, e o tema é confirmado via
    // palavrasConfirmacao no resumo do artigo depois.
    const resultado = await buscarNaWikipedia(lingua, nome, nome, PALAVRAS_FUTEBOL);
    if (resultado.encontrado) return resultado;
  }
  return { encontrado: false, motivo: "sem match em nenhuma língua tentada" };
}

async function buscarEscudoDeCompeticao(nome: string, paisCodigo: string): Promise<ResultadoBuscaWiki> {
  const linguas: ("pt" | "es")[] = WIKI_ES_PARA.has(paisCodigo) ? ["es", "pt"] : ["pt"];
  for (const lingua of linguas) {
    const resultado = await buscarNaWikipedia(lingua, nome, nome, [...PALAVRAS_FUTEBOL, "campeonato", "liga", "torneio", "torneo"]);
    if (resultado.encontrado) return resultado;
  }
  return { encontrado: false, motivo: "sem match em nenhuma língua tentada" };
}

function carregarClubes(): { arquivo: string; clubes: Club[] }[] {
  return readdirSync(CLUBES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ arquivo: join(CLUBES_DIR, f), clubes: JSON.parse(readFileSync(join(CLUBES_DIR, f), "utf-8")) as Club[] }));
}

function carregarCompeticoes<T extends { id: string; escudo_url?: string; nome: string }>(dir: string): { arquivo: string; competicao: T }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ arquivo: join(dir, f), competicao: JSON.parse(readFileSync(join(dir, f), "utf-8")) as T }));
}

function salvar(arquivo: string, dado: unknown): void {
  writeFileSync(arquivo, `${JSON.stringify(dado, null, 2)}\n`, "utf-8");
}

const ARQUIVO_RELATORIO = join(import.meta.dirname, "../relatorio-escudos-wikipedia.txt");

// Grava linha a linha (não só no final) — um processo morto no meio (ex: falta de memória do sistema,
// já aconteceu numa rodada real) não pode apagar o histórico de matches já decididos antes dele.
function registrar(linha: string): void {
  appendFileSync(ARQUIVO_RELATORIO, `${linha}\n`, "utf-8");
}

async function main(): Promise<void> {
  let clubesAchados = 0;
  let clubesTentados = 0;

  for (const { arquivo, clubes } of carregarClubes()) {
    let mudou = false;
    for (const clube of clubes) {
      if (clube.escudo_url) continue; // só quem o TheSportsDB não achou
      clubesTentados++;
      const resultado = await buscarEscudoDeClube(clube);
      if (resultado.encontrado && resultado.url) {
        clube.escudo_url = resultado.url;
        mudou = true;
        clubesAchados++;
        registrar(`OK   clube ${clube.id} (${clube.nome_popular ?? clube.nome}) ← "${resultado.titulo}": ${resultado.url}`);
      } else {
        registrar(`MISS clube ${clube.id} (${clube.nome_popular ?? clube.nome}): ${resultado.motivo}`);
      }
      if (clubesTentados % 25 === 0) console.log(`... ${clubesTentados} clubes tentados (${clubesAchados} achados até agora)`);
    }
    if (mudou) salvar(arquivo, clubes);
  }

  let competicoesAchadas = 0;
  let competicoesTentadas = 0;

  for (const dir of [ESTADUAIS_DIR, NACIONAIS_DIR]) {
    for (const { arquivo, competicao } of carregarCompeticoes<CampeonatoEstadual | CampeonatoNacional>(dir)) {
      if (competicao.escudo_url) continue;
      competicoesTentadas++;
      const paisCodigo = "pais" in competicao ? (competicao as CampeonatoNacional).pais : "BR";
      const resultado = await buscarEscudoDeCompeticao(competicao.nome, paisCodigo);
      if (resultado.encontrado && resultado.url) {
        competicao.escudo_url = resultado.url;
        competicoesAchadas++;
        registrar(`OK   competição ${competicao.id} (${competicao.nome}) ← "${resultado.titulo}": ${resultado.url}`);
        salvar(arquivo, competicao);
      } else {
        registrar(`MISS competição ${competicao.id} (${competicao.nome}): ${resultado.motivo}`);
      }
    }
  }

  registrar("");
  registrar(`Clubes: ${clubesAchados}/${clubesTentados} tentados (que não tinham escudo do TheSportsDB)`);
  registrar(`Competições: ${competicoesAchadas}/${competicoesTentadas} tentadas`);

  console.log(`Clubes: ${clubesAchados}/${clubesTentados} encontrados`);
  console.log(`Competições: ${competicoesAchadas}/${competicoesTentadas} encontradas`);
  console.log(`Relatório completo em ${ARQUIVO_RELATORIO}`);
}

main();
