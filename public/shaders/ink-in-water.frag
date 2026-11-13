// Ink in water — procedural reconstruction of a real footage segment.
// Reference: "Ink drops in water.ogv" (Wikimedia Commons), 58–74 s window.
// Structure: bold falling trails (black + one sepia), a grow-gated billowing
// plume, tangled residue webs, sparse hanging threads, translucent veils
// and bottom murk. Seamless loop: every animated term is periodic in
// `a = TAU * fract(iTime / LOOP)`.

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
const vec3  INK_BLACK = vec3(0.040, 0.034, 0.032);
const vec3  INK_GRAY  = vec3(0.225, 0.215, 0.215);
const vec3  INK_SEPIA = vec3(0.240, 0.165, 0.105);
const vec3  PAPER     = vec3(0.938, 0.940, 0.948);
// -------------------------------------------------------------------------

vec2 orbit(float a, float r, float phase) {
    return r * vec2(cos(a + phase), sin(a + phase));
}

float fbm3(vec3 p, int octaves) { return fbm(p, octaves, 2.01, 0.5); }

vec3 waterBackground(vec2 p, vec2 uv01) {
    float streaks = fbm(vec2(uv01.x * 16.0, uv01.y * 0.9), 3);
    vec3 col = PAPER - 0.038 * streaks;
    float flare = smoothstep(0.40, 1.0, uv01.x) * smoothstep(0.50, 1.0, uv01.y);
    col += vec3(0.06, 0.04, 0.005) * flare;
    vec2 drift = 0.014 * orbit(TAU * fract(iTime / LOOP), 1.0, 0.0);
    float bok = exp(-90.0  * dot(uv01 - vec2(0.870, 0.945) - drift, uv01 - vec2(0.870, 0.945) - drift))
              + 0.6 * exp(-140.0 * dot(uv01 - vec2(0.955, 0.885) + drift, uv01 - vec2(0.955, 0.885) + drift));
    col += vec3(0.15, 0.10, 0.02) * bok;
    float vig = smoothstep(1.80, 0.60, length(p * vec2(0.80, 1.0)));
    return col * (0.95 + 0.05 * vig);
}

// -------------------------------------------------------------------------

// Ragged ink at the top edge where trails enter — heavy above the left
// trail and the plume trunk, thin and torn elsewhere.
float topRag(vec2 p, float a) {
    float edge = 0.86 + 0.06 * fbm(vec2(p.x * 2.6, 1.7) + orbit(a, 0.20, 1.2), 3);
    float m = smoothstep(edge - 0.02, edge + 0.12, p.y);
    float lace = ridgedFbm(vec2(p.x * 9.0, p.y * 10.0) + orbit(a, 0.26, 3.0), 4);
    m *= 0.50 + 0.50 * smoothstep(0.12, 0.75, lace);
    float lanes = smoothstep(0.65, -0.35, abs(p.x + 0.38))
                + 0.90 * smoothstep(0.42, -0.12, abs(p.x - 0.30))
                + 0.35 * smoothstep(0.55, -0.25, abs(p.x - 0.62));
    return m * clamp(lanes, 0.08, 1.0);
}

// Tangled filament web confined to a soft region mask — the fuzzy ink
// residue that clings around the plume, the trails and the lower-left
// corner of the tank.
float cloudWeb(vec2 p, float a, vec2 center, vec2 radii, float phase) {
    vec2 q = (p - center) / radii;
    float mask = smoothstep(1.0, 0.45, length(q));
    if (mask <= 0.0) return 0.0;
    vec2 flow = curlNoise(p * 1.8 + orbit(a, 0.26, phase));
    vec2 w = p * vec2(3.2, 4.2) + 0.9 * flow;
    float f = fbm(w + orbit(a, 0.40, phase + 1.9), 4);
    float web = smoothstep(0.10, 0.015, abs(f));
    // clump the web into fibrous patches instead of a uniform mesh
    float clump = smoothstep(0.30, 0.72,
        fbm(p * vec2(2.2, 3.0) + orbit(a, 0.30, phase + 4.0), 3));
    return web * clump * mask;
}

