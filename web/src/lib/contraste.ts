/**
 * Escolhe texto claro ou escuro pra ficar legível sobre uma cor de fundo
 * qualquer (hex) — usado quando a tela assume a cor do clube (`Club.cor_primaria`),
 * que pode ser clara ou escura dependendo do clube, então o texto não pode
 * ser fixo. Luminância relativa (WCAG) com corte em 0.5: acima disso o fundo
 * é claro o bastante pra pedir texto escuro, abaixo pede texto claro.
 */
export function corDeTextoContrastante(hexFundo: string): string {
  const rgb = hexParaRgb(hexFundo);
  if (!rgb) return "#f1f5f9"; // hex inválido/inesperado — mesmo texto claro do fundo padrão (slate-950)
  return luminanciaRelativa(rgb) > 0.5 ? "#0f172a" : "#f1f5f9";
}

function hexParaRgb(hex: string): { r: number; g: number; b: number } | undefined {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return undefined;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function luminanciaRelativa({ r, g, b }: { r: number; g: number; b: number }): number {
  const [rl, gl, bl] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}
