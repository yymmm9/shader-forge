import type {
  ToolcraftComponentAcceptance,
  ToolcraftControlSectionInventoryEntry,
  ToolcraftInteractionOwnershipEntry,
  ToolcraftProductReadiness,
  ToolcraftTransferMode,
} from "./acceptance/types";
import { appSchema } from "./app-schema";

const persistedSlices =
  appSchema.persistence.storage === "localStorage"
    ? appSchema.persistence.include
    : [];

export const appTransferMode: ToolcraftTransferMode = {
  animationIntent: {
    loopDuration: {
      evidence:
        "One ambient shader cycle runs 2s at the default 0.5 cycles-per-second speed; the 8s loop holds exactly four integer cycles so first and last frames stitch at the wrap.",
      seconds: 8,
      source: "product-derived",
    },
    mode: "timeline-playback",
  },
  mode: "new-toolcraft-app",
  referenceInputs: [],
};

const panelInteraction = (
  id: string,
  target: string,
  capability: "precise-value-entry" | "property-edit",
  reason: string,
): ToolcraftInteractionOwnershipEntry => ({
  alternative: {
    reason:
      "The canvas already carries pan, zoom, and shader output; duplicating value editing there would add a second owner for the same state.",
    surface: "canvas",
  },
  capability,
  evidence: {
    detail:
      "Usability comparison: numeric and option edits need labeled fields and commit semantics that only the controls panel provides.",
    source: "usability-analysis",
  },
  id,
  reason,
  selectionScope: { mode: "global" },
  surface: "panel",
  target,
});

const productInteractionOwnership: ToolcraftInteractionOwnershipEntry[] = [
  panelInteraction(
    "interaction.source-kind",
    "source.kind",
    "property-edit",
    "Choosing the shader source is a mode decision with two named branches; a segmented panel control communicates both options and the active branch.",
  ),
  panelInteraction(
    "interaction.text-content",
    "text.content",
    "precise-value-entry",
    "Typing shader text needs a focused text field with keyboard commit; direct canvas editing cannot represent multi-character input precisely.",
  ),
  panelInteraction(
    "interaction.source-image",
    "source.image",
    "property-edit",
    "Image upload is source material owned by the fileDrop contract; the panel row also hosts the runtime transform actions for the same asset.",
  ),
  panelInteraction(
    "interaction.text-typography",
    "text.typography",
    "property-edit",
    "Typography bundles eight related text style parts; the compound fontPicker row keeps one owner for all of them.",
  ),
  panelInteraction(
    "interaction.effect-preset",
    "effect.preset",
    "property-edit",
    "Selecting the fragment effect is a named-branch choice best represented by the panel select control.",
  ),
  panelInteraction(
    "interaction.effect-amount",
    "effect.amount",
    "precise-value-entry",
    "Effect strength is a continuous scalar; the slider gives live feedback while staying out of the canvas surface.",
  ),
  panelInteraction(
    "interaction.effect-scale",
    "effect.scale",
    "precise-value-entry",
    "Effect frequency is a continuous scalar; the slider gives live feedback while staying out of the canvas surface.",
  ),
  panelInteraction(
    "interaction.effect-phase",
    "effect.phase",
    "precise-value-entry",
    "Phase offset is a continuous scalar; the slider scrubs the static pattern without a transport surface.",
  ),
  panelInteraction(
    "interaction.effect-speed",
    "effect.speed",
    "precise-value-entry",
    "Motion rate is a continuous scalar; the slider adjusts how many effect cycles fit inside one runtime timeline loop.",
  ),
  panelInteraction(
    "interaction.include-background",
    "export.includeBackground",
    "property-edit",
    "Including the background is an output-composition flag owned by the canonical panel switch.",
  ),
  panelInteraction(
    "interaction.appearance-background",
    "appearance.background",
    "property-edit",
    "Background color is a single color value; the canonical color control owns it beside the include switch.",
  ),
];

