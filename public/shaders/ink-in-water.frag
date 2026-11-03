// Ink in water — procedural reconstruction of a real footage segment.
// Reference: "Ink drops in water.ogv" (Wikimedia Commons), 58–74 s window.
// Seamless loop: every animated term is periodic in `a = TAU * t`.

#define DEBUG_MODE 0

// Library code below is bundled from shader-skills (MIT): https://github.com/gokayfem/shader-skills
// ---- shader-skills library: common ----
const float TAU = 6.28318530717959;
// Clamp to [0,1].
float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }

// ---- shader-skills library: hash ----
// PCG-style 1D integer hash.
uint pcgHash(uint v) {
    uint state = v * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}
// 3D integer hash, three decorrelated outputs.
uvec3 pcg3d(uvec3 v) {
    v = v * 1664525u + 1013904223u;
    v.x += v.y * v.z;
    v.y += v.z * v.x;
    v.z += v.x * v.y;
    v ^= v >> 16u;
    v.x += v.y * v.z;
    v.y += v.z * v.x;
    v.z += v.x * v.y;
    return v;
}
// Map a uint to [0,1) using the top 24 bits, so the result can never round up to 1.0.
float uintToUnit(uint h) { return float(h >> 8u) * (1.0 / 16777216.0); }
vec2 uintToUnit(uvec2 h) { return vec2(h >> 8u) * (1.0 / 16777216.0); }
vec3 uintToUnit(uvec3 h) { return vec3(h >> 8u) * (1.0 / 16777216.0); }
vec4 uintToUnit(uvec4 h) { return vec4(h >> 8u) * (1.0 / 16777216.0); }
// Random float in [0,1) for an integer-valued input.
float hash11(float p) { return uintToUnit(pcgHash(uint(int(floor(p))))); }
// Random float in [0,1) for an integer-valued 2D input.
float hash12(vec2 p) {
    uvec2 q = uvec2(ivec2(floor(p)));
    return uintToUnit(pcgHash(q.x + pcgHash(q.y)));
}
// Random vec3 in [0,1)^3 for an integer-valued 3D input.
vec3 hash33(vec3 p) { return uintToUnit(pcg3d(uvec3(ivec3(floor(p))))); }

