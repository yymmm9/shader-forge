import type { ReadonlyToolcraftState } from "@/toolcraft/runtime/state/readonly-state";

import type { ShaderSourceTransform } from "./shader-gl";
import {
  getShaderMediaBitmap,
  settleShaderMediaImage,
} from "./shader-media";
import {
  getShaderSourceImageAsset,
  getShaderSourceKind,
  getShaderText,
  getShaderTypography,
  type ShaderTypography,
} from "./shader-state";
import {
  ensureShaderTextFont,
  rasterizeShaderText,
} from "./shader-text";

export type ShaderSourceDescriptor = Readonly<
  | {
      aspect: number;
      kind: "text";
      text: string;
      typography: ShaderTypography;
    }
  | {
      assetId: string;
      kind: "image";
      transform: ShaderSourceTransform;
    }
  | { kind: "empty" }
>;

export type ResolvedShaderSource = Readonly<{
  source: TexImageSource | null;
  transform: ShaderSourceTransform;
}>;

const identityTransform: ShaderSourceTransform = {
  flipHorizontal: false,
  flipVertical: false,
  quarterTurns: 0,
};

function imageTransform(
  rotationDeg: number | undefined,
  flipHorizontal: boolean | undefined,
  flipVertical: boolean | undefined,
): ShaderSourceTransform {
  return {
    flipHorizontal: flipHorizontal === true,
    flipVertical: flipVertical === true,
    quarterTurns: ((rotationDeg ?? 0) / 90) % 4,
  };
}

export function resolveShaderSource(
  state: ReadonlyToolcraftState,
): ShaderSourceDescriptor {
  if (getShaderSourceKind(state) === "text") {
    return {
      aspect:
        state.canvas.size.width / Math.max(1, state.canvas.size.height),
      kind: "text",
      text: getShaderText(state),
      typography: getShaderTypography(state),
    };
  }

  const asset = getShaderSourceImageAsset(state);
  if (!asset) return { kind: "empty" };
  return {
    assetId: asset.id,
    kind: "image",
    transform: imageTransform(
      asset.transform?.rotationDeg,
      asset.transform?.flipHorizontal,
      asset.transform?.flipVertical,
    ),
  };
}

export async function materializeShaderSource(
  descriptor: ShaderSourceDescriptor,
  options: Readonly<{ waitForImage?: boolean }> = {},
): Promise<ResolvedShaderSource> {
  if (descriptor.kind === "text") {
    await ensureShaderTextFont(descriptor.typography);
    return {
      source: rasterizeShaderText(
        descriptor.text,
        descriptor.typography,
        descriptor.aspect,
      ),
      transform: identityTransform,
    };
  }

  if (descriptor.kind === "image") {
    if (options.waitForImage) {
      await settleShaderMediaImage(descriptor.assetId);
    }
    return {
      source: getShaderMediaBitmap(descriptor.assetId) ?? null,
      transform: descriptor.transform,
    };
  }

  return { source: null, transform: identityTransform };
}
