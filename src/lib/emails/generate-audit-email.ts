export type GenerateAuditEmailInput = {
  artist_name: string;
  followers: number | string | null;
  following: number | string | null;
  post_count: number | string | null;
  teaser: string;
  cta_url: string;
};

const AUDIT_CONTENT_FOOTER =
  "Your audit includes positioning analysis, content pattern insights, engagement reality, and your top opportunities.";

const DELIVERABILITY_FOOTER_HTML = `<p style="font-size:12px;color:#666;margin-top:40px;text-align:center;">You're receiving this because you signed up at app.roadie.media</p>`;

const DELIVERABILITY_FOOTER_TEXT =
  "You're receiving this because you signed up at app.roadie.media";

export function getAuditEmailSubject(artistName: string): string {
  const name = (artistName || "there").trim();
  return `${name}, your Tempo analysis is here`;
}

function toDisplayNumber(n: number | string | null): string {
  if (typeof n === "number" && Number.isFinite(n)) return n.toLocaleString();
  if (typeof n === "string" && n.trim()) return n.trim();
  return "—";
}

export function generateAuditEmailPlainText(
  input: GenerateAuditEmailInput
): string {
  const artistName = (input.artist_name || "there").trim();
  const followers = toDisplayNumber(input.followers);
  const following = toDisplayNumber(input.following);
  const posts = toDisplayNumber(input.post_count);
  const teaser = (input.teaser || "").trim();
  const ctaUrl = (input.cta_url || "").trim();

  const headline = getAuditEmailSubject(artistName);

  return [
    headline,
    "",
    teaser || "We found a clear pattern you can use immediately.",
    "",
    `Followers: ${followers} • Following: ${following} • Posts: ${posts}`,
    "",
    `Read your full audit → ${ctaUrl}`,
    "",
    AUDIT_CONTENT_FOOTER,
    "",
    DELIVERABILITY_FOOTER_TEXT,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nl2br(s: string): string {
  return escapeHtml(s).replace(/\n/g, "<br />");
}

export function generateAuditEmail(input: GenerateAuditEmailInput): string {
  const artistName = (input.artist_name || "there").trim();
  const followers = toDisplayNumber(input.followers);
  const following = toDisplayNumber(input.following);
  const posts = toDisplayNumber(input.post_count);
  const teaser = (input.teaser || "").trim();
  const ctaUrl = (input.cta_url || "").trim();
  const headline = getAuditEmailSubject(artistName);

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Tempo analysis</title>
    </head>
    <body style="margin:0;padding:0;background:#0A0A0F;font-family:Arial, sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        ${escapeHtml(headline)}
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0A0A0F;">
        <tr>
          <td align="center" style="padding:24px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;border-collapse:separate;">

              <tr>
                <td style="background:#111111;padding:26px 32px;text-align:left;border-bottom:1px solid rgba(0,255,135,0.22);">
                  <div style="font-weight:900;color:#00FF87;font-size:15px;letter-spacing:0.18em;">
                    TEMPO
                  </div>
                </td>
              </tr>

              <tr>
                <td style="background:#111111;padding:28px 32px 18px 32px;">
                  <div style="color:#ffffff;font-weight:900;font-size:24px;line-height:1.25;margin:0 0 10px 0;">
                    ${escapeHtml(headline)}
                  </div>
                  <div style="color:#A1A1AA;font-size:14px;line-height:1.7;margin:0;">
                    ${escapeHtml(teaser || "We found a clear pattern you can use immediately.")}
                  </div>
                </td>
              </tr>

              <tr>
                <td style="background:#111111;padding:0 32px 18px 32px;">
                  <div style="margin:0;">
                    <span style="display:inline-block;background:#1A1A1A;border:1px solid rgba(255,255,255,0.06);border-radius:999px;padding:10px 12px;margin:0 10px 10px 0;color:#ffffff;font-size:13px;line-height:1;">
                      <span style="color:#A1A1AA;">Followers</span>
                      <span style="color:#00FF87;font-weight:900;"> ${escapeHtml(followers)}</span>
                    </span>
                    <span style="display:inline-block;background:#1A1A1A;border:1px solid rgba(255,255,255,0.06);border-radius:999px;padding:10px 12px;margin:0 10px 10px 0;color:#ffffff;font-size:13px;line-height:1;">
                      <span style="color:#A1A1AA;">Following</span>
                      <span style="color:#00FF87;font-weight:900;"> ${escapeHtml(following)}</span>
                    </span>
                    <span style="display:inline-block;background:#1A1A1A;border:1px solid rgba(255,255,255,0.06);border-radius:999px;padding:10px 12px;margin:0 0 10px 0;color:#ffffff;font-size:13px;line-height:1;">
                      <span style="color:#A1A1AA;">Posts</span>
                      <span style="color:#00FF87;font-weight:900;"> ${escapeHtml(posts)}</span>
                    </span>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="background:#111111;padding:0 32px 30px 32px;text-align:left;">
                  <a href="${escapeHtml(ctaUrl)}"
                     style="display:block;background:#00FF87;color:#0A0A0F;text-decoration:none;font-weight:900;font-size:14px;padding:16px 18px;border-radius:12px;text-align:center;">
                    Read your full audit &rarr;
                  </a>
                </td>
              </tr>

              <tr>
                <td style="background:#0A0A0F;padding:18px 32px 28px 32px;text-align:left;">
                  <div style="color:#71717A;font-size:12px;line-height:1.6;margin:0;">
                    ${nl2br(AUDIT_CONTENT_FOOTER)}
                  </div>
                  ${DELIVERABILITY_FOOTER_HTML}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

  return html.trim();
}

