"""Función 2 — Reordenamiento por reversal SIN dirección + normalización común.

Este módulo contiene dos bloques:

1. La NORMALIZACIÓN CANÓNICA compartida (validación + reetiquetado a la
   identidad + centinelas) que también reutiliza la Función 3.
2. El solucionador de ``unsigned reversal distance`` con dos estrategias:
   ``optimal`` (A* con heurística admisible ``⌈b/2⌉``) y ``greedy`` (eliminación
   voraz de puntos de ruptura).

Modelo: la operación ``ρ(i, j)`` invierte el subarreglo ``S[i..j]``.
"""

from __future__ import annotations

import heapq
import math
from time import perf_counter
from typing import Any, Iterable, Sequence

MAX_ITEMS = 10
OPTIMAL_TIME_BUDGET_S = 3.0


# Normalización canónica compartida (Funciones 2, 3 y 4)
def parse_token(raw: Any) -> tuple[str, int]:
    """Convierte ``"+A"`` / ``"-T"`` / ``"A"`` en ``(símbolo, signo)``.

    El signo es ``+1`` (hebra sentido) o ``-1`` (hebra antisentido). Un símbolo
    sin prefijo se interpreta como hebra sentido ``+``.
    """
    text = str(raw).strip()
    if not text:
        raise ValueError("Se encontró un símbolo vacío en la secuencia.")
    if text[0] in "+-":
        sign = -1 if text[0] == "-" else 1
        symbol = text[1:].strip()
        if not symbol:
            raise ValueError(f"El símbolo '{text}' no tiene nombre de gen/bloque.")
        return symbol, sign
    return text, 1


def parse_sequence(seq: Sequence[Any]) -> list[tuple[str, int]]:
    """Parsea una secuencia (lista o cadena) a una lista de ``(símbolo, signo)``."""
    if isinstance(seq, str):
        raw_items: Iterable[Any] = seq.split()
        if len(seq.split()) == 1 and len(seq) > 1 and not any(c in seq for c in "+- "):
            raw_items = list(seq)
    else:
        raw_items = list(seq)
    return [parse_token(item) for item in raw_items]


def _validate_common(initial: list[tuple[str, int]], target: list[tuple[str, int]]) -> int:
    """Valida las restricciones de las Funciones 2, 3 y 4."""
    if not initial or not target:
        raise ValueError("Debes ingresar una secuencia inicial y una objetivo.")
    if len(initial) != len(target):
        raise ValueError(
            "La secuencia inicial y la objetivo deben tener la misma cantidad de bloques "
            f"(recibidas {len(initial)} y {len(target)})."
        )
    n = len(initial)
    if n > MAX_ITEMS:
        raise ValueError(
            f"El modelo de reordenamiento por inversiones admite a lo sumo {MAX_ITEMS} "
            f"bloques distintos (recibidos {n})."
        )
    init_symbols = [s for s, _ in initial]
    target_symbols = [s for s, _ in target]
    if len(set(init_symbols)) != n:
        raise ValueError(
            "El reversal sin/con dirección se define sobre marcadores sinténicos únicos: "
            "retira los símbolos repetidos de la secuencia inicial (la poda de repetidos "
            "corresponde a la Función 1)."
        )
    if len(set(target_symbols)) != n:
        raise ValueError(
            "La secuencia objetivo contiene símbolos repetidos; se exigen bloques únicos."
        )
    if set(init_symbols) != set(target_symbols):
        missing = sorted(set(target_symbols) - set(init_symbols))
        extra = sorted(set(init_symbols) - set(target_symbols))
        detail = []
        if missing:
            detail.append(f"faltan {missing} en la inicial")
        if extra:
            detail.append(f"sobran {extra} en la inicial")
        raise ValueError(
            "Ambas secuencias deben contener exactamente el mismo conjunto de bloques "
            f"({' y '.join(detail)})."
        )
    return n


def normalize_unsigned(
    initial: Sequence[Any], target: Sequence[Any]
) -> tuple[list[int], list[str]]:
    """Reetiqueta a identidad relativa a ``target`` e ignora los signos.

    Devuelve ``(perm, symbols)`` donde ``perm`` es la secuencia inicial expresada
    como valores ``1..n`` relativos al objetivo y ``symbols`` permite traducir
    cada valor de vuelta al símbolo original (``symbols[v-1]``).
    """
    init_tokens = parse_sequence(initial)
    target_tokens = parse_sequence(target)
    n = _validate_common(init_tokens, target_tokens)

    order = {symbol: idx + 1 for idx, (symbol, _sign) in enumerate(target_tokens)}
    perm = [order[symbol] for symbol, _sign in init_tokens]
    symbols = [symbol for symbol, _sign in target_tokens]
    if len(set(perm)) != n:
        raise ValueError("No fue posible construir una permutación biunívoca.")
    return perm, symbols


