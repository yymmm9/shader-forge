export type ShaderEffectPreset =
  | "flow"
  | "ripple"
  | "wave"
  | "swirl"
  | "kaleido"
  | "glitch"
  | "chromatic"
  | "pixelate"
  | "halftone"
  | "dither"
  | "posterize"
  | "edge"
  | "chrome"
  | "grain"
  | "liquid"
  | "aura"
  | "prism"
  | "cylinder"
  | "flag"
  | "coil"
  | "stripes"
  | "ascension"
  | "ink";

export const SHADER_EFFECT_PRESETS: readonly ShaderEffectPreset[] = [
  "flow",
  "ripple",
  "wave",
  "swirl",
  "kaleido",
  "glitch",
  "chromatic",
  "pixelate",
  "halftone",
  "dither",
  "posterize",
  "edge",
  "chrome",
  "grain",
  "liquid",
  "aura",
  "prism",
  "cylinder",
  "flag",
  "coil",
  "stripes",
  "ascension",
  "ink",
] as const;

export const SHADER_EFFECT_PRESET_INDEX: Readonly<
  Record<ShaderEffectPreset, number>
> = {
  flow: 0,
  ripple: 1,
  wave: 2,
  swirl: 3,
  kaleido: 4,
  glitch: 5,
  chromatic: 6,
  pixelate: 7,
  halftone: 8,
  dither: 9,
  posterize: 10,
  edge: 11,
  chrome: 12,
  grain: 13,
  liquid: 14,
  aura: 15,
  prism: 16,
  cylinder: 17,
  flag: 18,
  coil: 19,
  stripes: 20,
  ascension: 21,
  ink: 22,
};

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
uniform float u_time;
uniform vec3 u_sourceTransform;
uniform float u_band;

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

float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x * 0.5 + a.y * a.y * 0.75);
}

float bayer4(vec2 a) {
  return bayer2(a * 0.5) * 0.25 + bayer2(a);
}

float bayer8(vec2 a) {
  return bayer4(a * 0.5) * 0.25 + bayer2(a);
}

