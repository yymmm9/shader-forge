import { composeToolcraftApp } from "@/toolcraft/runtime/react";

import { appSchema } from "./app-schema";
import { shaderForgeExportRenderer } from "./shader/shader-export";
import { ShaderForgeOutput } from "./shader/shader-output";
import { shaderPipelineRegistration } from "./shader/shader-pipeline";
import { getShaderSceneRect } from "./shader/shader-state";

export const appComposition = composeToolcraftApp(appSchema, {
  renderer: {
    pipelineRegistration: shaderPipelineRegistration,
  },
  scene: {
    canvasContent: <ShaderForgeOutput />,
    rasterFrameRenderer: shaderForgeExportRenderer,
    renderDefaultCanvasMedia: false,
    sceneBoundsProvider: ({ state }) => [getShaderSceneRect(state)],
  },
});
