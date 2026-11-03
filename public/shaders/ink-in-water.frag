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

// ---- shader ----
const float LOOP = 16.0;          // seconds per loop

// ---- art controls -------------------------------------------------------
const float THREAD_GAIN    = 0.90;  // long drip weight
const float WISP_GAIN      = 0.28;  // fine filament weight
const float BLOB_GAIN      = 1.55;  // dense plume opacity weight
const float MURK_GAIN      = 0.45;  // bottom accumulation weight
const float HAZE_GAIN      = 0.05;  // ambient cloudiness
const float SWAY           = 0.10;  // lateral sway amplitude of drips
const vec3  INK_COLOR      = vec3(0.070, 0.058, 0.055); // warm near-black
const vec3  PAPER          = vec3(0.905, 0.910, 0.925); // cool bright water
// -------------------------------------------------------------------------

vec2 orbit(float a, float r, float phase) {
    return r * vec2(cos(a + phase), sin(a + phase));
}

// 3D fbm with the library's stock lacunarity/persistence.
float fbm3(vec3 p, int octaves) { return fbm(p, octaves, 2.01, 0.5); }

// Bright water backdrop: faint container-wall streaks + warm flare top right.
vec3 waterBackground(vec2 p, vec2 uv01) {
    float streaks = fbm(vec2(uv01.x * 14.0, uv01.y * 1.2), 3);
    vec3 col = PAPER - 0.055 * streaks;
    float flare = smoothstep(0.55, 1.0, uv01.x) * smoothstep(0.55, 1.0, uv01.y);
    col += vec3(0.06, 0.045, 0.01) * flare;
    float vig = smoothstep(1.65, 0.45, length(p * vec2(0.75, 1.0)));
    return col * (0.88 + 0.12 * vig);
}

// Long vertical drips: explicit wandering thread lanes with feathery texture.
// Each lane's x drifts with y (fbm wander) and sways in time — a closed
// periodic path so the whole loop is seamless. Per-lane weight/width/end
// keep the set irregular: a few bold trunks, the rest faint.
float dripThreads(vec2 p, float a) {
    float acc = 0.0;
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        // lane 0 is the bold trunk feeding the plume from the top edge
        float trunk = (i == 0) ? 1.0 : 0.0;
        float lane = mix(-0.44 + fi * 0.31, 0.06 * sin(a + 0.6), trunk)
                   + (1.0 - trunk) * 0.07 * sin(a + fi * 2.7);
        float wander = fbm(vec2(p.y * 1.4 + fi * 7.3, fi * 3.1), 3);
        float x = p.x - lane - 0.16 * wander
                - SWAY * sin(a + p.y * 1.7 + fi * 1.3);
        float w = mix(0.006 + 0.012 * hash11(fi * 5.1 + 1.3), 0.030, trunk);
        float thread = smoothstep(w, 0.0, abs(x));
        // feather the thread interior so it reads as ink, not a drawn line
        float tex = ridgedFbm(
            vec2(x * 40.0, p.y * 2.6) + orbit(a, 0.22, fi * 1.7), 4);
        // each lane dissolves out at its own depth; the trunk runs top->plume
        float end = 0.15 - 1.10 * hash11(fi * 9.7 + 3.1);
        float reach = mix(smoothstep(end - 0.25, end + 0.30, p.y),
                          smoothstep(0.0, 0.55, p.y), trunk);
        float weight = mix(0.30 + 0.70 * hash11(fi * 7.7 + 0.9), 1.3, trunk);
        acc += thread * pow(0.10 + 0.90 * tex, 1.3) * reach * weight;
    }
    return acc;
}

