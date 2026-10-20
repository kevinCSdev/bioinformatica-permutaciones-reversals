/** Casos biológicos precargados para cada función del laboratorio. */

import type { ActiveTab, SolverMode } from '../types/api';

export interface Preset {
  id: string;
  label: string;
  description: string;
  tab: ActiveTab;
  initial: string;
  target: string;
  repeats: number;
  mode: SolverMode;
}

export const PRESETS: Preset[] = [
  // Función 1 — Permutaciones
  {
    id: 'f1-distinct',
    tab: 'f1',
    label: 'Nucleótidos únicos (5)',
    description: 'Cinco símbolos distintos: 5! = 120 permutaciones posicionales.',
    initial: 'A T G C U',
    target: '',
    repeats: 5,
    mode: 'optimal'
  },
  {
    id: 'f1-duplicates',
    tab: 'f1',
    label: 'Multiconjunto AATGG',
    description: 'Dos A y dos G: 5!/(2!·2!) = 30 permutaciones únicas.',
    initial: 'A A T G G',
    target: '',
    repeats: 5,
    mode: 'optimal'
  },
  {
    id: 'f1-digits',
    tab: 'f1',
    label: 'Dígitos 1..5',
    description: 'Caso numérico clásico de 120 permutaciones.',
    initial: '1 2 3 4 5',
    target: '',
    repeats: 5,
    mode: 'optimal'
  },
  {
    id: 'f1-eight',
    tab: 'f1',
    label: 'Ocho símbolos (8!)',
    description: 'Límite de la interfaz: 40.320 permutaciones.',
    initial: '1 2 3 4 5 6 7 8',
    target: '',
    repeats: 3,
    mode: 'optimal'
  },

  // Función 2 — Reversal sin dirección
  {
    id: 'f2-genes',
    tab: 'f2',
    label: 'Bloques génicos',
    description: 'Reordena cuatro bloques sinténicos sin considerar la hebra.',
    initial: 'G A T C',
    target: 'A T G C',
    repeats: 1,
    mode: 'optimal'
  },
  {
    id: 'f2-reversed',
    tab: 'f2',
    label: 'Cromosoma invertido',
    description: 'Permutación completamente invertida de 5 bloque.',
    initial: '5 4 3 2 1',
    target: '1 2 3 4 5',
    repeats: 1,
    mode: 'optimal'
  },
  {
    id: 'f2-mixed',
    tab: 'f2',
    label: 'Reordenamiento intermedio',
    description: 'Caso con varios puntos de ruptura internos.',
    initial: '2 4 1 3',
    target: '1 2 3 4',
    repeats: 1,
    mode: 'greedy'
  },

  // Función 3 — Reversal con dirección
  {
    id: 'f3-strands',
    tab: 'f3',
    label: 'Hebras mixtas (+/-)',
    description: 'Bloques con orientación sentido y antisentido.',
    initial: '+A -T +G -C +U',
    target: '+A +T +G +C +U',
    repeats: 1,
    mode: 'optimal'
  },
  {
    id: 'f3-allflip',
    tab: 'f3',
    label: 'Inversión total',
    description: 'Todos los bloques en hebra antisentido.',
    initial: '-1 -2 -3 -4',
    target: '+1 +2 +3 +4',
    repeats: 1,
    mode: 'optimal'
  },
  {
    id: 'f3-mixed',
    tab: 'f3',
    label: 'Reordenamiento con signos',
    description: 'Combina cambios de posición y de orientación.',
    initial: '+2 -4 +1 -3',
    target: '+1 +2 +3 +4',
    repeats: 1,
    mode: 'optimal'
  },

  // Función 4 — Comparación paralela
  {
    id: 'f4-strands',
    tab: 'f4',
    label: 'Hebras mixtas (F2 vs F3)',
    description: 'Compara ignorar vs respetar la orientación de hebra.',
    initial: '+A -T +G -C +U',
    target: '+A +T +G +C +U',
    repeats: 1,
    mode: 'optimal'
  },
  {
    id: 'f4-allflip',
    tab: 'f4',
    label: 'Inversión total (F2 vs F3)',
    description: 'Todos los bloques en hebra antisentido.',
    initial: '-1 -2 -3 -4',
    target: '+1 +2 +3 +4',
    repeats: 1,
    mode: 'optimal'
  },
  {
    id: 'f4-mixed',
    tab: 'f4',
    label: 'Reordenamiento con signos',
    description: 'Combina cambios de posición y de orientación.',
    initial: '+2 -4 +1 -3',
    target: '+1 +2 +3 +4',
    repeats: 1,
    mode: 'greedy'
  }
];

export function presetsForTab(tab: ActiveTab): Preset[] {
  return PRESETS.filter((preset) => preset.tab === tab);
}