// ---- shader-skills library: noise ----
// Quintic fade 6t^5 - 15t^4 + 10t^3: C2-continuous interpolation weights for lattice noise.
vec2 quinticFade(vec2 f) { return f * f * f * (f * (f * 6.0 - 15.0) + 10.0); }
vec3 quinticFade(vec3 f) { return f * f * f * (f * (f * 6.0 - 15.0) + 10.0); }
// Derivative of quinticFade: 30 t^2 (t - 1)^2.
vec2 quinticFadeDeriv(vec2 f) { return 30.0 * f * f * (f * (f - 2.0) + 1.0); }
vec3 quinticFadeDeriv(vec3 f) { return 30.0 * f * f * (f * (f - 2.0) + 1.0); }
// Unit gradient for a 2D lattice point.
vec2 latticeGradient(vec2 cell) {
    float a = TAU * hash12(cell);
    return vec2(cos(a), sin(a));
}
// 2D gradient (Perlin-style) noise with analytic derivatives. Returns vec3(value, d/dx, d/dy). Gradient noise has less grid-aligned blockiness than value noise. Prefer it for fBm.
vec3 gradientNoiseD(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = quinticFade(f), du = quinticFadeDeriv(f);
    vec2 ga = latticeGradient(i);
    vec2 gb = latticeGradient(i + vec2(1.0, 0.0));
    vec2 gc = latticeGradient(i + vec2(0.0, 1.0));
    vec2 gd = latticeGradient(i + vec2(1.0, 1.0));
    float va = dot(ga, f);
    float vb = dot(gb, f - vec2(1.0, 0.0));
    float vc = dot(gc, f - vec2(0.0, 1.0));
    float vd = dot(gd, f - vec2(1.0, 1.0));
    float k = va - vb - vc + vd;
    float value = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * k;
    vec2 deriv = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd)
               + du * (vec2(vb - va, vc - va) + u.yx * k);
    return vec3(value, deriv);
}
// 2D gradient noise.
float gradientNoise(vec2 p) { return gradientNoiseD(p).x; }
// Dot product of a hashed 3D gradient with the offset to its lattice corner.
float latticeGradDot(vec3 cell, vec3 corner, vec3 f) {
    vec3 g = hash33(cell + corner) * 2.0 - 1.0;
    return dot(g, f - corner);
}
// 3D gradient noise.
float gradientNoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = quinticFade(f);
    return mix(mix(mix(latticeGradDot(i, vec3(0, 0, 0), f), latticeGradDot(i, vec3(1, 0, 0), f), u.x),
                   mix(latticeGradDot(i, vec3(0, 1, 0), f), latticeGradDot(i, vec3(1, 1, 0), f), u.x), u.y),
               mix(mix(latticeGradDot(i, vec3(0, 0, 1), f), latticeGradDot(i, vec3(1, 0, 1), f), u.x),
                   mix(latticeGradDot(i, vec3(0, 1, 1), f), latticeGradDot(i, vec3(1, 1, 1), f), u.x), u.y), u.z);
}
// 3D gradient noise with analytic derivatives. Returns vec4(value, d/dx, d/dy, d/dz); value equals gradientNoise(p). The trilinear blend is expanded as a polynomial in the fade weights, so the gradient is the same blend of the corner gradients plus the chain-rule term of the fade.
vec4 gradientNoiseD(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = quinticFade(f), du = quinticFadeDeriv(f);
    vec3 g000 = hash33(i) * 2.0 - 1.0;
    vec3 g100 = hash33(i + vec3(1, 0, 0)) * 2.0 - 1.0;
    vec3 g010 = hash33(i + vec3(0, 1, 0)) * 2.0 - 1.0;
    vec3 g110 = hash33(i + vec3(1, 1, 0)) * 2.0 - 1.0;
    vec3 g001 = hash33(i + vec3(0, 0, 1)) * 2.0 - 1.0;
    vec3 g101 = hash33(i + vec3(1, 0, 1)) * 2.0 - 1.0;
    vec3 g011 = hash33(i + vec3(0, 1, 1)) * 2.0 - 1.0;
    vec3 g111 = hash33(i + vec3(1, 1, 1)) * 2.0 - 1.0;
    float v000 = dot(g000, f);
    float v100 = dot(g100, f - vec3(1, 0, 0));
    float v010 = dot(g010, f - vec3(0, 1, 0));
    float v110 = dot(g110, f - vec3(1, 1, 0));
    float v001 = dot(g001, f - vec3(0, 0, 1));
    float v101 = dot(g101, f - vec3(1, 0, 1));
    float v011 = dot(g011, f - vec3(0, 1, 1));
    float v111 = dot(g111, f - vec3(1, 1, 1));
    // value = v000 + kx u.x + ky u.y + kz u.z + kxy u.x u.y + kyz u.y u.z + kzx u.z u.x + kxyz u.x u.y u.z
    float kx = v100 - v000, ky = v010 - v000, kz = v001 - v000;
    float kxy = v000 - v100 - v010 + v110;
    float kyz = v000 - v010 - v001 + v011;
    float kzx = v000 - v100 - v001 + v101;
    float kxyz = -v000 + v100 + v010 - v110 + v001 - v101 - v011 + v111;
    float value = v000 + kx * u.x + ky * u.y + kz * u.z
                + kxy * u.x * u.y + kyz * u.y * u.z + kzx * u.z * u.x + kxyz * u.x * u.y * u.z;
    vec3 grad = g000 + (g100 - g000) * u.x + (g010 - g000) * u.y + (g001 - g000) * u.z
              + (g000 - g100 - g010 + g110) * u.x * u.y
              + (g000 - g010 - g001 + g011) * u.y * u.z
              + (g000 - g100 - g001 + g101) * u.z * u.x
              + (-g000 + g100 + g010 - g110 + g001 - g101 - g011 + g111) * u.x * u.y * u.z
              + du * vec3(kx + kxy * u.y + kzx * u.z + kxyz * u.y * u.z,
                          ky + kxy * u.x + kyz * u.z + kxyz * u.x * u.z,
                          kz + kyz * u.y + kzx * u.x + kxyz * u.x * u.y);
    return vec4(value, grad);
}
const int FBM_MAX_OCTAVES = 12;
// Fractional Brownian motion over 2D gradient noise. Each octave is rotated to hide lattice alignment. persistence 0.5 is the classic look (H = 1). Lower is smoother, higher is rougher.
float fbm(vec2 p, int octaves, float lacunarity, float persistence) {
    const mat2 octaveRotation = mat2(0.8, 0.6, -0.6, 0.8);
    float sum = 0.0, amp = 1.0, norm = 0.0;
    for (int i = 0; i < FBM_MAX_OCTAVES; i++) {
        if (i >= octaves) break;
        sum += amp * gradientNoise(p);
        norm += amp;
        amp *= persistence;
        p = lacunarity * (octaveRotation * p) + vec2(17.13, -3.71);
    }
    return 1.4 * sum / norm;
}
// 2D fBm with the usual defaults (lacunarity 2.01 so octave peaks never re-align, persistence 0.5).
float fbm(vec2 p, int octaves) { return fbm(p, octaves, 2.01, 0.5); }
// fBm over 3D gradient noise.
float fbm(vec3 p, int octaves, float lacunarity, float persistence) {
    const mat3 octaveRotation = mat3(0.00, 0.80, 0.60,
                                     -0.80, 0.36, -0.48,
                                     -0.60, -0.48, 0.64);
    float sum = 0.0, amp = 1.0, norm = 0.0;
    for (int i = 0; i < FBM_MAX_OCTAVES; i++) {
        if (i >= octaves) break;
        sum += amp * gradientNoise(p);
        norm += amp;
        amp *= persistence;
        p = lacunarity * (octaveRotation * p) + vec3(17.13, -3.71, 5.29);
    }
    return sum / norm;
}
// Ridged multifractal: inverted |noise| creates sharp crests; each octave is weighted by the previous one, so detail gathers along ridges.
float ridgedFbm(vec2 p, int octaves) {
    const mat2 octaveRotation = mat2(0.8, 0.6, -0.6, 0.8);
    float sum = 0.0, amp = 0.5, weight = 1.0, norm = 0.0;
    for (int i = 0; i < FBM_MAX_OCTAVES; i++) {
        if (i >= octaves) break;
        float n = 1.0 - abs(gradientNoise(p) * 1.4);
        n *= n;
        sum += amp * n * weight;
        norm += amp;
        weight = clamp(n * 2.0, 0.0, 1.0);
        amp *= 0.5;
        p = 2.01 * (octaveRotation * p) + vec2(17.13, -3.71);
    }
    return sum / norm;
}
// Billowy multifractal: |noise| per octave makes puffy rounded lobes split by sharp creases (the inverse of ridgedFbm). Each octave is weighted by the previous one, so detail gathers on the lobes while the creases stay clean.
float billowFbm(vec2 p, int octaves) {
    const mat2 octaveRotation = mat2(0.8, 0.6, -0.6, 0.8);
    float sum = 0.0, amp = 0.5, weight = 1.0, norm = 0.0;
    for (int i = 0; i < FBM_MAX_OCTAVES; i++) {
        if (i >= octaves) break;
        float n = abs(gradientNoise(p) * 1.4);
        n = n * (2.0 - n);   // round the lobe tops, keep the creases sharp
        sum += amp * n * weight;
        norm += amp;
        weight = clamp(n * 1.5, 0.0, 1.0);
        amp *= 0.5;
        p = 2.01 * (octaveRotation * p) + vec2(17.13, -3.71);
    }
    return sum / norm;
}
float billowFbm(vec3 p, int octaves) {
    const mat3 octaveRotation = mat3(0.00, 0.80, 0.60,
                                     -0.80, 0.36, -0.48,
                                     -0.60, -0.48, 0.64);
    float sum = 0.0, amp = 0.5, weight = 1.0, norm = 0.0;
    for (int i = 0; i < FBM_MAX_OCTAVES; i++) {
        if (i >= octaves) break;
        float n = min(abs(gradientNoise(p)) * 1.4, 1.0);
        n = n * (2.0 - n);
        sum += amp * n * weight;
        norm += amp;
        weight = clamp(n * 1.5, 0.0, 1.0);
        amp *= 0.5;
        p = 2.01 * (octaveRotation * p) + vec3(17.13, -3.71, 5.29);
    }
    return sum / norm;
}

