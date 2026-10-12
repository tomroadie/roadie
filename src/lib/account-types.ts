/**
 * What kind of account a Tempo profile is. Artists get the full weekly
 * board; everything else is monitored (posts, learnings, concepts) until
 * the idea generator has versions written for them.
 */
export const ACCOUNT_TYPES = ["artist", "venue", "label", "promoter", "agency", "brand", "other"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  artist: "Artist",
  venue: "Venue",
  label: "Label",
  promoter: "Promoter",
  agency: "Agency",
  brand: "Brand / other business",
  other: "Other",
};

export function asAccountType(v: unknown): AccountType {
  return (ACCOUNT_TYPES as readonly string[]).includes(String(v)) ? (v as AccountType) : "artist";
}

/** Only artists get weekly ideas for now. */
export function getsWeeklyIdeas(type: string | null | undefined): boolean {
  return asAccountType(type) === "artist";
}
