/** Barra lateral: campos por función y ejemplos precargados. */

import type { ActiveTab, SolverMode } from '../types/api';
import { presetsForTab, type Preset } from '../data/presets';
import {
  parseSequence,
  validateReversalPair,
  validateSequenceField,
  type SequenceToken
} from '../services/sequenceInput';
import { validateRepeatsField } from '../services/repeatsInput';
import { escapeHtml } from './dom';
import { icon, type IconName } from './icons';

export interface SidebarHandlers {
  onRun: () => void;
  onPreset: (preset: Preset) => void;
  onSelectTab: (tab: ActiveTab) => void;
}

export interface SidebarTab {
  id: ActiveTab;
  label: string;
  icon: IconName;
}

export interface SidebarValues {
  first: string;
  second: string;
  mode: SolverMode;
  repeats: number;
}

const INPUT_CLASS =
  'w-full rounded-md border border-md-outline-variant bg-md-surface-container-highest px-3 py-2 font-mono text-sm font-semibold text-md-on-surface outline-none focus:border-md-primary focus:ring-2 focus:ring-md-primary-container';
const LABEL_CLASS =
  'text-[11px] font-semibold uppercase tracking-wide text-md-on-surface-variant';
const SELECT_CLASS =
  'w-full rounded-md border border-md-outline-variant bg-md-surface-container-highest px-3 py-2 text-sm font-medium text-md-on-surface outline-none focus:border-md-primary focus:ring-2 focus:ring-md-primary-container';

const NAV_BASE =
  'sidebar-item flex w-full items-center gap-3 rounded-full px-3 py-2 text-left text-[13px] font-semibold transition';
const NAV_ACTIVE = 'bg-md-primary-container text-md-on-primary-container shadow-sm';
const NAV_IDLE =
  'text-md-on-surface-variant hover:bg-md-surface-container hover:text-md-on-surface';

const SEQUENCE_HINT =
  'Escribe de corrido: ATGC · +A-T+G-C · 1,2,10 (el número de varias cifras usa separador).';

interface SequenceField {
  input: HTMLInputElement;
  chips: HTMLElement;
  counter: HTMLElement;
  error: HTMLElement;
}

export class Sidebar {
  private runButton: HTMLButtonElement | null = null;
  private presetSelect: HTMLSelectElement | null = null;
  private firstInput: HTMLInputElement | null = null;
  private secondInput: HTMLInputElement | null = null;
  private modeSelect: HTMLSelectElement | null = null;
  private repeatsInput: HTMLInputElement | null = null;
  private repeatsError: HTMLElement | null = null;
  private pairError: HTMLElement | null = null;
  private presetDescription: HTMLParagraphElement | null = null;
  private firstField: SequenceField | null = null;
  private secondField: SequenceField | null = null;
  private tab: ActiveTab = 'f1';
  private busy = false;
  private repeatsValid = true;

  constructor(
    private readonly navRoot: HTMLElement,
    private readonly fieldsRoot: HTMLElement,
    private readonly tabs: readonly SidebarTab[],
    private readonly handlers: SidebarHandlers
  ) {
    this.renderNav();
    this.setTab('f1');
  }

  private renderNav(): void {
    this.navRoot.innerHTML = this.tabs
      .map(
        (tab) => `
          <button type="button" data-tab="${tab.id}" title="${escapeHtml(tab.label)}"
            class="${NAV_BASE} ${NAV_IDLE}">
            <span class="sidebar-item-icon grid h-5 w-5 shrink-0 place-items-center">${icon(tab.icon)}</span>
            <span class="sidebar-label truncate">${escapeHtml(tab.label)}</span>
          </button>`
      )
      .join('');

    for (const button of this.navRoot.querySelectorAll<HTMLButtonElement>(
      'button[data-tab]'
    )) {
      button.addEventListener('click', () => {
        const id = button.dataset['tab'] as ActiveTab | undefined;
        if (id !== undefined) {
          this.handlers.onSelectTab(id);
        }
      });
    }
  }

  setActiveTab(tab: ActiveTab): void {
    for (const button of this.navRoot.querySelectorAll<HTMLButtonElement>(
      'button[data-tab]'
    )) {
      const active = button.dataset['tab'] === tab;
      button.className = `${NAV_BASE} ${active ? NAV_ACTIVE : NAV_IDLE}`;
      if (active) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    }
  }