// Divergence-free 2D flow field: the curl of scalar gradient noise.
// Particles advected by it swirl without bunching up.
vec2 curlNoise(vec2 p) {
    vec3 n = gradientNoiseD(p);
    return vec2(n.z, -n.y);
}

// ---- shader ----
const float LOOP = 16.0;          // seconds per loop

// ---- art controls -------------------------------------------------------
const float POOL_GAIN      = 1.90;  // ink ceiling feeding the drips
const float COLUMN_GAIN    = 1.45;  // bold falling trunks
const float PLUME_GAIN     = 1.65;  // dense billowing ink mass
const float VEIL_GAIN      = 0.22;  // translucent curtain sheets
const float HAIR_GAIN      = 0.50;  // hair-thin curling tendrils
const float MURK_GAIN      = 0.62;  // bottom accumulation
const float HAZE_GAIN      = 0.04;  // ambient cloudiness
const float SWAY           = 0.09;  // lateral sway of the trunks
const vec3  INK_COLOR      = vec3(0.042, 0.034, 0.032); // warm near-black
const vec3  PAPER          = vec3(0.945, 0.945, 0.952); // bright tank water
// -------------------------------------------------------------------------

vec2 orbit(float a, float r, float phase) {
    return r * vec2(cos(a + phase), sin(a + phase));
}

