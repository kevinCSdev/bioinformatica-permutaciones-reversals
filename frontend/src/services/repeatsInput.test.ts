import { describe, expect, it } from 'vitest';

import {
  REPEATS_MAX,
  REPEATS_MIN,
  validateRepeatsField,
  validateRepeatsValue
} from './repeatsInput';
import { PRESETS } from '../data/presets';

describe('validateRepeatsField', () => {
  it('acepta los extremos del rango', () => {
    expect(validateRepeatsField(String(REPEATS_MIN))).toBeNull();
    expect(validateRepeatsField(String(REPEATS_MAX))).toBeNull();
  });

  it('ignora espacios alrededor del número', () => {
    expect(validateRepeatsField('  5  ')).toBeNull();
  });

  it('exige un valor cuando el campo está vacío', () => {
    expect(validateRepeatsField('')).toContain('Ingresa');
    expect(validateRepeatsField('   ')).toContain('Ingresa');
  });

  it('rechaza valores fuera de rango', () => {
    expect(validateRepeatsField('0')).toContain(`entre ${REPEATS_MIN} y ${REPEATS_MAX}`);
    expect(validateRepeatsField('51')).toContain('recibidas 51');
  });

  it('rechaza números decimales', () => {
    expect(validateRepeatsField('2.5')).toContain('entero');
  });

  it('rechaza texto no numérico', () => {
    expect(validateRepeatsField('abc')).toContain('válido');
  });
});

describe('validateRepeatsValue', () => {
  it('rechaza valores no finitos', () => {
    expect(validateRepeatsValue(Number.NaN)).toContain('válido');
    expect(validateRepeatsValue(Number.POSITIVE_INFINITY)).toContain('válido');
  });
});

describe('compatibilidad con los ejemplos precargados', () => {
  it('todos los presets usan repeticiones válidas', () => {
    for (const preset of PRESETS) {
      expect(validateRepeatsValue(preset.repeats), preset.id).toBeNull();
    }
  });
});
