import {
  defineToolcraft,
  imageExportModule,
  mediaSourceModule,
  timelineModule,
} from "@/toolcraft/runtime";

import appDefaults from "./app-defaults.json" with { type: "json" };
import { appIdentity } from "./app-identity";
import { shaderControlSections } from "./shader/shader-controls";

export const appSchema = defineToolcraft({
  defaults: appDefaults,
  base: {
    canvas: {
      enabled: true,
      renderScale: true,
      size: { height: 1080, unit: "px", width: 1080 },
      sizing: { mode: "editable-output" },
      upload: true,
    },
    identity: appIdentity,
    panels: {
      controls: {
        sections: shaderControlSections,
        title: "Shader Forge",
      },
    },
    toolbar: {
      history: true,
      radar: true,
      zoom: true,
    },
  },
  modules: [
    mediaSourceModule(),
    imageExportModule(),
    timelineModule({ defaultDurationSeconds: 8, mode: "playback" }),
  ],
});
