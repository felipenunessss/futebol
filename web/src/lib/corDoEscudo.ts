/**
 * Extrai uma cor "dominante" (mais vibrante, não cinza/branco/preto) de uma
 * imagem de escudo — usado como fundo dinâmico da tela de temporada quando
 * o clube não tem `cor_primaria` cadastrada manualmente (a maioria dos 567
 * clubes com escudo não tem, ver `docs/dados-a-verificar.md`). Roda
 * inteiramente no navegador (canvas + `getImageData`), sem depender de
 * nenhuma biblioteca externa.
 *
 * Pode falhar por dois motivos comuns, ambos tratados como "sem cor" (quem
 * chama cai pro fundo padrão): a imagem não carrega (rede/URL quebrada), ou
 * o host da imagem não manda cabeçalho CORS liberando leitura de pixel
 * (`crossOrigin` "tainted canvas" — comum em hosts que não esperam uso
 * assim). `upload.wikimedia.org`/`thumb.wikimedia.org` (a maior fonte de
 * escudo hoje) libera CORS normalmente; `r2.thesportsdb.com` não é
 * garantido.
 */

const TAMANHO_AMOSTRA = 48;

/** Ignora pixel transparente, quase preto, quase branco ou de baixa saturação (cinza) — sobra só o
 * que dá pra chamar de "cor do escudo" de verdade (fundo/contorno normalmente é branco/preto/cinza). */
function pixelEhRelevante(r: number, g: number, b: number, a: number): boolean {
  if (a < 128) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luminancia = (max + min) / 2 / 255;
  if (luminancia < 0.15 || luminancia > 0.92) return false;
  const delta = max - min;
  const saturacao = delta === 0 ? 0 : delta / (255 - Math.abs(max + min - 255));
  return saturacao >= 0.2;
}

function rgbParaHex(r: number, g: number, b: number): string {
  const componente = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${componente(r)}${componente(g)}${componente(b)}`;
}

/** Agrupa pixels relevantes em baldes (passo 32 por canal) e devolve a média RGB do balde mais
 * frequente — mais estável que uma média direta (que ficaria puxada pro cinza com poucos pixels
 * de cor de verdade contra muito fundo neutro já filtrado, mas ainda sujeito a ruído de compressão). */
function corDoBaldeMaisFrequente(dados: Uint8ClampedArray): string | undefined {
  const baldes = new Map<string, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < dados.length; i += 4) {
    const [r, g, b, a] = [dados[i], dados[i + 1], dados[i + 2], dados[i + 3]];
    if (!pixelEhRelevante(r, g, b, a)) continue;
    const chave = `${Math.round(r / 32)},${Math.round(g / 32)},${Math.round(b / 32)}`;
    const atual = baldes.get(chave) ?? { r: 0, g: 0, b: 0, n: 0 };
    atual.r += r;
    atual.g += g;
    atual.b += b;
    atual.n += 1;
    baldes.set(chave, atual);
  }

  let melhor: { r: number; g: number; b: number; n: number } | undefined;
  for (const balde of baldes.values()) {
    if (!melhor || balde.n > melhor.n) melhor = balde;
  }
  if (!melhor) return undefined;
  return rgbParaHex(melhor.r / melhor.n, melhor.g / melhor.n, melhor.b / melhor.n);
}

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.crossOrigin = "anonymous";
    imagem.onload = () => resolve(imagem);
    imagem.onerror = () => reject(new Error(`falha ao carregar imagem: ${url}`));
    imagem.src = url;
  });
}

/** `undefined` = não deu pra extrair (rede, CORS, ou escudo sem cor vibrante o bastante, ex: preto e branco puro) — quem chama deve cair pro fundo padrão nesse caso, não tratar como erro. */
export async function extrairCorDominante(url: string): Promise<string | undefined> {
  try {
    const imagem = await carregarImagem(url);
    const canvas = document.createElement("canvas");
    canvas.width = TAMANHO_AMOSTRA;
    canvas.height = TAMANHO_AMOSTRA;
    const contexto = canvas.getContext("2d");
    if (!contexto) return undefined;
    contexto.drawImage(imagem, 0, 0, TAMANHO_AMOSTRA, TAMANHO_AMOSTRA);
    const { data } = contexto.getImageData(0, 0, TAMANHO_AMOSTRA, TAMANHO_AMOSTRA);
    return corDoBaldeMaisFrequente(data);
  } catch {
    return undefined;
  }
}
