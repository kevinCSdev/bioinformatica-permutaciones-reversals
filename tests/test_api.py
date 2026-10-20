"""Pruebas de integración de los endpoints FastAPI."""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_permutation_benchmark_valid():
    response = client.post(
        "/api/permutations/benchmark", json={"sequence": "ATGCU", "repeats": 2}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["length"] == 5
    assert data["positionalCount"] == 120
    assert data["uniqueCount"] == 120
    assert data["hasDuplicates"] is False
    assert len(data["variants"]) == 6
    for variant in data["variants"]:
        assert variant["count"] == 120
        assert variant["medianUs"] >= 0
        assert variant["peakBytes"] > 0


def test_permutation_benchmark_with_duplicates():
    response = client.post(
        "/api/permutations/benchmark", json={"sequence": "AATGG", "repeats": 2}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["hasDuplicates"] is True
    for variant in data["variants"]:
        if variant["group"] == "multiset":
            assert variant["count"] == 30


def test_permutation_benchmark_rejects_too_many_symbols():
    response = client.post(
        "/api/permutations/benchmark", json={"sequence": list("ABCDEFGHI")}
    )
    assert response.status_code == 422


def test_undirected_reversal_valid():
    response = client.post(
        "/api/reversal/undirected",
        json={"initial": ["G", "A", "T", "C"], "target": ["A", "T", "G", "C"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["directed"] is False
    assert data["steps"][0]["stepIndex"] == 0
    assert data["steps"][-1]["after"] == [
        {"symbol": s, "sign": 1} for s in ["A", "T", "G", "C"]
    ]
    assert data["totalSteps"] == len(data["steps"]) - 1


def test_undirected_reversal_rejects_duplicates():
    response = client.post(
        "/api/reversal/undirected",
        json={"initial": ["A", "A", "T"], "target": ["A", "T", "G"]},
    )
    assert response.status_code == 422
    assert "únicos" in response.json()["detail"]


def test_undirected_reversal_rejects_different_sets():
    response = client.post(
        "/api/reversal/undirected",
        json={"initial": ["A", "T", "G"], "target": ["A", "T", "C"]},
    )
    assert response.status_code == 422


def test_directed_reversal_valid():
    response = client.post(
        "/api/reversal/directed",
        json={
            "initial": ["+A", "-T", "+G", "-C"],
            "target": ["+A", "+T", "+G", "+C"],
            "mode": "optimal",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["directed"] is True
    assert data["mode"] == "optimal"
    assert data["steps"][-1]["after"] == [
        {"symbol": s, "sign": 1} for s in ["A", "T", "G", "C"]
    ]


def test_directed_reversal_rejects_invalid_mode():
    response = client.post(
        "/api/reversal/directed",
        json={
            "initial": ["+A", "+B"],
            "target": ["+A", "+B"],
            "mode": "turbo",
        },
    )
    assert response.status_code == 422


def test_parallel_comparison():
    response = client.post(
        "/api/reversal/parallel",
        json={"initial": ["+A", "-B", "+C"], "target": ["+A", "+B", "+C"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["unsigned"]["directed"] is False
    assert data["signed"]["directed"] is True
    assert data["deltaSteps"] == data["signed"]["totalSteps"] - data["unsigned"]["totalSteps"]
    assert data["orientationMismatchInUnsigned"] == 1
    assert len(data["unsignedPhysicalSteps"]) == data["unsigned"]["totalSteps"] + 1


def test_parallel_accepts_string_input():
    response = client.post(
        "/api/reversal/parallel",
        json={"initial": "+A -B +C", "target": "+A +B +C"},
    )
    assert response.status_code == 200


def test_source_code_returns_commented_modules():
    response = client.get("/api/source-code")
    assert response.status_code == 200
    data = response.json()
    assert len(data["files"]) >= 3
    keys = {item["key"] for item in data["files"]}
    assert {"permutations", "reversal_unsigned", "reversal_signed"} <= keys
    for item in data["files"]:
        assert item["language"] == "python"
        assert "def " in item["code"]
