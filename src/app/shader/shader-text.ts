import {
  getFontPickerFontById,
  type FontPickerFontCatalogEntry,
} from "@/toolcraft/ui";

import type { ShaderTypography } from "./shader-state";

const TEXT_RASTER_MIN_EDGE = 1024;
const TEXT_RASTER_MAX_EDGE = 2048;
const FONT_SIZE_REFERENCE = 108;
const HORIZONTAL_INSET = 0.92;

const LETTER_SPACING_EM: Readonly<
  Record<ShaderTypography["letterSpacing"], number>
> = {
  normal: 0,
  tight: -0.02,
  tighter: -0.04,
  tightest: -0.06,
  wide: 0.05,
  wider: 0.1,
  widest: 0.2,
};

const LINE_HEIGHT_FACTOR: Readonly<
  Record<ShaderTypography["lineHeight"], number>
> = {
  loose: 1.6,
  none: 1,
  normal: 1.2,
  relaxed: 1.4,
  spacious: 1.8,
  snug: 1.1,
  tight: 1,
};

const fontLoadPromises = new Map<string, Promise<void>>();
const injectedStylesheets = new Set<string>();

function applyTextCase(text: string, textCase: string): string {
  switch (textCase) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/\b\w/g, (char) => char.toUpperCase());
    case "titleCase":
      return text.replace(
        /\w\S*/g,
        (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      );
    default:
      return text;
  }
}

function buildFontStylesheetHref(entry: FontPickerFontCatalogEntry): string {
  const family = entry.family.trim().replace(/\s+/g, "+");
  const weightAxis = entry.weights.length
    ? Array.from(new Set(entry.weights)).join(";")
    : "400";
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${weightAxis}&display=swap`;
}

function parseFontFaces(
  family: string,
  css: string,
): FontFace[] {
  const faces: FontFace[] = [];
  for (const match of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const block = match[1] ?? "";
    const url = /url\((https:[^)\s]+)\)/.exec(block)?.[1];
    if (!url) continue;
    faces.push(
      new FontFace(family, `url(${url}) format("woff2")`, {
        style: "normal",
        unicodeRange: /unicode-range:\s*([^;]+);/.exec(block)?.[1]?.trim(),
        weight: /font-weight:\s*([0-9]+)/.exec(block)?.[1] ?? "400",
      }),
    );
  }
  return faces;
}

async function ensureFontStylesheet(
  entry: FontPickerFontCatalogEntry,
): Promise<void> {
  if (injectedStylesheets.has(entry.id)) return;
  injectedStylesheets.add(entry.id);
  try {
    const response = await fetch(buildFontStylesheetHref(entry));
    if (!response.ok) return;
    const faces = parseFontFaces(entry.family, await response.text());
    await Promise.all(faces.map((face) => face.load()));
    for (const face of faces) document.fonts.add(face);
  } catch {
    // Font fetch failures keep the fallback family raster.
  }
}

async function ensureShaderFont(
  fontId: string,
  fontWeight: string,
): Promise<void> {
  const entry = getFontPickerFontById(fontId);
  const family = entry?.family ?? "Inter";
  const key = `${family}:${fontWeight}`;
  const pending = fontLoadPromises.get(key);
  if (pending) return pending;

  const promise = (async () => {
    if (entry) await ensureFontStylesheet(entry);
    try {
      await document.fonts.load(`${fontWeight} 64px "${family}"`);
    } catch {
      // Font load failures keep the fallback family raster.
    }
  })();
  fontLoadPromises.set(key, promise);
  return promise;
}

export async function ensureShaderTextFont(
  typography: ShaderTypography,
): Promise<void> {
  await ensureShaderFont(typography.fontId, typography.fontWeight);
}

const rasterCache = { canvas: null as OffscreenCanvas | null, key: "" };

export function rasterizeShaderText(
  text: string,
  typography: ShaderTypography,
  aspect: number,
): OffscreenCanvas | null {
  const cacheKey = JSON.stringify([text, typography, aspect]);
  if (rasterCache.key === cacheKey) return rasterCache.canvas;

  const family = getFontPickerFontById(typography.fontId)?.family ?? "Inter";

  const width = Math.min(
    TEXT_RASTER_MAX_EDGE,
    Math.max(TEXT_RASTER_MIN_EDGE, Math.round(TEXT_RASTER_MIN_EDGE * aspect)),
  );
  const height = Math.round(width / Math.max(0.1, aspect));

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) return null;

  const lines = applyTextCase(text, typography.textCase)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    rasterCache.canvas = canvas;
    rasterCache.key = cacheKey;
    return canvas;
  }

  const baseSize = (typography.fontSize / FONT_SIZE_REFERENCE) * height;
  const weight = /^\d+$/.test(typography.fontWeight)
    ? typography.fontWeight
    : "400";
  const lineHeight = baseSize * LINE_HEIGHT_FACTOR[typography.lineHeight];
  const alpha = Math.min(1, Math.max(0, typography.opacity / 100));

  const fontFor = (size: number) =>
    `${weight} ${Math.round(size)}px "${family}", sans-serif`;

  let fontSize = baseSize;
  let letterSpacing = LETTER_SPACING_EM[typography.letterSpacing] * fontSize;
  context.font = fontFor(fontSize);
  context.letterSpacing = `${letterSpacing}px`;

  const maxWidth = width * HORIZONTAL_INSET;
  const widest = Math.max(
    ...lines.map((line) => context.measureText(line).width),
    0,
  );
  if (widest > maxWidth) {
    fontSize = Math.max(8, (fontSize * maxWidth) / widest);
    letterSpacing = LETTER_SPACING_EM[typography.letterSpacing] * fontSize;
    context.font = fontFor(fontSize);
    context.letterSpacing = `${letterSpacing}px`;
  }

  context.fillStyle = typography.color;
  context.globalAlpha = alpha;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const totalHeight = lineHeight * (lines.length - 1);
  const startY = height / 2 - totalHeight / 2;
  lines.forEach((line, index) => {
    context.fillText(line, width / 2, startY + index * lineHeight);
  });
  rasterCache.canvas = canvas;
  rasterCache.key = cacheKey;
  return canvas;
}
