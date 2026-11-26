import { ReactNode } from "react";
/** The shape a `?w=` import produces. All fields optional so a plain `src`
 *  plus explicit `width`/`height` also satisfies the props. */
export interface ImageVariantModule {
  /** Max-width URL — the `<img src>`. */
  src?: string;
  /** `"url 400w, url 800w, …"` — the `<img srcset>`. */
  srcset?: string;
  /** Intrinsic width of the source (before downscaling). */
  width?: number;
  /** Intrinsic height of the source. */
  height?: number;
}
export interface ImageProps extends ImageVariantModule {
  /** The image URL when not using a `?w=` import. */
  src: string;
  /** Overrides the variant module's `srcset`. */
  srcset?: string;
  /** The `sizes` attribute — how wide the image is at each viewport. */
  sizes?: string;
  /** `alt` is required for accessibility; empty string marks a decorative
   *  image (screen readers skip it). */
  alt: string;
  /** Mark this image as LCP-critical: eager loading + high fetch priority +
   *  an emitted `<link rel="preload">`. */
  priority?: boolean;
  /** Lazy-load. Defaults to `!priority`. */
  lazy?: boolean;
  /** Extra classes for the `<img>`. */
  className?: string;
  /** Anything else (id, data-*, style, …) passes through. */
  [key: string]: unknown;
}
/**
 * The `<Image>` component. Returns an `<img>` (or, with `priority`, a
 * fragment of `<link rel="preload">` + `<img>` — the preload must precede
 * the tag it primes, and React permits a fragment here).
 */
export declare function Image(props: ImageProps): ReactNode;
//# sourceMappingURL=image.d.ts.map