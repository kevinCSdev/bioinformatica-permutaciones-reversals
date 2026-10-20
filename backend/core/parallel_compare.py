"""Función 4 — Presentación paralela de la Función 2 y la Función 3.

Se ejecuta la MISMA instancia biológica bajo dos modelos:

* **Sin dirección (F2):** ignora los signos para decidir sus pasos, pero el
  backend rastrea el efecto físico real de cada giro sobre la hebra de ADN
  (invertir un segmento también invierte la orientación de sus bloques).
* **Con dirección (F3):** respeta y corrige tanto la posición como el signo
  de cada bloque.

El resultado expone las dos trazas completas y las métricas diferenciales.
"""

from __future__ import annotations

from typing import Any, Sequence

from backend.core.reversal_signed import solve_signed
from backend.core.reversal_unsigned import parse_sequence, solve_unsigned


def _tokens(pairs: Sequence[tuple[str, int]]) -> list[dict[str, Any]]:
    return [{"symbol": symbol, "sign": sign} for symbol, sign in pairs]


def _apply_physical_reversal(
    pairs: Sequence[tuple[str, int]], i: int, j: int
) -> list[tuple[str, int]]:
    """Aplica el giro físico: invierte el orden y cambia el signo del tramo."""
    out = list(pairs)
    out[i : j + 1] = [(symbol, -sign) for symbol, sign in reversed(out[i : j + 1])]
    return out


def compare_unsigned_vs_signed(
    initial: Sequence[Any], target: Sequence[Any], mode: str = "optimal"
) -> dict[str, Any]:
    """Ejecuta F2 y F3 sobre la misma instancia y calcula las diferencias."""
    unsigned = solve_unsigned(initial, target, mode)
    signed = solve_signed(initial, target, mode)

    # Efecto FÍSICO real de los giros elegidos por F2 sobre la hebra.
    init_pairs = parse_sequence(initial)
    target_pairs = parse_sequence(target)
    physical = list(init_pairs)
    physical_steps: list[list[dict[str, Any]]] = [_tokens(physical)]
    for step in unsigned["steps"][1:]:
        span = step["reversalSpan"]
        assert span is not None
        i, j = span
        physical = _apply_physical_reversal(physical, i, j)
        physical_steps.append(_tokens(physical))

    # Si solo se usara F2, ¿cuántos bloques quedan con la hebra invertida?
    orientation_mismatch = sum(
        1
        for (symbol_a, sign_a), (symbol_b, sign_b) in zip(physical, target_pairs)
        if symbol_a == symbol_b and sign_a != sign_b
    )

    delta_steps = signed["totalSteps"] - unsigned["totalSteps"]
    delta_time = signed["executionTimeMs"] - unsigned["executionTimeMs"]
    delta_explored = signed["exploredStates"] - unsigned["exploredStates"]

    if orientation_mismatch == 0:
        verdict = (
            "Los giros sin dirección coinciden con la orientación objetivo: no hay "
            "bloques con la hebra invertida."
        )
    else:
        verdict = (
            f"Al ignorar la dirección quedan {orientation_mismatch} bloque(s) con la "
            "hebra invertida respecto al objetivo; F3 debe corregirlos."
        )

    return {
        "unsigned": unsigned,
        "signed": signed,
        "unsignedPhysicalSteps": physical_steps,
        "orientationMismatchInUnsigned": orientation_mismatch,
        "deltaSteps": delta_steps,
        "deltaTimeMs": delta_time,
        "deltaExploredStates": delta_explored,
        "verdict": verdict,
    }
