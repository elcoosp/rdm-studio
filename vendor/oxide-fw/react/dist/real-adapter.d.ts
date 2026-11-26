import { RealAdapterOptions } from "@oxide-fw/core/server/real-ssr";
/**
 * Build a react adapter. Components are resolved by the runtime
 * (`RenderInput.resolve`, §6.4) from the generated SSR entry; an explicit
 * `componentFor` option overrides it. When `ssr` is 'auto' (default), a
 * missing component or missing `react`/`react-dom` deps falls back to the
 * neutral-IR renderer; when 'real', a missing page component is the §10.2
 * OX-500 diagnostic (never a silent blank body).
 */
export declare function createRealAdapter(opts: RealAdapterOptions): import("@oxide-fw/core/types").FrameworkAdapter;
export type { RealAdapterOptions };
//# sourceMappingURL=real-adapter.d.ts.map