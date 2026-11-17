#!/usr/bin/env python3
"""GPU validation harness for the studio-platform pipeline smoke run.

Runs a small real CUDA workload on the configured GPU box (``ssh gpu-resource``
by default), records measured numbers to a JSON report and prints a summary.
Everything is offline-safe: the only third-party dependency is PyTorch, already
available in ``~/venvs/torch`` on the GPU box.

Usage (from the repo root)::

    python3 backend/scripts/gpu_smoke.py --host gpu-resource \\
        --remote-python ~/venvs/torch/bin/python \\
        --out backend/data/gpu-smoke.json

The remote payload is streamed over stdin to ``python3 -``; no files are copied
to the GPU box. ``--dry-run`` prints the remote script without executing it.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

REMOTE_SCRIPT = r'''
import json
import time
import torch

if not torch.cuda.is_available():
    raise SystemExit(json.dumps({"error": "CUDA not available"}))

device = torch.device("cuda:0")
name = torch.cuda.get_device_name(0)
props = torch.cuda.get_device_properties(0)

# FP32 matmul throughput probe (matrix sizes chosen to fit 8 GB comfortably).
N = 2048
a = torch.randn(N, N, device=device, dtype=torch.float32)
b = torch.randn(N, N, device=device, dtype=torch.float32)
for _ in range(3):
    c = a @ b
torch.cuda.synchronize()
start = time.perf_counter()
iters = 10
for _ in range(iters):
    c = a @ b
torch.cuda.synchronize()
elapsed = time.perf_counter() - start
flops = 2 * N ** 3 * iters
tflops = flops / elapsed / 1e12
del a, b, c

# Memory probe.
free, total = torch.cuda.mem_get_info()

print("GPU_SMOKE_JSON:" + json.dumps({
    "device": name,
    "cuda_version": torch.version.cuda,
    "torch_version": torch.__version__,
    "compute_capability": f"{props.major}.{props.minor}",
    "matmul_tflops_fp32": round(tflops, 3),
    "matmul_seconds": round(elapsed, 4),
    "free_memory_bytes": free,
    "total_memory_bytes": total,
}))
'''


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="gpu-resource")
    parser.add_argument("--remote-python", default="~/venvs/torch/bin/python")
    parser.add_argument("--out", default="backend/data/gpu-smoke.json")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def run(host: str, remote_python: str) -> dict:
    command = ["ssh", "-o", "BatchMode=yes", host, f"{remote_python} -"]
    result = subprocess.run(
        command,
        input=REMOTE_SCRIPT.encode(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=300,
        check=True,
    )
    for line in result.stdout.decode().splitlines():
        if line.startswith("GPU_SMOKE_JSON:"):
            payload = json.loads(line.removeprefix("GPU_SMOKE_JSON:"))
            if "error" in payload:
                raise RuntimeError(payload["error"])
            return payload
    raise RuntimeError(
        "No GPU_SMOKE_JSON marker in remote output: " + result.stdout.decode()[:500]
    )


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.dry_run:
        print(REMOTE_SCRIPT)
        return 0
    try:
        metrics = run(args.host, args.remote_python)
    except (subprocess.SubprocessError, RuntimeError, ValueError) as exc:
        print(f"gpu-smoke: FAILED: {exc}", file=sys.stderr)
        return 1
    report = {
        "host": args.host,
        "measured_at": datetime.now(UTC).isoformat(),
        "source": "real CUDA matmul probe on GPU box",
        **metrics,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
