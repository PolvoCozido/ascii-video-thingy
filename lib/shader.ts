export const VERT_SRC = /* glsl */ `
  attribute vec2 a;
  varying vec2 vUv;
  void main(){ vUv = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }
`;

export const FRAG_SRC = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform vec2  uRes;
  uniform vec2  uVid;
  uniform float uPixel;
  uniform float uBlack;
  uniform float uWhite;
  uniform float uGamma;
  uniform float uDensity;
  uniform float uTime;
  uniform float uShimmer;
  uniform float uDrift;
  uniform vec3  uInk;
  uniform vec3  uBg;
  uniform int   uFit;

  float bayer2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
  float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
  float bayer8(vec2 a){ return bayer4(0.5 * a) * 0.25 + bayer2(a); }

  void main(){
    vec2 fragPx = gl_FragCoord.xy;
    vec2 cell   = floor(fragPx / uPixel);
    vec2 px     = cell * uPixel + 0.5 * uPixel;

    vec2 uv = px / uRes;
    uv.y = 1.0 - uv.y;

    vec2 drift = vec2(
      sin(uTime * 0.27) * 0.004,
      sin(uTime * 0.41) * 0.012 + cos(uTime * 0.18) * 0.006
    ) * uDrift;
    uv -= drift;

    float cAR = uRes.x / uRes.y;
    float vAR = uVid.x / uVid.y;
    vec2  vUvOut = uv;
    bool  inside = true;
    if (uFit == 0) {
      if (vAR > cAR) {
        float scale = cAR / vAR;
        float off = (1.0 - scale) * 0.5;
        if (uv.y < off || uv.y > 1.0 - off) inside = false;
        vUvOut.y = (uv.y - off) / scale;
      } else {
        float scale = vAR / cAR;
        float off = (1.0 - scale) * 0.5;
        if (uv.x < off || uv.x > 1.0 - off) inside = false;
        vUvOut.x = (uv.x - off) / scale;
      }
    } else {
      if (vAR > cAR) {
        float scale = vAR / cAR;
        float off = (1.0 - 1.0/scale) * 0.5;
        vUvOut.x = off + uv.x / scale;
      } else {
        float scale = cAR / vAR;
        float off = (1.0 - 1.0/scale) * 0.5;
        vUvOut.y = off + uv.y / scale;
      }
    }

    vec3 col = inside ? texture2D(uTex, vUvOut).rgb : vec3(0.0);

    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    lum = (lum - uBlack) / max(1e-4, uWhite - uBlack);
    lum = clamp(lum, 0.0, 1.0);
    lum = pow(lum, uGamma);
    lum *= uDensity;

    vec2 jit = floor(vec2(uTime * 6.0 * uShimmer, uTime * 4.7 * uShimmer)) * vec2(7.0, 13.0);
    float t = bayer8(cell + jit);
    float ink = step(t, lum) * step(0.001, lum);

    gl_FragColor = vec4(mix(uBg, uInk, ink), 1.0);
  }
`;

export type UniformLocs = {
  tex: WebGLUniformLocation | null;
  res: WebGLUniformLocation | null;
  vid: WebGLUniformLocation | null;
  pixel: WebGLUniformLocation | null;
  black: WebGLUniformLocation | null;
  white: WebGLUniformLocation | null;
  gamma: WebGLUniformLocation | null;
  density: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  shimmer: WebGLUniformLocation | null;
  drift: WebGLUniformLocation | null;
  ink: WebGLUniformLocation | null;
  bg: WebGLUniformLocation | null;
  fit: WebGLUniformLocation | null;
};

export function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("createShader failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("shader compile failed: " + log);
  }
  return sh;
}

export function linkProgram(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const prog = gl.createProgram();
  if (!prog) throw new Error("createProgram failed");
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error("program link failed: " + log);
  }
  return prog;
}

export function getUniformLocs(gl: WebGLRenderingContext, prog: WebGLProgram): UniformLocs {
  return {
    tex: gl.getUniformLocation(prog, "uTex"),
    res: gl.getUniformLocation(prog, "uRes"),
    vid: gl.getUniformLocation(prog, "uVid"),
    pixel: gl.getUniformLocation(prog, "uPixel"),
    black: gl.getUniformLocation(prog, "uBlack"),
    white: gl.getUniformLocation(prog, "uWhite"),
    gamma: gl.getUniformLocation(prog, "uGamma"),
    density: gl.getUniformLocation(prog, "uDensity"),
    time: gl.getUniformLocation(prog, "uTime"),
    shimmer: gl.getUniformLocation(prog, "uShimmer"),
    drift: gl.getUniformLocation(prog, "uDrift"),
    ink: gl.getUniformLocation(prog, "uInk"),
    bg: gl.getUniformLocation(prog, "uBg"),
    fit: gl.getUniformLocation(prog, "uFit"),
  };
}

export function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Push a StyleState (plus per-frame size/time) into the shader uniforms.
 * `pixelScale` lets the live canvas account for devicePixelRatio while the
 * exporter (rendering at native source resolution) passes 1.
 */
export function setStyleUniforms(
  gl: WebGLRenderingContext,
  u: UniformLocs,
  style: import("./style").StyleState,
  canvasW: number,
  canvasH: number,
  srcW: number,
  srcH: number,
  time: number,
  pixelScale = 1,
): void {
  const [ir, ig, ib] = hexToRgb(style.ink);
  const [br, bgc, bb] = hexToRgb(style.bg);
  gl.uniform2f(u.res, canvasW, canvasH);
  gl.uniform2f(u.vid, srcW, srcH);
  gl.uniform1f(u.pixel, style.pixel * pixelScale);
  gl.uniform1f(u.black, style.black);
  gl.uniform1f(u.white, style.white);
  gl.uniform1f(u.gamma, style.gamma);
  gl.uniform1f(u.density, style.density);
  gl.uniform1f(u.time, time);
  gl.uniform1f(u.shimmer, style.shimmer);
  gl.uniform1f(u.drift, style.drift);
  gl.uniform3f(u.ink, ir, ig, ib);
  gl.uniform3f(u.bg, br, bgc, bb);
  gl.uniform1i(u.fit, style.fit);
}
