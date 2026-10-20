/**
 * Punto de entrada del Laboratorio de Permutaciones y Reversals (UBB).
 *
 * Coordina la barra lateral, la navegación por pestañas, el navegador de trazas
 * compartido y las vistas de cada función. Las vistas solo leen el snapshot
 * del navegador; toda la ejecución de algoritmos vive en el backend.
 */

import './style.css';

import { ApiError } from './services/apiClient';
import { StepperState } from './state/StepperState';
import type { ActiveTab, StepperSnapshot } from './types/api';
import type { AlertFn, AlertKind, AppView, ViewInputs } from './types/ui';
import { Sidebar } from './ui/Sidebar';
import { BenchmarkView } from './ui/BenchmarkView';
import { ReversalView } from './ui/ReversalView';
import { ParallelView } from './ui/ParallelView';
import { ReportView } from './ui/ReportView';
import { escapeHtml, statusClasses, statusLabel } from './ui/dom';
import {
  parseSequence,
  validateReversalPair,
  validateSequenceField
} from './services/sequenceInput';
import { icon, type IconName } from './ui/icons';

interface TabConfig {
  id: ActiveTab;
  label: string;
  title: string;
  subtitle: string;
  icon: IconName;
}

const TABS: TabConfig[] = [
  {
    id: 'f1',
    label: 'Función 1 · Permutaciones',
    title: 'Función 1 · Permutaciones',
    subtitle: 'Seis variantes de enumeración y su costo en tiempo y memoria',
    icon: 'permutations'
  },
  {
    id: 'f2',
    label: 'Función 2 · Sin dirección',
    title: 'Función 2 · Reversal sin dirección',
    subtitle: 'Mínimo de giros ignorando la orientación de hebra',
    icon: 'reversal-undo'
  },
  {
    id: 'f3',
    label: 'Función 3 · Con dirección',
    title: 'Función 3 · Reversal con dirección',
    subtitle: 'Reordenamiento guiado por el grafo de breakpoints',
    icon: 'reversal-directed'
  },
  {
    id: 'f4',
    label: 'Función 4 · Paralela',
    title: 'Función 4 · Comparación paralela',
    subtitle: 'F2 vs F3 sobre la misma instancia, sincronizadas',
    icon: 'parallel'
  },
  {
    id: 'report',
    label: 'Informe y análisis',
    title: 'Información y análisis del trabajo',
    subtitle: 'Fundamento biológico, análisis algorítmico y código comentado',
    icon: 'report'
  }
];

const TRACE_TABS: ActiveTab[] = ['f2', 'f3', 'f4'];

function mustGet<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Elemento requerido no encontrado: #${id}`);
  }
  return element as T;
}

const sidebarEl = mustGet<HTMLElement>('sidebar');
const homeEl = mustGet<HTMLElement>('home');
const sidebarToggle = mustGet<HTMLButtonElement>('sidebar-toggle');
const sidebarOpen = mustGet<HTMLButtonElement>('sidebar-open');
const sidebarBackdrop = mustGet<HTMLElement>('sidebar-backdrop');
const navRoot = mustGet<HTMLElement>('sidebar-nav');
const fieldsRoot = mustGet<HTMLElement>('sidebar-fields');
const alertArea = mustGet<HTMLElement>('alert-area');
const viewRoot = mustGet<HTMLElement>('view-root');
const viewTitle = mustGet<HTMLElement>('view-title');
const viewSubtitle = mustGet<HTMLElement>('view-subtitle');
const statusBadge = mustGet<HTMLElement>('playback-status');

const stepper = new StepperState();
let activeTab: ActiveTab = 'f1';
let activeView: AppView | null = null;
let alertTimer: ReturnType<typeof setTimeout> | null = null;

const ALERT_TONES: Record<AlertKind, string> = {
  error: 'border-md-error/30 bg-md-error-container text-md-on-error-container',
  info: 'border-md-outline-variant bg-md-secondary-container text-md-on-secondary-container',
  success: 'border-md-tertiary/30 bg-md-tertiary-container/50 text-md-tertiary'
};

function clearAlert(): void {
  if (alertTimer !== null) {
    clearTimeout(alertTimer);
    alertTimer = null;
  }
  alertArea.innerHTML = '';
}

const setAlert: AlertFn = (message, kind = 'info') => {
  clearAlert();
  alertArea.innerHTML = `
    <div class="rounded-lg border px-4 py-3 text-[13px] ${ALERT_TONES[kind]}">
      ${escapeHtml(message)}
    </div>
  `;
  if (kind !== 'error') {
    alertTimer = setTimeout(clearAlert, 7000);
  }
};

function buildInputs(): ViewInputs | null {
  const values = sidebar.getValues();
  const first = parseSequence(values.first);

  if (activeTab === 'f1') {
    if (sidebar.getRepeatsError() !== null) {
      return null;
    }
    if (validateSequenceField(first, 'f1') !== null) {
      return null;
    }
    return {
      sequence: first.raw,
      initial: first.raw,
      target: [],
      repeats: values.repeats,
      mode: values.mode
    };
  }

  const second = parseSequence(values.second);
  if (validateReversalPair(first, second) !== null) {
    return null;
  }
  return {
    sequence: first.raw,
    initial: first.raw,
    target: second.raw,
    repeats: values.repeats,
    mode: values.mode
  };
}

