/**
 * Análisis de secuencias escritas de corrido.
 *
 * El usuario escribe sin separadores (`ATGC`, `+A-T+G-C`, `12345`) y este
 * módulo decide dónde termina cada elemento. Es la ÚNICA fuente de verdad: la
 * vista previa de la barra lateral y el envío al backend usan el mismo
 * resultado, de modo que lo que se muestra es exactamente lo que se ejecuta.
 */

import type { ActiveTab } from '../types/api';

export type Sign = 1 | -1;

export interface SequenceToken {
  /** Representación normalizada enviada a la API: `"+A"`, `"-T"`, `"A"`, `"10"`. */
  raw: string;
  /** Símbolo sin signo: `"A"`, `"T"`, `"10"`. */
  symbol: string;
  sign: Sign;
  /** `true` cuando el usuario escribió el signo de forma explícita. */
  hasSign: boolean;
}

export interface ParsedSequence {
  tokens: SequenceToken[];
  /** Tokens listos para el contrato `string[]` de la API. */
  raw: string[];
  /** Primer error de formato encontrado, o `null`. */
  error: string | null;
}

const SIGN_CHARS = new Set(['+', '-']);
const SEPARATORS = new Set([' ', '\t', '\n', '\r', ',', ';', '|']);
const SYMBOL_PATTERN = /^(?:\p{L}+|\d+)$/u;
const DELIMITER_PATTERN = /[\s,;|+\-\u2212\u2013\u2014]/;

/** Convierte signos Unicode (−, –, —) al guion ASCII para normalizar la entrada. */
function normalizeSigns(text: string): string {
  return text.replace(/[\u2212\u2013\u2014]/g, '-');
}

/**
 * Divide el texto en tokens.
 *
 * Reglas:
 * - Sin separadores ni signos, cada carácter es un elemento (`ATGC` → A, T, G, C).
 * - Los separadores (espacio, coma, punto y coma) delimitan elementos.
 * - Los signos `+` / `-` delimitan elementos y fijan su orientación.
 * - Con separadores, cada grupo es un elemento, por lo que un número de varias
 *   cifras requiere uno (`1,23`, `+1-2+10`).
 */
export function parseSequence(text: string): ParsedSequence {
  const normalized = normalizeSigns(text);

  if (!DELIMITER_PATTERN.test(normalized)) {
    const tokens: SequenceToken[] = [];
    let error: string | null = null;
    for (const character of normalized) {
      if (!SYMBOL_PATTERN.test(character)) {
        if (error === null) {
          error = `El símbolo "${character}" no es válido; usa solo letras o números.`;
        }
      }
      tokens.push({ raw: character, symbol: character, sign: 1, hasSign: false });
    }
    return { tokens, raw: tokens.map((token) => token.raw), error };
  }

  const tokens: SequenceToken[] = [];
  let current = '';
  let pendingSign: Sign | null = null;
  let error: string | null = null;

  const fail = (message: string): void => {
    if (error === null) {
      error = message;
    }
  };

  const flush = (): void => {
    if (current === '') {
      if (pendingSign !== null) {
        fail('Quedó un signo sin símbolo; escribe por ejemplo "+A" o "-1".');
      }
      pendingSign = null;
      return;
    }
    const symbol = current;
    if (!SYMBOL_PATTERN.test(symbol)) {
      fail(`El símbolo "${symbol}" no es válido; usa solo letras o números.`);
    }
    const sign: Sign = pendingSign ?? 1;
    const hasSign = pendingSign !== null;
    tokens.push({
      raw: `${hasSign ? (sign > 0 ? '+' : '-') : ''}${symbol}`,
      symbol,
      sign,
      hasSign
    });
    current = '';
    pendingSign = null;
  };

  for (const character of normalized) {
    if (SIGN_CHARS.has(character)) {
      flush();
      pendingSign = character === '+' ? 1 : -1;
      continue;
    }
    if (SEPARATORS.has(character)) {
      flush();
      continue;
    }
    current += character;
  }
  flush();

  return {
    tokens,
    raw: tokens.map((token) => token.raw),
    error
  };
}

const FIELD_LIMITS: Record<ActiveTab, number> = {
  f1: 8,
  f2: 10,
  f3: 10,
  f4: 10,
  report: 10
};

/** Valida una secuencia según los límites de la pestaña activa. */
export function validateSequenceField(
  parsed: ParsedSequence,
  tab: ActiveTab
): string | null {
  if (parsed.error !== null) {
    return parsed.error;
  }
  const limit = FIELD_LIMITS[tab];
  if (parsed.tokens.length === 0) {
    return 'Ingresa al menos un elemento.';
  }
  if (parsed.tokens.length > limit) {
    return tab === 'f1'
      ? `La Función 1 admite hasta ${limit} símbolos (recibidos ${parsed.tokens.length}).`
      : `Las Funciones 2, 3 y 4 admiten hasta ${limit} bloques (recibidos ${parsed.tokens.length}).`;
  }
  if (tab !== 'f1') {
    const symbols = parsed.tokens.map((token) => token.symbol);
    if (new Set(symbols).size !== symbols.length) {
      return 'Los bloques deben ser únicos; retira los símbolos repetidos.';
    }
  }
  return null;
}

/**
 * Valida el par inicial/objetivo de las Funciones 2, 3 y 4.
 *
 * Refleja las restricciones de `backend/core/reversal_unsigned.py`: bloques
 * únicos y exactamente el mismo conjunto de símbolos en ambas secuencias.
 */
export function validateReversalPair(
  initial: ParsedSequence,
  target: ParsedSequence
): string | null {
  const initialError = validateSequenceField(initial, 'f3');
  if (initialError !== null) {
    return `Secuencia inicial: ${initialError}`;
  }
  const targetError = validateSequenceField(target, 'f3');
  if (targetError !== null) {
    return `Secuencia objetivo: ${targetError}`;
  }
  if (initial.tokens.length !== target.tokens.length) {
    return (
      'Las cadenas tienen distinta longitud: la inicial tiene ' +
      `${initial.tokens.length} bloque(s) y la objetivo ${target.tokens.length}.`
    );
  }
  const initialSymbols = initial.tokens.map((token) => token.symbol);
  const targetSymbols = target.tokens.map((token) => token.symbol);
  if (new Set(initialSymbols).size !== initialSymbols.length) {
    return 'La secuencia inicial contiene bloques repetidos; usa símbolos únicos.';
  }
  if (new Set(targetSymbols).size !== targetSymbols.length) {
    return 'La secuencia objetivo contiene bloques repetidos; usa símbolos únicos.';
  }
  const missing = targetSymbols.filter((symbol) => !initialSymbols.includes(symbol));
  const extra = initialSymbols.filter((symbol) => !targetSymbols.includes(symbol));
  if (missing.length > 0 || extra.length > 0) {
    const detail: string[] = [];
    if (missing.length > 0) {
      detail.push(`faltan ${missing.join(', ')} en la inicial`);
    }
    if (extra.length > 0) {
      detail.push(`sobran ${extra.join(', ')} en la inicial`);
    }
    return (
      'Ambas secuencias deben contener exactamente el mismo conjunto de bloques ' +
      `(${detail.join(' y ')}).`
    );
  }
  return null;
}
