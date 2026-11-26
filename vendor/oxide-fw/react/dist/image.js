import { createElement } from "react";
import { deriveSizesFromSrcset } from "@oxide-fw/core/image-sizes";
// src/image.ts
/**
* The `<Image>` component. Returns an `<img>` (or, with `priority`, a
* fragment of `<link rel="preload">` + `<img>` — the preload must precede
* the tag it primes, and React permits a fragment here).
*/
function Image(props) {
	const { src, srcset, sizes, width, height, alt, priority = false, lazy, className, ...rest } = props;
	const imgProps = {
		src,
		alt,
		loading: lazy ?? !priority ? "lazy" : "eager",
		decoding: "async",
		...rest
	};
	if (srcset) imgProps.srcset = srcset;
	const effectiveSizes = sizes ?? deriveSizesFromSrcset(srcset);
	if (effectiveSizes) imgProps.sizes = effectiveSizes;
	if (typeof width === "number") imgProps.width = width;
	if (typeof height === "number") imgProps.height = height;
	if (className) imgProps.className = className;
	if (priority) imgProps.fetchpriority = "high";
	const img = createElement("img", imgProps);
	if (!priority) return img;
	const preloadProps = {
		rel: "preload",
		as: "image",
		href: src
	};
	if (srcset) {
		preloadProps.imagesrcset = srcset;
		const imSizes = sizes ?? deriveSizesFromSrcset(srcset);
		if (imSizes) preloadProps.imagesizes = imSizes;
	}
	return createElement("Fragment", null, createElement("link", preloadProps), img);
}
export { Image };

//# sourceMappingURL=image.js.map