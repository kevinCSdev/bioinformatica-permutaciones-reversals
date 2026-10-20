import { describe, expect, it } from 'vitest';

import {
  parseSequence,
  validateReversalPair,
  validateSequenceField
} from './sequenceInput';
import { PRESETS } from '../data/presets';

describe('parseSequence — escritura de corrido', () => {
  it('separa letras continuas en elementos individuales', () => {
    expect(parseSequence('ATGC').raw).toEqual(['A', 'T', 'G', 'C']);
  });

  it('respeta separadores explícitos', () => {
    expect(parseSequence('A T G C').raw).toEqual(['A', 'T', 'G', 'C']);
    expect(parseSequence('A,T;G').raw).toEqual(['A', 'T', 'G']);
  });

  it('adjunta el signo al elemento siguiente', () => {
    const parsed = parseSequence('+A-T+G-C');
    expect(parsed.raw).toEqual(['+A', '-T', '+G', '-C']);
    expect(parsed.tokens.map((token) => token.sign)).toEqual([1, -1, 1, -1]);
    expect(parsed.error).toBeNull();
  });

  it('interpreta cada dígito como un elemento cuando no hay separadores', () => {
    expect(parseSequence('12345').raw).toEqual(['1', '2', '3', '4', '5']);
  });

  it('conserva números de varias cifras cuando hay separador', () => {
    expect(parseSequence('1,2,10').raw).toEqual(['1', '2', '10']);
    expect(parseSequence('1 2 10').raw).toEqual(['1', '2', '10']);
  });

  it('combina signos y números de varias cifras', () => {
    expect(parseSequence('+1-2+10').raw).toEqual(['+1', '-2', '+10']);
  });

  it('normaliza el signo menos Unicode', () => {
    expect(parseSequence('\u2212A+T').raw).toEqual(['-A', '+T']);
  });

  it('acepta entrada vacía sin error', () => {
    const parsed = parseSequence('   ');
    expect(parsed.tokens).toEqual([]);
    expect(parsed.error).toBeNull();
  });

  it('reporta un signo sin símbolo', () => {
    expect(parseSequence('+A-').error).toContain('signo sin símbolo');
  });

  it('rechaza símbolos con caracteres inválidos', () => {
    expect(parseSequence('A*T').error).toContain('no es válido');
  });
});

describe('validateSequenceField', () => {
  it('exige al menos un elemento', () => {
    expect(validateSequenceField(parseSequence(''), 'f1')).toContain('al menos');
  });

  it('aplica el límite de la Función 1', () => {
    expect(validateSequenceField(parseSequence('123456789'), 'f1')).toContain('8');
  });

  it('permite repetidos en la Función 1', () => {
    expect(validateSequenceField(parseSequence('AATGG'), 'f1')).toBeNull();
  });

  it('rechaza repetidos en las Funciones 2, 3 y 4', () => {
    expect(validateSequenceField(parseSequence('AAT'), 'f3')).toContain('únicos');
  });
});

describe('validateReversalPair', () => {
  it('acepta un par coherente', () => {
    expect(
      validateReversalPair(parseSequence('GATC'), parseSequence('ATGC'))
    ).toBeNull();
  });

  it('exige la misma cantidad de bloques', () => {
    const message = validateReversalPair(
      parseSequence('GAT'),
      parseSequence('ATGC')
    );
    expect(message).toContain('distinta longitud');
    expect(message).toContain('3');
    expect(message).toContain('4');
  });

  it('exige el mismo conjunto de bloques', () => {
    expect(
      validateReversalPair(parseSequence('GATC'), parseSequence('ATGU'))
    ).toContain('mismo conjunto');
  });
});

describe('compatibilidad con los ejemplos precargados', () => {
  it('todos los presets de F1 producen tokens válidos', () => {
    for (const preset of PRESETS.filter((entry) => entry.tab === 'f1')) {
      const parsed = parseSequence(preset.initial);
      expect(parsed.error, preset.id).toBeNull();
      expect(validateSequenceField(parsed, 'f1'), preset.id).toBeNull();
    }
  });

  it('todos los presets de F2, F3 y F4 producen pares válidos', () => {
    for (const preset of PRESETS.filter((entry) => entry.tab !== 'f1' && entry.tab !== 'report')) {
      const initial = parseSequence(preset.initial);
      const target = parseSequence(preset.target);
      expect(initial.error, preset.id).toBeNull();
      expect(target.error, preset.id).toBeNull();
      expect(validateReversalPair(initial, target), preset.id).toBeNull();
    }
  });
});
