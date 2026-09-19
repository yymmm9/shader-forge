import {
  getToolcraftFiniteArtboardRect,
  getToolcraftTimelineLoopProgress,
  type ToolcraftFontPickerValue,
  type ToolcraftImageAsset,
  type ToolcraftSceneRect,
} from "@/toolcraft/runtime";
import type { ReadonlyToolcraftState } from "@/toolcraft/runtime/state/readonly-state";

import {
  SHADER_EFFECT_PRESETS,
  type ShaderEffectPreset,
} from "./shader-effects";

export type ShaderSourceKind = "text" | "image";

export type ShaderTypography = Readonly<{
  color: string;
  fontId: string;
  fontSize: number;
  fontWeight: string;
  letterSpacing: ToolcraftFontPickerValue["letterSpacing"];
  lineHeight: ToolcraftFontPickerValue["lineHeight"];
  opacity: number;
  textCase: ToolcraftFontPickerValue["textCase"];
}>;

export type ShaderParams = Readonly<{
  amount: number;
  effect: ShaderEffectPreset;
  phase: number;
  scale: number;
  speed: number;
}>;

export const SHADER_SOURCE_IMAGE_TARGET = "source.image";

const DEFAULT_TYPOGRAPHY: ShaderTypography = {
  color: "#f5f5f5",
  fontId: "inter",
  fontSize: 160,
  fontWeight: "800",
  letterSpacing: "normal",
  lineHeight: "normal",
  opacity: 100,
  textCase: "uppercase",
};

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

export function getShaderSourceKind(
  state: ReadonlyToolcraftState,
): ShaderSourceKind {
  return state.values["source.kind"] === "image" ? "image" : "text";
}

export function getShaderParams(state: ReadonlyToolcraftState): ShaderParams {
  const preset = state.values["effect.preset"];
  return {
    amount: Math.min(1, Math.max(0, asNumber(state.values["effect.amount"], 0.45))),
    effect: SHADER_EFFECT_PRESETS.includes(preset as ShaderEffectPreset)
      ? (preset as ShaderEffectPreset)
      : "flow",
    phase: asNumber(state.values["effect.phase"], 0),
    scale: asNumber(state.values["effect.scale"], 2),
    speed: Math.min(2, Math.max(0, asNumber(state.values["effect.speed"], 0.5))),
  };
}

export function getShaderText(state: ReadonlyToolcraftState): string {
  return asString(state.values["text.content"], "");
}

export function getShaderTypography(
  state: ReadonlyToolcraftState,
): ShaderTypography {
  const value = state.values["text.typography"];
  const raw =
    typeof value === "object" && value !== null
      ? (value as Partial<ToolcraftFontPickerValue>)
      : {};
  return {
    color: asString(raw.color, DEFAULT_TYPOGRAPHY.color),
    fontId: asString(raw.fontId, DEFAULT_TYPOGRAPHY.fontId),
    fontSize: asNumber(raw.fontSize, DEFAULT_TYPOGRAPHY.fontSize),
    fontWeight: asString(raw.fontWeight, DEFAULT_TYPOGRAPHY.fontWeight),
    letterSpacing: raw.letterSpacing ?? DEFAULT_TYPOGRAPHY.letterSpacing,
    lineHeight: raw.lineHeight ?? DEFAULT_TYPOGRAPHY.lineHeight,
    opacity: asNumber(raw.opacity, DEFAULT_TYPOGRAPHY.opacity),
    textCase: raw.textCase ?? DEFAULT_TYPOGRAPHY.textCase,
  };
}

export function getShaderSourceImageAsset(
  state: ReadonlyToolcraftState,
): ToolcraftImageAsset | undefined {
  if (getShaderSourceKind(state) !== "image") return undefined;
  return state.mediaAssets.find(
    (asset): asset is ToolcraftImageAsset =>
      asset.assetKind === "image" &&
      asset.lifecycle !== "unavailable" &&
      (asset.sourceTarget === undefined ||
        asset.sourceTarget === SHADER_SOURCE_IMAGE_TARGET),
  );
}

export function getShaderSceneRect(
  state: ReadonlyToolcraftState,
): ToolcraftSceneRect {
  return getToolcraftFiniteArtboardRect(state.canvas.size);
}

export function getShaderLoopTime(
  timeline: ReadonlyToolcraftState["timeline"],
  speed: number,
): number {
  if (speed <= 0) return 0;
  const cycles = Math.max(
    1,
    Math.round(speed * timeline.durationSeconds),
  );
  return getToolcraftTimelineLoopProgress(timeline) * cycles;
}
