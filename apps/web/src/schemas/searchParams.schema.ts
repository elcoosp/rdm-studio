import * as v from "valibot";

export const SearchParamsSchema = v.partial(
  v.object({
    step: v.picklist(["geometry", "supports", "loads", "results", "report"]),
    beamId: v.pipe(v.number(), v.integer(), v.minValue(0)),
    nodeId: v.pipe(v.number(), v.integer(), v.minValue(0)),
    sectionId: v.string(),
  }),
);