export const appProductReadiness: ToolcraftProductReadiness = {
  exportIntent: {
    image: { mode: "toolcraft-default" },
    svg: { mode: "not-requested" },
    video: { mode: "not-requested" },
  },
  interactionOwnership: productInteractionOwnership,
  mode: "product",
  productName: "Shader Forge",
  productSummary:
    "A WebGL2 shader canvas that animates custom text or an uploaded image through selectable looping fragment effects on the runtime timeline and exports the result as a PNG or JPG image.",
  requestedBehavior:
    "shader with custom text or image as input, react web app",
  viewInteraction: {
    mode: "non-spatial",
    reason:
      "The product scene is a fixed 2D raster frame filled by one fragment shader; there is no editable spatial model, so no orbit or camera surface applies.",
  },
};

const shaderSpec = "e2e/product-shader.spec.ts" as const;

export const appAcceptance: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName:
      "declares production reload coverage for the product schema",
    browser: {
      budget: "extended-io",
      file: "e2e/app-persistence.spec.ts",
      testName:
        "browser: app restores exact canvas, values, and panel workspace slices after reload",
    },
    componentType: "persistence",
    evidence: "persistence-state",
    expectedObservable:
      "Canvas size and zoom, their runtime values, and the moved and collapsed Controls workspace remain visibly restored after a real browser reload.",
    fixture: "product runtime persisted workspace",
    id: "persistence.reload",
    kind: "runtime",
    persistenceCoverage: "reload",
    persistenceSlices: persistedSlices,
    target: "canvas.size.width",
    userAction:
      "Edit Canvas width and zoom, move and collapse Controls, wait for persistence, and reload the page.",
  },
  {
    automated: true,
    automatedTestName:
      "proves the source kind selector switches shader inputs",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName:
        "browser: source kind switches the shader source input",
    },
    componentType: "segmented",
    evidence: "product-output",
    expectedObservable:
      "Switching Source Type changes the visible shader output between the text raster and the uploaded image source, and each visible option is reachable.",
    fixture: "default text source",
    id: "source.kind",
    interactionId: "interaction.source-kind",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "source.kind",
    userAction:
      "Select Text and then Image in the Source Type segmented control.",
  },
  {
    automated: true,
    automatedTestName:
      "proves editing the text content changes the shader output",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName: "browser: text content edits change the shader output",
    },
    componentType: "text",
    evidence: "product-output",
    expectedObservable:
      "Committing different text re-rasterizes the source texture and visibly changes the shader output.",
    fixture: "default text source",
    id: "text.content",
    interactionId: "interaction.text-content",
    kind: "control",
    target: "text.content",
    userAction: "Focus the Text field, type new words, and commit the value.",
  },
  {
    automated: true,
    automatedTestName:
      "proves the image fileDrop covers upload, transform, remove, and reset",
    browser: {
      budget: "extended-io",
      file: shaderSpec,
      testName:
        "browser: image fileDrop uploads, transforms, removes, and resets the shader source",
    },
    componentType: "fileDrop",
    evidence: "media-lifecycle",
    expectedObservable:
      "Uploading an image makes it the shader source, rotate and flip actions transform it in the output, removing clears the source, and reset restores defaults.",
    fixture: "image source branch",
    id: "source.image",
    interactionId: "interaction.source-image",
    kind: "control",
    mediaLifecycleCoverage: [
      "upload",
      "rotate",
      "flip",
      "transform-output",
      "remove",
      "reset",
    ],
    target: "source.image",
    userAction:
      "Switch Source Type to Image, upload an image file, apply rotate and flip actions, remove the image, and reset.",
  },
  {
    automated: true,
    automatedTestName:
      "proves every visible fontPicker part changes the text raster",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName:
        "browser: typography fontPicker parts each change the shader text",
    },
    componentType: "fontPicker",
    controlPartCoverage: "all-visible-parts",
    evidence: "product-output",
    expectedObservable:
      "Font, size, weight, letter spacing, line height, text case, color, and opacity each visibly change the shader text output.",
    fixture: "default text source",
    id: "text.typography",
    interactionId: "interaction.text-typography",
    kind: "control",
    target: "text.typography",
    userAction:
      "Open the Typography picker and change each visible part: font, size, weight, letter spacing, line height, case, color, and opacity.",
  },
  {
    automated: true,
    automatedTestName:
      "proves every effect preset option changes the shader output",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName: "browser: effect preset options each change the shader output",
    },
    componentType: "select",
    evidence: "product-output",
    expectedObservable:
      "Each of the seventeen presets (Flow, Ripple, Wave, Swirl, Kaleido, Glitch, Chromatic, Pixelate, Halftone, Dither, Posterize, Edge, Chrome, Grain, Liquid, Aura, Prism) produces a visibly different animated shader output.",
    fixture: "default text source",
    id: "effect.preset",
    interactionId: "interaction.effect-preset",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "effect.preset",
    userAction: "Select every option in the Effect Preset select.",
  },
  {
    automated: true,
    automatedTestName:
      "proves the amount slider scales the shader effect",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName: "browser: amount slider changes the shader strength",
    },
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Dragging Amount changes the visible distortion strength of the shader output.",
    fixture: "default text source",
    id: "effect.amount",
    interactionId: "interaction.effect-amount",
    kind: "control",
    target: "effect.amount",
    userAction: "Drag the Amount slider to a different value.",
  },
  {
    automated: true,
    automatedTestName:
      "proves the scale slider changes the shader frequency",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName: "browser: scale slider changes the shader frequency",
    },
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Dragging Scale changes the visible frequency or density of the shader effect.",
    fixture: "default text source",
    id: "effect.scale",
    interactionId: "interaction.effect-scale",
    kind: "control",
    target: "effect.scale",
    userAction: "Drag the Scale slider to a different value.",
  },
  {
    automated: true,
    automatedTestName:
      "proves the phase slider rephrases the shader pattern",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName: "browser: phase slider rephrases the shader output",
    },
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Dragging Phase offsets the visible effect pattern while keeping the same source.",
    fixture: "default text source",
    id: "effect.phase",
    interactionId: "interaction.effect-phase",
    kind: "control",
    target: "effect.phase",
    userAction: "Drag the Phase slider to a different value.",
  },
  {
    automated: true,
    automatedTestName:
      "proves the speed slider scales shader animation rate",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName: "browser: speed slider changes the shader animation rate",
    },
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Dragging Speed changes how many effect cycles play inside one timeline loop; 0 freezes the animated frame.",
    fixture: "default text source",
    id: "effect.speed",
    interactionId: "interaction.effect-speed",
    kind: "control",
    target: "effect.speed",
    userAction: "Drag the Speed slider to a different value.",
  },
  {
    automated: true,
    automatedTestName:
      "proves the timeline transport drives shader playback",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName:
        "browser: timeline playback drives the animated shader frame",
    },
    componentType: "timeline",
    evidence: "timeline-output",
    expectedObservable:
      "Playing advances the animated shader frame, pausing freezes it, scrubbing renders the deterministic frame at that time, editing duration keeps the seamless forward-only loop, and the first and last frames match.",
    fixture: "default text source",
    id: "timeline.playback",
    kind: "runtime",
    target: "timeline.playback",
    timelineCoverage: "playback",
    timelineLoopProof: {
      direction: "forward-only",
      durationChange: "reproved-after-edit",
      reversePlayback: "forbidden",
      seam: "first-last-match",
    },
    timelinePlaybackCoverage: [
      "pause-resume",
      "scrub",
      "duration",
      "loop",
      "rendered-frame",
    ],
    userAction:
      "Press Play and Pause on the timeline transport, scrub the playhead, edit the loop duration, and compare the rendered frame at the loop seam.",
  },
  {
    automated: true,
    automatedTestName:
      "proves the include-background switch governs preview and export background",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName:
        "browser: include background toggles preview and export background",
    },
    backgroundOutputCoverage: "all-required-background-output",
    componentType: "switch",
    evidence: "rendered-pixels",
    expectedObservable:
      "Turning Background off shows a transparent preview surface and produces a transparent PNG export; the background color still applies when it is on.",
    fixture: "default text source",
    id: "export.includeBackground",
    interactionId: "interaction.include-background",
    kind: "control",
    target: "export.includeBackground",
    userAction:
      "Toggle Background off and on, then export a PNG in both states.",
  },
  {
    automated: true,
    automatedTestName:
      "proves the background color repaints the canvas background",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName: "browser: background color repaints the canvas background",
    },
    componentType: "color",
    evidence: "viewport-side-effect",
    expectedObservable:
      "Changing Color repaints the canvas background behind the transparent shader output and the exported image background.",
    fixture: "default text source",
    id: "appearance.background",
    interactionId: "interaction.appearance-background",
    kind: "control",
    target: "appearance.background",
    userAction: "Pick a different Background Color.",
  },
  {
    automated: true,
    automatedTestName:
      "proves infinity canvas mode keeps output and scene-bounds export working",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName:
        "browser: infinity canvas keeps the shader output and exports scene bounds",
    },
    componentType: "canvas-infinity",
    evidence: "viewport-side-effect",
    expectedObservable:
      "Toggling Infinity canvas keeps the shader output visible and restores it when the mode returns.",
    fixture: "default text source",
    id: "canvas.infinity",
    infinityCanvasCoverage: "mode-continuity-and-restoration",
    kind: "runtime",
    target: "canvas.infinity",
    userAction: "Toggle Infinity canvas on and off in Setup.",
  },
  {
    automated: true,
    automatedTestName:
      "proves infinite mode image export resolves the product scene bounds",
    browser: {
      budget: "extended-io",
      file: shaderSpec,
      testName:
        "browser: infinity canvas image export resolves scene bounds",
    },
    componentType: "canvas-infinity",
    evidence: "exported-bytes",
    expectedObservable:
      "Exporting an image while Infinity canvas is on produces an artifact framed on the declared product scene bounds.",
    fixture: "default text source in infinite canvas mode",
    id: "canvas.infinity.scene-bounds-export",
    infinityCanvasCoverage: "scene-bounds-image-export",
    kind: "runtime",
    target: "canvas.infinity",
    userAction:
      "Enable Infinity canvas in Setup and export a PNG.",
  },
  {
    automated: true,
    automatedTestName:
      "proves render scale changes the shader canvas backing pixels",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName:
        "browser: render scale changes the shader canvas backing resolution",
    },
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Changing Render scale updates the shader canvas backing to exact CSS x devicePixelRatio x selected scale pixels while the output stays correct.",
    fixture: "default text source",
    id: "canvas.renderScale",
    kind: "runtime",
    renderScaleCoverage: {
      kind: "selected-backing-pixels",
      states: ["interaction", "playback", "steady"],
    },
    target: "canvas.renderScale",
    userAction: "Change Render scale in Setup and observe the shader output.",
  },
  {
    automated: true,
    automatedTestName:
      "proves the image format selector offers PNG and JPG",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName: "browser: image formats remain selectable",
    },
    componentType: "select",
    evidence: "product-output",
    expectedObservable:
      "PNG and JPG remain available image export formats and each selection is committed.",
    fixture: "default text source",
    id: "export.image.format",
    kind: "control",
    optionCoverage: ["png", "jpg"],
    target: "export.image.format",
    userAction: "Select PNG and JPG in the Image Export format control.",
  },
  {
    automated: true,
    automatedTestName:
      "proves the image resolution selector offers every size",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName: "browser: image resolutions remain selectable",
    },
    componentType: "select",
    evidence: "product-output",
    expectedObservable:
      "2K, 4K, and 8K remain available image export resolutions and each selection is committed.",
    fixture: "default text source",
    id: "export.image.resolution",
    kind: "control",
    optionCoverage: ["2k", "4k", "8k"],
    target: "export.image.resolution",
    userAction:
      "Select each Image Export resolution and observe the committed value.",
  },
  {
    actionCoverage: ["export.png"],
    automated: true,
    automatedTestName:
      "proves the export action downloads the shader product pixels",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName: "browser: export action downloads the shader image",
    },
    componentType: "panelActions",
    evidence: "exported-bytes",
    exportArtifactCoverage: "all-required-image-export-behavior",
    expectedObservable:
      "The Export action downloads an image artifact whose pixels contain the shader product output composited over the background.",
    fixture: "default text source",
    id: "export.action.image",
    kind: "control",
    target: "actions.shader",
    userAction: "Click the Export action and inspect the downloaded image.",
  },
  {
    actionCoverage: ["shader.randomize", "shader.copy-params", "export.png"],
    automated: true,
    automatedTestName:
      "proves the shader footer actions randomize and copy parameters",
    browser: {
      budget: "standard",
      file: shaderSpec,
      testName:
        "browser: randomize applies new effect values and copy params writes the clipboard",
    },
    componentType: "panelActions",
    evidence: "command-side-effect",
    expectedObservable:
      "Randomize commits a new preset and parameter set that visibly changes the shader output, Copy params writes the current recipe JSON to the clipboard and reports feedback, and Export PNG downloads the image artifact.",
    fixture: "default text source",
    id: "actions.shader",
    kind: "control",
    target: "actions.shader",
    userAction:
      "Click Randomize in the sticky footer, then click Copy params and paste the clipboard contents.",
  },
];

