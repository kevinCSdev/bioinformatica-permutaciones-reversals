"""Función 3 — Reordenamiento por reversal CON dirección (+/-).

Un bloque génico con signo ``+A``/``-A`` representa la hebra sentido o
antisentido. La operación ``ρ_signed(i, j)`` invierte el orden del segmento
``S[i..j]`` Y multiplica por ``-1`` el signo de cada elemento incluido.

Para evitar la explosión del BFS ciego en ``N=10`` (millones de estados) se
construye el GRAFO DE PUNTOS DE RUPTURA (breakpoint graph) sobre los extremos
tail/head de cada gen y se cuenta el número de ciclos alternantes ``c(π)``.
Con ello se usa la cota inferior admisible de Bafna–Pevzner ``h(π) = (n+1) - c``
para guiar A*.
"""

from __future__ import annotations

import heapq
import math
from time import perf_counter
from typing import Any, Sequence

from backend.core.reversal_unsigned import normalize_signed, parse_sequence

TIME_BUDGET_S = 2.0


# Operador con signo y puntos de ruptura
def apply_signed_reversal(perm: Sequence[int], i: int, j: int) -> list[int]:
    """Invierte ``perm[i..j]`` y cambia el signo de cada elemento del tramo."""
    out = list(perm)
    out[i : j + 1] = [-x for x in reversed(out[i : j + 1])]
    return out


def count_signed_breakpoints(perm: Sequence[int]) -> int:
    """Cuenta breakpoints con signo, usando los centinelas ``0`` y ``n+1``.

    Dos elementos consecutivos forman una adyacencia conservada cuando
    ``π_{i+1} - π_i == 1`` (esto describe ``i·(i+1)`` y también ``-(i+1)·-i``).
    Cualquier otro par consecutivo es un punto de ruptura.
    """
    n = len(perm)
    extended = [0, *perm, n + 1]
    breakpoints = 0
    for a, b in zip(extended, extended[1:]):
        if b - a != 1:
            breakpoints += 1
    return breakpoints


# Grafo de puntos de ruptura y conteo de ciclos c(π)
def count_cycles(perm: Sequence[int]) -> int:
    """Cuenta los ciclos alternantes del grafo de puntos de ruptura ``BG(π)``.

    Vértices (enteros): ``t(g) = 2g - 1`` y ``h(g) = 2g`` para cada gen, más
    ``0^h = 0`` y ``(n+1)^t = 2n+1``. Las aristas de REALIDAD conectan los
    extremos consecutivos de la permutación actual; las de DESEO emparejan
    ``h(i)`` con ``t(i+1)``, que en esta codificación es simplemente ``v ^ 1``.
    La unión de ambos matchings perfectos es un grafo 2-regular; sus ciclos se
    recorren alternando realidad y deseo.
    """
    n = len(perm)
    total_vertices = 2 * n + 2
    reality = [-1] * total_vertices

    def add_reality(a: int, b: int) -> None:
        reality[a] = b
        reality[b] = a

    def head(gene: int) -> int:
        return 2 * gene

    def tail(gene: int) -> int:
        return 2 * gene - 1

    def left(gene: int) -> int:
        return tail(abs(gene)) if gene > 0 else head(abs(gene))

    def right(gene: int) -> int:
        return head(abs(gene)) if gene > 0 else tail(abs(gene))

    add_reality(head(0), left(perm[0]))
    for k in range(n - 1):
        add_reality(right(perm[k]), left(perm[k + 1]))
    add_reality(right(perm[n - 1]), tail(n + 1))

    visited = [False] * total_vertices
    cycles = 0
    for start in range(total_vertices):
        if visited[start]:
            continue
        cycles += 1
        current = start
        while not visited[current]:
            visited[current] = True
            via_reality = reality[current]
            visited[via_reality] = True
            # Deseo: h(i) = 2i se empareja con t(i+1) = 2i+1.
            current = via_reality ^ 1
    return cycles


def cycle_lower_bound(perm: Sequence[int]) -> int:
    """Cota inferior admisible de Bafna–Pevzner: ``(n + 1) - c(π)``."""
    return (len(perm) + 1) - count_cycles(perm)


