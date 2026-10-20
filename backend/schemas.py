"""Contratos Pydantic de la API (espejo 1:1 de ``frontend/src/types/api.ts``).

Se usan nombres en camelCase de forma explícita para garantizar que el JSON
serializado coincida exactamente con las interfaces TypeScript del frontend.
"""

from __future__ import annotations

from typing import Literal, Union

from pydantic import BaseModel, Field, field_validator

Sign = Literal[1, -1]
SolverMode = Literal["optimal", "greedy"]


# Utilidades de normalización de entrada
def sequence_to_tokens(value: Union[str, list[str], list[int]]) -> list[str]:
    """Convierte una cadena o lista en una lista de tokens de texto.

    Acepta ``"ATGCA"``, ``"A T G C A"``, ``" +A -T +G "`` o ``[1, 2, 3]``.
    """
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return []
        parts = stripped.split()
        if len(parts) == 1 and len(stripped) > 1 and not any(
            ch in stripped for ch in "+- "
        ):
            return list(stripped)
        return parts
    return [str(item).strip() for item in value]


# Función 1 - Benchmark de permutaciones
class PermutationBenchmarkRequest(BaseModel):
    sequence: Union[list[str], str] = Field(
        default="ATGCU", description="Secuencia biológica de hasta 8 símbolos."
    )
    repeats: int = Field(default=5, ge=1, le=50)

    @field_validator("sequence")
    @classmethod
    def _normalize_sequence(cls, value: Union[list[str], str]) -> list[str]:
        tokens = sequence_to_tokens(value)
        if not 1 <= len(tokens) <= 8:
            raise ValueError(
                "La Función 1 admite entre 1 y 8 símbolos (para evitar bloqueos de la interfaz)."
            )
        return tokens


class BenchmarkVariant(BaseModel):
    key: str
    name: str
    group: Literal["distinct", "multiset"]
    description: str
    count: int
    medianUs: float
    minUs: float
    medianMs: float
    peakBytes: int
    peakKb: float
    relativeToItertools: float


class BenchmarkResponse(BaseModel):
    sequence: list[str]
    length: int
    repeats: int
    hasDuplicates: bool
    positionalCount: int
    uniqueCount: int
    baselineKey: str
    variants: list[BenchmarkVariant]


# Funciones 2, 3 y 4 - Reversals
class ReversalRequest(BaseModel):
    initial: Union[list[str], str]
    target: Union[list[str], str]
    mode: SolverMode = "optimal"

    @field_validator("initial", "target")
    @classmethod
    def _normalize_sequence(cls, value: Union[list[str], str]) -> list[str]:
        tokens = sequence_to_tokens(value)
        if not 1 <= len(tokens) <= 10:
            raise ValueError(
                "Las Funciones 2, 3 y 4 admiten entre 1 y 10 bloques distintos."
            )
        return tokens


class GeneToken(BaseModel):
    symbol: str
    sign: Sign


class ReversalStep(BaseModel):
    stepIndex: int
    reversalSpan: tuple[int, int] | None
    before: list[GeneToken]
    after: list[GeneToken]
    breakpointsRemaining: int
    description: str


class ReversalResult(BaseModel):
    directed: bool
    mode: SolverMode
    exact: bool
    initial: list[GeneToken]
    target: list[GeneToken]
    totalSteps: int
    steps: list[ReversalStep]
    executionTimeMs: float
    exploredStates: int


class ParallelComparisonResult(BaseModel):
    unsigned: ReversalResult
    signed: ReversalResult
    unsignedPhysicalSteps: list[list[GeneToken]]
    orientationMismatchInUnsigned: int
    deltaSteps: int
    deltaTimeMs: float
    deltaExploredStates: int
    verdict: str


# Visor de código fuente
class SourceFile(BaseModel):
    key: str
    name: str
    language: str
    code: str


class SourceCodeResponse(BaseModel):
    files: list[SourceFile]