  setTab(tab: ActiveTab): void {
    this.tab = tab;
    this.setActiveTab(tab);
    this.runButton = null;
    this.presetSelect = null;
    this.firstInput = null;
    this.secondInput = null;
    this.modeSelect = null;
    this.repeatsInput = null;
    this.repeatsError = null;
    this.pairError = null;
    this.presetDescription = null;
    this.firstField = null;
    this.secondField = null;
    this.busy = false;
    this.repeatsValid = true;
    this.fieldsRoot.innerHTML = '';

    if (tab === 'report') {
      return;
    }

    const presets = presetsForTab(tab);
    const presetOptions = presets
      .map(
        (preset) =>
          `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.label)}</option>`
      )
      .join('');

    if (tab === 'f1') {
      this.fieldsRoot.innerHTML = `
        <div class="flex flex-col gap-1">
          <label class="${LABEL_CLASS}" for="sb-preset">Ejemplo</label>
          <select id="sb-preset" class="${SELECT_CLASS}">${presetOptions}</select>
          <p id="sb-preset-desc" class="text-[11px] leading-snug text-md-on-surface-variant"></p>
        </div>
        ${this.sequenceFieldMarkup({
          id: 'sb-first',
          label: 'Secuencia (1 a 8 símbolos)',
          value: 'A T G C U'
        })}
        <div class="flex flex-col gap-1">
          <label class="${LABEL_CLASS}" for="sb-repeats">Repeticiones del benchmark (1 a 50)</label>
          <input id="sb-repeats" type="number" min="1" max="50" step="1" value="5" class="${INPUT_CLASS}" aria-describedby="sb-repeats-error" />
          <p id="sb-repeats-error" role="alert" class="hidden text-[10px] font-semibold text-md-error"></p>
        </div>
        <button id="sb-run" type="button" class="mt-1 rounded-lg bg-md-primary px-4 py-2.5 text-sm font-bold text-md-on-primary shadow-sm transition hover:brightness-110 disabled:opacity-50">
          Generar benchmark
        </button>
      `;
    } else {
      const modeOptions =
        tab === 'f2'
          ? `
            <option value="optimal">Óptimo (A*)</option>
            <option value="greedy">Voraz</option>
          `
          : `
            <option value="optimal">Óptimo (A* / breakpoints)</option>
            <option value="greedy">Voraz</option>
          `;
      const runLabel =
        tab === 'f2'
          ? 'Resolver sin dirección'
          : tab === 'f3'
            ? 'Resolver con dirección'
            : 'Comparar F2 vs F3';
      const hint =
        tab === 'f3' || tab === 'f4'
          ? 'Escribe de corrido: +A-T+G-C (el signo indica la orientación).'
          : 'Escribe de corrido: GATC (los signos +/- se ignoran en esta función).';
      this.fieldsRoot.innerHTML = `
        <div class="flex flex-col gap-1">
          <label class="${LABEL_CLASS}" for="sb-preset">Ejemplo</label>
          <select id="sb-preset" class="${SELECT_CLASS}">${presetOptions}</select>
          <p id="sb-preset-desc" class="text-[11px] leading-snug text-md-on-surface-variant"></p>
        </div>
        ${this.sequenceFieldMarkup({
          id: 'sb-first',
          label: 'Secuencia inicial (máx. 10)',
          value: '',
          hint
        })}
        ${this.sequenceFieldMarkup({
          id: 'sb-second',
          label: 'Secuencia objetivo (máx. 10)',
          value: '',
          hint
        })}
        <p id="sb-pair-error" role="alert" class="hidden text-[10px] font-semibold text-md-error"></p>
        <div class="flex flex-col gap-1">
          <label class="${LABEL_CLASS}" for="sb-mode">Estrategia</label>
          <select id="sb-mode" class="${SELECT_CLASS}">${modeOptions}</select>
        </div>
        <button id="sb-run" type="button" class="mt-1 rounded-lg bg-md-primary px-4 py-2.5 text-sm font-bold text-md-on-primary shadow-sm transition hover:brightness-110 disabled:opacity-50">
          ${runLabel}
        </button>
      `;
    }

    this.presetSelect = this.fieldsRoot.querySelector<HTMLSelectElement>('#sb-preset');
    this.firstInput = this.fieldsRoot.querySelector<HTMLInputElement>('#sb-first');
    this.secondInput = this.fieldsRoot.querySelector<HTMLInputElement>('#sb-second');
    this.modeSelect = this.fieldsRoot.querySelector<HTMLSelectElement>('#sb-mode');
    this.repeatsInput = this.fieldsRoot.querySelector<HTMLInputElement>('#sb-repeats');
    this.repeatsError = this.fieldsRoot.querySelector<HTMLElement>(
      '#sb-repeats-error'
    );
    this.pairError = this.fieldsRoot.querySelector<HTMLElement>(
      '#sb-pair-error'
    );
    this.presetDescription = this.fieldsRoot.querySelector<HTMLParagraphElement>(
      '#sb-preset-desc'
    );
    this.runButton = this.fieldsRoot.querySelector<HTMLButtonElement>('#sb-run');
    this.firstField = this.wireSequenceField('sb-first');
    this.secondField = this.wireSequenceField('sb-second');

    this.runButton?.addEventListener('click', () => {
      this.refreshFields();
      this.refreshRepeatsField();
      this.handlers.onRun();
    });
    this.repeatsInput?.addEventListener('input', () =>
      this.refreshRepeatsField()
    );
    this.presetSelect?.addEventListener('change', () => {
      const selected = presets.find(
        (preset) => preset.id === this.presetSelect?.value
      );
      if (selected !== undefined) {
        this.applyPreset(selected);
        this.handlers.onPreset(selected);
      }
    });

    const initialPreset = presets[0];
    if (initialPreset !== undefined) {
      this.applyPreset(initialPreset);
    }
    this.refreshRepeatsField();
    this.refreshPairError();
  }

