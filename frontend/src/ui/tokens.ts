/**
 * Utilidades compartidas para dibujar secuencias de bloques genéticos.
 *
 * Traduce símbolos y signos a valores relativos al objetivo para poder decidir
 * si dos bloques consecutivos son adyacentes (es decir, si NO hay punto de
 * ruptura entre ellos), replicando la misma convención del backend.
 */

import type { GeneToken, Sign } from '../types/api';
import { escapeHtml } from './dom';

export interface RelativeMarker {
  value: number;
  sign: Sign;
}

export function relativeMap(
  target: GeneToken[],
  directed: boolean
): Map<string, RelativeMarker> {
  const map = new Map<string, RelativeMarker>();
  target.forEach((token, index) => {
    if (!map.has(token.symbol)) {
      map.set(token.symbol, {
        value: index + 1,
        sign: directed ? token.sign : 1
      });
    }
  });
  return map;
}

export function areAdjacent(
  a: GeneToken,
  b: GeneToken,
  map: Map<string, RelativeMarker>,
  directed: boolean
): boolean {
  const markerA = map.get(a.symbol);
  const markerB = map.get(b.symbol);
  if (markerA === undefined || markerB === undefined) {
    return false;
  }
  if (!directed) {
    return Math.abs(markerA.value - markerB.value) === 1;
  }
  const relA = markerA.value * (markerA.sign * a.sign);
  const relB = markerB.value * (markerB.sign * b.sign);
  return relB - relA === 1;
}

export interface SequenceOptions {
  highlight: [number, number] | null;
  map: Map<string, RelativeMarker>;
  directed: boolean;
  showSign: boolean;
}

/** Genera el HTML de una fila de bloques con marcadores de ruptura. */
export function renderSequence(
  tokens: GeneToken[],
  options: SequenceOptions
): string {
  const { highlight, map, directed, showSign } = options;
  const blocks: string[] = [];
  tokens.forEach((token, index) => {
    const highlighted =
      highlight !== null && index >= highlight[0] && index <= highlight[1];
    const base =
      'flex items-center gap-1 rounded-lg border px-3 py-2 font-mono text-sm font-bold shadow-sm transition';
    const state = highlighted
      ? 'border-md-error bg-md-error-container text-md-on-error-container ring-2 ring-md-error/25'
      : showSign
        ? token.sign === 1
          ? 'border-md-outline-variant bg-md-tertiary-container text-md-on-surface'
          : 'border-md-outline-variant bg-md-strand-minus-container text-md-on-surface'
        : 'border-md-outline-variant bg-md-surface-bright text-md-on-surface';
    const signGlyph = showSign
      ? `<span class="${token.sign === 1 ? 'text-md-tertiary' : 'text-md-strand-minus'} font-extrabold">${token.sign === 1 ? '+' : '−'}</span>`
      : '';
    blocks.push(
      `<span class="${base} ${state}" title="Posición ${index + 1}">${signGlyph}${escapeHtml(token.symbol)}</span>`
    );

    const next = tokens[index + 1];
    if (next !== undefined && !areAdjacent(token, next, map, directed)) {
      blocks.push(
        '<span class="mx-0.5 h-6 shrink-0 border-l-2 border-dashed border-md-breakpoint" title="Punto de ruptura" aria-hidden="true"></span>'
      );
    }
  });
  return `<div class="flex flex-wrap items-center gap-1.5">${blocks.join('')}</div>`;
}
