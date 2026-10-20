"""Pruebas de las Funciones 2, 3 y 4: normalización, optimalidad y paralelo."""

from __future__ import annotations

import collections
import itertools

import pytest

from backend.core.parallel_compare import compare_unsigned_vs_signed
from backend.core.reversal_signed import (
    apply_signed_reversal,
    count_cycles,
    count_signed_breakpoints,
    solve_signed,
)
from backend.core.reversal_unsigned import (
    apply_unsigned_reversal,
    count_unsigned_breakpoints,
    normalize_signed,
    normalize_unsigned,
    solve_unsigned,
)


def bfs_distance(start: tuple[int, ...], signed: bool) -> int:
    """Distancia exacta por BFS, usada como oráculo para N pequeño."""
    n = len(start)
    goal = tuple(range(1, n + 1))
    if start == goal:
        return 0
    queue = collections.deque([(start, 0)])
    seen = {start}
    while queue:
        state, depth = queue.popleft()
        for i in range(n):
            for j in range(i if signed else i + 1, n):
                if signed:
                    neighbor = (
                        state[:i]
                        + tuple(-x for x in reversed(state[i : j + 1]))
                        + state[j + 1 :]
                    )
                else:
                    neighbor = state[:i] + state[i : j + 1][::-1] + state[j + 1 :]
                if neighbor in seen:
                    continue
                if neighbor == goal:
                    return depth + 1
                seen.add(neighbor)
                queue.append((neighbor, depth + 1))
    raise AssertionError("estado inalcanzable")


# Normalización y validación
def test_unsigned_normalization_maps_target_to_identity():
    perm, symbols = normalize_unsigned(["C", "A", "T"], ["A", "T", "C"])
    assert perm == [3, 1, 2]
    assert symbols == ["A", "T", "C"]


def test_signed_normalization_preserves_relative_orientation():
    # Objetivo +A +T +C; inicial -A +T -C => valores -1, +2, -3
    perm, _symbols = normalize_signed(["-A", "+T", "-C"], ["+A", "+T", "+C"])
    assert perm == [-1, 2, -3]


def test_normalization_rejects_duplicates():
    with pytest.raises(ValueError, match="únicos|repetidos"):
        normalize_unsigned(["A", "A", "T"], ["A", "T", "G"])


def test_normalization_rejects_different_symbol_sets():
    with pytest.raises(ValueError, match="mismo conjunto"):
        normalize_unsigned(["A", "T", "G"], ["A", "T", "C"])


def test_normalization_rejects_length_mismatch():
    with pytest.raises(ValueError, match="misma cantidad"):
        normalize_unsigned(["A", "T"], ["A", "T", "G"])


def test_normalization_rejects_more_than_ten_items():
    seq = [f"G{i}" for i in range(11)]
    with pytest.raises(ValueError, match="a lo sumo 10"):
        normalize_unsigned(seq, seq)


# Función 2 - Sin dirección
def test_unsigned_breakpoints_and_reversal_operator():
    # [2, 1, 4, 3] con centinelas 0 y 5: (0,2),(1,4),(3,5) son rupturas.
    assert count_unsigned_breakpoints([2, 1, 4, 3]) == 3
    assert apply_unsigned_reversal([1, 2, 3, 4], 1, 2) == [1, 3, 2, 4]
    assert count_unsigned_breakpoints([1, 2, 3, 4]) == 0


def test_unsigned_optimal_matches_bruteforce_for_small_n():
    for n in range(1, 6):
        target = [str(i) for i in range(1, n + 1)]
        for base in itertools.permutations(range(1, n + 1)):
            result = solve_unsigned([str(x) for x in base], target, "optimal")
            assert result["totalSteps"] == bfs_distance(base, signed=False)
            assert result["exact"] is True


def test_unsigned_steps_reach_target():
    initial = ["G", "A", "T", "C"]
    target = ["A", "T", "G", "C"]
    for mode in ("optimal", "greedy"):
        result = solve_unsigned(initial, target, mode)
        current = ["G", "A", "T", "C"]
        for step in result["steps"][1:]:
            i, j = step["reversalSpan"]
            current = apply_unsigned_reversal(current, i, j)
        assert current == target
        assert result["steps"][0]["stepIndex"] == 0
        assert result["steps"][-1]["after"] == [
            {"symbol": s, "sign": 1} for s in target
        ]


