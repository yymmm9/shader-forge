export type ShaderEffectPreset = "flow" | "ripple" | "halftone" | "glitch";

export const SHADER_EFFECT_PRESETS: readonly ShaderEffectPreset[] = [
  "flow",
  "ripple",
  "halftone",
  "glitch",
] as const;

export const SHADER_EFFECT_PRESET_INDEX: Readonly<
  Record<ShaderEffectPreset, number>
> = {
  flow: 0,
  ripple: 1,
  halftone: 2,
  glitch: 3,
} as const;

export const SHADER_VERTEX_SOURCE = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const SHADER_FRAGMENT_SOURCE = `#version 300 es
precision highp float;

uniform sampler2D u_source;
uniform float u_hasSource;
uniform int u_effect;
uniform vec2 u_resolution;
uniform vec2 u_sourceSize;
uniform float u_amount;
uniform float u_scale;
uniform float u_phase;
uniform vec3 u_sourceTransform;

in vec2 v_uv;
out vec4 fragColor;

const float TAU = 6.283185307179586;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float total = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    total += amplitude * valueNoise(p);
    p = p * 2.03 + vec2(17.3, 9.1);
    amplitude *= 0.5;
  }
  return total;
}

vec2 coverUv(vec2 uv) {
  float outAspect = u_resolution.x / max(u_resolution.y, 1.0);
  float srcAspect = u_sourceSize.x / max(u_sourceSize.y, 1.0);
  vec2 scale = vec2(1.0);
  if (srcAspect > outAspect) {
    scale.x = outAspect / srcAspect;
  } else {
    scale.y = srcAspect / outAspect;
  }
  vec2 centered = (uv - 0.5) / scale + 0.5;
  float quarterTurns = u_sourceTransform.x;
  float angle = quarterTurns * TAU * 0.25;
  float c = cos(angle);
  float s = sin(angle);
  centered -= 0.5;
  centered = vec2(
    centered.x * c - centered.y * s,
    centered.x * s + centered.y * c
  );
  if (u_sourceTransform.y > 0.5) centered.x = -centered.x;
  if (u_sourceTransform.z > 0.5) centered.y = -centered.y;
  return centered + 0.5;
}

vec4 sampleSource(vec2 uv) {
  vec2 sourceUv = coverUv(uv);
  if (
    sourceUv.x < 0.0 || sourceUv.x > 1.0 ||
    sourceUv.y < 0.0 || sourceUv.y > 1.0
  ) {
    return vec4(0.0);
  }
  return texture(u_source, sourceUv);
}

vec2 flowUv(vec2 uv) {
  vec2 p = uv * vec2(u_resolution.x / u_resolution.y, 1.0);
  float t = u_phase * TAU;
  vec2 warp = vec2(
    fbm(p * u_scale + vec2(t * 0.35, -t * 0.2)),
    fbm(p * u_scale + vec2(-t * 0.25, t * 0.3) + 7.7)
  );
  vec2 drift = vec2(cos(t), sin(t)) * 0.15;
  return uv + (warp - 0.5 + drift) * u_amount * 0.35;
}

vec2 rippleUv(vec2 uv) {
  vec2 centered = uv - 0.5;
  centered.x *= u_resolution.x / u_resolution.y;
  float dist = length(centered);
  float wave = sin(dist * u_scale * 24.0 - u_phase * TAU);
  vec2 dir = dist > 1e-4 ? normalize(centered) : vec2(0.0);
  vec2 offset = dir * wave * u_amount * 0.08;
  offset.x /= max(u_resolution.x / u_resolution.y, 1e-4);
  return uv + offset;
}

vec2 glitchUv(vec2 uv, out float rgbShift) {
  float row = floor(uv.y * u_scale * 60.0);
  float seed = hash21(vec2(row, floor(u_phase * 8.0)));
  float active = step(1.0 - u_amount * 0.6, seed);
  float offset = (seed - 0.5) * u_amount * 0.2 * active;
  rgbShift = u_amount * 0.02 * active;
  return uv + vec2(offset, 0.0);
}

vec4 halftoneColor(vec2 uv) {
  vec2 cellUv = uv * u_resolution;
  float cell = max(24.0 - u_scale * 2.5, 6.0);
  vec2 grid = cellUv / cell;
  vec2 cellId = floor(grid);
  vec2 cellCenter = (cellId + 0.5) * cell / u_resolution;
  vec4 color = sampleSource(cellCenter);
  float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114)) * color.a;
  float radius = mix(0.08, 0.62, lum * u_amount + (1.0 - u_amount) * lum);
  vec2 local = fract(grid) - 0.5;
  float d = length(local);
  float alpha = smoothstep(radius, radius - 0.08, d);
  return vec4(color.rgb, color.a * alpha);
}

void main() {
  vec2 uv = v_uv;
  if (u_hasSource < 0.5) {
    fragColor = vec4(0.0);
    return;
  }

  vec4 color;
  if (u_effect == 2) {
    color = halftoneColor(uv);
  } else {
    vec2 warped = uv;
    float rgbShift = 0.0;
    if (u_effect == 0) {
      warped = flowUv(uv);
    } else if (u_effect == 1) {
      warped = rippleUv(uv);
    } else {
      warped = glitchUv(uv, rgbShift);
    }
    color = sampleSource(warped);
    if (rgbShift > 0.0) {
      vec4 shifted = vec4(
        sampleSource(warped + vec2(rgbShift, 0.0)).r,
        color.g,
        sampleSource(warped - vec2(rgbShift, 0.0)).b,
        color.a
      );
      color = shifted;
    }
  }
  fragColor = color;
}
`;
