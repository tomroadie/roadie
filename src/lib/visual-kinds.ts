/** Kinds of post cover, shared by the image scan and the UI (no server deps). */

export const VISUAL_KINDS = ["live", "posed", "candid", "studio", "artwork", "poster", "graphic", "other"] as const;
export type VisualKind = (typeof VISUAL_KINDS)[number];

export const VISUAL_KIND_LABEL: Record<VisualKind, string> = {
  live: "Live",
  posed: "Posed photo",
  candid: "Candid",
  studio: "In the studio",
  artwork: "Artwork",
  poster: "Poster or flyer",
  graphic: "Text or graphic",
  other: "Other",
};

export function asVisualKind(v: unknown): VisualKind | null {
  return typeof v === "string" && (VISUAL_KINDS as readonly string[]).includes(v) ? (v as VisualKind) : null;
}