vec2 coverUv(vec2 uv) {
  float outAspect = u_resolution.x / max(u_resolution.y, 1.0);
  float srcAspect = u_sourceSize.x / max(u_sourceSize.y, 1.0);
  vec2 fit = vec2(1.0);
  if (srcAspect > outAspect) {
    fit.x = outAspect / srcAspect;
  } else {
    fit.y = srcAspect / outAspect;
  }
  vec2 centered = (uv - 0.5) / fit + 0.5;
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

float sourceLum(vec2 uv) {
  vec4 c = sampleSource(uv);
  return dot(c.rgb, vec3(0.299, 0.587, 0.114));
}

vec2 aspectUv(vec2 uv) {
  vec2 p = uv - 0.5;
  p.x *= u_resolution.x / max(u_resolution.y, 1.0);
  return p;
}

vec2 flowUv(vec2 uv) {
  vec2 p = uv * vec2(u_resolution.x / u_resolution.y, 1.0);
  float a = (u_phase + u_time) * TAU;
  vec2 orbit = vec2(cos(a), sin(a));
  vec2 warp = vec2(
    fbm(p * u_scale + orbit * 1.3),
    fbm(p * u_scale + vec2(cos(a + 2.4), sin(a + 2.4)) * 1.3 + 7.7)
  );
  return uv + (warp - 0.5 + orbit * 0.15) * u_amount * 0.35;
}

vec2 rippleUv(vec2 uv) {
  vec2 centered = aspectUv(uv);
  float dist = length(centered);
  float wave = sin(dist * u_scale * 24.0 - (u_phase + u_time) * TAU);
  vec2 dir = dist > 1e-4 ? normalize(centered) : vec2(0.0);
  vec2 offset = dir * wave * u_amount * 0.08;
  offset.x /= max(u_resolution.x / u_resolution.y, 1e-4);
  return uv + offset;
}

vec4 waveColor(vec2 uv) {
  float t = (u_phase + u_time) * TAU * 2.0;
  vec2 w = uv;
  w.x += sin(uv.y * u_scale * 8.0 + t) * u_amount * 0.06;
  w.y += cos(uv.x * u_scale * 6.0 - t * 0.8) * u_amount * 0.06;
  return sampleSource(w);
}

vec4 swirlColor(vec2 uv) {
  vec2 p = aspectUv(uv);
  float r = length(p);
  float ang = u_amount * 3.0 * smoothstep(0.6, 0.0, r)
    + (u_phase + u_time) * TAU;
  float c = cos(ang);
  float s = sin(ang);
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  p.x /= max(u_resolution.x / u_resolution.y, 1e-4);
  return sampleSource(p + 0.5);
}

vec4 kaleidoColor(vec2 uv) {
  vec2 p = aspectUv(uv);
  float rad = length(p);
  float seg = TAU / max(3.0, floor(3.0 + u_scale * 2.0));
  float ang = atan(p.y, p.x) + (u_phase + u_time) * TAU;
  ang = mod(ang, seg);
  ang = min(ang, seg - ang);
  vec2 kuv = vec2(cos(ang), sin(ang)) * rad;
  kuv.x /= max(u_resolution.x / u_resolution.y, 1e-4);
  return sampleSource(kuv * (0.7 + u_amount * 0.8) + 0.5);
}

vec4 glitchColor(vec2 uv, out float rgbShift) {
  float row = floor(uv.y * u_scale * 60.0);
  float seed = hash21(vec2(row, floor(u_time * 8.0 + u_phase * 8.0)));

  float rowOn = step(1.0 - u_amount * 0.6, seed);
  float offset = (seed - 0.5) * u_amount * 0.2 * rowOn;
  rgbShift = u_amount * 0.02 * rowOn;
  vec4 color = sampleSource(uv + vec2(offset, 0.0));
  if (rgbShift > 0.0) {
    color = vec4(
      sampleSource(uv + vec2(offset + rgbShift, 0.0)).r,
      color.g,
      sampleSource(uv + vec2(offset - rgbShift, 0.0)).b,
      color.a
    );
  }
  return color;
}

vec4 chromaticColor(vec2 uv) {
  vec2 dir = uv - 0.5;
  float dist = length(dir);
  float pulse = 0.6 + 0.4 * cos((u_phase + u_time) * TAU);
  vec2 off = dist > 1e-4
    ? normalize(dir) * u_amount * 0.08 * dist * (1.0 + u_scale * 0.3) * pulse
    : vec2(0.0);
  vec4 color = sampleSource(uv);
  color.r = sampleSource(uv + off).r;
  color.b = sampleSource(uv - off).b;
  return color;
}

vec4 pixelateColor(vec2 uv) {
  float breathe = 0.85 + 0.3 * sin((u_phase + u_time) * TAU);
  float cell = max(1.0, u_scale * (1.0 + u_amount * 24.0) * breathe);
  vec2 grid = u_resolution / cell;
  vec2 cellUv = (floor(uv * grid) + 0.5) / grid;
  return sampleSource(cellUv);
}

vec4 halftoneColor(vec2 uv) {
  vec2 cellUv = uv * u_resolution;
  float pulse = 0.9 + 0.15 * sin((u_phase + u_time) * TAU);
  float cell = max((24.0 - u_scale * 2.5) * pulse, 6.0);
  vec2 grid = cellUv / cell;
  vec2 cellId = floor(grid);
  vec2 cellCenter = (cellId + 0.5) * cell / u_resolution;
  vec4 color = sampleSource(cellCenter);
  float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  float radius = mix(0.08, 0.62, lum * u_amount + (1.0 - u_amount) * lum);
  vec2 local = fract(grid) - 0.5;
  float d = length(local);
  float alpha = smoothstep(radius, radius - 0.08, d);
  return vec4(color.rgb, color.a * alpha);
}

vec4 ditherColor(vec2 uv) {
  vec4 color = sampleSource(uv);
  float block = max(1.0, u_scale * 2.0);
  float a = (u_phase + u_time) * TAU;
  float d = bayer8(
    uv * u_resolution / block + vec2(cos(a), sin(a)) * 2.0
  );
  float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  float on = step(d * (1.05 - u_amount * 0.4), lum);
  return vec4(color.rgb * on, color.a * on);
}

vec4 posterizeColor(vec2 uv) {
  vec4 color = sampleSource(uv);
  float levels = max(2.0, floor(2.0 + u_scale * 2.0 - u_amount * 6.0));
  color.rgb = floor(color.rgb * levels + 0.5) / levels;
  return color;
}

vec4 edgeColor(vec2 uv) {
  vec2 texel = (1.0 + u_scale * 0.5) / u_sourceSize;
  float tl = sourceLum(uv + vec2(-texel.x, texel.y));
  float tc = sourceLum(uv + vec2(0.0, texel.y));
  float tr = sourceLum(uv + vec2(texel.x, texel.y));
  float ml = sourceLum(uv + vec2(-texel.x, 0.0));
  float mr = sourceLum(uv + vec2(texel.x, 0.0));
  float bl = sourceLum(uv + vec2(-texel.x, -texel.y));
  float bc = sourceLum(uv + vec2(0.0, -texel.y));
  float br = sourceLum(uv + vec2(texel.x, -texel.y));
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  float g = length(vec2(gx, gy));
  float e = smoothstep(0.04, 0.5, g * (0.5 + u_amount * 4.0));
  vec3 src = sampleSource(uv).rgb;
  vec3 tint = 0.5 + 0.5 * cos(
    (u_phase + u_time) * TAU + uv.x * 3.0 + uv.y * 2.0 + vec3(0.0, 2.1, 4.2)
  );
  vec3 col = e * (src * 0.6 + tint * 0.7);
  return vec4(col, e);
}

vec4 chromeColor(vec2 uv) {
  vec2 texel = 1.0 / u_sourceSize;
  float gx = sourceLum(uv + vec2(texel.x, 0.0))
    - sourceLum(uv - vec2(texel.x, 0.0));
  float gy = sourceLum(uv + vec2(0.0, texel.y))
    - sourceLum(uv - vec2(0.0, texel.y));
  vec4 src = sampleSource(uv);
  float n = length(vec2(gx, gy)) * (2.0 + u_amount * 6.0);
  vec3 band = 0.5 + 0.5 * cos(
    n * u_scale * 6.0 - (u_phase + u_time) * TAU
      + vec3(0.0, 1.0, 2.0)
  );
  vec3 col = mix(src.rgb * 0.12, band, smoothstep(0.02, 0.5, n));
  return vec4(col, src.a);
}

vec4 grainColor(vec2 uv) {
  vec4 color = sampleSource(uv);
  float a = (u_phase + u_time) * TAU * 3.0;
  vec2 seedUv = uv * u_resolution + vec2(cos(a), sin(a)) * 73.0;
  float n = hash21(seedUv) - 0.5;
  return vec4(color.rgb + n * u_amount * color.a, color.a);
}

vec4 liquidColor(vec2 uv) {
  vec4 src = sampleSource(uv);
  float a = (u_phase + u_time) * TAU;
  vec2 p = aspectUv(uv) * (1.0 + u_scale * 0.8);
  vec2 q = vec2(
    fbm(p + vec2(cos(a), sin(a)) * 0.7),
    fbm(p + vec2(sin(a + 1.7), cos(a + 1.7)) * 0.7 + 5.2)
  );
  vec2 r = vec2(
    fbm(p + 3.0 * q + vec2(1.7, 9.2) + a * 0.2),
    fbm(p + 3.0 * q + vec2(8.3, 2.8) - a * 0.15)
  );
  float f = fbm(p + 3.0 * r);
  vec3 grad = 0.5 + 0.5 * cos(
    f * 4.0 + a + vec3(0.0, 0.33, 0.67) * TAU
  );
  vec3 col = mix(src.rgb, grad, u_amount);
  return vec4(col, src.a);
}

vec4 auraColor(vec2 uv) {
  vec4 src = sampleSource(uv);
  vec2 texel = (1.0 + u_scale) / u_sourceSize;
  float gx = sourceLum(uv + vec2(texel.x, 0.0))
    - sourceLum(uv - vec2(texel.x, 0.0));
  float gy = sourceLum(uv + vec2(0.0, texel.y))
    - sourceLum(uv - vec2(0.0, texel.y));
  float g = length(vec2(gx, gy));
  float a = (u_phase + u_time) * TAU;
  vec3 tint = 0.5 + 0.5 * cos(
    a + uv.x * 4.0 + uv.y * 3.0 + vec3(0.0, 2.0, 4.0)
  );
  float halo = smoothstep(0.02, 0.6, g) * u_amount;
  return vec4(src.rgb + tint * halo * 0.9, src.a);
}

vec4 prismColor(vec2 uv) {
  vec4 src = sampleSource(uv);
  vec2 texel = (1.0 + u_scale * 0.5) / u_sourceSize;
  float gx = sourceLum(uv + vec2(texel.x, 0.0))
    - sourceLum(uv - vec2(texel.x, 0.0));
  float gy = sourceLum(uv + vec2(0.0, texel.y))
    - sourceLum(uv - vec2(0.0, texel.y));
  float g = length(vec2(gx, gy));
  float a = (u_phase + u_time) * TAU;
  vec3 tint = 0.5 + 0.5 * cos(
    a + atan(gy, gx) * 2.0 + vec3(0.0, 2.1, 4.2)
  );
  float edge = smoothstep(0.05, 0.8, g) * u_amount;
  vec3 col = mix(src.rgb, src.rgb * 0.5 + tint, edge * 0.85);
  return vec4(col, src.a);
}

vec4 sampleStrip(vec2 suv) {
  vec2 t = vec2(suv.x, (suv.y - 0.5) * u_band + 0.5);
  float angle = u_sourceTransform.x * TAU * 0.25;
  float c = cos(angle);
  float s = sin(angle);
  vec2 r = t - 0.5;
  r = vec2(r.x * c - r.y * s, r.x * s + r.y * c);
  if (u_sourceTransform.y > 0.5) r.x = -r.x;
  if (u_sourceTransform.z > 0.5) r.y = -r.y;
  r += 0.5;
  if (r.x < 0.0 || r.x > 1.0 || r.y < 0.0 || r.y > 1.0) {
    return vec4(0.0);
  }
  return texture(u_source, r);
}

vec4 cylinderColor(vec2 uv) {
  vec2 p = aspectUv(uv);
  float rot = (u_phase + u_time) * TAU;
  float stacks = 1.0 + floor(u_scale * 0.75);
  float stackBand = min(0.92, 0.3 * stacks);
  float ringH = stackBand / stacks;
  float ly = (uv.y - (0.5 - stackBand * 0.5)) / ringH;
  if (ly < 0.0 || ly >= stacks) return vec4(0.0);
  float ring = floor(ly);
  float ringV = fract(ly);
  float x = clamp(p.x / 0.34, -1.0, 1.0);
  float thetaF = asin(x);
  float thetaB = 3.14159265 - thetaF;
  float ringOff = ring * 0.37;
  float bob = sin(thetaF * 3.0 + ringOff * TAU) * u_amount * 0.22;
  vec4 front = sampleStrip(
    vec2(fract((thetaF - rot) / TAU + ringOff), ringV + bob)
  );
  vec4 back = sampleStrip(
    vec2(fract((thetaB - rot) / TAU - ringOff), ringV - bob)
  );
  front.rgb *= 0.45 + 0.55 * cos(thetaF);
  back.rgb *= 0.14 + 0.18 * cos(thetaF);
  back.a *= 0.5;
  vec3 rgb = mix(back.rgb, front.rgb, front.a);
  return vec4(rgb, max(front.a, back.a));
}

vec4 flagColor(vec2 uv) {
  float a = (u_phase + u_time) * TAU;
  float bandH = 0.62;
  vec2 su = vec2(uv.x, (uv.y - 0.5) / bandH + 0.5);
  float freq = 0.8 + u_scale * 0.45;
  float amp = u_amount * (0.04 + 0.3 * su.x);
  float ph = su.x * freq * TAU - a;
  su.y += sin(ph) * amp;
  su.x += cos(ph) * amp * 0.35;
  vec4 c = sampleStrip(su);
  float shade = 0.7 + 0.3 * cos(ph + 1.4);
  return vec4(c.rgb * shade, c.a);
}

vec4 coilColor(vec2 uv) {
  float a = (u_phase + u_time) * TAU;
  float freq = 1.0 + u_scale * 0.6;
  float amp = 0.08 + u_amount * 0.28;
  float thick = 0.2;
  float ph = uv.x * freq * TAU - a;
  float dy = uv.y - 0.5 - amp * sin(ph);
  float suY = dy / thick + 0.5;
  vec4 c = sampleStrip(vec2(fract(ph / TAU), suY));
  float rim = cos(clamp(suY, 0.0, 1.0) * 3.14159265);
  float shade = 0.55 + 0.45 * rim;
  return vec4(c.rgb * shade, c.a);
}

vec4 stripesColor(vec2 uv) {
  float a = (u_phase + u_time) * TAU;
  float bands = 2.0 + floor(u_scale * 1.5);
  float bandH = 0.6;
  vec2 su = vec2(uv.x, (uv.y - 0.5) / bandH + 0.5);
  float band = floor(su.x * bands);
  float bob = sin(a + band * 1.15) * u_amount * 0.45;
  float shear = cos(a * 0.8 + band * 1.7) * u_amount * 0.2;
  su.y += bob;
  su.x += shear * (su.y - 0.5);
  vec4 c = sampleStrip(su);
  float shade = 0.78 + 0.22 * cos(a + band * 1.15);
  return vec4(c.rgb * shade, c.a);
}

vec4 ascensionColor(vec2 uv) {
  float a = (u_phase + u_time) * TAU;
  float bandH = 0.55;
  vec2 su = vec2(uv.x, (uv.y - 0.5) / bandH + 0.5);

  float cx = (su.x - 0.5) * 2.0;
  float arch = 0.10 + u_amount * 0.18;
  su.y -= arch * (1.0 - cx * cx);

  float wob = 0.3 + u_amount;
  su.y += (sin(su.x * 14.0 + a) + 0.6 * sin(su.x * 23.0 - a * 1.3))
    * 0.012 * wob;
  su.x += sin(su.y * 16.0 + a * 0.8) * 0.006 * wob;

  vec4 src = sampleStrip(su);
  float m = src.a;
  float lum = dot(src.rgb, vec3(0.299, 0.587, 0.114));

  float mx = sampleStrip(su + vec2(0.012, 0.0)).a
    - sampleStrip(su - vec2(0.012, 0.0)).a;
  float my = sampleStrip(su + vec2(0.0, 0.012)).a
    - sampleStrip(su - vec2(0.0, 0.012)).a;

  float freq = 5.0 + u_scale * 9.0;
  float sweep = su.y * freq - a * 0.35 + mx * 2.0;
  float s1 = 0.5 + 0.5 * cos(sweep * TAU);
  float chrome = pow(s1, 3.5);
  float s2 = 0.5 + 0.5 * cos(sweep * TAU * 0.37 + 1.9);
  float metal = clamp(chrome * 1.6 + s2 * 0.55, 0.0, 1.0);
  metal *= mix(1.15, 0.75, su.y);
  vec3 fill = vec3(0.32 + metal * 0.8)
    * mix(vec3(1.0), src.rgb * 1.6, 0.3);
  fill *= 0.4 + 0.6 * lum;

  float eg = length(vec2(mx, my));
  vec3 hue = 0.5 + 0.5 * cos(
    atan(my, mx) + a * 0.3 + vec3(0.0, 2.09, 4.19)
  );
  vec3 col = fill + hue * eg * (1.5 + u_amount * 2.0);

  float halo = max(
    max(
      sampleStrip(su + vec2(0.0, 0.016)).a,
      sampleStrip(su - vec2(0.0, 0.016)).a
    ),
    max(
      sampleStrip(su + vec2(0.016, 0.0)).a,
      sampleStrip(su - vec2(0.016, 0.0)).a
    )
  );
  halo = max(halo - m, 0.0);
  float haloA = halo * (0.3 + 0.35 * u_amount);
  vec3 glowCol = vec3(0.85, 0.9, 1.0) * haloA;
  col = col * m + glowCol;
  return vec4(col, max(m, haloA * 0.7));
}

// --- ink: procedural ink-in-water reconstruction (video2glsl) -------------
// Self-contained scene: no source texture required. All motion terms are
// periodic in a = (u_phase + u_time) * TAU so the loop is seamless.
// Structure mirrors public/shaders/ink-in-water.frag: bold falling trails
// (one sepia), a billowing plume gated by a grow cycle, tangled residue
// webs, sparse hanging threads, translucent veils and bottom murk.

float inkHash(float p) {
  return hash21(vec2(p, p + 19.19));
}

vec2 inkOrbit(float a, float r, float ph) {
  return r * vec2(cos(a + ph), sin(a + ph));
}

float inkFbmS(vec2 p) {
  return fbm(p) * 2.0 - 1.0;
}

float inkRidged(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  float w = 1.0;
  float norm = 0.0;
  for (int i = 0; i < 5; i++) {
    float n = 1.0 - abs(valueNoise(p) * 2.0 - 1.0);
    n *= n;
    sum += amp * n * w;
    norm += amp;
    w = clamp(n * 2.0, 0.0, 1.0);
    amp *= 0.5;
    p = p * 2.03 + vec2(17.3, 9.1);
  }
  return sum / norm;
}

float inkBillow(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  float w = 1.0;
  float norm = 0.0;
  for (int i = 0; i < 4; i++) {
    float n = abs(valueNoise(p) * 2.0 - 1.0);
    n = n * (2.0 - n);
    sum += amp * n * w;
    norm += amp;
    w = clamp(n * 1.5, 0.0, 1.0);
    amp *= 0.5;
    p = p * 2.03 + vec2(17.3, 9.1);
  }
  return sum / norm;
}

vec3 inkBackground(vec2 p, vec2 uv01, float a) {
  float streaks = inkFbmS(vec2(uv01.x * 16.0, uv01.y * 0.9));
  vec3 col = vec3(0.938, 0.940, 0.948) - 0.038 * streaks;
  float flare = smoothstep(0.40, 1.0, uv01.x)
    * smoothstep(0.50, 1.0, uv01.y);
  col += vec3(0.06, 0.04, 0.005) * flare;
  vec2 drift = 0.014 * inkOrbit(a, 1.0, 0.0);
  float bok = exp(-90.0 * dot(
      uv01 - vec2(0.870, 0.945) - drift, uv01 - vec2(0.870, 0.945) - drift))
    + 0.6 * exp(-140.0 * dot(
      uv01 - vec2(0.955, 0.885) + drift, uv01 - vec2(0.955, 0.885) + drift));
  col += vec3(0.15, 0.10, 0.02) * bok;
  float vig = smoothstep(1.80, 0.60, length(p * vec2(0.80, 1.0)));
  return col * (0.95 + 0.05 * vig);
}

// ragged ink attached to the top edge where trails enter
float inkTopRag(vec2 p, float a) {
  float edge = 0.86 + 0.06 * inkFbmS(
    vec2(p.x * 2.6, 1.7) + inkOrbit(a, 0.20, 1.2));
  float m = smoothstep(edge - 0.02, edge + 0.12, p.y);
  float lace = inkRidged(
    vec2(p.x * 9.0, p.y * 10.0) + inkOrbit(a, 0.26, 3.0));
  m *= 0.50 + 0.50 * smoothstep(0.12, 0.75, lace);
  float lanes = smoothstep(0.65, -0.35, abs(p.x + 0.38))
    + 0.90 * smoothstep(0.42, -0.12, abs(p.x - 0.30))
    + 0.35 * smoothstep(0.55, -0.25, abs(p.x - 0.62));
  return m * clamp(lanes, 0.08, 1.0);
}

// tangled filament web confined to a soft region mask
float inkCloudWeb(vec2 p, float a, vec2 center, vec2 radii, float phase) {
  vec2 q = (p - center) / radii;
  float mask = smoothstep(1.0, 0.45, length(q));
  if (mask <= 0.0) return 0.0;
  float freq = max(0.4, u_scale * 0.6);
  vec2 flow = vec2(
    inkFbmS(p * 1.8 + inkOrbit(a, 0.26, phase)),
    inkFbmS(p * 1.8 + inkOrbit(a, 0.26, phase + 2.4) + vec2(5.2, 1.3)));
  vec2 w = p * vec2(3.2, 4.2) * freq + 0.9 * flow;
  float f = inkFbmS(w + inkOrbit(a, 0.40, phase + 1.9));
  float web = smoothstep(0.10, 0.015, abs(f));
  float clump = smoothstep(0.30, 0.72,
    inkFbmS(p * vec2(2.2, 3.0) + inkOrbit(a, 0.30, phase + 4.0)));
  return web * clump * mask;
}

// sparse thin hanging threads, each on a limited y-range
float inkThreads(vec2 p, float a) {
  float acc = 0.0;
  float freq = max(0.4, u_scale * 0.6);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float baseX = -0.70 + fi * 0.23
      + 0.12 * (inkHash(fi * 3.1 + 0.7) - 0.5);
    float wander = inkFbmS(vec2(p.y * 1.5 + fi * 3.3, fi * 5.1));
    float lane = baseX + 0.09 * wander
      + 0.035 * sin(a + p.y * 1.4 + fi * 2.2);
    float x = p.x - lane;
    float w = 0.0035 + 0.0028 * inkHash(fi * 4.3 + 1.1) / freq;
    float top = 0.55 - 0.65 * inkHash(fi * 6.7 + 0.3);
    float bot = top - 0.55 - 0.55 * inkHash(fi * 8.9 + 1.7);
    float span = smoothstep(top, top - 0.10, p.y)
      * smoothstep(bot, bot + 0.12, p.y);
    float tube = smoothstep(w, 0.0, abs(x));
    float margin = smoothstep(w * 5.0, w, abs(x)) * 0.30
      * smoothstep(0.45, 0.85, inkRidged(
        vec2(x * 40.0, p.y * 3.4) + inkOrbit(a, 0.24, fi)));
    acc += (tube * 0.9 + margin) * span;
  }
  return acc;
}

