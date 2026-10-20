/**
 * Informe integrado — ficha, marco biológico, análisis algorítmico y visor de
 * código Python real servido por el backend (`/api/source-code`).
 */

import { fetchSourceCode } from '../services/apiClient';
import type {
  SourceFile,
  StepperEvent,
  StepperSnapshot
} from '../types/api';
import type { AlertFn, AppView } from '../types/ui';
import { escapeHtml } from './dom';

const COMPLEXITY_ROWS: Array<[string, string, string, string]> = [
  [
    'Backtracking recursivo',
    'O(n!)',
    'O(n) pila',
    'Intercambio in-place con restauración.'
  ],
  [
    'itertools.permutations',
    'O(n!)',
    'O(n) buffer',
    'Generador nativo en C; línea base de tiempo.'
  ],
  [
    'Heap iterativo',
    'O(n!)',
    'O(n) vector',
    'Sin pila de recursión ni desbordamiento.'
  ],
  [
    'Backtracking podado',
    'O(n! / ∏ kᵢ!)',
    'O(n) pila',
    'Poda por nivel para multiconjuntos.'
  ],
  [
    'Narayana in-place',
    'O(n! / ∏ kᵢ!)',
    'O(1) auxiliar',
    'Siguiente permutación ordenada, sin duplicados.'
  ],
  [
    'itertools + set (base)',
    'O(n!) tiempo',
    'O(n! · n)',
    'Genera todo y filtra a posteriori.'
  ]
];

function section(title: string, body: string): string {
  return `
    <section class="rounded-xl bg-md-surface-bright p-4 shadow-sm sm:p-5">
      <h2 class="mb-3 text-lg font-bold text-md-on-surface">${escapeHtml(title)}</h2>
      <div class="space-y-3 text-[13px] leading-relaxed text-md-on-surface-variant">${body}</div>
    </section>
  `;
}

function bulletList(items: string[]): string {
  return `<ul class="list-disc space-y-1 pl-5">${items
    .map((item) => `<li>${item}</li>`)
    .join('')}</ul>`;
}