// 3D fbm with the library's stock lacunarity/persistence.
float fbm3(vec3 p, int octaves) { return fbm(p, octaves, 2.01, 0.5); }

// Bright water: faint container-wall streaks, warm light leaking in from the
// top right plus a few soft out-of-focus bokeh spots like the footage.
vec3 waterBackground(vec2 p, vec2 uv01) {
    float streaks = fbm(vec2(uv01.x * 13.0, uv01.y * 1.1), 3);
    vec3 col = PAPER - 0.05 * streaks;
    // warm wash leaking down from the top-right corner
    float flare = smoothstep(0.45, 1.0, uv01.x) * smoothstep(0.45, 1.0, uv01.y);
    col += vec3(0.07, 0.05, 0.01) * flare;
    // soft bokeh highlights near the surface, drifting gently
    vec2 drift = 0.012 * orbit(TAU * fract(iTime / LOOP), 1.0, 0.0);
    float bok = exp(-80.0  * dot(uv01 - vec2(0.865, 0.955) - drift, uv01 - vec2(0.865, 0.955) - drift))
              + 0.7 * exp(-120.0 * dot(uv01 - vec2(0.955, 0.900) + drift, uv01 - vec2(0.955, 0.900) + drift))
              + 0.5 * exp(-160.0 * dot(uv01 - vec2(0.760, 0.915) - drift * 0.5, uv01 - vec2(0.760, 0.915) - drift * 0.5));
    col += vec3(0.20, 0.13, 0.03) * bok;
    float vig = smoothstep(1.70, 0.50, length(p * vec2(0.75, 1.0)));
    return col * (0.93 + 0.07 * vig);
}

// Ragged ink ceiling hanging off the top edge — the reservoir the trunks
// feed from. Strongest left-of-center like the footage, with a lacy
// dissolving lower edge and a few thin teeth dangling below it.
float inkCeiling(vec2 p, float a) {
    vec2 w = orbit(a, 0.22, 1.2);
    float edge = 0.84 + 0.10 * fbm(vec2(p.x * 1.8 + w.x, 2.7 + w.y), 3);
    float m = smoothstep(edge - 0.04, edge + 0.16, p.y);
    float lace = ridgedFbm(vec2(p.x * 6.5, p.y * 7.5) + orbit(a, 0.30, 3.0), 4);
    // lace eats upward into the ceiling; deeper into the ceiling it stays solid
    m *= 0.55 + 0.45 * smoothstep(0.10, 0.80, lace + saturate((p.y - edge) * 4.0));
    // solid cap so the very top edge is true ink, not gray wash
    m += 1.1 * smoothstep(edge + 0.02, edge + 0.28, p.y);
    // thin teeth dangling below the ragged edge
    float teeth = ridgedFbm(vec2(p.x * 13.0, p.y * 4.0) + orbit(a, 0.26, 5.1), 3);
    m += 0.5 * smoothstep(0.72, 0.95, teeth)
       * smoothstep(edge, edge - 0.28, p.y) * smoothstep(edge - 0.55, edge, p.y);
    // pool heavier on the left, thinning to a hairline on the right
    m *= 0.30 + 0.70 * smoothstep(0.75, -0.45, p.x);
    return m;
}

