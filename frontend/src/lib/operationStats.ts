/**
 * Authoritative operation catalog statistics derivation helper (C65 follow-up).
 *
 * The backend (`OperationStatsRepository`) derives the whole snapshot from the
 * authoritative catalog on every call — there is no second index. `lib/operationStats`
 * reproduces that derivation exactly so mock mode stays at feature parity with
 * live mode and the parity guard can drive both transports over the same seeds.
 *
 * The `/operations/stats` endpoint takes no query parameters, so unlike the
 * other stats helpers there is no options/validation layer here — only the
 * deterministic derivation and a stable query-key-free transport contract.
 */

import type { OperationSpec, OperationStats, OperationTypeCount } from "./types";

/** Python-compatible lexicographic ordering for the deterministic type-count sort. */
function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Derive catalog metrics exactly as the backend repository does: zero-filled
 * streaming/provider/setting coverage and asset-type input/output breakdowns
 * sorted by descending count then name for deterministic cross-backend order.
 * An empty catalog yields zero counts and empty breakdown arrays.
 */
export function deriveOperationStats(
  operations: readonly OperationSpec[],
  now: string,
): OperationStats {
  const outputCounts = new Map<string, number>();
  const inputCounts = new Map<string, number>();
  let streaming = 0;
  let withProvider = 0;
  let totalSettings = 0;

  for (const spec of operations) {
    for (const assetType of spec.output?.asset_types ?? []) {
      outputCounts.set(assetType, (outputCounts.get(assetType) ?? 0) + 1);
    }
    for (const assetType of spec.input?.asset_types ?? []) {
      inputCounts.set(assetType, (inputCounts.get(assetType) ?? 0) + 1);
    }
    if (spec.streaming) streaming += 1;
    if (spec.provider_ids && spec.provider_ids.length > 0) withProvider += 1;
    totalSettings += spec.settings?.length ?? 0;
  }

  const toCounts = (counts: Map<string, number>): OperationTypeCount[] =>
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || compareNames(a[0], b[0]))
      .map(([asset_type, operations]) => ({ asset_type, operations }));

  return {
    total: operations.length,
    streaming,
    with_provider: withProvider,
    without_provider: operations.length - withProvider,
    total_settings: totalSettings,
    unique_output_types: outputCounts.size,
    by_output_type: toCounts(outputCounts),
    by_input_type: toCounts(inputCounts),
    generated_at: now,
  };
}
