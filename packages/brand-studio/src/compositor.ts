import fs from "node:fs";
import path from "node:path";
import { render, renderSvg } from "takumi-js";
import { container, image, text } from "@takumi-rs/helpers";
import type { ReleaseSpec } from "./releases.ts";
import { REPO_ROOT, loadUiTokens } from "./tokens.ts";

const FONT_INTER_400 = path.join(REPO_ROOT, "apps/web/public/fonts/inter-latin-400-normal.ttf");
const FONT_INTER_600 = path.join(REPO_ROOT, "apps/web/public/fonts/inter-latin-600-normal.ttf");
const FONT_INTER_700 = path.join(REPO_ROOT, "apps/web/public/fonts/inter-latin-700-normal.ttf");
const FONT_MONO_400 = path.join(REPO_ROOT, "apps/web/public/fonts/jetbrains-mono-latin-400-normal.ttf");
const FONT_MONO_600 = path.join(REPO_ROOT, "apps/web/public/fonts/jetbrains-mono-latin-600-normal.ttf");

const LOGO_CANDIDATES = [
  path.join(REPO_ROOT, "apps/web/public/logo-rdm-studio.png"),
  path.join(REPO_ROOT, "apps/site/public/logo-rdm-studio.png"),
  path.join(REPO_ROOT, "docs/logo.png"),
];

function resolveLogoPath(): string {
  for (const p of LOGO_CANDIDATES) {
    if (fs.existsSync(p) && fs.statSync(p).size > 100) return p;
  }
  throw new Error("Could not find logo-rdm-studio.png in repo");
}

let cachedFonts: Array<{ name: string; data: Buffer; weight: number; style: "normal" }> | null = null;