// Sparse thin threads — short hanging filaments, each living on a
// limited y-range, clustered lower-left and beside the trails.
float threads(vec2 p, float a) {
    float acc = 0.0;
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float baseX = -0.70 + fi * 0.23 + 0.12 * (hash11(fi * 3.1 + 0.7) - 0.5);
        float wander = fbm(vec2(p.y * 1.5 + fi * 3.3, fi * 5.1), 3);
        float lane = baseX + 0.09 * wander
                   + 0.035 * sin(a + p.y * 1.4 + fi * 2.2);
        float x = p.x - lane;
        float w = 0.0035 + 0.0028 * hash11(fi * 4.3 + 1.1);
        // each thread hangs over a band, not the full frame
        float top = 0.55 - 0.65 * hash11(fi * 6.7 + 0.3);
        float bot = top - 0.55 - 0.55 * hash11(fi * 8.9 + 1.7);
        float span = smoothstep(top, top - 0.10, p.y)
                   * smoothstep(bot, bot + 0.12, p.y);
        float tube = smoothstep(w, 0.0, abs(x));
        float margin = smoothstep(w * 5.0, w, abs(x)) * 0.30
            * smoothstep(0.45, 0.85, ridgedFbm(
                vec2(x * 40.0, p.y * 3.4) + orbit(a, 0.24, fi), 3));
        acc += (tube * 0.9 + margin) * span;
    }
    return acc;
}

// One falling trail: explicit lane, wider than the old pass, soft
// diffusing edges, denser near the top, fraying as it sinks.
float trailLane(vec2 p, float a, float fi, float baseX, float wBase,
                float swayPh) {
    float wander = fbm(vec2(p.y * 1.4 + fi * 5.0, fi * 2.3), 3);
    float lane = baseX + 0.12 * wander
               + 0.05 * sin(a + p.y * 1.2 + swayPh);
    float x = p.x - lane;
    float depth = (1.0 - p.y) * 0.5;
    float w = wBase * (0.65 + 0.80 * depth);
    float tex = ridgedFbm(vec2(x * 24.0, p.y * 2.6) + orbit(a, 0.26, fi * 1.7), 4);
    float tube = smoothstep(w, -w * 0.4, abs(x));
    float strand = 0.62 + 0.38 * ridgedFbm(
        vec2(x * 46.0, p.y * 2.4) + orbit(a, 0.24, fi * 2.9), 3);
    float margin = smoothstep(w * 2.6, w * 0.4, abs(x))
                 * smoothstep(0.45, 0.80, tex);
    return (tube * (0.60 + 0.40 * tex) * strand * 1.55 + margin * 0.70);
}

float blackTrails(vec2 p, float a) {
    // main left trail: top to bottom, the heaviest continuous ink
    float t0 = trailLane(p, a, 0.0, -0.38, 0.045, 1.9) * 1.45;
    // plume trunk: thick, ends inside the plume instead of reaching bottom
    float t1 = trailLane(p, a, 1.0, 0.28, 0.060, 4.1) * 2.1
             * smoothstep(-0.45, 0.10, p.y)
             * (0.35 + 0.65 * smoothstep(0.02, 0.55, 0.5 + 0.5 * sin(a - 1.1)));
    // faint mid drip
    float t2 = trailLane(p, a, 2.0, 0.02, 0.010, 2.7) * 0.55
             * smoothstep(0.75, 0.20, p.y);
    return t0 + t1 + t2;
}

// Right-hand sepia column: thinner, branched, distinctly brown, wrapped
// in a wide feathery halo of diffusing ink.
float sepiaTrail(vec2 p, float a) {
    float main = trailLane(p, a, 4.0, 0.62, 0.014, 0.8);
    float branch = trailLane(p, a, 5.0, 0.53, 0.008, 3.4)
                 * smoothstep(0.85, 0.20, p.y);
    vec2 q = p - vec2(0.60, 0.30);
    float haz = fbm(q * vec2(4.5, 2.4) + orbit(a, 0.28, 2.2), 4);
    float halo = smoothstep(0.48, 0.0, abs(q.x))
               * smoothstep(0.15, 0.55, haz)
               * smoothstep(-0.9, 0.5, p.y) * 0.95;
    return (main + 0.9 * branch) * 1.6 + halo;
}