// Bold falling trunks: lanes anchored to the ceiling, wandering via fbm,
// widening as they sink. Hard inner core + ridged lacy margin so the tube
// reads as turbulent ink, not a drawn line.
float dripColumns(vec2 p, float a) {
    float acc = 0.0;
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float trunk = (i == 0) ? 1.0 : 0.0;      // lane 0 carries the plume
        float baseX = -0.40 + fi * 0.36 + 0.12 * (hash11(fi * 3.7 + 0.4) - 0.5);
        float wander = fbm(vec2(p.y * 1.1 + fi * 5.0, fi * 2.3), 3);
        float lane = baseX + 0.14 * wander
                   + SWAY * sin(a + p.y * 1.3 + fi * 1.9);
        float x = p.x - lane;
        // columns widen as they sink (depth 0 at top, 1 at bottom)
        float depth = (1.0 - p.y) * 0.5;
        float w = mix(0.010 + 0.006 * hash11(fi * 5.1 + 1.3),
                      0.022 + 0.020 * hash11(fi * 8.3 + 2.9), depth)
                + (0.020 + 0.016 * depth) * trunk;
        // interior texture advected around the lane so edges stay lacy
        float tex = ridgedFbm(
            vec2(x * 24.0, p.y * 2.8) + orbit(a, 0.32, fi * 1.7), 4);
        float tube = smoothstep(w, 0.0, abs(x));
        // the column is a bundle of parallel strands, not a solid rod
        float strand = 0.40 + 0.60 * ridgedFbm(
            vec2(x * 55.0, p.y * 3.2) + orbit(a, 0.30, fi * 2.9), 3);
        float core = smoothstep(w * 0.5, 0.0, abs(x)) * strand;
        // feathery margin outside the tube where the texture survives
        float margin = smoothstep(w * 2.4, w * 0.6, abs(x))
                     * smoothstep(0.45, 0.85, tex);
        // each lane fades before the bottom murk; the trunk reaches the plume
        float end = -0.05 - 0.45 * hash11(fi * 9.7 + 3.1);
        float reach = mix(smoothstep(end - 0.15, end + 0.35, p.y),
                          smoothstep(-0.30, 0.35, p.y), trunk);
        // lanes fray in places: density gaps drifting along the column
        float gap = mix(smoothstep(0.15, 0.75,
                          fbm(vec2(p.y * 2.2, fi * 4.4) + orbit(a, 0.30, fi), 3)),
                        1.0, trunk);
        float weight = mix(0.40 + 0.40 * hash11(fi * 7.7 + 0.9), 1.35, trunk);
        acc += (tube * (0.25 + 0.75 * tex) + core * 1.2 + margin * 0.6)
             * reach * gap * weight;
    }
    return acc;
}

// Dense billowing plume anchored to the trunk: hard black core, cauliflower
// rim, lace fringe, and a thin skirt trailing below as it settles.
float plume(vec2 p, float a) {
    float grow = 0.5 + 0.5 * sin(a - 1.1);      // blooms then settles down
    vec2 c = vec2(0.07 * sin(a + 0.6),
                  mix(0.32, -0.18, grow) + 0.05 * cos(2.0 * a));
    vec2 d = (p - c) * vec2(0.90, 0.97);

    float body = fbm3(vec3(d * 1.5, 0.0) + vec3(orbit(a, 0.50, 0.4), 0.0), 4);
    float rag = ridgedFbm(d * 7.5 + orbit(a, 0.30, 2.6), 4);
    // two overlapping lobes make the mass a cauliflower cluster, not a blob
    float r1 = length(d) - 0.36 * body - 0.04 + 0.15 * (rag - 0.5);
    float r2 = length(d - vec2(0.28, 0.07))
             - 0.22 * fbm3(vec3(d * 1.9, 0.0) + vec3(orbit(a, 0.45, 1.9), 0.0), 3)
             - 0.02 + 0.12 * (rag - 0.5);
    float r = min(r1, r2 * 1.45);
    float core = smoothstep(0.26, 0.02, r);
    float rimN = ridgedFbm(d * 9.0 + orbit(a, 0.35, 1.7), 4);
    // cauliflower detail lives only in a ring around the silhouette
    float ring = smoothstep(0.60, 0.20, r) * smoothstep(-0.05, 0.25, r);
    float rim = pow(rimN, 1.5) * ring;
    // fine speckled fringe dissolving off the silhouette
    float fringe = pow(ridgedFbm(d * 15.0 + orbit(a, 0.28, 4.4), 3), 2.5)
                 * smoothstep(0.55, 0.10, r);
    float lace = fbm3(vec3(d * 4.6, 0.0) + vec3(orbit(a, 0.40, 3.3), 0.0), 3);
    float m = core * (0.55 + 0.80 * lace) + 1.15 * rim + 0.55 * fringe;
    // skirt of spent ink sagging off the plume's underside: a soft diffuse
    // halo plus a narrow lace band hugging the silhouette's lower edge
    float below = smoothstep(0.0, -0.55, p.y - c.y);
    vec2 ds = d - vec2(0.0, -0.30);
    m += 0.22 * below * smoothstep(0.75, 0.15, length(ds));
    m += 0.45 * rimN * below * smoothstep(0.45, 0.10, abs(r - 0.30));
    return saturate(m * (0.70 + 0.60 * grow));
}

