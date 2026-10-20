/** Iconos SVG inline (estilo Lucide) para la barra lateral. */

export type IconName =
  | 'permutations'
  | 'reversal-undo'
  | 'reversal-directed'
  | 'parallel'
  | 'report'
  | 'panel';

const ICON_CLASS = 'h-5 w-5 shrink-0';

const PATHS: Record<IconName, string> = {
  permutations:
    '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
  'reversal-undo':
    '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  'reversal-directed':
    '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  parallel:
    '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>',
  report:
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  panel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>'
};

/** Devuelve el marcado SVG del icono indicado, heredando el color actual. */
export function icon(name: IconName): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${ICON_CLASS}" aria-hidden="true">${PATHS[name]}</svg>`;
}
