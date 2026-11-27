// src/deeplinks/studioLinks.ts
/**
* Build a fully-typed studio URL with canonical English query parameters.
* Silent French aliases (portique, warren, travees, potence) are accepted
* by the studio's SearchParamsSchema and resolved to canonical slugs.
*/
function buildStudioUrl(params) {
	const { baseUrl, ...searchParams } = params;
	const url = new URL(baseUrl);
	if (searchParams.step) url.pathname = `/${searchParams.step}`;
	else if (searchParams.template) url.pathname = "/geometry";
	for (const [key, value] of Object.entries(searchParams)) if (value !== void 0 && value !== null) url.searchParams.set(key, String(value));
	return url.toString();
}
/**
* Build a "Try in Studio" deep link for documentation/tutorials.
* Defaults to geometry step with template and locale.
*/
function buildTryInStudioUrl(params) {
	return buildStudioUrl({
		baseUrl: params.baseUrl,
		step: params.step ?? "geometry",
		template: params.template,
		lang: params.lang
	});
}
/**
* Preset deep-link builders for common documentation scenarios.
*/
const studioLinks = {
	/** Open a template at the geometry step */
	template: (baseUrl, template, lang = "fr") => buildStudioUrl({
		baseUrl,
		step: "geometry",
		template,
		lang
	}),
	/** Open at results step with specific combination and scale */
	results: (baseUrl, options) => buildStudioUrl({
		baseUrl,
		step: "results",
		...options
	}),
	/** Open report with shared case ID */
	report: (baseUrl, caseId, lang = "fr") => buildStudioUrl({
		baseUrl,
		step: "report",
		caseId,
		lang
	}),
	/** Open optimizer modal */
	optimizer: (baseUrl, lang = "fr") => buildStudioUrl({
		baseUrl,
		step: "results",
		modal: "optim",
		lang
	}),
	/** Open scenario comparator */
	compare: (baseUrl, lang = "fr") => buildStudioUrl({
		baseUrl,
		step: "results",
		modal: "compare",
		lang
	}),
	/** Open 3D force diagrams */
	diagrams3d: (baseUrl, lang = "fr") => buildStudioUrl({
		baseUrl,
		step: "results",
		diagrams: 1,
		lang
	})
};
export { buildStudioUrl, buildTryInStudioUrl, studioLinks };
