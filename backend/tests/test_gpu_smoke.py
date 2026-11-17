"""GPU validation harness unit tests (no GPU required to run these)."""

from __future__ import annotations

from scripts.gpu_smoke import REMOTE_SCRIPT, main, parse_args


def test_default_args():
    args = parse_args([])
    assert args.host == "gpu-resource"
    assert args.out == "backend/data/gpu-smoke.json"
    assert args.dry_run is False


def test_remote_script_contract():
    assert "GPU_SMOKE_JSON:" in REMOTE_SCRIPT
    assert "torch.cuda.is_available()" in REMOTE_SCRIPT
    assert "matmul_tflops_fp32" in REMOTE_SCRIPT
    assert "torch.cuda.get_device_properties(0)" in REMOTE_SCRIPT


def test_dry_run_does_not_ssh(capsys):
    assert main(["--dry-run", "--host", "should-not-connect"]) == 0
    output = capsys.readouterr().out
    assert output.strip() == REMOTE_SCRIPT.strip()


def test_recorded_report_has_real_measurements():
    """The committed report records a real GPU probe, not provisional mocks."""
    from pathlib import Path

    report_path = Path(__file__).resolve().parents[1] / "data" / "gpu-smoke.json"
    if not report_path.is_file():  # pragma: no cover - generated artifact
        return
    import json

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert report["source"].startswith("real CUDA")
    assert report["host"] == "gpu-resource"
    assert report["matmul_tflops_fp32"] > 0
    assert report["total_memory_bytes"] >= 7 * 1024**3  # ~8 GiB M60
    assert "Tesla" in report["device"]
