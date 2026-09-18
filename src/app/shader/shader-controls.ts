import type { ToolcraftControlSectionSchema } from "@/toolcraft/runtime";

const textModeApplicability = Object.freeze({
  all: Object.freeze([
    Object.freeze({ equals: "text", target: "source.kind" }),
  ]),
  mode: "conditional" as const,
});

const imageModeApplicability = Object.freeze({
  all: Object.freeze([
    Object.freeze({ equals: "image", target: "source.kind" }),
  ]),
  mode: "conditional" as const,
});

export const shaderControlSections: readonly ToolcraftControlSectionSchema[] =
  [
    {
      controls: {
        sourceKind: {
          applicability: { mode: "always" },
          defaultValue: "text",
          description:
            "Chooses whether the shader distorts typed text or an uploaded image.",
          label: "Type",
          options: [
            { label: "Text", value: "text" },
            { label: "Image", value: "image" },
          ],
          orderRole: "mode",
          performanceReason:
            "Switches between the text raster and uploaded image source pipelines.",
          performanceRole: "workload",
          target: "source.kind",
          type: "segmented",
        },
        content: {
          applicability: textModeApplicability,
          commitMode: "content",
          defaultValue: "SHADER",
          label: "Text",
          orderRole: "input",
          performanceReason:
            "Text edits rasterize one bounded source texture.",
          performanceRole: "responsiveness",
          target: "text.content",
          textValueKind: "single-line",
          type: "text",
        },
        image: {
          applicability: imageModeApplicability,
          assetKind: "image",
          defaultValue: null,
          label: "Image",
          multiple: false,
          orderRole: "input",
          performanceReason:
            "Image import decodes and uploads one full-resolution source texture.",
          performanceRole: "workload",
          target: "source.image",
          type: "fileDrop",
        },
      },
      id: "source",
      title: "Source",
    },
    {
      controls: {
        typography: {
          applicability: textModeApplicability,
          defaultValue: {
            color: "#f5f5f5",
            fontId: "inter",
            fontSize: 160,
            fontWeight: "800",
            letterSpacing: "normal",
            lineHeight: "normal",
            opacity: 100,
            textCase: "uppercase",
          },
          label: false,
          performanceReason:
            "Typography changes rasterize one bounded source texture.",
          performanceRole: "responsiveness",
          target: "text.typography",
          type: "fontPicker",
        },
      },
      id: "typography",
      title: "Typography",
    },
    {
      controls: {
        preset: {
          applicability: { mode: "always" },
          defaultValue: "flow",
          description:
            "Selects the fragment-shader effect applied to the source texture.",
          label: "Preset",
          options: [
            { label: "Flow", value: "flow" },
            { label: "Ripple", value: "ripple" },
            { label: "Halftone", value: "halftone" },
            { label: "Glitch", value: "glitch" },
          ],
          orderRole: "primary",
          performanceReason:
            "Preset switches one fragment branch; uniform-only update.",
          performanceRole: "responsiveness",
          target: "effect.preset",
          type: "select",
        },
        amount: {
          applicability: { mode: "always" },
          defaultValue: 0.45,
          label: "Amount",
          max: 1,
          min: 0,
          orderRole: "strength",
          performanceReason: "Uniform-only update per drawn frame.",
          performanceRole: "responsiveness",
          step: 0.01,
          target: "effect.amount",
          type: "slider",
        },
        scale: {
          applicability: { mode: "always" },
          defaultValue: 2,
          label: "Scale",
          max: 8,
          min: 0.5,
          performanceReason: "Uniform-only update per drawn frame.",
          performanceRole: "responsiveness",
          step: 0.1,
          target: "effect.scale",
          type: "slider",
        },
        phase: {
          applicability: { mode: "always" },
          defaultValue: 0,
          description:
            "Offsets the effect pattern so a static frame can be rephrased before export.",
          label: "Phase",
          max: 1,
          min: 0,
          performanceReason: "Uniform-only update per drawn frame.",
          performanceRole: "responsiveness",
          step: 0.01,
          target: "effect.phase",
          type: "slider",
        },
      },
      id: "effect",
      layoutGroups: [
        {
          columns: 2,
          controls: ["amount", "scale", "phase"],
          layout: "inline",
        },
      ],
      title: "Effect",
    },
    {
      controls: {
        includeBackground: {
          applicability: { mode: "always" },
          defaultValue: true,
          label: "Include background",
          performanceReason:
            "Toggles the runtime-owned background composition layer.",
          performanceRole: "responsiveness",
          target: "export.includeBackground",
          type: "switch",
        },
        backgroundColor: {
          applicability: { mode: "always" },
          defaultValue: "#0f1115",
          label: "Color",
          orderRole: "color",
          performanceReason:
            "Repaints the runtime-owned background layer only.",
          performanceRole: "responsiveness",
          target: "appearance.background",
          type: "color",
        },
      },
      id: "background",
      title: "Background",
    },
  ];