// Product entries use the same explicit stable section IDs as appSchema.
export const appControlSectionInventory: readonly ToolcraftControlSectionInventoryEntry[] =
  [
    {
      entity: "shader source",
      entityId: "source",
      finiteSelectors: [
        {
          affectedTargets: [],
          reason:
            "Type selects which source branch is edited; the text and image controls are conditional on it rather than always-visible dependents.",
          role: "branch",
          target: "source.kind",
        },
      ],
      groupingReason:
        "Type, text content, and image upload all describe the one source material feeding the shader.",
      id: "source",
      targets: ["source.kind", "text.content", "source.image"],
      title: "Source",
    },
    {
      entity: "text typography",
      entityId: "typography",
      finiteSelectors: [],
      groupingReason:
        "Typography styles the text source; it is a distinct text-style entity kept in its own section so the compound picker owns one reset scope.",
      id: "typography",
      targets: ["text.typography"],
      title: "Typography",
    },
    {
      entity: "shader effect",
      entityId: "effect",
      finiteSelectors: [
        {
          reason:
            "Preset selects the fragment branch applied to the source without changing which sibling controls stay relevant.",
          role: "parameter",
          target: "effect.preset",
        },
      ],
      groupingReason:
        "Preset, amount, scale, and phase all tune the one shader effect applied to the source.",
      id: "effect",
      targets: [
        "effect.preset",
        "effect.amount",
        "effect.scale",
        "effect.phase",
        "effect.speed",
      ],
      title: "Effect",
    },
    {
      entity: "output background",
      entityId: "background",
      finiteSelectors: [
        {
          affectedTargets: ["appearance.background"],
          reason:
            "Background inclusion determines whether its color affects preview and export output.",
          role: "branch",
          target: "export.includeBackground",
        },
      ],
      groupingReason:
        "Include background and its color form the canonical output background pair recognized by runtime setup.",
      id: "background",
      targets: ["export.includeBackground", "appearance.background"],
      title: "Background",
    },
    {
      entity: "image delivery",
      entityId: "image-delivery",
      finiteSelectors: [
        {
          reason: "Image format changes its own exported artifact encoding.",
          role: "parameter",
          target: "export.image.format",
        },
        {
          reason:
            "Image resolution changes its own exported artifact dimensions.",
          role: "parameter",
          target: "export.image.resolution",
        },
      ],
      groupingReason:
        "Format and resolution jointly configure the exported shader image.",
      id: "runtime.image-export",
      targets: ["export.image.format", "export.image.resolution"],
      title: "Image Export",
    },
  ];
