/**
 * Función 4 — Vista paralela sincronizada F2 vs F3.
 *
 * Ambas columnas avanzan con el MISMO control. La columna sin dirección
 * muestra, además, el efecto físico real de sus giros sobre la orientación de
 * la hebra, evidenciando los bloques que quedan invertidos respecto al objetivo.
 */

import { solveParallel } from '../services/apiClient';
import type {
  GeneToken,
  ParallelComparisonResult,
  ReversalStep,
  StepperEvent,
  StepperSnapshot
} from '../types/api';
import type { AlertFn, AppView, ViewInputs } from '../types/ui';
import { StepperState } from '../state/StepperState';
import { escapeHtml, formatCount, formatMs } from './dom';
import { relativeMap, renderSequence } from './tokens';

interface ColumnOptions {
  title: string;
  subtitle: string;
  step: ReversalStep;
  totalSteps: number;
  finished: boolean;
  map: Map<string, { value: number; sign: 1 | -1 }>;
  directed: boolean;
  physicalTokens: GeneToken[] | null;
}

function stepCard(options: ColumnOptions): string {
  const { title, subtitle, step, totalSteps, finished, map, directed } = options;
  const isInitial = step.reversalSpan === null;
  const sequenceOptions = {
    highlight: step.reversalSpan,
    map,
    directed,
    showSign: directed
  };
  const spanText =
    step.reversalSpan !== null
      ? `ρ(${step.reversalSpan[0] + 1}, ${step.reversalSpan[1] + 1})`
      : 'Estado inicial';
  const finishedBadge = finished
    ? `<span class="rounded-full bg-md-tertiary-container/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-md-tertiary">Objetivo alcanzado en el paso ${totalSteps}</span>`
    : '';
  const beforeBlock = isInitial
    ? ''
    : `
      <div class="mb-3">
        <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-md-on-surface-variant/70">Antes</p>
        ${renderSequence(step.before, sequenceOptions)}
      </div>
    `;
  const afterLabel = isInitial ? 'Secuencia inicial' : 'Después';
  const physicalBlock =
    options.physicalTokens !== null
      ? `
        <div class="mt-4 rounded-lg border border-dashed border-md-outline-variant bg-md-surface-container p-3">
          <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-md-on-surface-variant">Efecto físico en la hebra (orientación real)</p>
          ${renderSequence(options.physicalTokens, {
            highlight: step.reversalSpan,
            map,
            directed: true,
            showSign: true
          })}
        </div>
      `
      : '';
  return `
    <section class="rounded-xl bg-md-surface-bright p-4 shadow-sm sm:p-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-bold text-md-on-surface">${escapeHtml(title)}</h3>
          <p class="text-[12px] text-md-on-surface-variant">${escapeHtml(subtitle)}</p>
        </div>
        <div class="flex items-center gap-2">
          ${finishedBadge}
          <span class="rounded-full bg-md-secondary-container px-3 py-1 font-mono text-xs font-semibold text-md-on-surface">Paso ${step.stepIndex} / ${totalSteps}</span>
        </div>
      </div>
      <p class="mt-3 break-words rounded-md border border-md-outline-variant bg-md-surface-container px-3 py-2 text-[12px] text-md-on-surface">
        <span class="font-mono font-semibold text-md-error">${escapeHtml(spanText)}</span> · ${escapeHtml(step.description)} · ${step.breakpointsRemaining} ptos. de ruptura
      </p>
      <div class="mt-4">
        ${beforeBlock}
        <div>
          <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-md-on-surface-variant/70">${escapeHtml(afterLabel)}</p>
          ${renderSequence(step.after, sequenceOptions)}
        </div>
      </div>
      ${physicalBlock}
    </section>
  `;
}

