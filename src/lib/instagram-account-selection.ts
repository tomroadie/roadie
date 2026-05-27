export const IG_ACCOUNT_SELECTION_COOKIE = "ig_account_selection";

export type IgAccountSelectionEntry = {
  igUserId: string;
  pageAccessToken: string;
  username: string;
  pageName: string;
};

export type IgAccountSelectionPayload = {
  artistId: string;
  accounts: IgAccountSelectionEntry[];
  expiresAt: number;
};

export function instagramTokenExpiresAt(): string {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 60);
  return expiresAt.toISOString();
}

export function parseIgAccountSelectionCookie(
  raw: string | undefined
): IgAccountSelectionPayload | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as IgAccountSelectionPayload;
    if (
      typeof parsed.artistId !== "string" ||
      !Array.isArray(parsed.accounts) ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (Date.now() > parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}
