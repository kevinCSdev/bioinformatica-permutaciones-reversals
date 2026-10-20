/** Tipos compartidos por los controladores de vista del frontend. */

import type {
  SolverMode,
  StepperEvent,
  StepperSnapshot
} from './api';

export type AlertKind = 'error' | 'info' | 'success';

export type AlertFn = (message: string, kind?: AlertKind) => void;

export interface ViewInputs {
  sequence: string[];
  initial: string[];
  target: string[];
  repeats: number;
  mode: SolverMode;
}

export interface AppView {
  render(snapshot: StepperSnapshot, event: StepperEvent): void;
  run?(inputs: ViewInputs): Promise<void>;
  destroy(): void;
}
