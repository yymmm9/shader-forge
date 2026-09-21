import {
  assessToolcraftRenderPlan,
  defineToolcraftFixtureAdapter,
  defineToolcraftPerformance,
  defineToolcraftSchemaDiscreteFixtureAdapter,
  deriveToolcraftPerformancePaths,
  type ToolcraftEnvelopePerformanceConfig,
  type ToolcraftPerformanceScenario,
} from "@/toolcraft/runtime";

import { appSchema } from "./app-schema";
import { shaderPipelineRegistration } from "./shader/shader-pipeline";

const shaderForgePerformanceBase = defineToolcraftPerformance({
  rendererPipeline: shaderPipelineRegistration,
  rendererStrategy: "webgl",
  rendererTechnique: {
    exportRenderer: "webgl",
    fidelityRisks: [
      "Preview and export must sample identical source textures, cover-fit UV mapping, rotate/flip transforms, and effect uniforms.",
      "Uploaded images must preserve source fidelity through the selected render scale and export pixel ratio without silent downsampling.",
    ],
    gpu: {
      export: {
        backend: "webgl",
        exception: {
          evidence:
            "The fragment shader requires WebGL2; the product shows a static notice surface instead of a shader render when the context is unavailable.",
          kind: "browser-compatibility",
        },
        provider: "native",
      },
      preview: {
        backend: "webgl",
        exception: {
          evidence:
            "The fragment shader requires WebGL2; the product shows a static notice surface instead of a shader render when the context is unavailable.",
          kind: "browser-compatibility",
        },
        provider: "native",
      },
    },
    intentionalRasterizationReason:
      "Product output is fragment-shader pixels; one full-quality WebGL2 pass supplies preview and the runtime-owned image export context.",
    layers: [
      {
        content: ["bitmap-media", "shader", "text"],
        exportMode: "included",
        id: "shader-output",
        intentionalRasterizationReason:
          "Typed text and uploaded images become source textures consumed by one fullscreen WebGL2 fragment shader.",
        kind: "product-foreground",
        primitiveCount: "low",
        renderer: "webgl",
        uiSelector: "canvas[data-toolcraft-product-output='shader-forge']",
      },
    ],
    performanceRisks: [
      "Render scale at 2x multiplies preview backing pixels while slider drags stay live.",
      "Image sources upload one full-resolution texture; large uploads dominate the discrete source pass.",
      "Retained source textures must survive unrelated control updates and release GPU resources on unmount.",
    ],
    previewRenderer: "webgl",
    productRepresentation: "pixel",
    rendererStrategy: "webgl",
    sourceRepresentation: "mixed",
    whyNotAlternativeStrategies: [
      "Canvas 2D cannot express domain-warped per-pixel displacement, halftone, or channel-split effects at interactive cost.",
      "DOM/CSS filters cannot reproduce cover-fit UV distortion or per-pixel noise at the selected render scale.",
      "SVG cannot represent rasterized text/image fragment output for pixel-identical export.",
    ],
  },
  scenarios: [],
  usesCustomRenderer: true,
  workloadEnvelope: { dimensions: [] },
});

export const shaderForgeRenderPlanAssessment = assessToolcraftRenderPlan(
  appSchema,
  shaderForgePerformanceBase,
);

export const shaderForgePerformancePaths = deriveToolcraftPerformancePaths(
  appSchema,
  shaderForgePerformanceBase,
);

function scenarioForPath(
  path: (typeof shaderForgePerformancePaths)[number],
): ToolcraftPerformanceScenario {
  const common = {
    automated: true,
    automatedTestName:
      "requires structurally valid performance coverage for functional delivery",
    browser: true,
    browserTestName: `browser perf: toolcraft path ${path.id}`,
    coversTargets: path.targets,
    expectedObservable:
      path.invalidates.length === 0
        ? "The primary operation completes while retained source and frame passes remain unchanged."
        : "The primary operation updates the visible shader output at the selected render scale with the declared pass invalidation.",
    fixture: "default text source at 1080x1080 flow preset",
    id: `shader-forge.${path.id}`,
    pathId: path.id,
  } as const;

  if (path.interaction === "export") {
    return {
      ...common,
      actionValue: "export.png",
      completionEvidence: "download",
      controlLabel: "Export PNG",
      interaction: "export",
      target: "actions.shader",
    };
  }

  return {
    ...common,
    interaction: path.interaction,
    ...(path.targets.length === 1 ? { target: path.targets[0] } : {}),
    uiSelector: "canvas[data-toolcraft-product-output='shader-forge']",
  };
}

export const appPerformance: ToolcraftEnvelopePerformanceConfig =
  defineToolcraftPerformance({
    ...shaderForgePerformanceBase,
    fixtureAdapters: {
      dimensions: {
        "export-resolution":
          defineToolcraftSchemaDiscreteFixtureAdapter(appSchema, {
            dimensionId: "export-resolution",
            entries: [
              { appliedValue: "2k", value: 2560 },
              { appliedValue: "4k", value: 3840 },
              { appliedValue: "8k", value: 7680 },
            ],
            target: "export.image.resolution",
          }),
        "source-image-pixels": defineToolcraftFixtureAdapter<number>({
          apply: (value) => Math.round(value),
          dimensionId: "source-image-pixels",
          observe: (applied) => applied,
        }),
        "source-mode": defineToolcraftSchemaDiscreteFixtureAdapter(
          appSchema,
          {
            dimensionId: "source-mode",
            entries: [
              { appliedValue: "text", value: 0 },
              { appliedValue: "image", value: 1 },
            ],
            target: "source.kind",
          },
        ),
      },
    },
    scenarios: shaderForgePerformancePaths.map(scenarioForPath),
    workloadEnvelope: {
      dimensions: [
        {
          batchMax: 1,
          defaultValue: 0,
          id: "source-mode",
          interactiveMax: 1,
          mapping: "direct",
          source: { kind: "schema-target", target: "source.kind" },
          unit: "source-mode-index",
        },
        {
          batchMax: 67108864,
          defaultValue: 0,
          id: "source-image-pixels",
          interactiveMax: 16777216,
          mapping: "direct",
          source: { kind: "schema-target", target: "source.image" },
          unit: "source-pixels",
        },
        {
          batchMax: 7680,
          customMappingReason:
            "Image resolution selects an output long edge in pixels; raster and export cost scales with output area, so the normalized value is the long-edge pixel count.",
          defaultValue: 3840,
          id: "export-resolution",
          mapping: "quadratic",
          source: {
            kind: "schema-target",
            target: "export.image.resolution",
          },
          unit: "output-edge-pixels",
        },
      ],
    },
  });