# Función 3 - Con dirección
def test_signed_operator_flips_sign_and_order():
    assert apply_signed_reversal([1, -2, 3], 0, 1) == [2, -1, 3]
    assert apply_signed_reversal([1, 2, 3], 1, 1) == [1, -2, 3]


def test_cycle_count_identity_is_n_plus_one():
    for n in range(1, 8):
        assert count_cycles(list(range(1, n + 1))) == n + 1


def test_signed_breakpoints_follow_conserved_adjacency_rule():
    assert count_signed_breakpoints([1, 2, 3, 4]) == 0
    # (-(i+1), -i) es adyacencia conservada: [-2,-1] tiene MENOS rupturas que [-1,-2].
    assert count_signed_breakpoints([-2, -1]) == 2
    assert count_signed_breakpoints([-1, -2]) == 3


def test_signed_optimal_matches_bruteforce_for_all_sign_patterns():
    for n in range(1, 5):
        target = [str(i) for i in range(1, n + 1)]
        for base in itertools.permutations(range(1, n + 1)):
            for mask in range(1 << n):
                signed = [
                    base[k] if not (mask >> k) & 1 else -base[k] for k in range(n)
                ]
                initial = [
                    ("+" if x > 0 else "-") + str(abs(x)) for x in signed
                ]
                result = solve_signed(initial, target, "optimal")
                assert result["totalSteps"] == bfs_distance(
                    tuple(signed), signed=True
                )
                assert result["exact"] is True


def test_signed_steps_reach_target_and_keep_signs():
    initial = ["+A", "-T", "+G", "-C", "+U"]
    target = ["+A", "+T", "+G", "+C", "+U"]
    for mode in ("optimal", "greedy"):
        result = solve_signed(initial, target, mode)
        current = [("A", 1), ("T", -1), ("G", 1), ("C", -1), ("U", 1)]
        for step in result["steps"][1:]:
            i, j = step["reversalSpan"]
            current[i : j + 1] = [
                (symbol, -sign) for symbol, sign in reversed(current[i : j + 1])
            ]
        assert current == [("A", 1), ("T", 1), ("G", 1), ("C", 1), ("U", 1)]
        assert result["steps"][-1]["after"] == [
            {"symbol": s, "sign": 1} for s in ["A", "T", "G", "C", "U"]
        ]


# Función 4 - Comparador paralelo
def test_parallel_detects_orientation_mismatch():
    result = compare_unsigned_vs_signed(
        ["+A", "-B", "+C"], ["+A", "+B", "+C"], "optimal"
    )
    # F2 ignora el signo y ya tiene el orden correcto: 0 pasos.
    assert result["unsigned"]["totalSteps"] == 0
    # F3 necesita invertir el bloque B.
    assert result["signed"]["totalSteps"] == 1
    assert result["deltaSteps"] == 1
    assert result["orientationMismatchInUnsigned"] == 1
    assert len(result["unsignedPhysicalSteps"]) == 1


def test_parallel_physical_trace_matches_final_orientation():
    result = compare_unsigned_vs_signed(
        ["+A", "-B", "+C", "-D"], ["+A", "+B", "+C", "+D"], "optimal"
    )
    physical_final = result["unsignedPhysicalSteps"][-1]
    assert physical_final == [
        {"symbol": "A", "sign": 1},
        {"symbol": "B", "sign": -1},
        {"symbol": "C", "sign": 1},
        {"symbol": "D", "sign": -1},
    ]
    assert result["orientationMismatchInUnsigned"] == 2


def test_parallel_signed_trace_reaches_target():
    result = compare_unsigned_vs_signed(
        ["+G", "-A", "+T", "-C"], ["+A", "+T", "+G", "+C"], "greedy"
    )
    assert result["signed"]["steps"][-1]["after"] == [
        {"symbol": s, "sign": 1} for s in ["A", "T", "G", "C"]
    ]