function createView(tab: ActiveTab): AppView {
  switch (tab) {
    case 'f2':
      return new ReversalView(viewRoot, stepper, false, setAlert);
    case 'f3':
      return new ReversalView(viewRoot, stepper, true, setAlert);
    case 'f4':
      return new ParallelView(viewRoot, stepper, setAlert);
    case 'report':
      return new ReportView(viewRoot, setAlert);
    case 'f1':
    default:
      return new BenchmarkView(viewRoot, setAlert);
  }
}

function updateStatus(snapshot: StepperSnapshot): void {
  statusBadge.textContent = statusLabel(snapshot.status);
  statusBadge.className = `rounded-full px-4 py-1.5 text-xs font-semibold ${statusClasses(snapshot.status)}`;
}

function switchTab(tab: ActiveTab): void {
  activeTab = tab;
  activeView?.destroy();
  activeView = createView(tab);
  sidebar.setTab(tab);

  const config = TABS.find((entry) => entry.id === tab);
  if (config !== undefined) {
    viewTitle.textContent = config.title;
    viewSubtitle.textContent = config.subtitle;
  }
  clearAlert();
  stepper.clear();
}

async function runActive(): Promise<void> {
  if (activeView === null || activeView.run === undefined) {
    setAlert('Esta vista no requiere ejecución.', 'info');
    return;
  }
  const inputs = buildInputs();
  if (inputs === null) {
    return;
  }
  sidebar.setBusy(true);
  try {
    await activeView.run(inputs);
  } catch (cause) {
    setAlert(
      cause instanceof ApiError
        ? cause.message
        : 'Ocurrió un error inesperado al ejecutar la función.',
      'error'
    );
  } finally {
    sidebar.setBusy(false);
  }
}

sidebarToggle.innerHTML = icon('panel');
sidebarOpen.innerHTML = icon('panel');

const mobileQuery = window.matchMedia('(max-width: 767px)');
let desktopCollapsed = false;
let mobileOpen = false;

function syncSidebar(): void {
  const mobile = mobileQuery.matches;
  const open = mobile && mobileOpen;
  const collapsed = !mobile && desktopCollapsed;

  sidebarEl.dataset['state'] = collapsed ? 'collapsed' : 'expanded';
  sidebarEl.dataset['mobileState'] = open ? 'open' : 'closed';
  homeEl.dataset['sidebar'] = collapsed ? 'collapsed' : 'expanded';
  sidebarBackdrop.classList.toggle('is-visible', open);
  document.body.classList.toggle('drawer-open', open);

  sidebarEl.inert = mobile && !open;
  sidebarEl.setAttribute('aria-hidden', String(mobile && !open));
  homeEl.inert = open;

  sidebarToggle.setAttribute('aria-expanded', String(mobile ? open : !collapsed));
  sidebarToggle.title = mobile
    ? open
      ? 'Cerrar panel'
      : 'Abrir panel'
    : collapsed
      ? 'Expandir barra lateral'
      : 'Contraer barra lateral';
  sidebarToggle.setAttribute(
    'aria-label',
    mobile
      ? open
        ? 'Cerrar el panel de configuración'
        : 'Abrir el panel de configuración'
      : collapsed
        ? 'Expandir la barra lateral'
        : 'Contraer la barra lateral'
  );

  sidebarOpen.setAttribute('aria-expanded', String(open));
  sidebarOpen.title = open ? 'Cerrar panel' : 'Abrir panel de configuración';
  sidebarOpen.setAttribute(
    'aria-label',
    open
      ? 'Cerrar el panel de configuración'
      : 'Abrir el panel de configuración'
  );
}

function setMobileOpen(next: boolean, restoreFocus = true): void {
  if (mobileOpen === next) {
    syncSidebar();
    return;
  }
  mobileOpen = next;
  syncSidebar();
  if (next) {
    sidebarEl
      .querySelector<HTMLElement>('button[data-tab], input, select, button')
      ?.focus();
  } else if (restoreFocus) {
    sidebarOpen.focus();
  }
}

function toggleSidebar(): void {
  if (mobileQuery.matches) {
    setMobileOpen(!mobileOpen);
    return;
  }
  desktopCollapsed = !desktopCollapsed;
  syncSidebar();
}

const sidebar = new Sidebar(navRoot, fieldsRoot, TABS, {
  onRun: () => {
    void runActive();
  },
  onPreset: () => {
    // El preset ya se aplicó en la Sidebar; el usuario decide cuándo ejecutar.
  },
  onSelectTab: (tab: ActiveTab) => {
    if (mobileQuery.matches) {
      setMobileOpen(false, false);
    }
    switchTab(tab);
  }
});

stepper.subscribe((snapshot, event) => {
  activeView?.render(snapshot, event);
  updateStatus(snapshot);
});

sidebarToggle.addEventListener('click', toggleSidebar);
sidebarOpen.addEventListener('click', () => setMobileOpen(!mobileOpen));
sidebarBackdrop.addEventListener('click', () => setMobileOpen(false));
mobileQuery.addEventListener('change', () => {
  mobileOpen = false;
  syncSidebar();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && mobileOpen) {
    event.preventDefault();
    setMobileOpen(false);
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
    event.preventDefault();
    toggleSidebar();
    return;
  }
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'BUTTON' ||
      target.isContentEditable)
  ) {
    return;
  }
  if (!TRACE_TABS.includes(activeTab)) {
    return;
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    stepper.stepForward();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    stepper.stepBackward();
  }
});

switchTab('f1');
updateStatus(stepper.getSnapshot());
syncSidebar();
