import type { ToolcraftProductExportRenderer } from "@/toolcraft/runtime";

import { createShaderRenderer } from "./shader-gl";
import { shaderExportPass } from "./shader-pipeline";
import {
  materializeShaderSource,
  resolveShaderSource,
} from "./shader-source";
import { getShaderParams } from "./shader-state";

export const shaderForgeExportRenderer: ToolcraftProductExportRenderer = {
  baseFileName: "shader-forge",
  renderFrame: async ({
    context,
    frame,
    pixelRatio,
    rendererPipeline,
    state,
  }) => {
    const draw = async () => {
      const glCanvas = new OffscreenCanvas(
        Math.max(1, Math.round(frame.width * pixelRatio)),
        Math.max(1, Math.round(frame.height * pixelRatio)),
      );
      const renderer = createShaderRenderer(glCanvas);
      if (!renderer) {
        throw new Error(
          "Shader Forge export requires a WebGL2 context; this browser cannot create one.",
        );
      }
      try {
        const { source, transform } = await materializeShaderSource(
          resolveShaderSource(state),
          { waitForImage: true },
        );
        const params = getShaderParams(state);
        if (
          !renderer.render({
            amount: params.amount,
            effect: params.effect,
            phase: params.phase,
            scale: params.scale,
            source,
            sourceTransform: transform,
          })
        ) {
          throw new Error(
            "Shader Forge export failed while drawing the shader frame.",
          );
        }
        context.drawImage(
          glCanvas,
          frame.x,
          frame.y,
          frame.width,
          frame.height,
        );
      } finally {
        renderer.dispose();
      }
    };

    if (rendererPipeline) {
      await rendererPipeline.runPass(shaderExportPass, undefined, draw);
      return;
    }
    await draw();
  },
};