// one falling trail: explicit lane, soft diffusing edges,
// denser near the top, fraying as it sinks
float inkTrailLane(vec2 p, float a, float fi, float baseX, float wBase,
                   float swayPh) {
  float wander = inkFbmS(vec2(p.y * 1.4 + fi * 5.0, fi * 2.3));
  float lane = baseX + 0.12 * wander + 0.05 * sin(a + p.y * 1.2 + swayPh);
  float x = p.x - lane;
  float depth = (1.0 - p.y) * 0.5;
  float w = wBase * (0.65 + 0.80 * depth);
  float tex = inkRidged(vec2(x * 24.0, p.y * 2.6)
    + inkOrbit(a, 0.26, fi * 1.7));
  float tube = smoothstep(w, -w * 0.4, abs(x));
  float strand = 0.62 + 0.38 * inkRidged(
    vec2(x * 46.0, p.y * 2.4) + inkOrbit(a, 0.24, fi * 2.9));
  float margin = smoothstep(w * 2.6, w * 0.4, abs(x))
    * smoothstep(0.45, 0.80, tex);
  return (tube * (0.60 + 0.40 * tex) * strand * 1.55 + margin * 0.70);
}

float inkBlackTrails(vec2 p, float a) {
  float t0 = inkTrailLane(p, a, 0.0, -0.38, 0.045, 1.9) * 1.45;
  float grow = smoothstep(0.02, 0.55, 0.5 + 0.5 * sin(a - 1.1));
  float t1 = inkTrailLane(p, a, 1.0, 0.28, 0.060, 4.1) * 2.1
    * smoothstep(-0.45, 0.10, p.y) * (0.35 + 0.65 * grow);
  float t2 = inkTrailLane(p, a, 2.0, 0.02, 0.010, 2.7) * 0.55
    * smoothstep(0.75, 0.20, p.y);
  return t0 + t1 + t2;
}