// Translucent curtain sheets: broad soft washes stretched vertically with
// faint column streaking, drifting slowly through the mid water. Linear
// response (no threshold) so the wash stays diffuse, never cellular.
float veils(vec2 p, float a) {
    vec2 q = vec2(p.x * 0.55, p.y * 0.30);
    vec2 w = vec2(fbm(q * 1.4 + orbit(a, 0.30, 0.2), 3),
                  fbm(q * 1.4 + orbit(a, 0.30, 2.9) + vec2(5.2, 1.3), 3));
    float v = 0.5 + 0.5 * fbm(q * 1.7 + 1.6 * w + orbit(a, 0.35, 4.4), 4);
    // vertical haze streaks so the sheets read as sinking curtains
    float streak = 0.75 + 0.25 * fbm(vec2(p.x * 7.0, p.y * 0.5)
                   + orbit(a, 0.30, 3.7), 3);
    // strongest in the mid band, fading at the very top and bottom
    float band = smoothstep(0.95, 0.45, p.y) * smoothstep(-1.05, -0.45, p.y);
    return v * v * streak * (0.35 + 0.65 * band);
}

// Hair-thin curling tendrils: anisotropic ridged field thresholded hard so
// only thin squiggles survive, domain-warped by a curl flow so the threads
// swirl without bunching. Denser in the lower half where ink has spread.
float hairs(vec2 p, float a) {
    vec2 q = p * vec2(4.2, 1.6);
    vec2 flow = curlNoise(p * 2.1 + orbit(a, 0.35, 0.8));
    q += 1.8 * flow;
    float f = ridgedFbm(q + orbit(a, 0.50, 2.0), 4);
    float line = smoothstep(0.86, 0.99, f);
    float depthW = 0.35 + 0.65 * smoothstep(0.55, -0.55, p.y);
    return line * depthW;
}

// Smoky accumulation hugging the bottom edge, thickening over the loop.
float bottomMurk(vec2 p, float a) {
    float rise = 0.5 + 0.5 * sin(a - 0.4);
    float g = smoothstep(-0.38 - 0.22 * rise, -1.0, p.y);
    float n = billowFbm(vec3(p * vec2(2.6, 3.6), 0.0)
              + vec3(orbit(a, 0.30, 4.1), 0.0), 3);
    return g * (0.15 + 0.85 * n) * 0.8;
}

// Broad faint cloudiness drifting through the whole volume.
float ambientHaze(vec2 p, float a) {
    return HAZE_GAIN * (0.5 + 0.5 * fbm3(
        vec3(p * 1.1, 0.0) + vec3(orbit(a, 0.5, 5.0), 0.0), 3));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv   = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
    vec2 uv01 = fragCoord / iResolution.xy;
    float a = TAU * fract(iTime / LOOP);

    vec3 col = waterBackground(uv, uv01);

    float d = ambientHaze(uv, a)
            + VEIL_GAIN   * veils(uv, a)
            + HAIR_GAIN   * hairs(uv, a)
            + POOL_GAIN   * inkCeiling(uv, a)
            + COLUMN_GAIN * dripColumns(uv, a)
            + PLUME_GAIN  * plume(uv, a)
            + MURK_GAIN   * bottomMurk(uv, a);

#if DEBUG_MODE == 1
    fragColor = vec4(vec3(saturate(d)), 1.0);
    return;
#endif

    // Beer-ish absorption: thin wash -> warm gray, dense core -> near black.
    float inkA = 1.0 - exp(-4.2 * d);
    vec3 ink = mix(vec3(0.30, 0.245, 0.215), INK_COLOR, smoothstep(0.04, 0.60, d));
    col = mix(col, ink, saturate(inkA));

    // paper grain + a few faint dust specks like the footage
    col += (hash12(fragCoord) - 0.5) * 0.012;

    fragColor = vec4(col, 1.0);
}
