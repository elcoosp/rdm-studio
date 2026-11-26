import { HandlerBinding } from "./render.js";
import { ClientInput, Disposer } from "@oxide-fw/core/types";
export interface OxElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  hasAttribute(name: string): boolean;
  addEventListener(type: string, fn: (ev: unknown) => void): void;
  removeEventListener(type: string, fn: (ev: unknown) => void): void;
  dispatchEvent?(ev: unknown): boolean;
  innerHTML: string;
  /** The DOM specification types this as `Document | null` (null when the
   *  element is detached from its document), not `Document | undefined`.
   *  Widening to `OxDoc | null` makes OxElement DOM-faithful and lets a
   *  fake DOM in tests (FakeDocument | null) structurally satisfy the type
   *  without a cast. `hydrate.ts` already null-checks via `if (!doc)`. */
  ownerDocument?: OxDoc | null;
  querySelector?(sel: string): OxElement | null;
  querySelectorAll?(sel: string): ArrayLike<OxElement>;
}
export interface OxDoc {
  addEventListener(type: string, fn: (ev: unknown) => void): void;
  removeEventListener(type: string, fn: (ev: unknown) => void): void;
  dispatchEvent?(ev: unknown): boolean;
  querySelector?(sel: string): OxElement | null;
  querySelectorAll?(sel: string): ArrayLike<OxElement>;
}
export interface ClientOptions {
  doc?: OxDoc;
  /** Navigation hook (wired to the core router in the bootstrap, §8.4). */
  navigate?: (href: string) => void;
  /** Called for every ox:swap — adapter hydration of swapped content (§7.1). */
  onSwap?: (detail: {
    id: number;
  }) => void;
}
interface ClientHandle {
  update(input: ClientInput): void;
  dispose(): void;
}
/**
 * Hydrate server-rendered markup: binds handlers + the core defer glue while
 * preserving the server HTML byte-for-byte (no mismatch, §7.2).
 */
export declare function hydrate(root: OxElement, input: ClientInput, opts?: ClientOptions): Disposer;
/** SPA mode (§10.1 `spa`): render the shell into an empty root, then bind.
 * When a manifest route exists the real page component paints instead —
 * `createClientRoot` skips the IR shell for that route (§8.4/§10.3). */
export declare function mount(root: OxElement, input: ClientInput, opts?: ClientOptions): Disposer;
/**
 * Client navigation (§7 update): swap the route tree in the active root.
 * No-op when no client root is mounted (e.g. update fires before mount).
 */
export declare function update(input: ClientInput): void;
/**
 * Islands hydration (§10.3): the core loader schedules by strategy and calls
 * this with the loaded chunk module. The module's default component renders
 * into the host (deterministic markup) and its handlers bind to the
 * data-ox-id markers — one rendering path shared with full-page hydration.
 */
export declare function hydrateIsland(host: OxElement, mod: unknown, props: unknown, opts?: ClientOptions): Disposer;
export type { ClientHandle, HandlerBinding };
//# sourceMappingURL=hydrate.d.ts.map