def normalize_signed(
    initial: Sequence[Any], target: Sequence[Any]
) -> tuple[list[int], list[str]]:
    """Reetiqueta a identidad ``+1..+n`` conservando la orientación relativa.

    Para cada símbolo se toma su posición y su signo en la secuencia objetivo
    como referencia canónica; el signo efectivo de cada bloque inicial es el
    producto de su signo con el signo objetivo. Así, cuando la inicial coincide
    con la objetivo, la permutación resultante es exactamente ``(+1, ..., +n)``.
    """
    init_tokens = parse_sequence(initial)
    target_tokens = parse_sequence(target)
    _validate_common(init_tokens, target_tokens)

    magnitude: dict[str, int] = {}
    base_sign: dict[str, int] = {}
    symbols: list[str] = []
    for idx, (symbol, sign) in enumerate(target_tokens):
        magnitude[symbol] = idx + 1
        base_sign[symbol] = sign
        symbols.append(symbol)

    perm = [
        magnitude[symbol] * (sign * base_sign[symbol]) for symbol, sign in init_tokens
    ]
    return perm, symbols


# Operador y conteo de puntos de ruptura (sin dirección)
def apply_unsigned_reversal(perm: Sequence[int], i: int, j: int) -> list[int]:
    """Invierte el subarreglo ``perm[i..j]`` (índices 0-based, inclusivos)."""
    out = list(perm)
    out[i : j + 1] = reversed(out[i : j + 1])
    return out


def count_unsigned_breakpoints(perm: Sequence[int]) -> int:
    """Cuenta puntos de ruptura de ``perm`` con los centinelas 0 y n+1.

    Una adyacencia es "buena" cuando dos elementos consecutivos difieren en
    exactamente 1 en valor absoluto; el resto son puntos de ruptura. Se añaden
    los centinelas ``0`` (inicio) y ``n+1`` (final) para contabilizar también
    los extremos.
    """
    n = len(perm)
    extended = [0, *perm, n + 1]
    breakpoints = 0
    for a, b in zip(extended, extended[1:]):
        if abs(a - b) != 1:
            breakpoints += 1
    return breakpoints


def _heuristic(perm: Sequence[int]) -> int:
    """Cota inferior admisible: cada reversal elimina a lo más 2 breakpoints."""
    return math.ceil(count_unsigned_breakpoints(perm) / 2)


# Solver óptimo - A*
def _reconstruct(
    parent: dict[tuple[int, ...], tuple[tuple[int, ...] | None, tuple[int, int] | None]],
    goal: tuple[int, ...],
) -> tuple[list[tuple[int, ...]], list[tuple[int, int]]]:
    states: list[tuple[int, ...]] = []
    spans: list[tuple[int, int]] = []
    cur: tuple[int, ...] | None = goal
    while cur is not None:
        states.append(cur)
        prev, span = parent[cur]
        if prev is None:
            break
        assert span is not None
        spans.append(span)
        cur = prev
    states.reverse()
    spans.reverse()
    return states, spans


def solve_unsigned_optimal(
    perm: Sequence[int], time_budget_s: float = OPTIMAL_TIME_BUDGET_S
) -> tuple[list[tuple[int, ...]], list[tuple[int, int]], int] | None:
    """A* con heurística ``⌈b(π)/2⌉``. Devuelve estados, spans y estados explorados.

    Retorna ``None`` si excede el presupuesto de tiempo (fallback en el llamador).
    """
    n = len(perm)
    start = tuple(perm)
    goal = tuple(range(1, n + 1))
    if start == goal:
        return [start], [], 0

    start_time = perf_counter()
    h_cache: dict[tuple[int, ...], int] = {}

    def heuristic(state: tuple[int, ...]) -> int:
        cached = h_cache.get(state)
        if cached is None:
            cached = _heuristic(state)
            h_cache[state] = cached
        return cached

    best_g: dict[tuple[int, ...], int] = {start: 0}
    parent: dict[
        tuple[int, ...], tuple[tuple[int, ...] | None, tuple[int, int] | None]
    ] = {start: (None, None)}
    # Desempate por mayor g (más profundo) para reducir expansiones con f igual.
    heap: list[tuple[int, int, int, int, tuple[int, ...]]] = [
        (heuristic(start), 0, 0, 0, start)
    ]
    counter = 1
    explored = 0

    while heap:
        _f, _neg_g, _counter, g, state = heapq.heappop(heap)
        if g != best_g.get(state):
            continue
        if state == goal:
            states, spans = _reconstruct(parent, goal)
            return states, spans, explored
        explored += 1

        for i in range(n):
            for j in range(i + 1, n):
                neighbor = state[:i] + state[i : j + 1][::-1] + state[j + 1 :]
                ng = g + 1
                if ng < best_g.get(neighbor, math.inf):
                    best_g[neighbor] = ng
                    parent[neighbor] = (state, (i, j))
                    heapq.heappush(
                        heap, (ng + heuristic(neighbor), -ng, counter, ng, neighbor)
                    )
                    counter += 1

        if perf_counter() - start_time > time_budget_s:
            return None

    return None


