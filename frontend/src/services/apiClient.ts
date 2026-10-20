/**
 * Cliente HTTP tipado del laboratorio.
 *
 * Centraliza las llamadas a FastAPI, valida el estado HTTP y extrae el mensaje
 * de error legible tanto de los `detail` escalares como de los arreglos de
 * validación de Pydantic (HTTP 422).
 */

import type {
  BenchmarkRequest,
  BenchmarkResponse,
  ParallelComparisonResult,
  ReversalRequest,
  ReversalResult,
  SourceCodeResponse
} from '../types/api';

/** Error de API con el mensaje ya normalizado para mostrarlo en la interfaz. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ValidationIssue {
  msg?: string;
  loc?: Array<string | number>;
}

function extractDetail(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('detail' in body)) {
    return null;
  }
  const detail = (body as { detail: unknown }).detail;
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    const messages = (detail as ValidationIssue[])
      .map((issue) => {
        if (typeof issue.msg !== 'string') {
          return null;
        }
        const location = Array.isArray(issue.loc)
          ? issue.loc.filter((part) => part !== 'body').join('.')
          : '';
        return location ? `${location}: ${issue.msg}` : issue.msg;
      })
      .filter((message): message is string => message !== null);
    return messages.length > 0 ? messages.join(' · ') : null;
  }
  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(
      'No se pudo conectar con el servidor. Verifica que FastAPI esté en ejecución.',
      0
    );
  }

  if (!response.ok) {
    let message = `Error HTTP ${response.status}`;
    try {
      const body: unknown = await response.json();
      const detail = extractDetail(body);
      if (detail !== null) {
        message = detail;
      }
    } catch {
      // El cuerpo no era JSON: se conserva el mensaje genérico.
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

function postTyped<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

/** Función 1: ejecuta el benchmark de permutaciones. */
export function runBenchmark(
  requestBody: BenchmarkRequest
): Promise<BenchmarkResponse> {
  return postTyped<BenchmarkResponse>(
    '/api/permutations/benchmark',
    requestBody
  );
}

/** Función 2: reversal sin dirección. */
export function solveUndirected(
  requestBody: ReversalRequest
): Promise<ReversalResult> {
  return postTyped<ReversalResult>('/api/reversal/undirected', requestBody);
}

/** Función 3: reversal con dirección (+/-). */
export function solveDirected(
  requestBody: ReversalRequest
): Promise<ReversalResult> {
  return postTyped<ReversalResult>('/api/reversal/directed', requestBody);
}

/** Función 4: comparación paralela F2 vs F3. */
export function solveParallel(
  requestBody: ReversalRequest
): Promise<ParallelComparisonResult> {
  return postTyped<ParallelComparisonResult>(
    '/api/reversal/parallel',
    requestBody
  );
}

/** Visor educativo: código Python comentado real. */
export function fetchSourceCode(): Promise<SourceCodeResponse> {
  return request<SourceCodeResponse>('/api/source-code');
}
