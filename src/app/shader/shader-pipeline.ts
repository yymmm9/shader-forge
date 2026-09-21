import {
  registerToolcraftRendererPipeline,
  type ToolcraftRendererPipelinePassContract,
} from "@/toolcraft/runtime";

import type { ShaderSourceDescriptor } from "./shader-source";

type ShaderPipelinePasses = {
  "shader-export": ToolcraftRendererPipelinePassContract<void>;
  "shader-frame": ToolcraftRendererPipelinePassContract<void>;
  "source-texture": ToolcraftRendererPipelinePassContract<ShaderSourceDescriptor>;
};

export const shaderPipelineRegistration =
  registerToolcraftRendererPipeline<ShaderPipelinePasses>()({
    interactionInvalidation: [
      {
        interaction: "initial-render",
        invalidates: ["source-texture", "shader-frame"],
        mustNotInvalidate: ["shader-export"],
        targets: ["canvas.initial-render"],
      },
      {
        interaction: "control-drag",
        invalidates: ["shader-frame"],
        mustNotInvalidate: ["source-texture", "shader-export"],
        targets: [
          "effect.amount",
          "effect.scale",
          "effect.phase",
          "effect.speed",
        ],
      },
      {
        interaction: "timeline-playback",
        invalidates: ["shader-frame"],
        mustNotInvalidate: ["source-texture", "shader-export"],
        targets: ["timeline.time"],
      },
      {
        interaction: "timeline-scrub",
        invalidates: ["shader-frame"],
        mustNotInvalidate: ["source-texture", "shader-export"],
        targets: ["timeline.time"],
      },
      {
        interaction: "control-change",
        invalidates: ["shader-frame"],
        mustNotInvalidate: ["source-texture", "shader-export"],
        targets: ["effect.preset"],
      },
      {
        interaction: "control-change",
        invalidates: ["source-texture", "shader-frame"],
        mustNotInvalidate: ["shader-export"],
        targets: ["source.kind", "text.content", "text.typography"],
      },
      {
        interaction: "media-import",
        invalidates: ["source-texture", "shader-frame"],
        mustNotInvalidate: ["shader-export"],
        targets: ["source.image"],
      },
      {
        interaction: "control-change",
        invalidates: ["shader-frame"],
        mustNotInvalidate: ["source-texture", "shader-export"],
        targets: [
          "canvas.renderScale",
          "canvas.size.width",
          "canvas.size.height",
          "canvas.infinity",
        ],
      },
      {
        interaction: "control-change",
        invalidates: [],
        mustNotInvalidate: [
          "source-texture",
          "shader-frame",
          "shader-export",
        ],
        targets: [
          "appearance.background",
          "export.includeBackground",
          "export.image.format",
          "export.image.resolution",
        ],
      },
      {
        interaction: "viewport-drag",
        invalidates: [],
        mustNotInvalidate: [
          "source-texture",
          "shader-frame",
          "shader-export",
        ],
        targets: ["canvas.viewport"],
      },
      {
        interaction: "viewport-zoom",
        invalidates: [],
        mustNotInvalidate: [
          "source-texture",
          "shader-frame",
          "shader-export",
        ],
        targets: ["canvas.viewport"],
      },
      {
        interaction: "export",
        invalidates: ["shader-export"],
        mustNotInvalidate: ["source-texture", "shader-frame"],
        targets: ["actions.shader"],
      },
    ],
    passes: [
      {
        cacheKey: [
          "source.kind",
          "text.content",
          "text.typography",
          "source.image",
        ],
        cost: {
          dimensions: ["source-mode", "source-image-pixels"],
          frequency: "discrete",
          relationship: "linear",
        },
        id: "source-texture",
        inputs: [
          "source.kind",
          "text.content",
          "text.typography",
          "source.image",
        ],
        invalidatedBy: [
          "source.kind",
          "text.content",
          "text.typography",
          "source.image",
        ],
        kind: "rasterize",
        lifecycle: { cache: "memoized", resourceScope: "source" },
        output: "intermediate",
        quality: "full",
        runsOn: "main",
      },
      {
        cost: {
          dimensions: [],
          frequency: "frame",
          relationship: "constant",
        },
        gpu: {
          resources: "sampled-textures",
          stage: "render",
          state: "stateless",
          surfaces: ["preview"],
        },
        id: "shader-frame",
        inputs: [
          "source-texture",
          "effect.preset",
          "effect.amount",
          "effect.scale",
          "effect.phase",
          "effect.speed",
          "timeline.time",
          "canvas.renderScale",
          "canvas.product-scene-frame",
        ],
        invalidatedBy: [
          "source-texture",
          "effect.preset",
          "effect.amount",
          "effect.scale",
          "effect.phase",
          "effect.speed",
          "timeline.time",
          "canvas.renderScale",
          "canvas.size.width",
          "canvas.size.height",
          "canvas.infinity",
        ],
        kind: "composite",
        lifecycle: { cache: "none", resourceScope: "call" },
        output: "preview",
        quality: "retina",
        runsOn: "gpu",
      },
      {
        cost: {
          dimensions: ["export-resolution"],
          frequency: "batch",
          relationship: "quadratic",
        },
        id: "shader-export",
        inputs: [
          "source-texture",
          "effect.preset",
          "effect.amount",
          "effect.scale",
          "effect.phase",
          "export.frame",
        ],
        invalidatedBy: ["actions.output"],
        kind: "export",
        lifecycle: { cache: "none", resourceScope: "call" },
        output: "export",
        quality: "export",
        runsOn: "export-only",
      },
    ],
    runtimeId: "shader-forge-webgl2-v1",
  });

export const shaderSourceTexturePass =
  shaderPipelineRegistration.getPass("source-texture");
export const shaderFramePass =
  shaderPipelineRegistration.getPass("shader-frame");
export const shaderExportPass =
  shaderPipelineRegistration.getPass("shader-export");
