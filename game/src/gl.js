import { clamp, lerp } from './random.js';
function matPerspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1; m[14] = 2 * far * near * nf;
  return m;
}
function matLookAt(eye, center, up) {
  let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
  let zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  let xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  const m = new Float32Array(16);
  m[0] = xx; m[1] = yx; m[2] = zx; m[4] = xy; m[5] = yy; m[6] = zy; m[8] = xz; m[9] = yz; m[10] = zz;
  m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  m[15] = 1;
  return m;
}
function matMul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) for (let r = 0; r < 4; r += 1) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// Dusk-first sky: Nova City is shot at golden dusk, never pitch black. The
// horizon stays warm purple-orange through the evening so the skyline, the
// fog and the neon all read on camera. Night only settles past 0.9.
const SKY_KEYS = [
  { t: 0.00, sky: [0.10, 0.07, 0.22], sun: [0.90, 0.55, 0.75], amb: [0.48, 0.44, 0.62], dir: [0.3, 0.6, 0.4] },
  { t: 0.30, sky: [0.22, 0.10, 0.30], sun: [1.00, 0.60, 0.50], amb: [0.55, 0.48, 0.64], dir: [0.5, 0.7, 0.3] },
  { t: 0.55, sky: [0.38, 0.18, 0.32], sun: [1.00, 0.62, 0.42], amb: [0.62, 0.53, 0.65], dir: [0.8, 0.4, 0.2] },
  { t: 0.75, sky: [0.30, 0.14, 0.36], sun: [0.90, 0.50, 0.70], amb: [0.57, 0.49, 0.64], dir: [-0.4, 0.6, 0.4] },
  { t: 0.90, sky: [0.12, 0.08, 0.24], sun: [0.60, 0.40, 0.80], amb: [0.44, 0.40, 0.58], dir: [-0.3, 0.6, 0.4] },
  { t: 1.00, sky: [0.08, 0.06, 0.18], sun: [0.50, 0.35, 0.75], amb: [0.40, 0.36, 0.54], dir: [-0.3, 0.6, 0.4] },
];
export function skyAt(tod) {
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i += 1) {
    if (tod >= SKY_KEYS[i].t && tod <= SKY_KEYS[i + 1].t) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const f = b.t === a.t ? 0 : clamp((tod - a.t) / (b.t - a.t), 0, 1);
  const mix = (x, y) => [lerp(x[0], y[0], f), lerp(x[1], y[1], f), lerp(x[2], y[2], f)];
  return {
    sky: mix(a.sky, b.sky), fog: mix(a.sky, b.sky), sun: mix(a.sun, b.sun), amb: mix(a.amb, b.amb),
    dir: norm3(mix(a.dir, b.dir)), night: true, fogNear: 300, fogFar: 3000,
  };
}
const colorCache = new Map();
export function parseColor(c) {
  if (Array.isArray(c)) return c.length === 3 ? [c[0], c[1], c[2], 1] : c;
  let hit = colorCache.get(c);
  if (hit) return hit;
  const n = parseInt(c.slice(1), 16);
  hit = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  colorCache.set(c, hit);
  return hit;
}
const VS = `attribute vec3 aPos; attribute vec4 aColor; attribute vec3 aNormal;
uniform mat4 uVP; uniform vec3 uCamPos; uniform vec3 uLightDir; uniform vec3 uLightCol;
uniform vec3 uAmbient; uniform float uFogNear; uniform float uFogFar; uniform float uEmissive;
varying vec4 vColor; varying float vFog;
void main(){
  vec3 n = normalize(aNormal);
  float diff = max(dot(n, uLightDir), 0.0);
  vec3 lit = aColor.rgb * (uAmbient + uLightCol * diff);
  lit += aColor.rgb * uEmissive;
  vColor = vec4(lit, aColor.a);
  float d = distance(aPos, uCamPos);
  vFog = clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  gl_Position = uVP * vec4(aPos, 1.0);
}`;
const FS = `precision mediump float;
varying vec4 vColor; varying float vFog; uniform vec3 uFogColor;
void main(){ vec3 c = mix(vColor.rgb, uFogColor, vFog); gl_FragColor = vec4(c, vColor.a); }`;
export function createRenderer(canvas) {
  // No MSAA: this game is flat-shaded low-poly, so the smoothing is barely
  // visible at 1280x800, but in software renderers (SwiftShader, weak
  // devices) multisampling nearly halves the frame rate (measured 4.3 fps
  // with it, 8.0 without). The game targets smooth play on low-end machines.
  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false });
  if (!gl) throw new Error('WebGL is not available');
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const loc = (n) => gl.getUniformLocation(prog, n);
  const U = {
    vp: loc('uVP'), cam: loc('uCamPos'), ldir: loc('uLightDir'), lcol: loc('uLightCol'),
    amb: loc('uAmbient'), fogc: loc('uFogColor'), fogn: loc('uFogNear'), fogf: loc('uFogFar'),
    emi: loc('uEmissive'),
  };
  const A = { pos: gl.getAttribLocation(prog, 'aPos'), col: gl.getAttribLocation(prog, 'aColor'), nrm: gl.getAttribLocation(prog, 'aNormal') };
  const bufPos = gl.createBuffer(), bufCol = gl.createBuffer(), bufNrm = gl.createBuffer(), bufIdx = gl.createBuffer();
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const R = {
    gl, w: canvas.width, h: canvas.height, fov: 60 * Math.PI / 180, aspect: canvas.width / canvas.height,
    eye: [0, 0, 0], fwd: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0], tanHalf: Math.tan((60 * Math.PI / 180) / 2),
    pos: [], col: [], nrm: [], idx: [], vc: 0, tris: 0, emissive: 0,
    setCamera(eye, target) {
      this.eye = eye;
      const view = matLookAt(eye, target, [0, 1, 0]);
      const proj = matPerspective(this.fov, this.aspect, 1, 6000);
      this.vp = matMul(proj, view);
      this.fwd = norm3([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
      this.right = norm3([-this.fwd[2], 0, this.fwd[0]]);
      const cr = this.right, f = this.fwd;
      this.up = norm3([cr[1] * f[2] - cr[2] * f[1], cr[2] * f[0] - cr[0] * f[2], cr[0] * f[1] - cr[1] * f[0]]);
    },
    begin(sky) {
      this.pos.length = 0; this.col.length = 0; this.nrm.length = 0; this.idx.length = 0; this.vc = 0; this.tris = 0;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(sky.sky[0], sky.sky[1], sky.sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(U.vp, false, this.vp);
      gl.uniform3fv(U.cam, this.eye);
      gl.uniform3fv(U.ldir, sky.dir);
      gl.uniform3fv(U.lcol, sky.sun);
      gl.uniform3fv(U.amb, sky.amb);
      gl.uniform3fv(U.fogc, sky.fog);
      gl.uniform1f(U.fogn, sky.fogNear);
      gl.uniform1f(U.fogf, sky.fogFar);
      gl.uniform1f(U.emi, 0);
    },
    // Sky elements (sun, horizon glow, stars) must not be fogged out, so the
    // renderer lets the scene turn fog off for them and back on after. Call
    // only with an empty batch (right after flush()).
    setFog(near, far) {
      gl.uniform1f(U.fogn, near);
      gl.uniform1f(U.fogf, far);
    },
    setEmissive(v) {
      if (v !== this.emissive) { this.flush(); this.emissive = v; gl.uniform1f(U.emi, v); }
    },
    vert(p, c, n) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(c[0], c[1], c[2], c[3]);
      this.nrm.push(n[0], n[1], n[2]);
      this.vc += 1;
      if (this.vc > 58000) this.flush();
    },
    quad(p0, p1, p2, p3, color, n) {
      const cs = Array.isArray(color) && Array.isArray(color[0]) ? color : [color, color, color, color];
      const c0 = parseColor(cs[0]), c1 = parseColor(cs[1]), c2 = parseColor(cs[2]), c3 = parseColor(cs[3]);
      const base = this.vc;
      this.vert(p0, c0, n); this.vert(p1, c1, n); this.vert(p2, c2, n); this.vert(p3, c3, n);
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      this.tris += 2;
    },
    flat(x, z, w, d, y, color) {
      this.quad([x, y, z], [x + w, y, z], [x + w, y, z + d], [x, y, z + d], color, [0, 1, 0]);
    },
    box(cx, cy, cz, w, h, d, color, ry) {
      const c = parseColor(color);
      const hx = w / 2, hy = h / 2, hz = d / 2;
      const cos = Math.cos(ry || 0), sin = Math.sin(ry || 0);
      const rot = (x, z) => [cx + x * cos - z * sin, cz + x * sin + z * cos];
      const corner = (sx, sy, sz) => { const [x, z] = rot(sx * hx, sz * hz); return [x, cy + sy * hy, z]; };
      const F = [
        { n: [0, 1, 0], pts: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]] },
        { n: [0, -1, 0], pts: [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]] },
        { n: [0, 0, 1], pts: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
        { n: [0, 0, -1], pts: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
        { n: [1, 0, 0], pts: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
        { n: [-1, 0, 0], pts: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
      ];
      for (const f of F) {
        const nx = f.n[0] * cos - f.n[2] * sin, nz = f.n[0] * sin + f.n[2] * cos;
        const pts = f.pts.map((p) => corner(p[0], p[1], p[2]));
        this.quad(pts[0], pts[1], pts[2], pts[3], c, [nx, f.n[1], nz]);
      }
    },
    cyl(x, y, z, r, h, color, sides) {
      const s = sides || 8, c = parseColor(color);
      const top = [], bot = [];
      for (let i = 0; i < s; i += 1) {
        const a = (i / s) * Math.PI * 2;
        top.push([x + Math.cos(a) * r, y + h, z + Math.sin(a) * r]);
        bot.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]);
      }
      for (let i = 0; i < s; i += 1) {
        const j = (i + 1) % s;
        const a = (i / s) * Math.PI * 2, nx = Math.cos(a + Math.PI / s), nz = Math.sin(a + Math.PI / s);
        this.quad(bot[i], bot[j], top[j], top[i], c, [nx, 0, nz]);
      }
      const tc = [x, y + h, z];
      for (let i = 0; i < s; i += 1) {
        const j = (i + 1) % s, base = this.vc;
        this.vert(tc, c, [0, 1, 0]); this.vert(top[i], c, [0, 1, 0]); this.vert(top[j], c, [0, 1, 0]);
        this.idx.push(base, base + 1, base + 2); this.tris += 1;
      }
    },
    // Sphere centered at (cx, cy, cz), radius r. Lat/long grid with true
    // normals, so heads, helmets and tree canopies catch the dusk light
    // instead of looking like flat cubes. sy scales the Y axis (0.6 makes
    // a flattened hair cap or a wide-brim hat).
    sphere(cx, cy, cz, r, color, seg, sy) {
      const s = seg || 8, rings = Math.max(4, Math.floor(s / 2));
      const c = parseColor(color);
      const ys = sy || 1;
      const pt = (i, j) => {
        const a = (i / s) * Math.PI * 2, b = (j / rings) * Math.PI;
        const nx = Math.sin(b) * Math.cos(a), ny = Math.cos(b), nz = Math.sin(b) * Math.sin(a);
        return { p: [cx + nx * r, cy + ny * r * ys, cz + nz * r], n: norm3([nx, ny / Math.max(ys, 0.01), nz]) };
      };
      for (let j = 0; j < rings; j += 1) {
        for (let i = 0; i < s; i += 1) {
          const i2 = (i + 1) % s;
          const a = pt(i, j), b = pt(i2, j), d = pt(i2, j + 1), e = pt(i, j + 1);
          const base = this.vc;
          this.vert(a.p, c, a.n); this.vert(b.p, c, b.n); this.vert(d.p, c, d.n); this.vert(e.p, c, e.n);
          this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          this.tris += 2;
        }
      }
    },
    // Tapered tube from (x0,y0,z0) to (x1,y1,z1), radius r0 at the start and
    // r1 at the end. Limbs (arms, legs, torso) and wheels are tubes: they
    // can point any direction, unlike cyl which is always vertical. A
    // swinging leg is just a tube whose end point moves with the walk phase.
    limb(x0, y0, z0, x1, y1, z1, r0, r1, color, sides) {
      const s = sides || 8, c = parseColor(color);
      const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
      const len = Math.hypot(dx, dy, dz) || 1;
      const d = [dx / len, dy / len, dz / len];
      const up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const u = norm3([d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]);
      const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
      for (let i = 0; i < s; i += 1) {
        const j = (i + 1) % s;
        const a0 = (i / s) * Math.PI * 2, a1 = (j / s) * Math.PI * 2;
        const n0 = [u[0] * Math.cos(a0) + v[0] * Math.sin(a0), u[1] * Math.cos(a0) + v[1] * Math.sin(a0), u[2] * Math.cos(a0) + v[2] * Math.sin(a0)];
        const n1 = [u[0] * Math.cos(a1) + v[0] * Math.sin(a1), u[1] * Math.cos(a1) + v[1] * Math.sin(a1), u[2] * Math.cos(a1) + v[2] * Math.sin(a1)];
        this.quad(
          [x0 + n0[0] * r0, y0 + n0[1] * r0, z0 + n0[2] * r0],
          [x0 + n1[0] * r0, y0 + n1[1] * r0, z0 + n1[2] * r0],
          [x1 + n1[0] * r1, y1 + n1[1] * r1, z1 + n1[2] * r1],
          [x1 + n0[0] * r1, y1 + n0[1] * r1, z1 + n0[2] * r1],
          c, n0,
        );
      }
    },
    rayGround(mx, my) {
      const nx = (mx / this.w) * 2 - 1, ny = 1 - (my / this.h) * 2;
      const dx = this.fwd[0] + this.right[0] * nx * this.tanHalf * this.aspect + this.up[0] * ny * this.tanHalf;
      const dy = this.fwd[1] + this.right[1] * nx * this.tanHalf * this.aspect + this.up[1] * ny * this.tanHalf;
      const dz = this.fwd[2] + this.right[2] * nx * this.tanHalf * this.aspect + this.up[2] * ny * this.tanHalf;
      if (dy > -0.001) return null;
      const t = -this.eye[1] / dy;
      return { x: this.eye[0] + dx * t, z: this.eye[2] + dz * t };
    },
    project(x, y, z) {
      const m = this.vp;
      const cx = m[0] * x + m[4] * y + m[8] * z + m[13];
      const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (cw <= 0.01) return null;
      return { x: (cx / cw * 0.5 + 0.5) * this.w, y: (0.5 - cy / cw * 0.5) * this.h };
    },
    flush() {
      if (this.idx.length === 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, bufPos);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.pos), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(A.pos);
      gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufCol);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.col), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(A.col);
      gl.vertexAttribPointer(A.col, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufNrm);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.nrm), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(A.nrm);
      gl.vertexAttribPointer(A.nrm, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIdx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.idx), gl.DYNAMIC_DRAW);
      gl.drawElements(gl.TRIANGLES, this.idx.length, gl.UNSIGNED_SHORT, 0);
      this.pos.length = 0; this.col.length = 0; this.nrm.length = 0; this.idx.length = 0; this.vc = 0;
    },
  };
  return R;
}