export class ReportView implements AppView {
  private files: SourceFile[] = [];
  private activeKey: string | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly setAlert: AlertFn
  ) {
    this.container.innerHTML = `
      <div class="space-y-4">
        ${section(
          'Ficha técnica y objetivos del laboratorio',
          `
          <p><strong>Universidad:</strong> Universidad del Bío-Bío · <strong>Asignatura:</strong> Bioinformática.</p>
          <p>Este laboratorio aborda dos problemas computacionales centrales en genómica comparativa: la enumeración de combinatorias de secuencias y el cálculo de distancias de reordenamiento cromosómico mediante inversiones (reversals). El propósito consiste en modelar formalmente las transformaciones estructurales del ADN, evaluando el costo en tiempo de cómputo y consumo de memoria que imponen los algoritmos exactos frente a las aproximaciones heurísticas.</p>
          <p>La arquitectura del sistema divide el trabajo en dos capas desacopladas. El backend en <em>FastAPI</em> implementa los motores algorítmicos en Python, resuelve las instancias y retorna trazas completas con cada paso intermedio. El frontend en <em>TypeScript y Tailwind CSS</em> opera como un visualizador de estados; navega de manera determinista la traza generada sin recalcular operaciones en el cliente web.</p>
          <p><strong>Uso del sistema:</strong> selecciona una función en la barra lateral superior, carga una secuencia de prueba predefinida o ingresa una personalizada, presiona ejecutar y utiliza la línea de tiempo (o las teclas <kbd>←</kbd>, <kbd>→</kbd>) para inspeccionar las transiciones paso a paso.</p>
          `
        )}
        ${section(
          'Marco biológico: de la estructura genómica al modelo computacional',
          `
          <p>Los genomas no son cadenas abstractas de texto; se organizan físicamente en cromosomas donde el orden de los genes condiciona la expresión celular y la viabilidad del organismo. Cuando comparamos genomas de especies que divergieron de un ancestro común, no se analizan nucleótidos individuales; se identifican <strong>bloques sinténicos</strong>, que corresponden a segmentos cromosómicos conservados donde los mismos conjuntos de genes coexisten en un orden específico. Cada bloque sinténico se etiqueta con un identificador y un signo (+ o −), indicando si su transcripción ocurre en la hebra sentido o antisentido del ADN.</p>
          <p>A diferencia de las mutaciones puntuales que alteran bases individuales, los reordenamientos a gran escala reorganizan fragmentos cromosómicos completos. La <strong>inversión cromosómica (reversal)</strong> ocurre cuando se producen dos rupturas de doble hebra en un cromosoma; el segmento intermedio rota 180 grados en el espacio celular y los mecanismos celulares de reparación vuelven a ligar los extremos. Este evento altera el orden relativo de los bloques y, a nivel biofísico, invierte la orientación de lectura respecto a la ARN polimerasa.</p>
          <p>En términos evolutivos, la <strong>distancia de reversión</strong> mide el número mínimo de inversiones necesarias para transformar la disposición cromosómica de una especie en la de otra. Bajo el principio de parsimonia evolutiva, la trayectoria con menor cantidad de eventos representa la hipótesis biológica más probable. Esta métrica permite inferir la arquitectura de genomas ancestrales y cuantificar la tasa de divergencia estructural entre linajes evolutivos.</p>
          `
        )}
        ${section(
          'Función 1 · Generación y optimización de permutaciones',
          `
          <p>La Función 1 estudia el problema de generar y enumerar todas las disposiciones posibles de una secuencia biológica. Con n elementos únicos, el número de configuraciones totales equivale a n factorial. No obstante, en secuencias biológicas reales existen nucleótidos o residuos repetidos; en tales multiconjuntos, permutar dos elementos idénticos produce configuraciones indistinguibles. La cantidad real de secuencias únicas corresponde al coeficiente multinomial n! dividido por el producto de los factoriales de las frecuencias de cada símbolo.</p>
          <p>Se comparan seis variantes para evaluar la relación de costo temporal y uso de memoria:</p>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[36rem] text-left text-[12px]">
              <thead>
                <tr class="border-b border-md-outline-variant/60 text-md-on-surface-variant">
                  <th class="py-2 pr-3 font-semibold">Variante</th>
                  <th class="py-2 pr-3 font-semibold">Tiempo</th>
                  <th class="py-2 pr-3 font-semibold">Memoria</th>
                  <th class="py-2 font-semibold">Observación</th>
                </tr>
              </thead>
              <tbody>
                ${COMPLEXITY_ROWS.map(
                  ([name, time, memory, note]) => `
                    <tr class="border-b border-md-outline-variant/30">
                      <td class="py-2 pr-3 font-semibold text-md-on-surface">${escapeHtml(name)}</td>
                      <td class="py-2 pr-3 font-mono text-md-on-surface-variant">${escapeHtml(time)}</td>
                      <td class="py-2 pr-3 font-mono text-md-on-surface-variant">${escapeHtml(memory)}</td>
                      <td class="py-2 text-md-on-surface-variant">${escapeHtml(note)}</td>
                    </tr>
                  `
                ).join('')}
              </tbody>
            </table>
          </div>
          ${bulletList([
            '<strong>Backtracking recursivo:</strong> intercambia elementos directamente en memoria mediante permutaciones posicionales y llamadas recursivas. Su consumo de memoria se mantiene en O(n) por la profundidad de la pila de llamadas, pero genera siempre n! estados independientemente de las repeticiones.',
            '<strong>itertools.permutations:</strong> aprovecha el generador en C de la biblioteca estándar de Python. Ofrece la menor sobrecarga de ejecución temporal, consumiéndose al vuelo sin instanciar arreglos intermedios.',
            '<strong>Algoritmo de Heap iterativo:</strong> produce permutaciones mediante intercambios sistemáticos gobernados por un vector auxiliar de conteo. Al suprimir la recursión, elimina el riesgo de desborde de pila en secuencias extensas.',
            '<strong>Backtracking podado por nivel:</strong> descarta ramas redundantes al verificar en cada nivel los símbolos previamente utilizados. Calcula exactamente el conteo del coeficiente multinomial sin generar duplicados.',
            '<strong>Algoritmo de Narayana:</strong> reordena la secuencia inicial y avanza hacia la siguiente permutación lexicográfica modificando el arreglo original. Opera con O(1) de memoria adicional y salta duplicados por diseño.',
            '<strong>Filtrado con conjunto (línea base):</strong> constituye la referencia ingenua; materializa la totalidad de las tuplas en memoria y aplica un conjunto para descartar repeticiones. Su consumo de memoria escala en O(n! · n), demostrando el costo excesivo de no filtrar durante la generación.'
          ])}
          <p>Para evitar la saturación del navegador web, la interfaz gráfica limita el tamaño de entrada a 8 símbolos y expone únicamente el conteo numérico total, sin transferir listas masivas de resultados.</p>
          `
        )}
        ${section(
          'Función 2 · Reordenamiento por reversal sin dirección (Unsigned)',
          `
          <p>La Función 2 calcula la distancia de inversión en el modelo clásico sin dirección, donde se ignora la polaridad de las hebras y solo interesa el orden posicional de los marcadores. La operación básica invierte un segmento continuo invirtiendo el orden de sus elementos.</p>
          <p>Para estructurar el problema matemáticamente, la secuencia se normaliza añadiendo centinelas: 0 al inicio y n+1 al extremo final. Dos elementos contiguos constituyen una adyacencia conservada si la diferencia absoluta entre sus valores equivale a 1. Si dicha diferencia es distinta de 1, se identifica un <strong>punto de ruptura (breakpoint)</strong>. Una permutación ordenada posee cero breakpoints. Dado que una inversión modifica únicamente las uniones de sus dos extremos, un giro puede reducir a lo sumo dos puntos de ruptura.</p>
          ${bulletList([
            '<strong>Modo óptimo mediante A*:</strong> emplea la heurística admisible h = ⌈b / 2⌉, donde b representa los puntos de ruptura actuales. Debido a que h jamás sobreestima el costo real y cumple la condición de consistencia, el algoritmo garantiza hallar el camino con la menor cantidad de inversiones.',
            '<strong>Modo voraz:</strong> evalúa las posibles inversiones en cada iteración y aplica aquella que maximice la eliminación inmediata de breakpoints. Aunque su velocidad es mayor, suele estancarse en mesetas donde ninguna inversión disminuye rupturas, requiriendo maniobras neutras que degradan la optimalidad.'
          ])}
          <p>Caprara demostró en 1997 que encontrar la distancia de reversión sin dirección es un problema <strong>NP-hard</strong>. Debido al crecimiento del espacio de estados, el backend impone un límite de tiempo de 3.0 segundos; de sobrepasarse, retorna la mejor solución encontrada rotulándola como aproximada.</p>
          `
        )}
        ${section(
          'Función 3 · Reordenamiento por reversal con dirección (Signed)',
          `
          <p>La Función 3 incorpora los signos (+ y −) que representan la orientación biológica de cada gen en la doble hélice. Al ejecutarse un reversal sobre un intervalo, no solo se invierte el orden de los elementos; se multiplica además por −1 el signo de cada gen contenido en dicho tramo. El estado objetivo exige alcanzar la permutación ordenada con todos los signos positivos.</p>
          <p>El análisis se fundamenta en el <strong>grafo de puntos de ruptura BG(π)</strong>. Cada gen g se descompone en dos vértices: cola t(g) = 2g − 1 y cabeza h(g) = 2g, complementados por los centinelas 0 y n+1. El grafo combina dos familias de conexiones:</p>
          ${bulletList([
            '<strong>Aristas de realidad:</strong> vinculan los vértices que se encuentran físicamente continuos en la disposición genómica actual.',
            '<strong>Aristas de deseo:</strong> unen los vértices que deberían ser adyacentes en el genoma ordenado de referencia.'
          ])}
          <p>La superposición de ambos sistemas de aristas conforma un grafo regular donde cada nodo posee grado 2. Dicho grafo se descompone de forma unívoca en <strong>ciclos alternantes</strong>. El genoma objetivo contiene exactamente n+1 ciclos independientes. Cada inversión dirigida incrementa la cantidad de ciclos a lo más en 1. Con este principio, Bafna y Pevzner formularon la cota inferior admisible h = (n+1) − c(π), donde c(π) corresponde al conteo de ciclos alternantes.</p>
          <p>A pesar de incorporar mayor información, el cálculo de reversiones con dirección pertenece a la clase de complejidad polinomial <strong>P</strong>. Hannenhalli y Pevzner formularon la resolución exacta mediante la descomposición de componentes orientados junto al análisis de obstáculos y fortalezas. En este sistema, la orientación de los genes elimina las ambigüedades combinatorias del modelo sin signo, acotando el espacio de transiciones válidas.</p>
          `
        )}
        ${section(
          'Función 4 · Comparación paralela y divergencia biofísica',
          `
          <p>La Función 4 realiza la evaluación simultánea de la Función 2 y la Función 3 sobre una idéntica secuencia de entrada y destino. Esta comparación permite evidenciar las deficiencias de ignorar la orientación génica frente a eventos moleculares verídicos.</p>
          <p>Al procesar la secuencia con el algoritmo sin dirección, el sistema calcula de fondo el efecto físico concreto que cada inversión induce sobre la doble hebra. Al alcanzar el orden numérico final, el analizador verifica si los signos efectivos concuerdan con la secuencia objetivo. Si se detectan discrepancias, se constata que la solución puramente matemática dejó genes invertidos respecto a su polaridad biológica.</p>
          <p>El panel expone la discrepancia entre ambos enfoques a través de tres indicadores: la diferencia en pasos totales, el tiempo de procesamiento y la cantidad de nodos explorados en el árbol de búsqueda. La modalidad dirigida requiere comúnmente pasos adicionales para reorientar bloques aislados, pero la heurística basada en ciclos alternantes aporta mayor selectividad algorítmica durante la exploración del grafo.</p>
          `
        )}
        <section class="rounded-xl bg-md-surface-bright p-4 shadow-sm sm:p-5">
          <h2 class="mb-1 text-lg font-bold text-md-on-surface">Visor de código comentado</h2>
          <p class="mb-3 text-[12px] text-md-on-surface-variant">Código Python real de los motores usados por cada función.</p>
          <div id="report-code-tabs" class="mb-3 flex flex-wrap gap-2"></div>
          <div id="report-code-body" class="rounded-lg bg-md-inverse-surface p-3">
            <p class="text-[12px] text-md-inverse-on-surface/80">Cargando código…</p>
          </div>
        </section>
      </div>
    `;
    void this.loadSource();
  }

  render(_snapshot: StepperSnapshot, _event: StepperEvent): void {
    // El informe es estático y no participa del reproductor.
  }

  destroy(): void {
    // Sin suscripciones propias.
  }

  private async loadSource(): Promise<void> {
    try {
      const response = await fetchSourceCode();
      this.files = response.files;
      this.activeKey = response.files[0]?.key ?? null;
      this.renderSource();
    } catch {
      this.setAlert(
        'No se pudo cargar el código fuente; el servidor podría estar fuera de línea.',
        'error'
      );
      const body = this.container.querySelector<HTMLDivElement>(
        '#report-code-body'
      );
      if (body !== null) {
        body.innerHTML =
          '<p class="text-[12px] text-md-error-container">Código no disponible (servidor fuera de línea).</p>';
      }
    }
  }

  private renderSource(): void {
    const tabs = this.container.querySelector<HTMLDivElement>('#report-code-tabs');
    const body = this.container.querySelector<HTMLDivElement>('#report-code-body');
    if (tabs === null || body === null) {
      return;
    }

    tabs.innerHTML = this.files
      .map((file) => {
        const active = file.key === this.activeKey;
        const classes = active
          ? 'rounded-md bg-md-primary px-3 py-1.5 text-[12px] font-semibold text-md-on-primary'
          : 'rounded-md border border-md-outline-variant bg-md-surface-bright px-3 py-1.5 text-[12px] font-semibold text-md-on-surface-variant hover:bg-md-surface-container';
        return `<button type="button" data-key="${escapeHtml(file.key)}" class="${classes}">${escapeHtml(file.name)}</button>`;
      })
      .join('');

    tabs
      .querySelectorAll<HTMLButtonElement>('button[data-key]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          this.activeKey = button.dataset['key'] ?? null;
          this.renderSource();
        });
      });

    const active = this.files.find((file) => file.key === this.activeKey);
    if (active === undefined) {
      body.innerHTML =
        '<p class="text-[12px] text-md-inverse-on-surface/80">Sin archivos disponibles.</p>';
      return;
    }
    body.innerHTML = `
      <p class="mb-2 font-mono text-[11px] text-md-inverse-on-surface/60">${escapeHtml(active.name)} · ${escapeHtml(active.language)}</p>
      <pre class="max-h-[32rem] overflow-auto font-mono text-[11.5px] leading-relaxed text-md-inverse-on-surface thin-scroll">${escapeHtml(active.code)}</pre>
    `;
  }
}
