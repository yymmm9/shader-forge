import type { ToolcraftPanelActionHandler } from "@/toolcraft/runtime/react";

import { SHADER_EFFECT_PRESETS } from "./shader-effects";
import {
  getShaderParams,
  getShaderText,
  getShaderTypography,
} from "./shader-state";

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export const shaderPanelActionHandler: ToolcraftPanelActionHandler = async ({
  action,
  dispatch,
  reportFeedback,
  state,
}) => {
  if (action.value === "shader.randomize") {
    const preset =
      SHADER_EFFECT_PRESETS[
        Math.floor(Math.random() * SHADER_EFFECT_PRESETS.length)
      ] ?? "flow";
    dispatch({
      label: "Randomize shader",
      type: "controls.apply",
      values: {
        "effect.preset": preset,
        "effect.amount": roundTo(0.15 + Math.random() * 0.75, 2),
        "effect.scale": roundTo(0.8 + Math.random() * 4.2, 1),
        "effect.phase": roundTo(Math.random(), 2),
        "effect.speed": roundTo(0.15 + Math.random() * 1.1, 2),
      },
    });
    return;
  }

  if (action.value === "shader.copy-params") {
    const params = getShaderParams(state);
    const payload = JSON.stringify(
      {
        preset: params.effect,
        amount: params.amount,
        scale: params.scale,
        phase: params.phase,
        speed: params.speed,
        text: getShaderText(state),
        typography: getShaderTypography(state),
      },
      null,
      2,
    );
    try {
      await navigator.clipboard.writeText(payload);
      reportFeedback({
        code: "copied",
        message: "Shader parameters copied to clipboard.",
      });
    } catch {
      reportFeedback({
        code: "copy-failed",
        message: "Clipboard is unavailable; copy was blocked by the browser.",
      });
    }
  }
};
