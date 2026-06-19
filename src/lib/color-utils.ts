/**
 * Converts a hex color string to HSL values.
 * @returns { h: 0-360, s: 0-100, l: 0-100 }
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Formats HSL values into the CSS variable format used by the app: "H S% L%"
 */
export function hslToCssValue(h: number, s: number, l: number): string {
  return `${h} ${s}% ${l}%`;
}

/**
 * Determines the best foreground color (white or dark) for a given HSL background.
 * Returns the CSS variable format string.
 */
export function computeForegroundColor(h: number, s: number, l: number): string {
  // Use relative luminance: light backgrounds need dark text, dark backgrounds need white
  return l > 65 ? '222 47% 11%' : '0 0% 100%';
}

/**
 * Generates all CSS variable overrides needed for an org branding color.
 */
export function generateThemeOverrides(
  hex: string,
  isDark: boolean
): Record<string, string> {
  const { h, s, l } = hexToHsl(hex);

  // In dark mode, bump lightness slightly for better visibility
  const primaryL = isDark ? Math.min(l + 9, 80) : l;
  const primary = hslToCssValue(h, s, primaryL);
  const foreground = computeForegroundColor(h, s, primaryL);

  const secondary = isDark
    ? hslToCssValue(h, Math.round(s * 0.5), 15)
    : hslToCssValue(h, s, 95);

  const secondaryForeground = isDark
    ? hslToCssValue(h, s, 90)
    : hslToCssValue(h, s, Math.max(l - 15, 15));

  const gradientPrimary = `linear-gradient(135deg, hsl(${hslToCssValue(h, s, primaryL)}) 0%, hsl(${hslToCssValue(h, s, Math.max(primaryL - 10, 5))}) 100%)`;
  const gradientHero = `linear-gradient(135deg, hsl(${hslToCssValue(h, s, isDark ? 12 : 15)}) 0%, hsl(${hslToCssValue(h, s, isDark ? 22 : 25)}) 50%, hsl(${hslToCssValue(h, s, isDark ? 15 : 18)}) 100%)`;

  return {
    '--primary': primary,
    '--primary-foreground': foreground,
    '--secondary': secondary,
    '--secondary-foreground': secondaryForeground,
    '--ring': primary,
    '--sidebar-primary': primary,
    '--gradient-primary': gradientPrimary,
    '--gradient-hero': gradientHero,
  };
}

/**
 * Validates a hex color string.
 */
export function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}
