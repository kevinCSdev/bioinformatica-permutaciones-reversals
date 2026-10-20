/**
 * Reproductor determinista de trazas de reversals.
 *
 * Se inspira en el patrón de suscripción reactiva de `AppState.js` del
 * laboratorio anterior, pero reproduce una traza YA calculada por el backend:
 * no ejecuta el algoritmo, solo navega sus estados. Soporta una traza simple
 * (F2/F3) y dos trazas sincronizadas (F4).
 */

import type {
  ParallelComparisonResult,
  PlaybackStatus,
  ReversalResult,
  StepperEvent,
  StepperListener,
  StepperSnapshot
} from '../types/api';

export class StepperState {
  private readonly listeners = new Set<StepperListener>();
  private status: PlaybackStatus = 'IDLE';
  private kind: 'single' | 'parallel' = 'single';
  private single: ReversalResult | null = null;
  private parallel: ParallelComparisonResult | null = null;
  private stepIndex = 0;

  /** Registra un observador y devuelve la función para cancelar la suscripción. */
  subscribe(listener: StepperListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(event: StepperEvent): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot, event);
    }
  }

  private hasTrace(): boolean {
    return this.single !== null || this.parallel !== null;
  }

  /** Número máximo de pasos de la traza. En modo dual es el máximo de ambas. */
  getMaxSteps(): number {
    if (this.kind === 'parallel' && this.parallel !== null) {
      return Math.max(
        this.parallel.unsigned.totalSteps,
        this.parallel.signed.totalSteps
      );
    }
    return this.single !== null ? this.single.totalSteps : 0;
  }

  getSnapshot(): StepperSnapshot {
    const unsignedTotal =
      this.parallel !== null ? this.parallel.unsigned.totalSteps : 0;
    const signedTotal =
      this.parallel !== null ? this.parallel.signed.totalSteps : 0;
    return {
      status: this.status,
      kind: this.kind,
      stepIndex: this.stepIndex,
      maxSteps: this.getMaxSteps(),
      single: this.single,
      parallel: this.parallel,
      unsignedStepIndex: Math.min(this.stepIndex, unsignedTotal),
      signedStepIndex: Math.min(this.stepIndex, signedTotal),
      unsignedFinished:
        this.kind === 'parallel' && this.stepIndex >= unsignedTotal,
      signedFinished: this.kind === 'parallel' && this.stepIndex >= signedTotal,
      hasTrace: this.hasTrace()
    };
  }

  loadSingleTrace(result: ReversalResult): void {
    this.kind = 'single';
    this.single = result;
    this.parallel = null;
    this.stepIndex = 0;
    this.status = 'INITIALIZED';
    this.notify('LOAD_SINGLE');
  }

  loadParallelTraces(result: ParallelComparisonResult): void {
    this.kind = 'parallel';
    this.parallel = result;
    this.single = null;
    this.stepIndex = 0;
    this.status = 'INITIALIZED';
    this.notify('LOAD_PARALLEL');
  }

  stepForward(): boolean {
    return this.advance();
  }

  stepBackward(): boolean {
    if (!this.hasTrace()) {
      return false;
    }
    if (this.stepIndex <= 0) {
      return false;
    }
    this.stepIndex -= 1;
    this.status = this.stepIndex === 0 ? 'INITIALIZED' : 'PAUSED';
    this.notify('STEP_BACKWARD');
    return true;
  }

  goToStep(target: number): boolean {
    if (!this.hasTrace()) {
      return false;
    }
    const clamped = Math.max(
      0,
      Math.min(Math.round(target), this.getMaxSteps())
    );
    this.stepIndex = clamped;
    if (clamped === 0) {
      this.status = 'INITIALIZED';
    } else if (clamped >= this.getMaxSteps()) {
      this.status = 'FINISHED';
    } else {
      this.status = 'PAUSED';
    }
    this.notify('GO_TO_STEP');
    return true;
  }

  jumpToEnd(): void {
    if (!this.hasTrace()) {
      return;
    }
    this.stepIndex = this.getMaxSteps();
    this.status = 'FINISHED';
    this.notify('JUMP_END');
  }

  reset(): void {
    this.stepIndex = 0;
    this.status = this.hasTrace() ? 'INITIALIZED' : 'IDLE';
    this.notify('RESET');
  }

  /** Descarta la traza actual (al cambiar de pestaña entre vistas). */
  clear(): void {
    this.kind = 'single';
    this.single = null;
    this.parallel = null;
    this.stepIndex = 0;
    this.status = 'IDLE';
    this.notify('RESET');
  }

  private advance(): boolean {
    if (!this.hasTrace()) {
      return false;
    }
    if (this.stepIndex >= this.getMaxSteps()) {
      if (this.status !== 'FINISHED') {
        this.status = 'FINISHED';
        this.notify('FINISH');
      }
      return false;
    }

    this.stepIndex += 1;
    if (this.stepIndex >= this.getMaxSteps()) {
      this.status = 'FINISHED';
      this.notify('FINISH');
      return true;
    }

    this.status = 'PAUSED';
    this.notify('STEP_FORWARD');
    return true;
  }
}