// right-hand sepia column: thinner, branched, distinctly brown
float inkSepiaTrail(vec2 p, float a) {
  float main = inkTrailLane(p, a, 4.0, 0.62, 0.014, 0.8);
  float branch = inkTrailLane(p, a, 5.0, 0.53, 0.008, 3.4)
    * smoothstep(0.85, 0.20, p.y);
  vec2 q = p - vec2(0.60, 0.30);
  float haz = inkFbmS(q * vec2(4.5, 2.4) + inkOrbit(a, 0.28, 2.2));
  float halo = smoothstep(0.48, 0.0, abs(q.x))
    * smoothstep(0.15, 0.55, haz)
    * smoothstep(-0.9, 0.5, p.y) * 0.95;
  return (main + 0.9 * branch) * 1.6 + halo;
}

// billowing plume gated by a grow cycle: compact mass, lobed bottom,
// high-contrast fibrous interior, short skirt of spent ink below
float inkPlume(vec2 p, float a) {
  float grow = smoothstep(0.02, 0.55, 0.5 + 0.5 * sin(a - 1.1));
  vec2 c = vec2(0.08 + 0.05 * sin(a + 0.6),
    mix(0.22, -0.16, grow) + 0.04 * cos(2.0 * a));
  vec2 d = (p - c) * vec2(0.80, 1.05);

  float body = inkFbmS(d * 2.4 + inkOrbit(a, 0.45, 0.4));
  float rag = inkRidged(d * 8.5 + inkOrbit(a, 0.28, 2.6));
  float r1 = length(d) - 0.34 * body - 0.07 + 0.13 * (rag - 0.5);
  float r2 = length(d - vec2(0.20, -0.10))
    - 0.22 * inkFbmS(d * 2.8 + inkOrbit(a, 0.40, 1.9))
    - 0.04 + 0.12 * (rag - 0.5);
  float r = min(r1, r2 * 1.35);
  float lace = inkRidged(d * 10.0 + inkOrbit(a, 0.32, 1.7));
  float inside = smoothstep(0.28, -0.06, r);
  float fib = smoothstep(0.20, 0.80, lace) * 1.10 + 0.42;
  float coreMask = smoothstep(0.38, -0.05, r)
    * smoothstep(-0.38, 0.10, d.y);
  float fringe = pow(inkRidged(d * 16.0 + inkOrbit(a, 0.26, 4.4)), 2.5)
    * smoothstep(0.55, 0.10, r);
  float below = smoothstep(0.0, -0.40, p.y - c.y);
  float skirt = 0.28 * lace * below * smoothstep(0.55, 0.15, abs(r - 0.38));
  float m = inside * fib * (0.55 + 1.60 * coreMask)
    + 0.80 * fringe + skirt;
  return clamp(m * (0.18 + 1.05 * grow), 0.0, 1.0);
}

