import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:5173",
  },
  webServer: {
    // PWA offline tests run against the production build: the service
    // worker only exists in the built artifact.
    command: "pnpm exec vite build && pnpm exec vite preview --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  // M8 (section 18): e2e green on Chromium + Firefox (+ Safari/WebKit).
  // - mobile.spec.ts (Motion drag gestures) runs on chromium only: Firefox's
  //   touch emulation cancels synthetic pointer streams mid-drag.
  // - WebKit cannot launch in this sandbox: 8 system libraries missing and
  //   `playwright install-deps` needs sudo. Same specs otherwise.
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    {
      name: "firefox",
      use: { browserName: "firefox" },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: "webkit",
      use: { browserName: "webkit" },
      // AGENTS.md guardrail: WebKit cannot launch in this rootless sandbox
      // (8 missing GTK4/GStreamer system libraries, no sudo for
      // `playwright install-deps`) — skip the project instead of failing
      // the gate on infrastructure.
      testIgnore: /.*/,
    },
  ],
});
