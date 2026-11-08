import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(hexToRgb(fgHex));
  const l2 = relativeLuminance(hexToRgb(bgHex));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseThemeBlock(css: string, selectorMarker: string): Record<string, string> {
  const idx = css.indexOf(selectorMarker);
  if (idx === -1) throw new Error(`Missing block ${selectorMarker}`);
  const openBrace = css.indexOf('{', idx);
  const closeBrace = css.indexOf('}', openBrace);
  const body = css.slice(openBrace + 1, closeBrace);
  const map: Record<string, string> = {};
  for (const match of body.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) {
    map[match[1]] = match[2];
  }
  return map;
}

describe('WCAG 2.2 AA Color Contrast Verification across Light & Dark Themes', () => {
  const cssPath = path.resolve(__dirname, '../styles/tokens.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const light = parseThemeBlock(css, "[data-theme='light']");
  const dark = parseThemeBlock(css, "[data-theme='dark']");

  for (const [themeName, tokens] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    it(`${themeName} theme meets >= 4.5:1 AA contrast for all text pairs`, () => {
      expect(contrastRatio(tokens['--text-primary'], tokens['--bg-surface'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens['--text-primary'], tokens['--bg-canvas'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens['--text-secondary'], tokens['--bg-surface'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens['--text-secondary'], tokens['--bg-canvas'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens['--text-muted'], tokens['--bg-surface'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens['--accent-primary'], tokens['--bg-surface'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens['--accent-on-solid'], tokens['--accent-solid-bg'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio('#ffffff', tokens['--danger-solid'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens['--danger-text'], tokens['--danger-subtle'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens['--warning-text'], tokens['--warning-subtle'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens['--success-text'], tokens['--success-subtle'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens['--rail-text'], tokens['--rail-bg'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens['--rail-muted'], tokens['--rail-bg'])).toBeGreaterThanOrEqual(4.5);
    });

    it(`${themeName} theme meets >= 3.0:1 AA contrast for interactive borders & focus indicators`, () => {
      expect(contrastRatio(tokens['--border-strong'], tokens['--bg-surface'])).toBeGreaterThanOrEqual(3.0);
      expect(contrastRatio(tokens['--focus-ring'], tokens['--bg-surface'])).toBeGreaterThanOrEqual(3.0);
    });
  }
});
