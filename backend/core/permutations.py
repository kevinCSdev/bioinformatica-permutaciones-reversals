"""Función 1 — Generación y optimización de permutaciones.

Este módulo reúne seis variantes para enumerar permutaciones de una secuencia
biológica (nucleótidos o aminoácidos) y un arnés de medición que separa de
forma estricta la medición de TIEMPO de la medición de MEMORIA.

Restricción del enunciado: la interfaz y la API solo exponen el NÚMERO TOTAL
de permutaciones encontradas (``count``), nunca la lista completa de
permutaciones. Por eso todas las variantes cuentan "al vuelo" y no acumulan
resultados en memoria, salvo ``itertools_set_unique`` que se incluye
deliberadamente como línea base para evidenciar su costo de memoria.
"""

from __future__ import annotations

import gc
import itertools
import math
import timeit
import tracemalloc
from collections import Counter
from typing import Any, Callable, Sequence


# 1. Backtracking recursivo clásico (intercambio in-place + restauración)
def recursive_backtracking(seq: Sequence[Any]) -> int:
    """Cuenta las permutaciones posicionales con backtracking recursivo.

    Se intercambia cada elemento de la posición ``k`` con los siguientes y se
    restaura el estado al volver (backtrack). Genera exactamente ``n!``
    resultados para elementos distintos; con símbolos repetidos sigue contando
    ``n!`` porque el algoritmo trabaja por POSICIÓN, no por valor.
    """
    data = list(seq)
    n = len(data)
    count = 0

    def backtrack(k: int) -> None:
        nonlocal count
        if k == n:
            count += 1
            return
        for i in range(k, n):
            data[k], data[i] = data[i], data[k]
            backtrack(k + 1)
            data[k], data[i] = data[i], data[k]

    backtrack(0)
    return count


# 2. Biblioteca estándar: itertools.permutations (generador nativo en C)
def itertools_permutations(seq: Sequence[Any]) -> int:
    """Consume el iterador en C de ``itertools.permutations`` sin materializar.

    Se usa un generador para contar sin almacenar las permutaciones en RAM,
    aislando así la velocidad del motor C de la biblioteca estándar.
    """
    return sum(1 for _ in itertools.permutations(seq))


# 3. Algoritmo de Heap iterativo (sin pila de recursión)
def iterative_heap(seq: Sequence[Any]) -> int:
    """Cuenta permutaciones con el algoritmo de Heap no recursivo.

    Usa un vector de control ``c`` de tamaño ``N`` (O(N) enteros) en lugar de
    los marcos de pila que consume la versión recursiva. Para ``N`` pequeño la
    diferencia de memoria es marginal, pero elimina el riesgo de desbordar la
    pila de recursión en ``N`` grandes.
    """
    data = list(seq)
    n = len(data)
    if n == 0:
        return 1
    c = [0] * n
    count = 1
    i = 0
    while i < n:
        if c[i] < i:
            if i % 2 == 0:
                data[0], data[i] = data[i], data[0]
            else:
                data[c[i]], data[i] = data[i], data[c[i]]
            count += 1
            c[i] += 1
            i = 0
        else:
            c[i] = 0
            i += 1
    return count


# 4a. Poda de idénticos con backtracking por nivel
def unique_backtracking(seq: Sequence[Any]) -> int:
    """Permutaciones ÚNICAS de un multiconjunto podando durante la generación.

    En cada nivel recursivo se mantiene un conjunto ``seen`` con los símbolos ya
    usados en esa posición; intercambiar dos símbolos iguales produciría una
    rama idéntica, por lo que se descarta antes de recurrir. Así se obtiene el
    coeficiente multinomial ``n! / (k1!·k2!···km!)`` sin generar duplicados.
    """
    data = list(seq)
    n = len(data)
    count = 0

    def backtrack(k: int) -> None:
        nonlocal count
        if k == n:
            count += 1
            return
        seen: set[Any] = set()
        for i in range(k, n):
            if data[i] in seen:
                continue
            seen.add(data[i])
            data[k], data[i] = data[i], data[k]
            backtrack(k + 1)
            data[k], data[i] = data[i], data[k]

    backtrack(0)
    return count


# 4b. Narayana / siguiente permutación iterativo lexicográfico (O(1) auxiliar)
def unique_narayana(seq: Sequence[Any]) -> int:
    """Permutaciones únicas con el algoritmo de Narayana in-place.

    Se ordena una copia y se aplica iterativamente "siguiente permutación"
    (variante iterativa del algoritmo de Narayana): al ordenar y avanzar en
    orden lexicográfico, los duplicados se saltan de forma natural. No usa
    pila de recursión ni conjuntos auxiliares: O(1) de memoria adicional.
    """
    data = sorted(seq)
    n = len(data)
    if n == 0:
        return 1
    count = 1
    while True:
        # i = mayor índice con data[i] < data[i+1]
        i = n - 2
        while i >= 0 and data[i] >= data[i + 1]:
            i -= 1
        if i < 0:
            break
        # j = mayor índice con data[j] > data[i]
        j = n - 1
        while data[j] <= data[i]:
            j -= 1
        data[i], data[j] = data[j], data[i]
        data[i + 1:] = reversed(data[i + 1:])
        count += 1
    return count