function loadBrandFonts() {
  if (cachedFonts) return cachedFonts;
  const list: Array<{ name: string; data: Buffer; weight: number; style: "normal" }> = [
    { name: "Inter", data: fs.readFileSync(FONT_INTER_400), weight: 400, style: "normal" },
    { name: "Inter", data: fs.readFileSync(FONT_INTER_600), weight: 600, style: "normal" },
    { name: "Inter", data: fs.readFileSync(FONT_INTER_700), weight: 700, style: "normal" },
    { name: "JetBrains Mono", data: fs.readFileSync(FONT_MONO_400), weight: 400, style: "normal" },
    { name: "JetBrains Mono", data: fs.readFileSync(FONT_MONO_600), weight: 600, style: "normal" },
  ];
  for (const fallback of [
    "/System/Library/Fonts/Apple Symbols.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  ]) {
    if (fs.existsSync(fallback)) {
      list.push({ name: "Apple Symbols", data: fs.readFileSync(fallback), weight: 400, style: "normal" });
      break;
    }
  }
  cachedFonts = list;
  return cachedFonts;
}

export interface RenderBannerOptions {
  spec: ReleaseSpec;
  illustrationPath?: string;
  width?: number;
  height?: number;
  format?: "png" | "webp" | "svg";
}

function buildDefaultCadSchematic() {
  const T = loadUiTokens();
  const loadArrows = Array.from({ length: 8 }, (_, i) => 130 + i * 45).map((x) =>
    '<line x1="' + x + '" y1="102" x2="' + x + '" y2="134" stroke="' + T.feaTier5 + '" stroke-width="1.4"/>' +
    '<polygon points="' + x + ',138 ' + (x - 3.5) + ',130 ' + (x + 3.5) + ',130" fill="' + T.feaTier5 + '"/>',
  ).join("");

  const fixedHatch = Array.from({ length: 6 }, (_, i) => 92 + i * 8).map((x) =>
    '<line x1="' + x + '" y1="385" x2="' + (x - 6) + '" y2="395" stroke="' + T.inkSecondary + '" stroke-width="1.4"/>',
  ).join("");

  const svg =
    '<svg xmlns="http://w3.org" width="580" height="480" viewBox="0 0 580 480" fill="none">' +
    "<defs>" +
    '<linearGradient id="beamGrad" x1="110" y1="0" x2="470" y2="0" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0%" stop-color="' + T.feaTier1 + '"/>' +
    '<stop offset="30%" stop-color="' + T.feaTier2 + '"/>' +
    '<stop offset="50%" stop-color="' + T.feaTier5 + '"/>' +
    '<stop offset="70%" stop-color="' + T.feaTier2 + '"/>' +
    '<stop offset="100%" stop-color="' + T.feaTier1 + '"/>' +
    "</linearGradient>" +
    '<linearGradient id="momentFill" x1="0" y1="150" x2="0" y2="255" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0%" stop-color="' + T.accent + '" stop-opacity="0.18"/>' +
    '<stop offset="100%" stop-color="' + T.accent + '" stop-opacity="0.02"/>' +
    "</linearGradient>" +
    "</defs>" +
    '<circle cx="290" cy="240" r="195" stroke="' + T.hairline + '" stroke-width="1" stroke-dasharray="4 6"/>' +
    '<circle cx="290" cy="240" r="135" stroke="' + T.hairline + '" stroke-width="1"/>' +
    '<line x1="110" y1="68" x2="470" y2="68" stroke="' + T.accent + '" stroke-width="1.2"/>' +
    '<line x1="110" y1="60" x2="110" y2="76" stroke="' + T.accent + '" stroke-width="1.2"/>' +
    '<line x1="470" y1="60" x2="470" y2="76" stroke="' + T.accent + '" stroke-width="1.2"/>' +
    '<line x1="68" y1="145" x2="68" y2="385" stroke="' + T.accent + '" stroke-width="1.2"/>' +
    '<line x1="60" y1="145" x2="76" y2="145" stroke="' + T.accent + '" stroke-width="1.2"/>' +
    '<line x1="60" y1="385" x2="76" y2="385" stroke="' + T.accent + '" stroke-width="1.2"/>' +
    '<line x1="110" y1="102" x2="470" y2="102" stroke="' + T.feaTier5 + '" stroke-width="1.5"/>' +
    loadArrows +
    '<path d="M 110 145 Q 290 265 470 145 Z" fill="url(#momentFill)" stroke="' + T.accent + '" stroke-width="1.5" stroke-dasharray="5 4"/>' +
    '<rect x="103" y="145" width="14" height="240" rx="2" fill="' + T.feaTier1 + '"/>' +
    '<rect x="463" y="145" width="14" height="240" rx="2" fill="' + T.feaTier1 + '"/>' +
    '<rect x="103" y="138" width="374" height="14" rx="2" fill="url(#beamGrad)"/>' +
    '<polygon points="117,152 146,152 117,178" fill="' + T.accent + '" fill-opacity="0.22" stroke="' + T.accent + '" stroke-width="1.2"/>' +
    '<polygon points="463,152 434,152 463,178" fill="' + T.accent + '" fill-opacity="0.22" stroke="' + T.accent + '" stroke-width="1.2"/>' +
    '<circle cx="110" cy="145" r="5" fill="' + T.panel + '" stroke="' + T.accent + '" stroke-width="2"/>' +
    '<circle cx="470" cy="145" r="5" fill="' + T.panel + '" stroke="' + T.accent + '" stroke-width="2"/>' +
    '<circle cx="290" cy="145" r="4" fill="' + T.panel + '" stroke="' + T.feaTier5 + '" stroke-width="2"/>' +
    '<line x1="86" y1="385" x2="134" y2="385" stroke="' + T.inkPrimary + '" stroke-width="2.5"/>' +
    fixedHatch +
    '<polygon points="470,385 454,407 486,407" fill="' + T.panel + '" stroke="' + T.inkPrimary + '" stroke-width="2"/>' +
    '<line x1="448" y1="407" x2="492" y2="407" stroke="' + T.inkPrimary + '" stroke-width="2"/>' +
    '<line x1="495" y1="340" x2="538" y2="340" stroke="' + T.feaTier5 + '" stroke-width="1.8"/>' +
    '<polygon points="543,340 535,336.5 535,343.5" fill="' + T.feaTier5 + '"/>' +
    '<line x1="495" y1="340" x2="495" y2="297" stroke="' + T.accent + '" stroke-width="1.8"/>' +
    '<polygon points="495,292 491.5,300 498.5,300" fill="' + T.accent + '"/>' +
    '<circle cx="495" cy="340" r="3" fill="' + T.inkPrimary + '"/>' +
    "</svg>";

  return image({
    src: svg,
    width: 580,
    height: 480,
    style: {
      width: 580,
      height: 480,
      objectFit: "contain",
    },
  });
}

function buildReleaseBannerTree(
  spec: ReleaseSpec,
  logoBytes: Uint8Array,
  illustrationBytes: Uint8Array | null,
) {
  const T = loadUiTokens();
  const spectrum = [T.feaTier1, T.feaTier2, T.feaTier3, T.feaTier4, T.feaTier5];

  return container({
    style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: T.canvas,
      backgroundImage: "radial-gradient(" + T.borderSubtle + " 1.35px, transparent 1.35px)",
      backgroundSize: "22px 22px",
      fontFamily: "Inter",
      color: T.inkPrimary,
      justifyContent: "space-between",
    },
    children: [
      container({
        style: {
          width: "100%",
          height: 4,
          display: "flex",
          flexDirection: "row",
          flexShrink: 0,
        },
        children: [container({ style: { width: '100%', height: 3, backgroundColor: T.accent }, children: [] })],
      }),
      container({
        style: {
          flexGrow: 1,
          display: "flex",
          flexDirection: "row",
          paddingTop: 28,
          paddingBottom: 38,
          paddingLeft: 52,
          paddingRight: 44,
          justifyContent: "space-between",
          alignItems: "stretch",
        },
        children: [
          container({
            style: {
              width: 580,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              paddingRight: 24,
            },
            children: [
              container({
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                },
                children: [
                  container({
                    style: {
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 22,
                    },
                    children: [
                      image({
                        src: logoBytes,
                        width: 120,
                        height: 120,
                        style: {
                          width: 120,
                          height: 120,
                          flexShrink: 0,
                          objectFit: "contain",
                        },
                      }),
                      container({
                        style: {
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        },
                        children: [
                          text("RDM Studio", {
                            fontFamily: "Inter",
                            fontWeight: 700,
                            fontSize: 54,
                            lineHeight: "58px",
                            letterSpacing: "-0.03em",
backgroundImage: "linear-gradient(135deg, " + T.inkPrimary + " 0%, " + T.accent + " 100%)",
backgroundClip: "text",
color: "transparent",
}),
container({
style: {
display: "flex",
flexDirection: "row",
alignItems: "center",
gap: 10,
},
children: [
container({
                                style: {
                                  display: "flex",
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 10,
                                  backgroundColor: "rgba(255, 255, 255, 0.78)",
                                  backgroundImage: "linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(239, 246, 255, 0.68) 100%)",
                                  border: "1.5px solid " + T.accentRing,
                                  borderRadius: "9999px",
                                  boxShadow: "0 4px 16px rgba(29, 78, 216, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.95)",
                                  paddingTop: 6,
                                  paddingBottom: 6,
                                  paddingLeft: 16,
                                  paddingRight: 20,
                                },
                                children: [
                                  container({
                                    style: {
                                      width: 9,
                                      height: 9,
                                      borderRadius: "9999px",
                                      backgroundColor: T.accent,
                                    },
                                    children: [],
                                  }),
                                  text(spec.version, {
                                    fontFamily: "JetBrains Mono",
                                    fontWeight: 600,
                                    fontSize: 24,
                                    lineHeight: "28px",
                                    color: T.inkPrimary,
                                  }),
                                ],
                              }),
text("GITHUB RELEASE", {
fontFamily: "JetBrains Mono",
fontWeight: 600,
fontSize: 13,
letterSpacing: "0.08em",
color: T.accent,
}),
],
}),
],
}),
],
}),
container({
style: {
width: "100%",
height: 1,
backgroundColor: T.hairline,
},
children: [],
}),
container({
style: {
display: "flex",
flexDirection: "column",
gap: 10,
},
children: [
text(spec.title, {
fontFamily: "Inter",
fontWeight: 700,
fontSize: 42,
lineHeight: "48px",
letterSpacing: "-0.025em",
color: T.inkPrimary,
}),
container({
                        style: {
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          paddingTop: 2,
                        },
                        children: spec.subtitle.split(" · ").map((item) =>
                          container({
                            style: {
                              display: "flex",
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                            },
                            children: [
                              container({
                                style: {
                                  width: 6,
                                  height: 6,
                                  borderRadius: 1,
                                  backgroundColor: T.accent,
                                  flexShrink: 0,
                                },
                                children: [],
                              }),
                              text(item.trim(), {
                                fontFamily: "Inter",
                                fontWeight: 500,
                                fontSize: 19,
                                lineHeight: "24px",
                                color: T.inkSecondary,
                              }),
                            ],
                          }),
                        ),
                      }),
],
}),
],
}),
container({
style: {
display: "flex",
flexDirection: "column",
gap: 10,
},
children: [
container({
style: {
display: "flex",
flexDirection: "row",
flexWrap: "wrap",
gap: 10,
},
children: spec.tags.map((tag) =>
container({
style: {
backgroundColor: T.panel,
border: "1px solid " + T.accentRing,
borderRadius: T.radiusControl,
paddingTop: 7,
paddingBottom: 7,
paddingLeft: 13,
paddingRight: 13,
},
children: [
text(tag, {
fontFamily: "JetBrains Mono",
fontWeight: 600,
fontSize: 14,
lineHeight: "18px",
color: T.accent,
}),
],
}),
),
}),
container({
style: {
display: "flex",
flexDirection: "row",
alignItems: "center",
gap: 10,
},
children: [
container({
style: {
width: 8,
height: 8,
borderRadius: 4,
backgroundColor: T.feaTier3,
},
children: [],
}),
text("OPEN SOURCE · LOCAL-FIRST WASM · EN 1990 – 1999", {
fontFamily: "JetBrains Mono",
fontWeight: 400,
fontSize: 13,
color: T.inkSecondary,
}),
],
}),
],
}),
],
}),
container({
style: {
flexGrow: 1,
display: "flex",
flexDirection: "column",
alignItems: "center",
justifyContent: "center",
position: "relative",
},
children: [
illustrationBytes
? image({
src: illustrationBytes,
width: 600,
height: 520,
style: {
width: "100%",
height: "100%",
objectFit: "contain",
},
})
: buildDefaultCadSchematic(),
],
}),
],
}),
],
});
}
export async function renderReleaseBanner(opts: RenderBannerOptions): Promise<Buffer | string> {
const width = opts.width ?? 1280;
const height = opts.height ?? 640;
const format = opts.format ?? "png";
const fonts = loadBrandFonts();
const logoBytes = new Uint8Array(fs.readFileSync(resolveLogoPath()));
const illustrationBytes =
opts.illustrationPath && fs.existsSync(opts.illustrationPath)
? new Uint8Array(fs.readFileSync(opts.illustrationPath))
: null;
const tree = buildReleaseBannerTree(opts.spec, logoBytes, illustrationBytes);
if (format === "svg") {
return renderSvg(tree, { width, height, fonts });
}
const bytes = await render(tree, { width, height, format, fonts });
return Buffer.from(bytes);
}