  private sequenceFieldMarkup(options: {
    id: string;
    label: string;
    value: string;
    hint?: string;
  }): string {
    const { id, label, value } = options;
    const hint = options.hint ?? SEQUENCE_HINT;
    return `
      <div class="flex flex-col gap-1">
        <label class="${LABEL_CLASS}" for="${id}">${escapeHtml(label)}</label>
        <input
          id="${id}"
          class="${INPUT_CLASS}"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          value="${escapeHtml(value)}"
        />
        <div id="${id}-chips" class="flex min-h-[24px] flex-wrap items-center gap-1"></div>
        <div class="flex items-start justify-between gap-2">
          <span id="${id}-hint" class="text-[10px] leading-snug text-md-on-surface-variant/70">${escapeHtml(hint)}</span>
          <span id="${id}-count" class="shrink-0 font-mono text-[10px] font-semibold text-md-on-surface-variant"></span>
        </div>
        <p id="${id}-error" role="alert" class="hidden text-[10px] font-semibold text-md-error"></p>
      </div>
    `;
  }

  private wireSequenceField(id: string): SequenceField | null {
    const input = this.fieldsRoot.querySelector<HTMLInputElement>(`#${id}`);
    const chips = this.fieldsRoot.querySelector<HTMLElement>(`#${id}-chips`);
    const counter = this.fieldsRoot.querySelector<HTMLElement>(`#${id}-count`);
    const error = this.fieldsRoot.querySelector<HTMLElement>(`#${id}-error`);
    if (input === null || chips === null || counter === null || error === null) {
      return null;
    }
    const field: SequenceField = { input, chips, counter, error };
    input.addEventListener('input', () => {
      this.refreshSequenceField(field);
      this.refreshPairError();
    });
    return field;
  }

  private refreshFields(): void {
    if (this.firstField !== null) {
      this.refreshSequenceField(this.firstField);
    }
    if (this.secondField !== null) {
      this.refreshSequenceField(this.secondField);
    }
    this.refreshPairError();
  }