# Solver óptimo - A* guiado por el grafo de puntos de ruptura
def _reconstruct(
    parent: dict[
        tuple[int, ...], tuple[tuple[int, ...] | None, tuple[int, int] | None]
    ],
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


def solve_signed_optimal(
    perm: Sequence[int], time_budget_s: float = TIME_BUDGET_S
) -> tuple[list[tuple[int, ...]], list[tuple[int, int]], int] | None:
    """A* con ``h(π) = (n+1) - c(π)``. Devuelve ``None`` si excede el presupuesto."""
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
            cached = cycle_lower_bound(state)
            h_cache[state] = cached
        return cached

    open_heap: list[tuple[int, int, int, int, tuple[int, ...]]] = [
        (heuristic(start), 0, 0, 0, start)
    ]
    best_g: dict[tuple[int, ...], int] = {start: 0}
    parent: dict[
        tuple[int, ...], tuple[tuple[int, ...] | None, tuple[int, int] | None]
    ] = {start: (None, None)}
    counter = 1
    explored = 0

    while open_heap:
        _f, _neg_g, _counter, g, state = heapq.heappop(open_heap)
        if g != best_g.get(state):
            continue
        if state == goal:
            states, spans = _reconstruct(parent, goal)
            return states, spans, explored
        explored += 1

        for i in range(n):
            for j in range(i, n):
                neighbor = state[:i] + tuple(-x for x in reversed(state[i : j + 1])) + state[j + 1 :]
                ng = g + 1
                if ng < best_g.get(neighbor, math.inf):
                    best_g[neighbor] = ng
                    parent[neighbor] = (state, (i, j))
                    heapq.heappush(
                        open_heap,
                        (ng + heuristic(neighbor), -ng, counter, ng, neighbor),
                    )
                    counter += 1

        if perf_counter() - start_time > time_budget_s:
            return None

    return None


# Solver voraz - maximiza el número de ciclos del grafo de puntos de ruptura
def solve_signed_greedy(
    perm: Sequence[int], time_budget_s: float = TIME_BUDGET_S
) -> tuple[list[tuple[int, ...]], list[tuple[int, int]], int]:
    """Voraz por pares orientados: prioriza crear/split ciclos (reduce breakpoints)."""
    n = len(perm)
    state = tuple(perm)
    goal = tuple(range(1, n + 1))
    states: list[tuple[int, ...]] = [state]
    spans: list[tuple[int, int]] = []
    visited = {state}
    explored = 1
    guard = 0
    deadline = perf_counter() + time_budget_s

    while state != goal and guard < 4 * n * n and perf_counter() < deadline:
        guard += 1
        current_cycles = count_cycles(state)
        current_bp = count_signed_breakpoints(state)
        moves: list[tuple[int, int, int, int, tuple[int, ...]]] = []
        for i in range(n):
            for j in range(i, n):
                neighbor = (
                    state[:i] + tuple(-x for x in reversed(state[i : j + 1])) + state[j + 1 :]
                )
                moves.append(
                    (
                        count_cycles(neighbor),
                        count_signed_breakpoints(neighbor),
                        i,
                        j,
                        neighbor,
                    )
                )

        improving = [
            m for m in moves if m[0] > current_cycles and m[4] not in visited
        ]
        if not improving:
            improving = [m for m in moves if m[1] < current_bp and m[4] not in visited]
        if not improving:
            escapes = [m for m in moves if m[4] not in visited]
            if not escapes:
                break
            escapes.sort(key=lambda m: (-m[0], m[1], m[3] - m[2]))
            _c, _bp, i, j, neighbor = escapes[0]
        else:
            improving.sort(key=lambda m: (-m[0], m[1], m[3] - m[2]))
            _c, _bp, i, j, neighbor = improving[0]

        state = neighbor
        spans.append((i, j))
        states.append(state)
        visited.add(state)
        explored += 1

    if state != goal:
        tail = solve_signed_optimal(state, time_budget_s=max(0.5, time_budget_s))
        if tail is not None:
            tail_states, tail_spans, tail_explored = tail
            explored += tail_explored
            for k in range(1, len(tail_states)):
                states.append(tail_states[k])
                spans.append(tail_spans[k - 1])

    return states, spans, explored


# Construcción del resultado con traza detallada
def _tokens_from_signed(values: Sequence[int], symbols: Sequence[str]) -> list[dict[str, Any]]:
    return [
        {"symbol": symbols[abs(v) - 1], "sign": 1 if v > 0 else -1} for v in values
    ]


def _build_steps(
    states: Sequence[tuple[int, ...]],
    spans: Sequence[tuple[int, int]],
    symbols: Sequence[str],
) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = []
    for k, values in enumerate(states):
        span: list[int] | None = None
        before: list[dict[str, Any]] = []
        description = "Estado inicial (con orientación de hebra)."
        if k > 0:
            i, j = spans[k - 1]
            span = [i, j]
            before = _tokens_from_signed(states[k - 1], symbols)
            gi = symbols[abs(values[i]) - 1]
            gj = symbols[abs(values[j]) - 1]
            if i == j:
                description = (
                    f"Reversal ρ({i}, {i}): se invierte el sentido de la hebra del "
                    f"bloque {gi}."
                )
            else:
                description = (
                    f"Reversal ρ({i}, {j}): se invierte el orden y el sentido de "
                    f"las hebras desde {gi} hasta {gj}."
                )
        steps.append(
            {
                "stepIndex": k,
                "reversalSpan": span,
                "before": before,
                "after": _tokens_from_signed(values, symbols),
                "breakpointsRemaining": count_signed_breakpoints(values),
                "description": description,
            }
        )
    return steps


def solve_signed(
    initial: Sequence[Any], target: Sequence[Any], mode: str = "optimal"
) -> dict[str, Any]:
    """Resuelve la Función 3 y devuelve el ``ReversalResult`` serializable."""
    t0 = perf_counter()
    perm, symbols = normalize_signed(initial, target)
    exact = True

    if mode == "greedy":
        states, spans, explored = solve_signed_greedy(perm)
        exact = False
    else:
        result = solve_signed_optimal(perm)
        if result is None:
            states, spans, explored = solve_signed_greedy(perm)
            exact = False
        else:
            states, spans, explored = result

    elapsed_ms = (perf_counter() - t0) * 1000.0
    steps = _build_steps(states, spans, symbols)
    init_tokens = parse_sequence(initial)
    target_tokens = parse_sequence(target)

    return {
        "directed": True,
        "mode": mode if mode in ("optimal", "greedy") else "optimal",
        "exact": exact,
        "initial": [{"symbol": s, "sign": sg} for s, sg in init_tokens],
        "target": [{"symbol": s, "sign": sg} for s, sg in target_tokens],
        "totalSteps": len(states) - 1,
        "steps": steps,
        "executionTimeMs": elapsed_ms,
        "exploredStates": explored,
    }