# Solver voraz - máxima eliminación de breakpoints
def solve_unsigned_greedy(
    perm: Sequence[int],
) -> tuple[list[tuple[int, ...]], list[tuple[int, int]], int]:
    """Elimina en cada paso la mayor cantidad de puntos de ruptura.

    Si ningún movimiento reduce los breakpoints (barrera de las tiras), se
    selecciona el movimiento no visitado de menor costo para escapar; si se
    agotan las alternativas se completa el resto con el solver óptimo para
    garantizar la llegada al objetivo.
    """
    n = len(perm)
    state = tuple(perm)
    goal = tuple(range(1, n + 1))
    states: list[tuple[int, ...]] = [state]
    spans: list[tuple[int, int]] = []
    visited = {state}
    explored = 1
    guard = 0

    while state != goal and guard < 4 * n * n:
        guard += 1
        current_b = count_unsigned_breakpoints(state)
        moves: list[tuple[int, int, int, tuple[int, ...]]] = []
        for i in range(n):
            for j in range(i + 1, n):
                neighbor = state[:i] + state[i : j + 1][::-1] + state[j + 1 :]
                moves.append((count_unsigned_breakpoints(neighbor), i, j, neighbor))

        improving = [m for m in moves if m[0] < current_b and m[3] not in visited]
        if improving:
            improving.sort(key=lambda m: (m[0], m[2] - m[1]))
            _b, i, j, neighbor = improving[0]
        else:
            escapes = [m for m in moves if m[3] not in visited]
            if not escapes:
                break
            escapes.sort(key=lambda m: (m[0], m[2] - m[1]))
            _b, i, j, neighbor = escapes[0]

        state = neighbor
        spans.append((i, j))
        states.append(state)
        visited.add(state)
        explored += 1

    if state != goal:
        tail = solve_unsigned_optimal(state)
        if tail is not None:
            tail_states, tail_spans, tail_explored = tail
            explored += tail_explored
            for k in range(1, len(tail_states)):
                states.append(tail_states[k])
                spans.append(tail_spans[k - 1])

    return states, spans, explored


# Construcción del resultado con traza detallada
def _tokens_from_values(values: Sequence[int], symbols: Sequence[str]) -> list[dict[str, Any]]:
    return [{"symbol": symbols[v - 1], "sign": 1} for v in values]


def _build_steps(
    states: Sequence[tuple[int, ...]],
    spans: Sequence[tuple[int, int]],
    symbols: Sequence[str],
) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = []
    for k, values in enumerate(states):
        span: list[int] | None = None
        before: list[dict[str, Any]] = []
        description = "Estado inicial de la secuencia."
        if k > 0:
            i, j = spans[k - 1]
            span = [i, j]
            before = _tokens_from_values(states[k - 1], symbols)
            gi, gj = symbols[values[i] - 1], symbols[values[j] - 1]
            description = (
                f"Reversal ρ({i}, {j}): se invierte el tramo que hoy va de "
                f"{gi} a {gj}."
            )
        steps.append(
            {
                "stepIndex": k,
                "reversalSpan": span,
                "before": before,
                "after": _tokens_from_values(values, symbols),
                "breakpointsRemaining": count_unsigned_breakpoints(values),
                "description": description,
            }
        )
    return steps


def solve_unsigned(
    initial: Sequence[Any], target: Sequence[Any], mode: str = "optimal"
) -> dict[str, Any]:
    """Resuelve la Función 2 y devuelve el ``ReversalResult`` serializable."""
    t0 = perf_counter()
    perm, symbols = normalize_unsigned(initial, target)
    exact = True

    if mode == "greedy":
        states, spans, explored = solve_unsigned_greedy(perm)
        exact = False
    else:
        result = solve_unsigned_optimal(perm)
        if result is None:
            states, spans, explored = solve_unsigned_greedy(perm)
            exact = False
        else:
            states, spans, explored = result

    elapsed_ms = (perf_counter() - t0) * 1000.0
    steps = _build_steps(states, spans, symbols)
    init_tokens = parse_sequence(initial)
    target_tokens = parse_sequence(target)

    return {
        "directed": False,
        "mode": mode if mode in ("optimal", "greedy") else "optimal",
        "exact": exact,
        "initial": [{"symbol": s, "sign": 1} for s, _ in init_tokens],
        "target": [{"symbol": s, "sign": 1} for s, _ in target_tokens],
        "totalSteps": len(states) - 1,
        "steps": steps,
        "executionTimeMs": elapsed_ms,
        "exploredStates": explored,
    }