float inkVeils(vec2 p, float a) {
  vec2 q = vec2(p.x * 0.50, p.y * 0.28);
  vec2 w = vec2(
    inkFbmS(q * 1.4 + inkOrbit(a, 0.28, 0.2)),
    inkFbmS(q * 1.4 + inkOrbit(a, 0.28, 2.9) + vec2(5.2, 1.3)));
  float v = 0.5 + 0.5 * inkFbmS(q * 1.6 + 1.6 * w + inkOrbit(a, 0.32, 4.4));
  float streak = 0.70 + 0.30 * inkFbmS(
    vec2(p.x * 8.0, p.y * 0.45) + inkOrbit(a, 0.28, 3.7));
  float leftBias = 0.70 + 0.50 * smoothstep(0.85, -0.55, p.x);
  return v * v * streak * leftBias;
}

float inkMurk(vec2 p, float a) {
  float rise = 0.5 + 0.5 * sin(a - 0.4);
  float edge = -0.58 - 0.14 * rise + 0.12 * inkFbmS(
    vec2(p.x * 3.0, 4.0) + inkOrbit(a, 0.24, 2.2));
  float g = smoothstep(edge + 0.32, edge - 0.30, p.y);
  float n = inkBillow(p * vec2(3.0, 4.2) + inkOrbit(a, 0.26, 4.1));
  float leftBias = 0.60 + 0.40 * smoothstep(0.7, -0.5, p.x);
  return g * (0.20 + 0.80 * n) * leftBias;
}

