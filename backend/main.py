"""Servidor FastAPI del Laboratorio de Permutaciones y Reversals (UBB).

Expone los endpoints ``/api/*`` y, al final, sirve el bundle compilado de
``frontend/dist`` para que todo el laboratorio funcione con un solo comando.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.core.parallel_compare import compare_unsigned_vs_signed
from backend.core.permutations import run_permutation_benchmark
from backend.core.reversal_signed import solve_signed
from backend.core.reversal_unsigned import solve_unsigned
from backend.schemas import (
    BenchmarkResponse,
    ParallelComparisonResult,
    PermutationBenchmarkRequest,
    ReversalRequest,
    ReversalResult,
    SourceCodeResponse,
    SourceFile,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = PROJECT_ROOT / "frontend" / "dist"
CORE_DIR = Path(__file__).resolve().parent / "core"

app = FastAPI(
    title="Laboratorio de Permutaciones y Reversals",
    description=(
        "API del Laboratorio de Bioinformática UBB: permutaciones, reversal sin "
        "dirección, reversal con dirección y comparación paralela."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _execute(fn: Callable[..., Any], *args: Any) -> Any:
    """Ejecuta un motor de dominio y traduce ``ValueError`` a HTTP 422."""
    try:
        return fn(*args)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/health")
def health() -> dict[str, str]:
    """Sonda de salud usada por la verificación E2E."""
    return {"status": "ok"}


@app.post("/api/permutations/benchmark", response_model=BenchmarkResponse)
def permutation_benchmark(request: PermutationBenchmarkRequest) -> Any:
    """Función 1: benchmark de las seis variantes de generación de permutaciones."""
    return _execute(run_permutation_benchmark, request.sequence, request.repeats)


@app.post("/api/reversal/undirected", response_model=ReversalResult)
def reversal_undirected(request: ReversalRequest) -> Any:
    """Función 2: reversal SIN dirección (los signos se ignoran)."""
    return _execute(solve_unsigned, request.initial, request.target, request.mode)


@app.post("/api/reversal/directed", response_model=ReversalResult)
def reversal_directed(request: ReversalRequest) -> Any:
    """Función 3: reversal CON dirección (+/-) guiado por el grafo de breakpoints."""
    return _execute(solve_signed, request.initial, request.target, request.mode)


@app.post("/api/reversal/parallel", response_model=ParallelComparisonResult)
def reversal_parallel(request: ReversalRequest) -> Any:
    """Función 4: comparación paralela sincronizada F2 vs F3."""
    return _execute(
        compare_unsigned_vs_signed, request.initial, request.target, request.mode
    )


SOURCE_SPECS: list[tuple[str, str, str]] = [
    ("permutations", "Función 1 · permutations.py", "permutations.py"),
    ("reversal_unsigned", "Función 2 · reversal_unsigned.py", "reversal_unsigned.py"),
    ("reversal_signed", "Función 3 · reversal_signed.py", "reversal_signed.py"),
    ("parallel_compare", "Función 4 · parallel_compare.py", "parallel_compare.py"),
]


@app.get("/api/source-code", response_model=SourceCodeResponse)
def source_code() -> SourceCodeResponse:
    """Devuelve el código Python comentado real para el visor educativo."""
    files: list[SourceFile] = []
    for key, name, filename in SOURCE_SPECS:
        path = CORE_DIR / filename
        files.append(
            SourceFile(
                key=key,
                name=name,
                language="python",
                code=path.read_text(encoding="utf-8"),
            )
        )
    return SourceCodeResponse(files=files)


# El montaje estático debe ir AL FINAL para no capturar las rutas /api.
if DIST_DIR.is_dir():
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="static")
