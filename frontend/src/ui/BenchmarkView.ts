/**
 * Función 1 — Vista del benchmark de permutaciones.
 *
 * Muestra el resumen del multiconjunto, las tarjetas por variante y barras
 * comparativas de tiempo y memoria.
 */

import { runBenchmark } from '../services/apiClient';
import type {
  BenchmarkResponse,
  BenchmarkVariant,
  StepperEvent,
  StepperSnapshot
} from '../types/api';
import type { AlertFn, AppView, ViewInputs } from '../types/ui';
import {
  escapeHtml,
  formatCount,
  formatMemory,
  formatMicros
} from './dom';

function statCard(label: string, value: string, accent: string): string {
  return `
    <div class="rounded-lg border border-md-outline-variant/50 bg-md-surface-container p-3">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-md-on-surface-variant">${escapeHtml(label)}</p>
      <p class="mt-1 font-mono text-xl font-bold ${accent}">${escapeHtml(value)}</p>
    </div>
  `;
}

export class BenchmarkView implements AppView {
  constructor(
    private readonly container: HTMLElement,
    private readonly setAlert: AlertFn
  ) {
    this.container.innerHTML = `
      <div id="bench-results" class="space-y-4"></div>
    `;
  }

  render(_snapshot: StepperSnapshot, _event: StepperEvent): void {
    // La vista de benchmark no participa del reproductor.
  }

  destroy(): void {
    // Nada que liberar: no hay suscripciones propias.
  }

  async run(inputs: ViewInputs): Promise<void> {
    if (inputs.sequence.length === 0) {
      this.setAlert('Ingresa una secuencia con al menos un símbolo.', 'error');
      return;
    }
    const result = await runBenchmark({
      sequence: inputs.sequence,
      repeats: inputs.repeats
    });
    this.renderResults(result);
    this.setAlert(
      `Benchmark completado: ${formatCount(result.positionalCount)} permutaciones posicionales.`,
      'success'
    );
  }

  private renderResults(result: BenchmarkResponse): void {
    const root = this.container.querySelector<HTMLDivElement>('#bench-results');
    if (root === null) {
      return;
    }

    const chips = result.sequence
      .map(
        (symbol) =>
          `<span class="rounded-md border border-md-outline-variant bg-md-surface-container px-2.5 py-1 font-mono text-sm font-bold text-md-on-surface">${escapeHtml(symbol)}</span>`
      )
      .join('');
    const kindBadge = result.hasDuplicates
      ? '<span class="rounded-full bg-md-strand-minus-container px-3 py-1 text-xs font-semibold text-md-strand-minus">Multiconjunto</span>'
      : '<span class="rounded-full bg-md-secondary-container px-3 py-1 text-xs font-semibold text-md-on-surface">Símbolos distintos</span>';

    const maxTime = Math.max(
      1,
      ...result.variants.map((variant) => variant.medianUs)
    );
    const maxMemory = Math.max(
      1,
      ...result.variants.map((variant) => variant.peakKb)
    );

    root.innerHTML = `
      <section class="rounded-xl bg-md-surface-bright p-4 shadow-sm sm:p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-md-on-surface">Función 1 · Permutaciones</h2>
            <p class="text-[13px] text-md-on-surface-variant">Enumeración posicional y por multiconjunto sobre una secuencia biológica.</p>
          </div>
          ${kindBadge}
        </div>
        <div class="mt-4 flex flex-wrap gap-2">${chips}</div>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          ${statCard('Longitud', String(result.length), 'text-md-on-surface')}
          ${statCard('Posicionales (n!)', formatCount(result.positionalCount), 'text-md-primary')}
          ${statCard('Únicas', formatCount(result.uniqueCount), 'text-md-tertiary')}
          ${statCard('Repeticiones', String(result.repeats), 'text-md-on-surface')}
        </div>
        ${this.renderInsight(result)}
      </section>

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        ${result.variants
          .map((variant) => this.renderVariantCard(variant))
          .join('')}
      </section>

      ${this.renderBarSection(
        'Comparativa de tiempo (mediana)',
        'Cada barra representa la mediana de las ráfagas con el recolector de basura pausado.',
        result.variants,
        maxTime,
        (variant) => variant.medianUs,
        (variant) => formatMicros(variant.medianUs),
        'bg-md-primary'
      )}
      ${this.renderBarSection(
        'Comparativa de memoria (pico, tracemalloc)',
        'Medición en una corrida separada para no contaminar el tiempo.',
        result.variants,
        maxMemory,
        (variant) => variant.peakKb,
        (variant) => formatMemory(variant.peakKb),
        'bg-md-tertiary'
      )}
    `;
  }