vec4 inkColor(vec2 uv) {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= aspect;
  float a = (u_phase + u_time) * TAU;

  vec3 col = inkBackground(p, uv, a);
  float webs = inkCloudWeb(p, a, vec2(0.05, -0.45), vec2(0.75, 0.60), 0.0)
    + inkCloudWeb(p, a, vec2(-0.45, -0.75), vec2(0.55, 0.45), 2.1)
    + inkCloudWeb(p, a, vec2(-0.10, 0.55), vec2(0.60, 0.35), 4.2);
  float dB = 0.40 * inkVeils(p, a)
    + 0.50 * inkThreads(p, a)
    + 0.60 * webs
    + 0.95 * inkTopRag(p, a)
    + inkBlackTrails(p, a)
    + 1.55 * inkPlume(p, a)
    + 0.68 * inkMurk(p, a)
    + 0.03 * (0.5 + 0.5 * inkFbmS(p * 1.1 + inkOrbit(a, 0.5, 5.0)));
  float dS = inkSepiaTrail(p, a);
  dB *= 0.4 + u_amount * 1.6;
  dS *= 0.4 + u_amount * 1.6;

  float sepA = 1.0 - exp(-3.6 * dS);
  vec3 sepCol = mix(
    vec3(0.55, 0.44, 0.34),
    vec3(0.240, 0.165, 0.105),
    smoothstep(0.05, 0.55, dS));
  col = mix(col, sepCol, clamp(sepA, 0.0, 1.0));

  float inkA = 1.0 - exp(-4.0 * dB);
  vec3 ink = mix(
    vec3(0.225, 0.215, 0.215),
    vec3(0.040, 0.034, 0.032),
    smoothstep(0.04, 0.55, dB));
  col = mix(col, ink, clamp(inkA, 0.0, 1.0));
  col += (hash21(uv * u_resolution) - 0.5) * 0.012;
  return vec4(col, 1.0);
}

