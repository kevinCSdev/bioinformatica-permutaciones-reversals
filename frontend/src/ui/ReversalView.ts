/**
 * Funciones 2 y 3 — Vista de una traza de reversal (sin/con dirección).
 *
 * Dibuja el escenario del paso activo (antes/después con el rango invertido
 * resaltado), los puntos de ruptura entre bloques y una línea de tiempo
 * navegable que controla el reproductor compartido.
 */

import { solveDirected, solveUndirected } from '../services/apiClient';
import type {
  ReversalResult,
  StepperEvent,
  StepperSnapshot
} from '../types/api';
import type { AlertFn, AppView, ViewInputs } from '../types/ui';
import { StepperState } from '../state/StepperState';
import { escapeHtml, formatCount, formatMs } from './dom';
import { relativeMap, renderSequence } from './tokens';

export class ReversalView implements AppView {
  constructor(
    private readonly container: HTMLElement,
    private readonly stepper: StepperState,
    private readonly directed: boolean,
    private readonly setAlert: AlertFn
  ) {
    this.container.innerHTML = `
      <div id="rev-content" class="hidden space-y-4">
        <section class="rounded-xl bg-md-surface-bright p-4 shadow-sm sm:p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-lg font-bold text-md-on-surface">${directed ? 'Función 3 · Reversal con dirección' : 'Función 2 · Reversal sin dirección'}</h2>
            <div class="flex items-center gap-2">
              <span id="rev-exact"></span>
              <span id="rev-step-badge" class="rounded-full bg-md-secondary-container px-3 py-1 text-xs font-semibold text-md-on-surface"></span>
            </div>
          </div>
          <div id="rev-meta" class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"></div>
          <p id="rev-mode-note" class="mt-3 text-[12px] text-md-on-surface-variant"></p>
          <div class="mt-3">
            <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-md-on-surface-variant/70">Secuencia objetivo</p>
            <div id="rev-target"></div>
          </div>
        </section>

        <section class="rounded-xl bg-md-surface-bright p-4 shadow-sm sm:p-5">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-bold text-md-on-surface">Escenario del paso activo</h3>
            <span id="rev-span-label" class="font-mono text-[12px] font-semibold text-md-error"></span>
          </div>
          <p id="rev-description" class="mb-4 rounded-md border border-md-outline-variant bg-md-surface-container px-3 py-2 text-[13px] text-md-on-surface"></p>
          <div class="space-y-4">
            <div id="rev-before-wrap">
              <p id="rev-before-label" class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-md-on-surface-variant/70">Antes</p>
              <div id="rev-before"></div>
            </div>
            <div>
              <p id="rev-after-label" class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-md-on-surface-variant/70">Después</p>
              <div id="rev-after"></div>
            </div>
          </div>
          <p class="mt-4 text-[11px] text-md-on-surface-variant/70">Las barras punteadas señalan puntos de ruptura entre bloques no adyacentes.</p>
        </section>

        <section class="rounded-xl bg-md-surface-bright p-4 shadow-sm sm:p-5">
          <h3 class="mb-3 text-sm font-bold text-md-on-surface">Línea de tiempo</h3>
          <div id="rev-timeline" class="flex max-h-80 flex-col gap-1.5 overflow-auto pr-1 thin-scroll"></div>
        </section>

        <section class="rounded-xl bg-md-surface-bright p-4 shadow-sm sm:p-5">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-bold text-md-on-surface">Recorrido completo paso a paso</h3>
            <span id="rev-walk-count" class="text-[11px] font-semibold text-md-on-surface-variant"></span>
          </div>
          <p class="mb-3 text-[12px] text-md-on-surface-variant">Todos los estados en orden. El tramo invertido de cada paso se resalta en rojo; haz clic en una fila para saltar a ese paso.</p>
          <div id="rev-walkthrough" class="flex flex-col gap-2"></div>
        </section>
      </div>
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
    const payload = {
      initial: inputs.initial,
      target: inputs.target,
      mode: inputs.mode
    };
    const result = this.directed
      ? await solveDirected(payload)
      : await solveUndirected(payload);
    this.stepper.loadSingleTrace(result);
    this.setAlert(
      `Traza calculada: ${result.totalSteps} paso(s) ${result.exact ? 'óptimo(s)' : 'aproximado(s)'}.`,
      'success'
    );
  }

  render(snapshot: StepperSnapshot, _event: StepperEvent): void {
    const result: ReversalResult | null =
      snapshot.kind === 'single' ? snapshot.single : null;
    const content = this.query<HTMLDivElement>('#rev-content');
    if (content === null) {
      return;
    }
    if (result === null || result.steps.length === 0) {
      content.classList.add('hidden');
      return;
    }
    content.classList.remove('hidden');

    const index = Math.max(
      0,
      Math.min(snapshot.stepIndex, result.steps.length - 1)
    );
    const step = result.steps[index];
    if (step === undefined) {
      return;
    }

    const map = relativeMap(result.target, result.directed);
    const showSign = result.directed;

    const exact = this.query<HTMLSpanElement>('#rev-exact');
    if (exact !== null) {
      exact.className = result.exact
        ? 'rounded-full bg-md-tertiary-container/50 px-3 py-1 text-xs font-semibold text-md-tertiary'
        : 'rounded-full bg-md-secondary-container px-3 py-1 text-xs font-semibold text-md-on-surface';
      exact.textContent = result.exact ? 'Óptimo exacto' : 'Aproximado';
    }

    const stepBadge = this.query<HTMLSpanElement>('#rev-step-badge');
    if (stepBadge !== null) {
      stepBadge.textContent = `Paso ${step.stepIndex} / ${result.totalSteps}`;
    }

    const meta = this.query<HTMLDivElement>('#rev-meta');
    if (meta !== null) {
      const cards: Array<[string, string]> = [
        ['Pasos totales', String(result.totalSteps)],
        ['Tiempo de cálculo', formatMs(result.executionTimeMs)],
        ['Estados explorados', formatCount(result.exploredStates)],
        ['Puntos de ruptura', String(step.breakpointsRemaining)]
      ];
      meta.innerHTML = cards
        .map(
          ([label, value]) => `
            <div class="rounded-lg border border-md-outline-variant/50 bg-md-surface-container p-3">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-md-on-surface-variant">${escapeHtml(label)}</p>
              <p class="mt-1 font-mono text-lg font-bold text-md-on-surface">${escapeHtml(value)}</p>
            </div>
          `
        )
        .join('');
    }

    const modeNote = this.query<HTMLParagraphElement>('#rev-mode-note');
    if (modeNote !== null) {
      const strategy =
        result.mode === 'optimal'
          ? result.directed
            ? 'Óptimo mediante A* con cota de Bafna–Pevzner (n+1 − c(π))'
            : 'Óptimo mediante A* con heurística admisible ⌈b/2⌉'
          : 'Voraz: revierte el intervalo que más reduce puntos de ruptura';
      modeNote.textContent = `Estrategia: ${strategy}.`;
    }

    const spanLabel = this.query<HTMLSpanElement>('#rev-span-label');
    if (spanLabel !== null) {
      spanLabel.textContent =
        step.reversalSpan !== null
          ? `ρ(${step.reversalSpan[0] + 1}, ${step.reversalSpan[1] + 1})`
          : 'Estado inicial';
    }

    const description = this.query<HTMLParagraphElement>('#rev-description');
    if (description !== null) {
      description.textContent = step.description;
    }

    const target = this.query<HTMLDivElement>('#rev-target');
    if (target !== null) {
      target.innerHTML = renderSequence(result.target, {
        highlight: null,
        map,
        directed: result.directed,
        showSign
      });
    }

    const options = {
      highlight: step.reversalSpan,
      map,
      directed: result.directed,
      showSign
    };
    const isInitial = step.reversalSpan === null;
    const beforeWrap = this.query<HTMLDivElement>('#rev-before-wrap');
    const beforeLabel = this.query<HTMLParagraphElement>('#rev-before-label');
    const afterLabel = this.query<HTMLParagraphElement>('#rev-after-label');
    const before = this.query<HTMLDivElement>('#rev-before');
    const after = this.query<HTMLDivElement>('#rev-after');
    if (beforeWrap !== null) {
      beforeWrap.classList.toggle('hidden', isInitial);
    }
    if (beforeLabel !== null) {
      beforeLabel.textContent = 'Antes';
    }
    if (afterLabel !== null) {
      afterLabel.textContent = isInitial ? 'Secuencia inicial' : 'Después';
    }
    if (before !== null) {
      before.innerHTML = renderSequence(step.before, options);
    }
    if (after !== null) {
      after.innerHTML = renderSequence(step.after, options);
    }

    this.renderTimeline(result, step.stepIndex);
    this.renderWalkthrough(result, step.stepIndex);
  }

  private renderWalkthrough(result: ReversalResult, activeIndex: number): void {
    const root = this.query<HTMLDivElement>('#rev-walkthrough');
    const count = this.query<HTMLSpanElement>('#rev-walk-count');
    if (root === null) {
      return;
    }
    if (count !== null) {
      count.textContent = `${result.totalSteps} reversal(es) · ${result.steps.length} estados`;
    }

    const map = relativeMap(result.target, result.directed);
    const showSign = result.directed;

    root.innerHTML = result.steps
      .map((step) => {
        const active = step.stepIndex === activeIndex;
        const visited = step.stepIndex < activeIndex;
        const rowClass = active
          ? 'border-md-primary bg-md-primary-container text-md-on-surface'
          : visited
            ? 'border-md-outline-variant bg-md-surface-container text-md-on-surface'
            : 'border-md-outline-variant bg-md-surface-bright text-md-on-surface hover:bg-md-surface-container';
        const circleClass = active
          ? 'bg-md-primary text-md-on-primary'
          : visited
            ? 'bg-md-primary-container text-md-on-surface'
            : 'bg-md-surface-container-high text-md-on-surface-variant';
        const spanText =
          step.reversalSpan !== null
            ? `ρ(${step.reversalSpan[0] + 1}, ${step.reversalSpan[1] + 1})`
            : 'Inicial';
        return `
          <button type="button" data-step="${step.stepIndex}" aria-current="${active ? 'step' : 'false'}" class="w-full rounded-lg border px-3 py-2 text-left transition ${rowClass}">
            <span class="flex flex-wrap items-center gap-2 text-[12px]">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${circleClass} text-[11px] font-bold">${step.stepIndex}</span>
              <span class="font-mono font-semibold text-md-error">${escapeHtml(spanText)}</span>
              <span class="min-w-0 flex-1 break-words text-md-on-surface-variant">${escapeHtml(step.description)}</span>
              <span class="shrink-0 font-mono text-[11px] text-md-on-surface-variant/70">${step.breakpointsRemaining} ptos.</span>
            </span>
            <span class="mt-2 block">${renderSequence(step.after, {
              highlight: step.reversalSpan,
              map,
              directed: result.directed,
              showSign
            })}</span>
          </button>
        `;
      })
      .join('');

    root
      .querySelectorAll<HTMLButtonElement>('button[data-step]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          const target = Number(button.dataset['step']);
          if (Number.isFinite(target)) {
            this.stepper.goToStep(target);
          }
        });
      });
  }

  private renderTimeline(result: ReversalResult, activeIndex: number): void {
    const timeline = this.query<HTMLDivElement>('#rev-timeline');
    if (timeline === null) {
      return;
    }
    timeline.innerHTML = result.steps
      .map((step) => {
        const active = step.stepIndex === activeIndex;
        const visited = step.stepIndex < activeIndex;
        const rowClass = active
          ? 'border-md-primary bg-md-primary text-md-on-primary'
          : visited
            ? 'border-md-primary-container bg-md-primary-container text-md-on-surface'
            : 'border-md-outline-variant bg-md-surface-bright text-md-on-surface hover:bg-md-primary-container';
        const circleClass = active
          ? 'bg-md-on-primary text-md-primary'
          : visited
            ? 'bg-md-primary text-md-on-primary'
            : 'bg-md-primary-container text-md-on-surface';
        const titleTone = active
          ? 'text-md-on-primary'
          : visited
            ? 'text-md-on-surface'
            : 'text-md-on-surface';
        const descTone = active ? 'text-md-on-primary/80' : 'text-md-on-surface-variant';
        const metaTone = active ? 'text-md-on-primary/70' : 'text-md-on-surface-variant/70';
        const spanText =
          step.reversalSpan !== null
            ? `ρ(${step.reversalSpan[0] + 1}, ${step.reversalSpan[1] + 1})`
            : 'Inicial';
        return `
          <button type="button" data-step="${step.stepIndex}" class="flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-[12px] transition ${rowClass}">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${circleClass} text-[11px] font-bold">${step.stepIndex}</span>
            <span class="min-w-0 flex-1 break-words">
              <span class="font-mono font-semibold ${titleTone}">${escapeHtml(spanText)}</span>
              <span class="ml-2 ${descTone}">${escapeHtml(step.description)}</span>
            </span>
            <span class="shrink-0 font-mono text-[11px] ${metaTone}">${step.breakpointsRemaining} ptos.</span>
          </button>
        `;
      })
      .join('');
    timeline
      .querySelectorAll<HTMLButtonElement>('button[data-step]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          const target = Number(button.dataset['step']);
          if (Number.isFinite(target)) {
            this.stepper.goToStep(target);
          }
        });
      });
  }
}