function signedDelta(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export class ParallelView implements AppView {
  constructor(
    private readonly container: HTMLElement,
    private readonly stepper: StepperState,
    private readonly setAlert: AlertFn
  ) {
    this.container.innerHTML = `
      <div id="par-content" class="hidden space-y-4"></div>
    `;
  }

  private query<T extends Element>(selector: string): T | null {
    return this.container.querySelector<T>(selector);
  }

  destroy(): void {
    // El reproductor es compartido y lo administra main.ts.
  }

  async run(inputs: ViewInputs): Promise<void> {
    if (inputs.initial.length === 0 || inputs.target.length === 0) {
      this.setAlert('Completa la secuencia inicial y la objetivo.', 'error');
      return;
    }
    const result = await solveParallel({
      initial: inputs.initial,
      target: inputs.target,
      mode: inputs.mode
    });
    this.stepper.loadParallelTraces(result);
    this.setAlert(
      `Comparación lista: F2 = ${result.unsigned.totalSteps} paso(s), F3 = ${result.signed.totalSteps} paso(s).`,
      'success'
    );
  }

  render(snapshot: StepperSnapshot, _event: StepperEvent): void {
    const result: ParallelComparisonResult | null =
      snapshot.kind === 'parallel' ? snapshot.parallel : null;
    const content = this.query<HTMLDivElement>('#par-content');
    if (content === null) {
      return;
    }
    if (result === null) {
      content.classList.add('hidden');
      return;
    }
    content.classList.remove('hidden');

    const uIndex = this.clampIndex(
      snapshot.unsignedStepIndex,
      result.unsigned.steps
    );
    const sIndex = this.clampIndex(
      snapshot.signedStepIndex,
      result.signed.steps
    );
    const uStep = result.unsigned.steps[uIndex];
    const sStep = result.signed.steps[sIndex];
    if (uStep === undefined || sStep === undefined) {
      return;
    }
    const physicalIndex = Math.min(
      snapshot.unsignedStepIndex,
      result.unsignedPhysicalSteps.length - 1
    );
    const physicalTokens =
      physicalIndex >= 0
        ? (result.unsignedPhysicalSteps[physicalIndex] ?? null)
        : null;

    const mismatchTone =
      result.orientationMismatchInUnsigned === 0
        ? 'text-md-tertiary'
        : 'text-md-error';

    content.innerHTML = `
      <section class="rounded-xl bg-md-surface-bright p-4 shadow-sm sm:p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-bold text-md-on-surface">Función 4 · Comparación paralela F2 vs F3</h2>
          <span class="rounded-full bg-md-secondary-container px-3 py-1 text-xs font-semibold text-md-on-surface">Control sincronizado</span>
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-lg border border-md-outline-variant/50 bg-md-surface-container p-3">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-md-on-surface-variant">Δ Pasos (F3 − F2)</p>
            <p class="mt-1 font-mono text-xl font-bold text-md-on-surface">${escapeHtml(signedDelta(result.deltaSteps))}</p>
          </div>
          <div class="rounded-lg border border-md-outline-variant/50 bg-md-surface-container p-3">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-md-on-surface-variant">Tiempo F2</p>
            <p class="mt-1 font-mono text-xl font-bold text-md-primary">${escapeHtml(formatMs(result.unsigned.executionTimeMs))}</p>
          </div>
          <div class="rounded-lg border border-md-outline-variant/50 bg-md-surface-container p-3">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-md-on-surface-variant">Tiempo F3</p>
            <p class="mt-1 font-mono text-xl font-bold text-md-tertiary">${escapeHtml(formatMs(result.signed.executionTimeMs))}</p>
          </div>
          <div class="rounded-lg border border-md-outline-variant/50 bg-md-surface-container p-3">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-md-on-surface-variant">Hebras invertidas (F2)</p>
            <p class="mt-1 font-mono text-xl font-bold ${mismatchTone}">${formatCount(result.orientationMismatchInUnsigned)}</p>
          </div>
        </div>
        <p class="mt-4 break-words rounded-md border border-md-outline-variant/40 bg-md-surface-container px-3 py-2 text-[13px] text-md-on-surface">${escapeHtml(result.verdict)}</p>
        <p class="mt-2 text-[11px] text-md-on-surface-variant/70">Δ Estados explorados (F3 − F2): ${escapeHtml(signedDelta(result.deltaExploredStates))}.</p>
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
        ${stepCard({
          title: 'F2 · Sin dirección',
          subtitle: 'Ignora los signos para elegir los giros.',
          step: uStep,
          totalSteps: result.unsigned.totalSteps,
          finished: snapshot.unsignedFinished,
          map: relativeMap(result.unsigned.target, false),
          directed: false,
          physicalTokens
        })}
        ${stepCard({
          title: 'F3 · Con dirección',
          subtitle: 'Respeta posición y orientación de cada bloque.',
          step: sStep,
          totalSteps: result.signed.totalSteps,
          finished: snapshot.signedFinished,
          map: relativeMap(result.signed.target, true),
          directed: true,
          physicalTokens: null
        })}
      </div>
    `;
  }

  private clampIndex(index: number, steps: ReversalStep[]): number {
    return Math.max(0, Math.min(index, steps.length - 1));
  }
}