void main() {
  vec2 uv = v_uv;
  if (u_effect == 22) {
    fragColor = inkColor(uv);
    return;
  }
  if (u_hasSource < 0.5) {
    fragColor = vec4(0.0);
    return;
  }

  vec4 color;
  if (u_effect == 0) {
    color = sampleSource(flowUv(uv));
  } else if (u_effect == 1) {
    color = sampleSource(rippleUv(uv));
  } else if (u_effect == 2) {
    color = waveColor(uv);
  } else if (u_effect == 3) {
    color = swirlColor(uv);
  } else if (u_effect == 4) {
    color = kaleidoColor(uv);
  } else if (u_effect == 5) {
    float rgbShift = 0.0;
    color = glitchColor(uv, rgbShift);
  } else if (u_effect == 6) {
    color = chromaticColor(uv);
  } else if (u_effect == 7) {
    color = pixelateColor(uv);
  } else if (u_effect == 8) {
    color = halftoneColor(uv);
  } else if (u_effect == 9) {
    color = ditherColor(uv);
  } else if (u_effect == 10) {
    color = posterizeColor(uv);
  } else if (u_effect == 11) {
    color = edgeColor(uv);
  } else if (u_effect == 12) {
    color = chromeColor(uv);
  } else if (u_effect == 13) {
    color = grainColor(uv);
  } else if (u_effect == 14) {
    color = liquidColor(uv);
  } else if (u_effect == 15) {
    color = auraColor(uv);
  } else if (u_effect == 16) {
    color = prismColor(uv);
  } else if (u_effect == 17) {
    color = cylinderColor(uv);
  } else if (u_effect == 18) {
    color = flagColor(uv);
  } else if (u_effect == 19) {
    color = coilColor(uv);
  } else if (u_effect == 20) {
    color = stripesColor(uv);
  } else {
    color = ascensionColor(uv);
  }
  fragColor = color;
}
`;
