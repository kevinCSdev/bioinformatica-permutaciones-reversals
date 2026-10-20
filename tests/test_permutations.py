"""Pruebas de la Función 1: conteo factorial y multinomial de permutaciones."""

from __future__ import annotations

import math

import pytest

from backend.core.permutations import (
    VARIANTS,
    expected_count,
    itertools_permutations,
    itertools_set_unique,
    iterative_heap,
    recursive_backtracking,
    run_permutation_benchmark,
    unique_backtracking,
    unique_narayana,
)

DISTINCT = ["A", "T", "G", "C", "A"][:4]  # ATGC (4 símbolos distintos)
DISTINCT5 = ["A", "T", "G", "C", "U"]
DUPLICATED = list("AATGG")


def test_factorial_count_distinct_five():
    """5 elementos distintos => 5! = 120 en todas las variantes posicionales."""
    assert recursive_backtracking(DISTINCT5) == 120
    assert itertools_permutations(DISTINCT5) == 120
    assert iterative_heap(DISTINCT5) == 120
    assert 120 == math.factorial(5)


def test_multinomial_count_with_duplicates():
    """'AATGG' => 5! / (2!·2!·1!) = 30 permutaciones únicas."""
    assert unique_backtracking(DUPLICATED) == 30
    assert unique_narayana(DUPLICATED) == 30
    assert itertools_set_unique(DUPLICATED) == 30
    assert expected_count(DUPLICATED) == 30


def test_positional_count_ignores_duplicates():
    """Las variantes posicionales siguen devolviendo n! aunque haya repetidos."""
    assert recursive_backtracking(DUPLICATED) == 120
    assert itertools_permutations(DUPLICATED) == 120
    assert iterative_heap(DUPLICATED) == 120


def test_expected_count_formula_matches_all_multiset_variants():
    for seq in [list("AATTGG"), list("AAABBB"), list("ABCABC")]:
        expected = expected_count(seq)
        assert unique_backtracking(seq) == expected
        assert unique_narayana(seq) == expected
        assert itertools_set_unique(seq) == expected


def test_edge_cases_empty_and_single():
    assert recursive_backtracking([]) == 1
    assert itertools_permutations([]) == 1
    assert iterative_heap([]) == 1
    assert unique_narayana([]) == 1
    assert unique_backtracking(["A"]) == 1
    assert iterative_heap(["A"]) == 1


def test_benchmark_harness_reports_only_counts_and_metrics():
    result = run_permutation_benchmark(DISTINCT5, repeats=3)
    assert result["length"] == 5
    assert result["positionalCount"] == 120
    assert result["uniqueCount"] == 120
    assert result["hasDuplicates"] is False
    assert len(result["variants"]) == len(VARIANTS)
    for variant in result["variants"]:
        assert variant["count"] == 120
        assert variant["medianUs"] >= 0.0
        assert variant["minUs"] >= 0.0
        assert variant["peakBytes"] > 0
        assert variant["relativeToItertools"] > 0.0
        # El enunciado prohíbe devolver la lista de permutaciones
        assert "permutations" not in variant


def test_benchmark_flags_duplicates():
    result = run_permutation_benchmark(DUPLICATED, repeats=3)
    assert result["hasDuplicates"] is True
    multiset = [v for v in result["variants"] if v["group"] == "multiset"]
    for variant in multiset:
        assert variant["count"] == 30