// Billowing plume hanging off the trunk — compact mass, lobed bottom,
// high-contrast fibrous interior, short skirt of spent ink below.
float plume(vec2 p, float a) {
    float grow = smoothstep(0.02, 0.55, 0.5 + 0.5 * sin(a - 1.1));
    vec2 c = vec2(0.08 + 0.05 * sin(a + 0.6),
                  mix(0.20, -0.20, grow) + 0.04 * cos(2.0 * a));
    vec2 d = (p - c) * vec2(0.80, 1.05);

    float body = fbm3(vec3(d * 2.4, 0.0) + vec3(orbit(a, 0.45, 0.4), 0.0), 4);
    float rag = ridgedFbm(d * 8.5 + orbit(a, 0.28, 2.6), 4);
    float r1 = length(d) - 0.34 * body - 0.07 + 0.13 * (rag - 0.5);
    float r2 = length(d - vec2(0.20, -0.10))
             - 0.22 * fbm3(vec3(d * 2.8, 0.0) + vec3(orbit(a, 0.40, 1.9), 0.0), 3)
             - 0.04 + 0.12 * (rag - 0.5);
    float r = min(r1, r2 * 1.35);
    // interior: distinct dark filaments on light gaps, not gray mush
    float lace = ridgedFbm(d * 10.0 + orbit(a, 0.32, 1.7), 4);
    float inside = smoothstep(0.28, -0.06, r);
    float fib = smoothstep(0.20, 0.80, lace) * 1.10 + 0.42;
    // dense black cap where the trunk feeds the mass
    float coreMask = smoothstep(0.38, -0.05, r)
                   * smoothstep(-0.38, 0.10, d.y);
    // speckled fringe dissolving off the silhouette
    float fringe = pow(ridgedFbm(d * 16.0 + orbit(a, 0.26, 4.4), 3), 2.5)
                 * smoothstep(0.55, 0.10, r);
    float below = smoothstep(0.0, -0.40, p.y - c.y);
    float skirt = 0.28 * lace * below * smoothstep(0.55, 0.15, abs(r - 0.38));
    float m = inside * fib * (0.55 + 1.60 * coreMask)
            + 0.80 * fringe + skirt;
    return saturate(m * (0.18 + 1.05 * grow));
}

// Broad translucent washes — stronger left-of-center where ink settles.
float veils(vec2 p, float a) {
    vec2 q = vec2(p.x * 0.50, p.y * 0.28);
    vec2 w = vec2(fbm(q * 1.4 + orbit(a, 0.28, 0.2), 3),
                  fbm(q * 1.4 + orbit(a, 0.28, 2.9) + vec2(5.2, 1.3), 3));
    float v = 0.5 + 0.5 * fbm(q * 1.6 + 1.6 * w + orbit(a, 0.32, 4.4), 4);
    float streak = 0.70 + 0.30 * fbm(vec2(p.x * 8.0, p.y * 0.45)
                   + orbit(a, 0.28, 3.7), 3);
    float leftBias = 0.70 + 0.50 * smoothstep(0.85, -0.55, p.x);
    return v * v * streak * leftBias;
}

// Bottom accumulation — smoky wash, wispier rising edge, denser left.
float bottomMurk(vec2 p, float a) {
    float rise = 0.5 + 0.5 * sin(a - 0.4);
    float edge = -0.58 - 0.14 * rise + 0.12 * fbm(vec2(p.x * 3.0, 4.0)
                  + orbit(a, 0.24, 2.2), 3);
    float g = smoothstep(edge + 0.32, edge - 0.30, p.y);
    float n = billowFbm(vec3(p * vec2(3.0, 4.2), 0.0)
              + vec3(orbit(a, 0.26, 4.1), 0.0), 3);
    float leftBias = 0.60 + 0.40 * smoothstep(0.7, -0.5, p.x);
    return g * (0.20 + 0.80 * n) * leftBias;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv   = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
    vec2 uv01 = fragCoord / iResolution.xy;
    float a = TAU * fract(iTime / LOOP);

    vec3 col = waterBackground(uv, uv01);

    // tangled residue regions — the fuzzy webs clinging to the plume,
    // the lower-left corner and the trail fringes
    float webs = cloudWeb(uv, a, vec2(0.05, -0.45), vec2(0.75, 0.60), 0.0)
               + cloudWeb(uv, a, vec2(-0.45, -0.75), vec2(0.55, 0.45), 2.1)
               + cloudWeb(uv, a, vec2(-0.10, 0.55), vec2(0.60, 0.35), 4.2);

    float dB = 0.40 * veils(uv, a)
             + 0.50 * threads(uv, a)
             + 0.60 * webs
             + 0.95 * topRag(uv, a)
             + blackTrails(uv, a)
             + 1.55 * plume(uv, a)
             + 0.68 * bottomMurk(uv, a)
             + 0.03 * (0.5 + 0.5 * fbm3(vec3(uv * 1.1, 0.0)
                      + vec3(orbit(a, 0.5, 5.0), 0.0), 3));
    float dS = sepiaTrail(uv, a);

#if DEBUG_MODE == 1
    fragColor = vec4(vec3(saturate(dB), saturate(dS), 0.0), 1.0);
    return;
#endif

    float sepA = 1.0 - exp(-3.6 * dS);
    vec3 sepCol = mix(vec3(0.55, 0.44, 0.34), INK_SEPIA, smoothstep(0.05, 0.55, dS));
    col = mix(col, sepCol, saturate(sepA));

    float inkA = 1.0 - exp(-4.0 * dB);
    vec3 ink = mix(INK_GRAY, INK_BLACK, smoothstep(0.04, 0.55, dB));
    col = mix(col, ink, saturate(inkA));

    col += (hash12(fragCoord) - 0.5) * 0.012;
    fragColor = vec4(col, 1.0);
}