  private renderInsight(result: BenchmarkResponse): string {
    if (result.hasDuplicates) {
      return `
        <div class="mt-4 rounded-lg border border-md-breakpoint/40 bg-md-breakpoint/10 px-4 py-3 text-[12px] leading-relaxed text-md-on-surface">
          <strong>Poda multinomial activa:</strong> al repetirse símbolos, las permutaciones únicas son
          n! / ∏ kᵢ! = ${escapeHtml(formatCount(result.uniqueCount))} (frente a ${escapeHtml(formatCount(result.positionalCount))} posicionales).
          Por eso conviene <em>podar durante la generación</em> (<code>unique_backtracking</code>, <code>unique_narayana</code>)
          en lugar de generar todo y filtrar al final (<code>itertools + set</code>), que dispara el uso de memoria.
        </div>
      `;
    }
    return `
      <div class="mt-4 rounded-lg border border-md-outline-variant bg-md-secondary-container px-4 py-3 text-[12px] leading-relaxed text-md-on-surface">
        <strong>Sin símbolos repetidos:</strong> se generan exactamente n! = ${escapeHtml(formatCount(result.positionalCount))} permutaciones.
        Las variantes de poda multinomial coinciden en el conteo pero su ventaja aparece al comparar memoria y tiempo
        con la línea base <code>itertools + set</code>, que materializa todos los resultados.
      </div>
    `;
  }

  private renderVariantCard(variant: BenchmarkVariant): string {
    const isDistinct = variant.group === 'distinct';
    const badge = isDistinct
      ? '<span class="rounded-full bg-md-secondary-container px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-md-on-surface">Distintos</span>'
      : '<span class="rounded-full bg-md-strand-minus-container px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-md-strand-minus">Multiconjunto</span>';
    const factor =
      variant.relativeToItertools === 1 && variant.key === 'itertools_permutations'
        ? '1.00× (línea base)'
        : `${variant.relativeToItertools.toFixed(2)}×`;
    return `
      <article class="flex flex-col rounded-xl border ${isDistinct ? 'border-md-outline-variant/60' : 'border-md-strand-minus/20'} bg-md-surface-bright p-4 shadow-sm">
        <header class="flex items-start justify-between gap-2">
          <h3 class="text-sm font-bold text-md-on-surface">${escapeHtml(variant.name)}</h3>
          ${badge}
        </header>
        <p class="mt-1 text-[12px] leading-snug text-md-on-surface-variant">${escapeHtml(variant.description)}</p>
        <p class="mt-3 flex items-baseline gap-1.5">
          <span class="font-mono text-2xl font-bold ${isDistinct ? 'text-md-primary' : 'text-md-tertiary'}">${escapeHtml(formatCount(variant.count))}</span>
          <span class="text-[11px] text-md-on-surface-variant">permutaciones</span>
        </p>
        <dl class="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div><dt class="text-md-on-surface-variant/70">Mediana</dt><dd class="font-mono font-semibold text-md-on-surface">${escapeHtml(formatMicros(variant.medianUs))}</dd></div>
          <div><dt class="text-md-on-surface-variant/70">Mínimo</dt><dd class="font-mono font-semibold text-md-on-surface">${escapeHtml(formatMicros(variant.minUs))}</dd></div>
          <div><dt class="text-md-on-surface-variant/70">Memoria pico</dt><dd class="font-mono font-semibold text-md-on-surface">${escapeHtml(formatMemory(variant.peakKb))}</dd></div>
          <div><dt class="text-md-on-surface-variant/70">Factor vs itertools</dt><dd class="font-mono font-semibold text-md-on-surface">${escapeHtml(factor)}</dd></div>
        </dl>
      </article>
    `;
  }

  private renderBarSection(
    title: string,
    caption: string,
    variants: BenchmarkVariant[],
    maximum: number,
    valueOf: (variant: BenchmarkVariant) => number,
    labelOf: (variant: BenchmarkVariant) => string,
    fillClass: string
  ): string {
    const rows = variants
      .map((variant) => {
        const width = Math.max(2, (valueOf(variant) / maximum) * 100);
        return `
          <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span class="w-full min-w-0 truncate text-[12px] font-medium text-md-on-surface-variant sm:w-44 sm:shrink-0" title="${escapeHtml(variant.name)}">${escapeHtml(variant.name)}</span>
            <span class="relative h-3 w-full overflow-hidden rounded-full bg-md-surface-container sm:flex-1">
              <span class="absolute inset-y-0 left-0 rounded-full ${fillClass}" style="width:${width.toFixed(2)}%"></span>
            </span>
            <span class="w-full text-left font-mono text-[11px] font-semibold text-md-on-surface sm:w-24 sm:shrink-0 sm:text-right">${escapeHtml(labelOf(variant))}</span>
          </div>
        `;
      })
      .join('');
    return `
      <section class="rounded-xl bg-md-surface-bright p-4 shadow-sm sm:p-5">
        <h3 class="text-sm font-bold text-md-on-surface">${escapeHtml(title)}</h3>
        <p class="mb-3 text-[12px] text-md-on-surface-variant">${escapeHtml(caption)}</p>
        <div class="flex flex-col gap-2">${rows}</div>
      </section>
    `;
  }
}