# 4c. Línea base: filtrar duplicados a posteriori con un set
def itertools_set_unique(seq: Sequence[Any]) -> int:
    """Cuenta únicas con ``len(set(itertools.permutations(seq)))``.

    Es la línea base "ingenua": genera TODAS las permutaciones posicionales y
    luego descarta duplicados al construir un conjunto. Se mantiene en memoria
    el conjunto completo, lo que evidencia el costo de filtrar a posteriori
    frente a podar durante la generación.
    """
    return len(set(itertools.permutations(seq)))


# Registro de variantes con su ficha descriptiva (usada también por la UI)
Variant = dict[str, Any]

VARIANTS: list[Variant] = [
    {
        "key": "recursive_backtracking",
        "name": "Backtracking recursivo",
        "group": "distinct",
        "fn": recursive_backtracking,
        "description": "Intercambio in-place con restauración; pila de recursión O(N).",
    },
    {
        "key": "itertools_permutations",
        "name": "itertools.permutations",
        "group": "distinct",
        "fn": itertools_permutations,
        "description": "Generador nativo en C; se consume sin materializar listas.",
    },
    {
        "key": "iterative_heap",
        "name": "Heap iterativo",
        "group": "distinct",
        "fn": iterative_heap,
        "description": "Sin pila de recursión; vector de control O(N).",
    },
    {
        "key": "unique_backtracking",
        "name": "Backtracking podado (multiconjunto)",
        "group": "multiset",
        "fn": unique_backtracking,
        "description": "Poda por nivel con conjunto 'seen'; único por símbolo y posición.",
    },
    {
        "key": "unique_narayana",
        "name": "Narayana lexicográfico in-place",
        "group": "multiset",
        "fn": unique_narayana,
        "description": "Siguiente permutación iterativa; O(1) de memoria auxiliar.",
    },
    {
        "key": "itertools_set_unique",
        "name": "itertools + set (línea base)",
        "group": "multiset",
        "fn": itertools_set_unique,
        "description": "Genera todo y filtra duplicados a posteriori; O(N!) en memoria.",
    },
]


def expected_count(seq: Sequence[Any]) -> int:
    """Cuenta teórica esperada: n! posicional o multinomial si hay repetidos."""
    n = len(seq)
    total = math.factorial(n)
    multiplicities = Counter(seq)
    if max(multiplicities.values(), default=1) > 1:
        for k in multiplicities.values():
            total //= math.factorial(k)
    return total


def _median(values: list[float]) -> float:
    ordered = sorted(values)
    m = len(ordered)
    if m == 0:
        return 0.0
    mid = m // 2
    if m % 2 == 1:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2.0


def run_permutation_benchmark(
    seq: Sequence[Any], repeats: int = 5
) -> dict[str, Any]:
    """Ejecuta el benchmark de las seis variantes.

    Protocolo de medición riguroso y SIN interferencia:

    1. El TIEMPO se mide con ``timeit.repeat`` en ráfagas independientes con el
       recolector de basura pausado durante cada ráfaga; se reporta la mediana
       y el mínimo en microsegundos y milisegundos.
    2. La MEMORIA se mide en una corrida SEPARADA con ``tracemalloc`` porque su
       instrumentación introduce sobrecosto de tiempo; se reporta el pico de
       bytes alojados.

    Devuelve únicamente el conteo de permutaciones y las métricas por variante.
    """
    sequence = list(seq)
    n = len(sequence)
    has_duplicates = len(set(sequence)) != len(sequence)
    repeats = max(1, min(int(repeats), 50))

    variants_out: list[dict[str, Any]] = []
    for variant in VARIANTS:
        fn: Callable[[Sequence[Any]], int] = variant["fn"]

        # --- Medición de tiempo en ráfaga con gc pausado ---
        def burst() -> int:
            return fn(sequence)

        gc_was_enabled = gc.isenabled()
        gc.disable()
        try:
            samples = timeit.repeat(burst, repeat=repeats, number=1)
        finally:
            if gc_was_enabled:
                gc.enable()

        median_s = _median(samples)
        min_s = min(samples)

        # --- Medición de memoria en corrida separada ---
        gc.collect()
        tracemalloc.start()
        count = fn(sequence)
        _current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        variants_out.append(
            {
                "key": variant["key"],
                "name": variant["name"],
                "group": variant["group"],
                "description": variant["description"],
                "count": count,
                "medianUs": median_s * 1_000_000.0,
                "minUs": min_s * 1_000_000.0,
                "medianMs": median_s * 1_000.0,
                "peakBytes": int(peak),
                "peakKb": peak / 1024.0,
            }
        )

    # Factor de aceleración relativo a itertools.permutations (línea base de tiempo)
    baseline = next(
        (v for v in variants_out if v["key"] == "itertools_permutations"), None
    )
    if baseline and baseline["medianUs"] > 0:
        for v in variants_out:
            v["relativeToItertools"] = v["medianUs"] / baseline["medianUs"]
    else:
        for v in variants_out:
            v["relativeToItertools"] = 1.0

    return {
        "sequence": sequence,
        "length": n,
        "repeats": repeats,
        "hasDuplicates": has_duplicates,
        "positionalCount": math.factorial(n),
        "uniqueCount": expected_count(sequence),
        "baselineKey": "itertools_permutations",
        "variants": variants_out,
    }
