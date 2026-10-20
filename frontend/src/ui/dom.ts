/** Utilidades de presentación compartidas por las vistas. */

import type { PlaybackStatus } from '../types/api';

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/** Escapa texto proveniente del usuario antes de inyectarlo como HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

export function formatCount(value: number): string {
  return value.toLocaleString('es-CL');
}

/** Formatea microsegundos a µs o ms según magnitud. */
export function formatMicros(micros: number): string {
  if (micros >= 1000) {
    return `${(micros / 1000).toFixed(2)} ms`;
  }
  return `${micros.toFixed(1)} µs`;
}

/** Formatea kilobytes a KB o MB. */
export function formatMemory(kilobytes: number): string {
  if (kilobytes >= 1024) {
    return `${(kilobytes / 1024).toFixed(2)} MB`;
  }
  return `${kilobytes.toFixed(1)} KB`;
}

export function formatMs(milliseconds: number): string {
  if (milliseconds >= 1000) {
    return `${(milliseconds / 1000).toFixed(2)} s`;
  }
  return `${milliseconds.toFixed(2)} ms`;
}

const STATUS_LABELS: Record<PlaybackStatus, string> = {
  IDLE: 'Sin traza',
  INITIALIZED: 'Inicializado',
  PAUSED: 'En pausa',
  FINISHED: 'Completado'
};

export function statusLabel(status: PlaybackStatus): string {
  return STATUS_LABELS[status];
}

export function statusClasses(status: PlaybackStatus): string {
  switch (status) {
    case 'PAUSED':
      return 'bg-md-breakpoint/15 text-md-on-surface';
    case 'FINISHED':
      return 'bg-md-tertiary-container/50 text-md-tertiary';
    case 'INITIALIZED':
      return 'bg-md-secondary-container text-md-on-secondary-container';
    case 'IDLE':
    default:
      return 'bg-md-surface-container text-md-on-surface-variant';
  }
}
