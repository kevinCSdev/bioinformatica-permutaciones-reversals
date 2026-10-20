/**
 * Contratos TypeScript estrictos (espejo 1:1 de `backend/schemas.py`).
 *
 * Se usan uniones discriminadas y tipos literales para que el compilador
 * detecte cualquier desalineación con la API de FastAPI.
 */

export type PlaybackStatus =
  | 'IDLE'
  | 'INITIALIZED'
  | 'PAUSED'
  | 'FINISHED';

export type ActiveTab = 'f1' | 'f2' | 'f3' | 'f4' | 'report';

export type SolverMode = 'optimal' | 'greedy';

export type Sign = 1 | -1;

export type VariantGroup = 'distinct' | 'multiset';

export interface GeneToken {
  symbol: string;
  /** En F2 se muestra sin signo; en F3 y F4 indica orientación + / -. */
  sign: Sign;
}

export interface ReversalStep {
  /** 0 = estado inicial; 1..K = pasos aplicados. */
  stepIndex: number;
  /** [i, j] invertido en este paso (0-indexed) o null en el estado inicial. */
  reversalSpan: [number, number] | null;
  before: GeneToken[];
  after: GeneToken[];
  breakpointsRemaining: number;
  description: string;
}

export interface ReversalResult {
  directed: boolean;
  mode: SolverMode;
  exact: boolean;
  initial: GeneToken[];
  target: GeneToken[];
  totalSteps: number;
  steps: ReversalStep[];
  executionTimeMs: number;
  exploredStates: number;
}

export interface ParallelComparisonResult {
  unsigned: ReversalResult;
  signed: ReversalResult;
  unsignedPhysicalSteps: GeneToken[][];
  orientationMismatchInUnsigned: number;
  deltaSteps: number;
  deltaTimeMs: number;
  deltaExploredStates: number;
  verdict: string;
}

export interface BenchmarkVariant {
  key: string;
  name: string;
  group: VariantGroup;
  description: string;
  count: number;
  medianUs: number;
  minUs: number;
  medianMs: number;
  peakBytes: number;
  peakKb: number;
  relativeToItertools: number;
}

export interface BenchmarkResponse {
  sequence: string[];
  length: number;
  repeats: number;
  hasDuplicates: boolean;
  positionalCount: number;
  uniqueCount: number;
  baselineKey: string;
  variants: BenchmarkVariant[];
}

export interface SourceFile {
  key: string;
  name: string;
  language: string;
  code: string;
}

export interface SourceCodeResponse {
  files: SourceFile[];
}

export interface BenchmarkRequest {
  sequence: string[];
  repeats: number;
}

export interface ReversalRequest {
  initial: string[];
  target: string[];
  mode: SolverMode;
}

/** Snapshot inmutable que consumen las vistas suscritas al reproductor. */
export interface StepperSnapshot {
  status: PlaybackStatus;
  kind: 'single' | 'parallel';
  stepIndex: number;
  maxSteps: number;
  single: ReversalResult | null;
  parallel: ParallelComparisonResult | null;
  unsignedStepIndex: number;
  signedStepIndex: number;
  unsignedFinished: boolean;
  signedFinished: boolean;
  hasTrace: boolean;
}

export type StepperEvent =
  | 'LOAD_SINGLE'
  | 'LOAD_PARALLEL'
  | 'STEP_FORWARD'
  | 'STEP_BACKWARD'
  | 'GO_TO_STEP'
  | 'JUMP_END'
  | 'RESET'
  | 'FINISH';

export type StepperListener = (
  snapshot: StepperSnapshot,
  event: StepperEvent
) => void;
