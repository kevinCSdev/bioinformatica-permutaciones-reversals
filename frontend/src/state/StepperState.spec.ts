import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StepperState } from './StepperState';
import type {
  GeneToken,
  ParallelComparisonResult,
  ReversalResult,
  ReversalStep
} from '../types/api';

function token(symbol: string, sign: 1 | -1 = 1): GeneToken {
  return { symbol, sign };
}

function step(stepIndex: number, span: [number, number] | null): ReversalStep {
  return {
    stepIndex,
    reversalSpan: span,
    before: [],
    after: [],
    breakpointsRemaining: 0,
    description: ''
  };
}

function trace(total: number): ReversalResult {
  const steps: ReversalStep[] = [step(0, null)];
  for (let k = 1; k <= total; k += 1) {
    steps.push(step(k, [0, 1]));
  }
  return {
    directed: false,
    mode: 'optimal',
    exact: true,
    initial: [token('A')],
    target: [token('A')],
    totalSteps: total,
    steps,
    executionTimeMs: 1,
    exploredStates: 1
  };
}

function parallel(unsignedSteps: number, signedSteps: number): ParallelComparisonResult {
  return {
    unsigned: trace(unsignedSteps),
    signed: trace(signedSteps),
    unsignedPhysicalSteps: [[token('A')]],
    orientationMismatchInUnsigned: 1,
    deltaSteps: signedSteps - unsignedSteps,
    deltaTimeMs: 0,
    deltaExploredStates: 0,
    verdict: ''
  };
}

describe('StepperState', () => {
  let stepper: StepperState;

  beforeEach(() => {
    stepper = new StepperState();
  });

  afterEach(() => {
    stepper.reset();
  });

  it('carga una traza simple en estado INITIALIZED', () => {
    stepper.loadSingleTrace(trace(3));
    const snapshot = stepper.getSnapshot();
    expect(snapshot.status).toBe('INITIALIZED');
    expect(snapshot.kind).toBe('single');
    expect(snapshot.stepIndex).toBe(0);
    expect(snapshot.maxSteps).toBe(3);
    expect(snapshot.hasTrace).toBe(true);
  });

  it('avanza y retrocede paso a paso', () => {
    stepper.loadSingleTrace(trace(3));
    expect(stepper.stepForward()).toBe(true);
    expect(stepper.getSnapshot().stepIndex).toBe(1);
    expect(stepper.getSnapshot().status).toBe('PAUSED');
    expect(stepper.stepBackward()).toBe(true);
    expect(stepper.getSnapshot().stepIndex).toBe(0);
    expect(stepper.getSnapshot().status).toBe('INITIALIZED');
    expect(stepper.stepBackward()).toBe(false);
  });

  it('se detiene en FINISHED al llegar al final', () => {
    stepper.loadSingleTrace(trace(2));
    stepper.stepForward();
    stepper.stepForward();
    expect(stepper.getSnapshot().stepIndex).toBe(2);
    expect(stepper.getSnapshot().status).toBe('FINISHED');
    expect(stepper.stepForward()).toBe(false);
  });

  it('salta a un paso y lo acota al rango válido', () => {
    stepper.loadSingleTrace(trace(4));
    stepper.goToStep(2);
    expect(stepper.getSnapshot().stepIndex).toBe(2);
    stepper.goToStep(99);
    expect(stepper.getSnapshot().stepIndex).toBe(4);
    expect(stepper.getSnapshot().status).toBe('FINISHED');
    stepper.goToStep(-5);
    expect(stepper.getSnapshot().stepIndex).toBe(0);
  });

  it('jumpToEnd y reset restablecen el reproductor', () => {
    stepper.loadSingleTrace(trace(3));
    stepper.jumpToEnd();
    expect(stepper.getSnapshot().status).toBe('FINISHED');
    expect(stepper.getSnapshot().stepIndex).toBe(3);
    stepper.reset();
    expect(stepper.getSnapshot().status).toBe('INITIALIZED');
    expect(stepper.getSnapshot().stepIndex).toBe(0);
  });

  it('sincroniza trazas duales saturando la más corta', () => {
    stepper.loadParallelTraces(parallel(2, 4));
    const snapshot0 = stepper.getSnapshot();
    expect(snapshot0.kind).toBe('parallel');
    expect(snapshot0.maxSteps).toBe(4);

    stepper.goToStep(3);
    const snapshot3 = stepper.getSnapshot();
    expect(snapshot3.unsignedStepIndex).toBe(2);
    expect(snapshot3.unsignedFinished).toBe(true);
    expect(snapshot3.signedStepIndex).toBe(3);
    expect(snapshot3.signedFinished).toBe(false);

    stepper.jumpToEnd();
    const final = stepper.getSnapshot();
    expect(final.unsignedStepIndex).toBe(2);
    expect(final.signedStepIndex).toBe(4);
    expect(final.signedFinished).toBe(true);
  });

  it('notifica a los suscriptores y permite cancelar la suscripción', () => {
    const events: string[] = [];
    const unsubscribe = stepper.subscribe((_snapshot, event) => {
      events.push(event);
    });
    stepper.loadSingleTrace(trace(1));
    stepper.stepForward();
    unsubscribe();
    stepper.stepForward();
    expect(events).toEqual(['LOAD_SINGLE', 'FINISH']);
  });
});
