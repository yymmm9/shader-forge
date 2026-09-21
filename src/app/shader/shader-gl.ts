import {
  SHADER_EFFECT_PRESET_INDEX,
  SHADER_FRAGMENT_SOURCE,
  SHADER_VERTEX_SOURCE,
  type ShaderEffectPreset,
} from "./shader-effects";

const GL_ONE = 1;
const GL_ONE_MINUS_SRC_ALPHA = 0x0303;

export type ShaderSourceTransform = Readonly<{
  flipHorizontal: boolean;
  flipVertical: boolean;
  quarterTurns: number;
}>;

export type ShaderRenderParams = Readonly<{
  amount: number;
  band: number;
  effect: ShaderEffectPreset;
  phase: number;
  scale: number;
  source: TexImageSource | null;
  sourceTransform: ShaderSourceTransform;
  time: number;
}>;

export type ShaderRenderer = Readonly<{
  kind: "webgl2";
  dispose: () => void;
  render: (params: ShaderRenderParams) => boolean;
}>;

type ShaderProgram = {
  attributePosition: number;
  program: WebGLProgram;
  uniforms: Readonly<Record<string, WebGLUniformLocation | null>>;
};

const UNIFORM_NAMES = [
  "u_source",
  "u_hasSource",
  "u_effect",
  "u_resolution",
  "u_sourceSize",
  "u_amount",
  "u_scale",
  "u_phase",
  "u_time",
  "u_sourceTransform",
  "u_band",
] as const;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
): ShaderProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, SHADER_VERTEX_SOURCE);
  if (!vertex) return null;
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, SHADER_FRAGMENT_SOURCE);
  if (!fragment) {
    gl.deleteShader(vertex);
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of UNIFORM_NAMES) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return {
    attributePosition: gl.getAttribLocation(program, "a_position"),
    program,
    uniforms,
  };
}

export function createShaderRenderer(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): ShaderRenderer | null {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    stencil: false,
  });
  if (!gl) return null;

  const compiled = createProgram(gl);
  if (!compiled) return null;

  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (!buffer || !texture) {
    gl.deleteProgram(compiled.program);
    if (buffer) gl.deleteBuffer(buffer);
    if (texture) gl.deleteTexture(texture);
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.enable(gl.BLEND);
  gl.blendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);

  let lastSource: TexImageSource | null = null;
  let disposed = false;

  return {
    kind: "webgl2",
    dispose: () => {
      if (disposed) return;
      disposed = true;
      const loseContext = gl.getExtension("WEBGL_lose_context");
      gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
      gl.deleteProgram(compiled.program);
      loseContext?.loseContext();
    },
    render: (params) => {
      if (disposed || gl.isContextLost()) return false;
      const width = Math.max(1, Math.round(canvas.width));
      const height = Math.max(1, Math.round(canvas.height));
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!params.source) {
        lastSource = null;
        return true;
      }

      if (params.source !== lastSource) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        try {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            params.source,
          );
        } catch {
          return false;
        }
        lastSource = params.source;
      }

      const sourceWidth =
        params.source instanceof HTMLImageElement
          ? params.source.naturalWidth
          : params.source instanceof VideoFrame
            ? params.source.displayWidth
            : params.source.width;
      const sourceHeight =
        params.source instanceof HTMLImageElement
          ? params.source.naturalHeight
          : params.source instanceof VideoFrame
            ? params.source.displayHeight
            : params.source.height;

      gl.useProgram(compiled.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(compiled.attributePosition);
      gl.vertexAttribPointer(
        compiled.attributePosition,
        2,
        gl.FLOAT,
        false,
        0,
        0,
      );
      const { uniforms } = compiled;
      gl.uniform1i(uniforms.u_source, 0);
      gl.uniform1f(uniforms.u_hasSource, 1);
      gl.uniform1i(
        uniforms.u_effect,
        SHADER_EFFECT_PRESET_INDEX[params.effect],
      );
      gl.uniform2f(uniforms.u_resolution, width, height);
      gl.uniform2f(
        uniforms.u_sourceSize,
        Math.max(1, sourceWidth),
        Math.max(1, sourceHeight),
      );
      gl.uniform1f(uniforms.u_amount, params.amount);
      gl.uniform1f(uniforms.u_scale, params.scale);
      gl.uniform1f(uniforms.u_phase, params.phase);
      gl.uniform1f(uniforms.u_time, params.time);
      gl.uniform3f(
        uniforms.u_sourceTransform,
        params.sourceTransform.quarterTurns % 4,
        params.sourceTransform.flipHorizontal ? 1 : 0,
        params.sourceTransform.flipVertical ? 1 : 0,
      );
      gl.uniform1f(uniforms.u_band, params.band);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disableVertexAttribArray(compiled.attributePosition);
      return !gl.isContextLost();
    },
  };
}