  private refreshSequenceField(field: SequenceField): void {
    const parsed = parseSequence(field.input.value);
    this.renderChips(field.chips, parsed.tokens);
    const count = parsed.tokens.length;
    field.counter.textContent = `${count} ${count === 1 ? 'elemento' : 'elementos'}`;
    const message = validateSequenceField(parsed, this.tab);
    field.error.textContent = message ?? '';
    field.error.classList.toggle('hidden', message === null);
    field.input.setAttribute('aria-invalid', message !== null ? 'true' : 'false');
  }

  private refreshPairError(): void {
    if (
      this.pairError === null ||
      this.tab === 'f1' ||
      this.firstInput === null ||
      this.secondInput === null
    ) {
      if (this.pairError !== null) {
        this.pairError.textContent = '';
        this.pairError.classList.add('hidden');
      }
      return;
    }
    const first = parseSequence(this.firstInput.value);
    const second = parseSequence(this.secondInput.value);
    const fieldError =
      validateSequenceField(first, this.tab) ??
      validateSequenceField(second, this.tab);
    const message =
      fieldError !== null ? null : validateReversalPair(first, second);
    this.pairError.textContent = message ?? '';
    this.pairError.classList.toggle('hidden', message === null);
  }

  private refreshRepeatsField(): void {
    if (this.repeatsInput === null || this.repeatsError === null) {
      return;
    }
    const message = validateRepeatsField(this.repeatsInput.value);
    this.repeatsValid = message === null;
    this.repeatsError.textContent = message ?? '';
    this.repeatsError.classList.toggle('hidden', message === null);
    this.repeatsInput.setAttribute(
      'aria-invalid',
      message !== null ? 'true' : 'false'
    );
    this.syncRunButtonState();
  }

  private syncRunButtonState(): void {
    if (this.runButton === null) {
      return;
    }
    this.runButton.disabled = this.busy || !this.repeatsValid;
  }

  private renderChips(container: HTMLElement, tokens: SequenceToken[]): void {
    if (tokens.length === 0) {
      container.innerHTML =
        '<span class="text-[10px] italic text-md-on-surface-variant/60">Sin elementos</span>';
      return;
    }
    container.innerHTML = tokens.map((token) => this.chipMarkup(token)).join('');
  }

  private chipMarkup(token: SequenceToken): string {
    const tone =
      token.sign < 0
        ? 'border-md-strand-minus/40 bg-md-strand-minus-container text-md-strand-minus'
        : 'border-md-outline-variant bg-md-surface-container-high text-md-on-surface';
    return `<span class="inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${tone}">${escapeHtml(token.raw)}</span>`;
  }

  applyPreset(preset: Preset): void {
    if (this.presetSelect !== null) {
      this.presetSelect.value = preset.id;
    }
    if (this.presetDescription !== null) {
      this.presetDescription.textContent = preset.description;
    }
    if (this.firstInput !== null) {
      this.firstInput.value = preset.initial;
    }
    if (this.secondInput !== null) {
      this.secondInput.value = preset.target;
    }
    if (this.modeSelect !== null) {
      this.modeSelect.value = preset.mode;
    }
    if (this.repeatsInput !== null) {
      this.repeatsInput.value = String(preset.repeats);
    }
    this.refreshFields();
    this.refreshRepeatsField();
  }

  /** Error actual del campo de repeticiones; `null` si es válido o no aplica. */
  getRepeatsError(): string | null {
    if (this.repeatsInput === null) {
      return null;
    }
    return validateRepeatsField(this.repeatsInput.value);
  }

  getValues(): SidebarValues {
    const modeValue =
      this.modeSelect !== null ? this.modeSelect.value : 'optimal';
    const mode: SolverMode = modeValue === 'greedy' ? 'greedy' : 'optimal';
    const repeatsValue =
      this.repeatsInput !== null ? Number(this.repeatsInput.value) : 5;
    return {
      first: this.firstInput?.value ?? '',
      second: this.secondInput?.value ?? '',
      mode,
      repeats: repeatsValue
    };
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    if (this.runButton === null) {
      return;
    }
    this.syncRunButtonState();
    if (busy) {
      this.runButton.dataset['idleLabel'] = this.runButton.textContent ?? '';
      this.runButton.textContent = 'Calculando…';
    } else {
      const idle = this.runButton.dataset['idleLabel'];
      if (idle !== undefined) {
        this.runButton.textContent = idle;
      }
    }
  }
}
