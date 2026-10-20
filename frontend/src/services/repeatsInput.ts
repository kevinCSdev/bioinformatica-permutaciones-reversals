/**
 * Validación del campo de repeticiones del benchmark.
 *
 * Reproduce el contrato de `PermutationBenchmarkRequest.repeats` en el backend
 * (`ge=1`, `le=50`, entero) para detectar el error antes de enviar la solicitud.
 */

export const REPEATS_MIN = 1;
export const REPEATS_MAX = 50;

/** Valida un número ya interpretado y devuelve el primer error, o `null`. */
export function validateRepeatsValue(value: number): string | null {
  if (!Number.isFinite(value)) {
    return 'Las repeticiones deben ser un número válido.';
  }
  if (!Number.isInteger(value)) {
    return 'Las repeticiones deben ser un número entero.';
  }
  if (value < REPEATS_MIN || value > REPEATS_MAX) {
    return `Las repeticiones deben estar entre ${REPEATS_MIN} y ${REPEATS_MAX} (recibidas ${value}).`;
  }
  return null;
}

/** Valida el texto crudo del campo `#sb-repeats`. */
export function validateRepeatsField(raw: string): string | null {
  if (raw.trim() === '') {
    return `Ingresa el número de repeticiones (${REPEATS_MIN} a ${REPEATS_MAX}).`;
  }
  return validateRepeatsValue(Number(raw));
}
