import type { CapabilityMatch } from "../../lib/catalog";
import type { BadgeTone } from "../../ui/Badge";

export interface AudioCapability {
  readonly enabled: boolean;
  readonly operationIds: readonly string[];
  readonly providers: readonly string[];
  readonly label: string;
  readonly tone: BadgeTone;
}

const AUDIO_OPERATION_PATTERN = /(tts|text-to-speech|dialogue|voice|audio)/i;

/** TTS/dialogue UI stays hidden until a provider advertises an audio operation. */
export function deriveAudioCapability(matches: readonly CapabilityMatch[]): AudioCapability {
  const audioMatches = matches.filter((match) =>
    AUDIO_OPERATION_PATTERN.test(match.operation_id),
  );
  const operationIds = Array.from(new Set(audioMatches.map((match) => match.operation_id))).sort();
  const providers = Array.from(new Set(audioMatches.map((match) => match.provider_name))).sort();
  const enabled = audioMatches.some((match) => match.status === "available");
  const label = enabled
    ? `Enabled · ${operationIds.join(", ")}`
    : operationIds.length > 0
      ? "Advertised but no available provider"
      : "No audio capability advertised";
  return {
    enabled,
    operationIds,
    providers,
    label,
    tone: enabled ? "success" : "neutral",
  };
}

export interface DialogueLine {
  readonly id: string;
  readonly speaker: string;
  readonly text: string;
}

/** Split a plain dialogue script into speaker lines for the TTS preview. */
export function parseDialogueScript(script: string): readonly DialogueLine[] {
  return script
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      const separator = line.indexOf(":");
      if (separator > 0) {
        return {
          id: `line-${index}`,
          speaker: line.slice(0, separator).trim(),
          text: line.slice(separator + 1).trim(),
        };
      }
      return { id: `line-${index}`, speaker: "Narrator", text: line };
    })
    .filter((line) => line.text.length > 0);
}