// Fine feathery wisps: anisotropic ridged field carved thin.
float wisps(vec2 p, float a) {
    vec2 q = p;
    q.x += SWAY * 0.7 * sin(a + p.y * 1.9);
    q *= vec2(3.4, 1.15);                 // stretch along y -> vertical filaments
    vec2 w = vec2(
        fbm(q * 1.2 + orbit(a, 0.40, 0.0), 4),
        fbm(q * 1.2 + orbit(a, 0.40, 2.4) + vec2(5.2, 1.3), 4));
    float f = ridgedFbm(q * 1.6 + 1.1 * w + orbit(a, 0.28, 1.1), 6);
    return pow(smoothstep(0.66, 0.97, f), 1.8);
}

// Dense billowing plume: low-frequency body + billowed rim + inner lace holes.
float plume(vec2 p, float a) {
    vec2 c = vec2(0.06 * sin(a + 0.6), 0.46 - 0.08 * sin(a));
    vec2 d = (p - c) * vec2(1.12, 0.82);
    float grow = 0.62 + 0.38 * sin(a - 0.9);

    float body = fbm3(vec3(d * 1.6, 0.0) + vec3(orbit(a, 0.55, 0.0), 0.0), 4);
    float rim  = billowFbm(vec3(d * 5.5, 0.0) + vec3(orbit(a, 0.35, 1.7), 0.0), 4);
    rim = pow(rim, 1.6);                  // sharpen the cauliflower edge
    float lace = fbm3(vec3(d * 4.4, 0.0) + vec3(orbit(a, 0.40, 3.3), 0.0), 3);

    float r = length(d) - 0.28 * body;
    float m = smoothstep(0.48, 0.02, r) * grow;
    m *= 0.45 + 0.68 * lace;              // eat holes into the mass
    m += 0.50 * rim * smoothstep(0.60, 0.05, r) * grow;
    // hard core so the plume reaches true black like the footage
    m += 0.75 * smoothstep(0.32, 0.0, r) * grow;
    return saturate(m);
}

// Smoky accumulation hugging the bottom edge.
float bottomMurk(vec2 p, float a) {
    float g = smoothstep(-0.35, -0.98, p.y);
    float n = billowFbm(vec3(p * vec2(1.9, 2.6), 0.0)
              + vec3(orbit(a, 0.30, 4.1), 0.0), 3);
    return g * (0.30 + 0.70 * n);
}

// Broad faint cloudiness drifting through the whole volume, plus a faint
// horizontal wash band where spent ink gathers mid-frame.
float ambientHaze(vec2 p, float a) {
    float band = smoothstep(-0.05, -0.45, p.y)
               * smoothstep(-0.95, -0.55, p.y);
    float bn = fbm3(vec3(p * vec2(1.2, 3.0), 0.0)
               + vec3(orbit(a, 0.35, 6.2), 0.0), 3);
    return HAZE_GAIN * (0.5 + 0.5 * fbm3(
        vec3(p * 1.1, 0.0) + vec3(orbit(a, 0.5, 5.0), 0.0), 3))
        + 0.10 * band * (0.5 + 0.5 * bn);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv   = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
    vec2 uv01 = fragCoord / iResolution.xy;
    float a = TAU * fract(iTime / LOOP);

    vec3 col = waterBackground(uv, uv01);

    float d = ambientHaze(uv, a)
            + THREAD_GAIN * dripThreads(uv, a)
            + WISP_GAIN   * wisps(uv, a)
            + BLOB_GAIN   * plume(uv, a)
            + MURK_GAIN   * bottomMurk(uv, a);

#if DEBUG_MODE == 1
    fragColor = vec4(vec3(saturate(d)), 1.0);
    return;
#endif

    // Beer-ish absorption: thin wash -> warm gray, dense core -> near black.
    float inkA = 1.0 - exp(-3.2 * d);
    vec3 ink = mix(INK_COLOR * 2.3, INK_COLOR, smoothstep(0.05, 0.55, d));
    col = mix(col, ink, saturate(inkA));

    // paper grain
    col += (hash12(fragCoord) - 0.5) * 0.012;

    fragColor = vec4(col, 1.0);
}
