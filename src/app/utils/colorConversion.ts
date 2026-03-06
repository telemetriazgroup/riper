/**
 * Converts oklch color format to RGB
 * oklch(L C H) -> rgb(r, g, b)
 */
export function oklchToRgb(l: number, c: number, h: number): { r: number; g: number; b: number } {
  // Convert to Lab first
  const L = l * 100;
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);

  // Lab to XYZ
  let y = (L + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  x = 0.95047 * (x * x * x > 0.008856 ? x * x * x : (x - 16 / 116) / 7.787);
  y = 1.0 * (y * y * y > 0.008856 ? y * y * y : (y - 16 / 116) / 7.787);
  z = 1.08883 * (z * z * z > 0.008856 ? z * z * z : (z - 16 / 116) / 7.787);

  // XYZ to RGB
  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let b_val = x * 0.0557 + y * -0.204 + z * 1.057;

  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b_val = b_val > 0.0031308 ? 1.055 * Math.pow(b_val, 1 / 2.4) - 0.055 : 12.92 * b_val;

  return {
    r: Math.max(0, Math.min(255, Math.round(r * 255))),
    g: Math.max(0, Math.min(255, Math.round(g * 255))),
    b: Math.max(0, Math.min(255, Math.round(b_val * 255)))
  };
}

/**
 * Converts oklch string to hex color
 * "oklch(0.5 0.1 180)" -> "#rrggbb"
 */
export function oklchStringToHex(oklchString: string): string {
  const match = oklchString.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
  if (!match) return oklchString;

  const [, l, c, h] = match;
  const { r, g, b } = oklchToRgb(parseFloat(l), parseFloat(c), parseFloat(h));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Converts oklch string to rgb string
 * "oklch(0.5 0.1 180)" -> "rgb(r, g, b)"
 */
export function oklchStringToRgb(oklchString: string): string {
  const match = oklchString.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
  if (!match) return oklchString;

  const [, l, c, h] = match;
  const { r, g, b } = oklchToRgb(parseFloat(l), parseFloat(c), parseFloat(h));
  
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Color mapping for common Tailwind v4 CSS variables
 */
export const colorMap: Record<string, string> = {
  // Background colors
  'var(--background)': 'rgb(255, 255, 255)',
  'var(--foreground)': 'rgb(15, 23, 42)',
  'var(--card)': 'rgb(255, 255, 255)',
  'var(--card-foreground)': 'rgb(15, 23, 42)',
  'var(--muted)': 'rgb(241, 245, 249)',
  'var(--muted-foreground)': 'rgb(100, 116, 139)',
  'var(--border)': 'rgb(226, 232, 240)',
  
  // Primary colors
  'var(--primary)': 'rgb(37, 99, 235)',
  'var(--primary-foreground)': 'rgb(255, 255, 255)',
  
  // Status colors
  'var(--destructive)': 'rgb(239, 68, 68)',
  'var(--success)': 'rgb(34, 197, 94)',
  'var(--warning)': 'rgb(249, 115, 22)',
};

/**
 * Replaces all color formats in a CSS string with RGB equivalents
 */
export function normalizeColors(cssValue: string): string {
  if (!cssValue) return cssValue;
  
  // Replace CSS variables with RGB values
  let result = cssValue;
  for (const [varName, rgbValue] of Object.entries(colorMap)) {
    result = result.replace(new RegExp(varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), rgbValue);
  }
  
  // Replace oklch with RGB
  result = result.replace(/oklch\([\d.\s]+\)/g, (match) => oklchStringToRgb(match));
  
  return result;
}
