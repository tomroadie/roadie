/**
 * Audits that scrape a typed-in Instagram handle (Apify) are off for the
 * public product: anyone could audit an account they don't own, and Meta's
 * review treats scraping as a risk. Roadie admins can still run them from
 * the admin area. Set PUBLIC_SCRAPE_AUDITS=on only to deliberately bring
 * the old webhook entry points back.
 */
export function publicScrapeAuditsOn(): boolean {
  return process.env.PUBLIC_SCRAPE_AUDITS?.trim().toLowerCase() === "on";
}
