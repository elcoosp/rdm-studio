import { createElement, useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * SpectralLogoCube island — interactive 3D optical-glass prism emblem for
 * RDM Studio's landing hero. Uses native `three` from workspace dependencies,
 * renders `/logo-rdm-studio.png` during SSR / pre-hydration for instant LCP,
 * blends transparently onto the Swiss Metrology hero canvas, honors
 * `prefers-reduced-motion`, and disposes all WebGL resources on unmount.
 */

function createFlatChamferedBox(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  b: number,
): THREE.BufferGeometry {
  const verts: number[] = [];
  const quad = (a: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, e: THREE.Vector3) => {
    verts.push(
      a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z,
      a.x, a.y, a.z, d.x, d.y, d.z, e.x, e.y, e.z,
    );
  };
  const tri = (a: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    verts.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  const ix0 = x0 + b;
  const ix1 = x1 - b;
  const iy0 = y0 + b;
  const iy1 = y1 - b;
  const iz0 = z0 + b;
  const iz1 = z1 - b;

  quad(V(ix0, iy0, z1), V(ix1, iy0, z1), V(ix1, iy1, z1), V(ix0, iy1, z1));
  quad(V(ix1, iy0, z0), V(ix0, iy0, z0), V(ix0, iy1, z0), V(ix1, iy1, z0));
  quad(V(x1, iy0, iz1), V(x1, iy0, iz0), V(x1, iy1, iz0), V(x1, iy1, iz1));
  quad(V(x0, iy0, iz0), V(x0, iy0, iz1), V(x0, iy1, iz1), V(x0, iy1, iz0));
  quad(V(ix0, y1, iz1), V(ix1, y1, iz1), V(ix1, y1, iz0), V(ix0, y1, iz0));
  quad(V(ix0, y0, iz0), V(ix1, y0, iz0), V(ix1, y0, iz1), V(ix0, y0, iz1));

  quad(V(ix0, iy1, z1), V(ix1, iy1, z1), V(ix1, y1, iz1), V(ix0, y1, iz1));
  quad(V(ix0, y0, iz1), V(ix1, y0, iz1), V(ix1, iy0, z1), V(ix0, iy0, z1));
  quad(V(ix1, iy0, z1), V(x1, iy0, iz1), V(x1, iy1, iz1), V(ix1, iy1, z1));
  quad(V(x0, iy0, iz1), V(ix0, iy0, z1), V(ix0, iy1, z1), V(x0, iy1, iz1));
  quad(V(ix1, iy1, z0), V(ix0, iy1, z0), V(ix0, y1, iz0), V(ix1, y1, iz0));
  quad(V(ix1, y0, iz0), V(ix0, y0, iz0), V(ix0, iy0, z0), V(ix1, iy0, z0));
  quad(V(x1, iy0, iz0), V(ix1, iy0, z0), V(ix1, iy1, z0), V(x1, iy1, iz0));
  quad(V(ix0, iy0, z0), V(x0, iy0, iz0), V(x0, iy1, iz0), V(ix0, iy1, z0));
  quad(V(x1, iy1, iz1), V(x1, iy1, iz0), V(ix1, y1, iz0), V(ix1, y1, iz1));
  quad(V(x0, iy1, iz0), V(x0, iy1, iz1), V(ix0, y1, iz1), V(ix0, y1, iz0));
  quad(V(x1, y0, iz1), V(x1, y0, iz0), V(x1, iy0, iz0), V(x1, iy0, iz1));
  quad(V(x0, y0, iz0), V(x0, y0, iz1), V(x0, iy0, iz1), V(x0, iy0, iz0));

  tri(V(ix1, iy1, z1), V(x1, iy1, iz1), V(ix1, y1, iz1));
  tri(V(x0, iy1, iz1), V(ix0, iy1, z1), V(ix0, y1, iz1));
  tri(V(x1, iy0, iz1), V(ix1, iy0, z1), V(ix1, y0, iz1));
  tri(V(ix0, iy0, z1), V(x0, iy0, iz1), V(ix0, y0, iz1));
  tri(V(x1, iy1, iz0), V(ix1, iy1, z0), V(ix1, y1, iz0));
  tri(V(ix0, iy1, z0), V(x0, iy1, iz0), V(ix0, y1, iz0));
  tri(V(ix1, iy0, z0), V(x1, iy0, iz0), V(ix1, y0, iz0));
  tri(V(x0, iy0, iz0), V(ix0, iy0, z0), V(ix0, y0, iz0));

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}

function createExtrudedGroovedSlab(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  b: number,
): THREE.BufferGeometry {
  const verts: number[] = [];
  const cx = (x0 + x1) * 0.5;
  const cy = (y0 + y1) * 0.5;
  const cz = (z0 + z1) * 0.5;

  const tri = (a: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    const e1x = c.x - a.x;
    const e1y = c.y - a.y;
    const e1z = c.z - a.z;
    const e2x = d.x - a.x;
    const e2y = d.y - a.y;
    const e2z = d.z - a.z;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const mx = (a.x + c.x + d.x) / 3 - cx;
    const my = (a.y + c.y + d.y) / 3 - cy;
    const mz = (a.z + c.z + d.z) / 3 - cz;
    if (nx * mx + ny * my + nz * mz < 0) {
      const tmp = c;
      c = d;
      d = tmp;
    }
    verts.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
  };
  const quad = (a: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, e: THREE.Vector3) => {
    tri(a, c, d);
    tri(a, d, e);
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  const ix0 = x0 + b;
  const ix1 = x1 - b;
  const iy0 = y0 + b;
  const iy1 = y1 - b;
  const iz0 = z0 + b;
  const iz1 = z1 - b;
  const g1 = 0.34;
  const g2 = -0.34;
  const gw = 0.052;
  const gd = 0.13;
  const gx = x1 - gd;

  const prof = [
    V(x0, iy0, 0), V(ix0, y0, 0), V(ix1, y0, 0), V(x1, iy0, 0),
    V(x1, g2 - gw, 0), V(gx, g2, 0), V(x1, g2 + gw, 0),
    V(x1, g1 - gw, 0), V(gx, g1, 0), V(x1, g1 + gw, 0),
    V(x1, iy1, 0), V(ix1, y1, 0), V(ix0, y1, 0), V(x0, iy1, 0),
  ];
  const inner = [
    V(ix0, iy0, 0), V(ix0, iy0, 0), V(ix1, iy0, 0), V(x1, iy0, 0),
    V(x1, g2 - gw, 0), V(gx, g2, 0), V(x1, g2 + gw, 0),
    V(x1, g1 - gw, 0), V(gx, g1, 0), V(x1, g1 + gw, 0),
    V(x1, iy1, 0), V(ix1, iy1, 0), V(ix0, iy1, 0), V(ix0, iy1, 0),
  ];

  for (let i = 0; i < prof.length; i++) {
    const j = (i + 1) % prof.length;
    const p0 = prof[i]!;
    const p1 = prof[j]!;
    const q0 = inner[i]!;
    const q1 = inner[j]!;
    if (Math.hypot(p1.x - p0.x, p1.y - p0.y) > 1e-5) {
      quad(V(p0.x, p0.y, iz1), V(p1.x, p1.y, iz1), V(p1.x, p1.y, iz0), V(p0.x, p0.y, iz0));
      if (Math.hypot(q0.x - p0.x, q0.y - p0.y) > 1e-5 || Math.hypot(q1.x - p1.x, q1.y - p1.y) > 1e-5) {
        quad(V(q0.x, q0.y, z1), V(q1.x, q1.y, z1), V(p1.x, p1.y, iz1), V(p0.x, p0.y, iz1));
        quad(V(p0.x, p0.y, iz0), V(p1.x, p1.y, iz0), V(q1.x, q1.y, z0), V(q0.x, q0.y, z0));
      }
    }
  }

  const bands = [
    { yA: iy0, yB: g2 - gw },
    { yA: g2 + gw, yB: g1 - gw },
    { yA: g1 + gw, yB: iy1 },
  ];
  for (const bd of bands) {
    quad(V(ix0, bd.yA, z1), V(x1, bd.yA, z1), V(x1, bd.yB, z1), V(ix0, bd.yB, z1));
    quad(V(x1, bd.yA, z0), V(ix0, bd.yA, z0), V(ix0, bd.yB, z0), V(x1, bd.yB, z0));
  }
  quad(V(ix0, g2 - gw, z1), V(x1, g2 - gw, z1), V(gx, g2, z1), V(ix0, g2, z1));
  quad(V(ix0, g2, z1), V(gx, g2, z1), V(x1, g2 + gw, z1), V(ix0, g2 + gw, z1));
  quad(V(ix0, g1 - gw, z1), V(x1, g1 - gw, z1), V(gx, g1, z1), V(ix0, g1, z1));
  quad(V(ix0, g1, z1), V(gx, g1, z1), V(x1, g1 + gw, z1), V(ix0, g1 + gw, z1));
  quad(V(x1, g2 - gw, z0), V(ix0, g2 - gw, z0), V(ix0, g2, z0), V(gx, g2, z0));
  quad(V(gx, g2, z0), V(ix0, g2, z0), V(ix0, g2 + gw, z0), V(x1, g2 + gw, z0));
  quad(V(x1, g1 - gw, z0), V(ix0, g1 - gw, z0), V(ix0, g1, z0), V(gx, g1, z0));
  quad(V(gx, g1, z0), V(ix0, g1, z0), V(ix0, g1 + gw, z0), V(x1, g1 + gw, z0));

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}

export default function SpectralLogoCubeIsland(): React.ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff, 0);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.style.touchAction = "none";
    host.appendChild(renderer.domElement);

    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
    cam.position.set(7, 6, 7.5);
    cam.lookAt(0, 0, 0);

    const scene = new THREE.Scene();
    const ballScene = new THREE.Scene();
    const rt = new THREE.WebGLRenderTarget(384, 384, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });

    const uTime = { value: 0 };
    const uRes = { value: new THREE.Vector2(1, 1) };
    const uTex = { value: rt.texture };

    const BALL_R = 1.38;
    const ballMat = new THREE.ShaderMaterial({
      uniforms: { uTime, uR: { value: BALL_R } },
      vertexShader: `
        varying vec3 vView, vCenter, vObj;
        void main() {
          vObj = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = mv.xyz;
          vCenter = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vView, vCenter, vObj;
        uniform float uTime, uR;
        vec3 ramp(float t) {
          vec3 c0 = vec3(1.00, 0.32, 0.50);
          vec3 c1 = vec3(1.00, 0.58, 0.18);
          vec3 c2 = vec3(1.00, 0.92, 0.22);
          vec3 c3 = vec3(0.20, 0.92, 0.44);
          vec3 c4 = vec3(0.12, 0.84, 1.00);
          vec3 c5 = vec3(0.32, 0.46, 1.00);
          vec3 c6 = vec3(0.76, 0.48, 1.00);
          t = clamp(t, 0.0, 1.0) * 6.0;
          if (t < 1.0) return mix(c0, c1, t);
          if (t < 2.0) return mix(c1, c2, t - 1.0);
          if (t < 3.0) return mix(c2, c3, t - 2.0);
          if (t < 4.0) return mix(c3, c4, t - 3.0);
          if (t < 5.0) return mix(c4, c5, t - 4.0);
          return mix(c5, c6, t - 5.0);
        }
        void main() {

          vec2 q = (vView.xy - vCenter.xy) / uR;
          vec3 p = vObj / uR;
          float warp = 0.070 * sin(p.x * 3.0 + p.y * 2.0 + uTime * 0.7)
          + 0.050 * sin(p.y * 4.0 - p.z * 3.0 - uTime * 0.6)
          + 0.040 * sin(p.z * 5.0 + p.x * 2.0 + uTime * 0.9);
          float d = length(q) + warp - 0.05 * sin(uTime * 1.1);
          float t = d * 1.05 + 0.08 * sin(d * 14.0 - uTime * 1.6) * smoothstep(0.2, 0.9, d);
          vec3 col = ramp(t);
          col = mix(col, ramp(fract(d * 2.2 + 0.1 - uTime * 0.03)), 0.22 * smoothstep(0.3, 0.9, d));
          col = mix(col, vec3(1.0, 0.96, 0.94), 0.30 * exp(-d * d * 8.5) * (0.6 + 0.4 * sin(uTime * 2.0)));
          float a = smoothstep(1.04, 0.46, d) * 0.98;
          gl_FragColor = vec4(col * a, a);
        }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    const ballGroup = new THREE.Group();
    ballScene.add(ballGroup);
    const ballGeo = new THREE.SphereGeometry(BALL_R, 48, 36);
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ballGroup.add(ball);
    const VERT = `varying vec3 vP, vNv, vNo; void main() { vP = position; vNo = normalize(normal); vNv = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
    const FRAG = `precision highp float; varying vec3 vP, vNv, vNo; uniform vec3 uMin, uMax; uniform float uFrost, uBack, uTime; uniform sampler2D uTex; uniform vec2 uRes; float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } void main() { vec2 uv = gl_FragCoord.xy / uRes; vec3 N = normalize(vNv); if (!gl_FrontFacing) N = -N; vec3 No = normalize(vNo); if (!gl_FrontFacing) No = -No; vec3 absNo = abs(No); float maxAxis = max(absNo.x, max(absNo.y, absNo.z)); float isBevel = smoothstep(0.95, 0.72, maxAxis); vec2 refr = N.xy * (uBack > 0.5 ? -0.024 : 0.048) + 0.010 * (1.0 - uFrost) * vec2( sin(vP.y * 7.0 + uTime * 0.6 + N.x * 3.0), cos(vP.z * 6.0 - uTime * 0.5 + N.y * 3.0) ); float rad = mix(0.006, 0.068, uFrost); vec2 asp = vec2(uRes.y / uRes.x, 1.0); float j = hash(gl_FragCoord.xy) * 6.2832; vec3 acc = vec3(0.0); for (int i = 0; i < 14; i++) { float fi = float(i); float r = sqrt((fi + 0.5) / 14.0) * rad; float an = fi * 2.399963 + j; acc += texture2D(uTex, uv + refr + vec2(cos(an), sin(an)) * r * asp).rgb; } vec3 tex = acc / 14.0; vec2 dv = N.xy * 0.038 * (0.35 + 0.65 * isBevel); vec3 disp = vec3( texture2D(uTex, uv + refr + dv).r, texture2D(uTex, uv + refr).g, texture2D(uTex, uv + refr - dv).b ); tex = mix(tex, disp, 0.38 + isBevel * 0.55); float diff = 0.85 + 0.16 * dot(No, normalize(vec3(-0.35, 0.85, 0.48))); vec3 col = tex * vec3(0.88, 0.915, 0.965) * diff; col = mix(col, vec3(0.84, 0.88, 0.935) * diff, uFrost * 0.46); float streak = pow(max(0.0, sin((vP.y * 2.4 + vP.z * 1.9 + N.x * 2.5) * 3.2 + uTime * 0.15)), 14.0) * 0.24 * (1.0 - uFrost); float spec = pow(max(dot(reflect(-normalize(vec3(-0.4, 0.8, 0.6)), N), vec3(0.0, 0.0, 1.0)), 0.0), 30.0) * 0.42; col += streak + spec; float rimShade = isBevel * smoothstep(0.0, 0.7, -No.z + No.x * 0.4); col = mix(col, vec3(0.68, 0.74, 0.82), rimShade * 0.32); col = mix(col, vec3(0.96, 0.98, 1.0), isBevel * (1.0 - rimShade) * 0.48); col += (hash(gl_FragCoord.xy + 7.0) - 0.5) * 0.015; float al = (uBack > 0.5) ? 0.35 : (0.78 + 0.15 * uFrost); gl_FragColor = vec4(col * al, al); }`;
    const slabs = [
      { x0: -1.00, x1: -0.45, y0: -1.00, y1: 1.00, z0: -1.00, z1: 1.00, frost: 0.74, grooved: false },
      { x0: -0.35, x1: 0.35, y0: -1.00, y1: 1.00, z0: -1.00, z1: 1.00, frost: 0.16, grooved: false },
      { x0: 0.45, x1: 1.00, y0: -1.00, y1: 1.00, z0: -1.00, z1: 1.00, frost: 0.44, grooved: true },
    ];
    const group = new THREE.Group();
    scene.add(group);
    const meshes: THREE.Mesh[] = [];
    const geos: THREE.BufferGeometry[] = [ballGeo];
    const mats: THREE.ShaderMaterial[] = [ballMat];
    for (const s of slabs) {
      const g = s.grooved
      ? createExtrudedGroovedSlab(s.x0, s.x1, s.y0, s.y1, s.z0, s.z1, 0.068)
      : createFlatChamferedBox(s.x0, s.x1, s.y0, s.y1, s.z0, s.z1, 0.068);
      geos.push(g);
      for (const back of new Array(1, 0)) {
        const m = new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            uniforms: {
              uMin: { value: new THREE.Vector3(s.x0, s.y0, s.z0) },
              uMax: { value: new THREE.Vector3(s.x1, s.y1, s.z1) },
              uFrost: { value: s.frost },
              uBack: { value: back },
              uTime,
              uTex,
              uRes,
            },
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: THREE.CustomBlending,
            blendEquation: THREE.AddEquation,
            blendSrc: THREE.OneFactor,
            blendDst: THREE.OneMinusSrcAlphaFactor,
            side: back ? THREE.BackSide : THREE.FrontSide,
        });
        mats.push(m);
        const mesh = new THREE.Mesh(g, m);
        mesh.userData.back = back;
        group.add(mesh);
        meshes.push(mesh);
      }
    }
    const userQ = new THREE.Quaternion();
    const swayQ = new THREE.Quaternion();
    const X = new THREE.Vector3(1, 0, 0);
    const Y = new THREE.Vector3(0, 1, 0);
    const q1 = new THREE.Quaternion();
    const q2 = new THREE.Quaternion();
    let dragging = false;
    let lx = 0;
    let ly = 0;
    let vx = 0;
    let vy = 0;
    const el = renderer.domElement;
    const spin = (dx: number, dy: number) => {
      q1.setFromAxisAngle(Y, dx);
      q2.setFromAxisAngle(X, dy);
      userQ.premultiply(q1).premultiply(q2);
    };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
      el.style.cursor = "grabbing";
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      vx = (e.clientX - lx) * 0.01;
      vy = (e.clientY - ly) * 0.01;
      lx = e.clientX;
      ly = e.clientY;
      spin(vx, vy);
    };
    const onUp = () => {
      dragging = false;
      el.style.cursor = "grab";
    };
    const onDbl = () => {
      userQ.identity();
      vx = 0;
      vy = 0;
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("dblclick", onDbl);
    const resize = () => {
      const rect = host.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const a = w / h;
      const s = 1.92;
      renderer.setSize(w, h, false);
      const db = renderer.getDrawingBufferSize(new THREE.Vector2());
      rt.setSize(db.x, db.y);
      uRes.value.copy(db);
      if (a >= 1) {
        cam.left = -s * a;
        cam.right = s * a;
        cam.top = s;
        cam.bottom = -s;
      } else {
        cam.left = -s;
        cam.right = s;
        cam.top = s / a;
        cam.bottom = -s / a;
      }
      cam.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    const clock = new THREE.Clock();
    const v = new THREE.Vector3();
    const inv = new THREE.Matrix4();
    let rafId = 0;
    let disposed = false;
    const loop = () => {
      if (disposed) return;
      const dt = clock.getDelta();
      if (!reducedMotion) {
        uTime.value += dt;
      }
      const t = uTime.value;
      if (!dragging) {
        spin(vx, vy);
        vx *= 0.95;
        vy *= 0.95;
      }
      const swayAngle = reducedMotion ? 0 : Math.sin(t * 0.45) * 0.22;
      swayQ.setFromAxisAngle(Y, swayAngle);
      group.quaternion.copy(swayQ).multiply(userQ);
      ballGroup.quaternion.copy(group.quaternion);
      ball.position.set(
        0.08 + 0.12 * Math.sin(t * 0.5),
        0.04 + 0.10 * Math.sin(t * 0.7 + 1.0),
        0.06 + 0.12 * Math.sin(t * 0.4 + 2.0),
      );
      ball.rotation.set(t * 0.3, t * 0.4, t * 0.2);
      group.updateMatrixWorld(true);
      cam.updateMatrixWorld(true);
      inv.copy(cam.matrixWorld).invert();
      for (const m of meshes) {
        m.geometry.boundingBox?.getCenter(v);
        v.applyMatrix4(group.matrixWorld).applyMatrix4(inv);
        const k = Math.max(-300, Math.min(300, (v.z * 40) | 0));
        m.renderOrder = (m.userData.back ? -1000 : 0) + k;
      }
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0xffffff, 1);
      renderer.clear();
      renderer.render(ballScene, cam);
      renderer.setRenderTarget(null);
      renderer.setClearColor(0xffffff, 0);
      renderer.clear();
      renderer.render(scene, cam);
      if (!ready) setReady(true);
      rafId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("dblclick", onDbl);
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      rt.dispose();
      renderer.dispose();
      if (el.parentNode === host) host.removeChild(el);
    };
  }, []);

  return createElement("div", {
    ref: hostRef,
    "data-testid": "spectral-logo-cube",
    role: "img",
    "aria-label": "RDM Studio",
    title: "Glisser pour pivoter · Double-clic pour réinitialiser",
    style: {
      position: "relative",
      width: 96,
      height: 96,
      overflow: "hidden",
      backgroundImage: ready ? "none" : 'url("/logo-rdm-studio.png")',
      backgroundSize: "contain",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center",
    },
    className: "relative h-full w-full select-none",
  });
}
