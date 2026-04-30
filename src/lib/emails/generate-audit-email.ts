import { parseFullAnalysisText } from "@/lib/parse-full-analysis";

export type GenerateAuditEmailInput = {
  artist_name: string;
  instagram_handle: string;
  followers: number | string | null;
  following: number | string | null;
  post_count: number | string | null;
  bio: string | null;
  ai_pattern_analysis: string;
  ai_full_analysis: string;
};

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

function asDisplayHandle(handle: string): string {
  return handle.trim().replace(/^@/, "");
}

function toDisplayNumber(n: number | string | null): string {
  if (typeof n === "number" && Number.isFinite(n)) return n.toLocaleString();
  if (typeof n === "string" && n.trim()) return n.trim();
  return "—";
}

function sectionColor(title: string): { border: string; text: string } {
  switch (title.trim().toLowerCase()) {
    case "positioning":
      return { border: "#3B82F6", text: "#3B82F6" }; // blue
    case "content pattern":
      return { border: "#00FF87", text: "#00FF87" }; // green
    case "engagement reality":
      return { border: "#FACC15", text: "#FACC15" }; // yellow
    case "core problem":
      return { border: "#EF4444", text: "#EF4444" }; // red
    case "opportunity":
      return { border: "#A855F7", text: "#A855F7" }; // purple
    default:
      return { border: "#00FF87", text: "#00FF87" };
  }
}

export function generateAuditEmail(input: GenerateAuditEmailInput): string {
  const artistName = (input.artist_name || "there").trim();
  const handle = asDisplayHandle(input.instagram_handle || "");
  const followers = toDisplayNumber(input.followers);
  const following = toDisplayNumber(input.following);
  const posts = toDisplayNumber(input.post_count);
  const bio = (input.bio ?? "").trim() || "—";

  const fullSections = parseFullAnalysisText(input.ai_full_analysis).filter(
    (s) => s.title && s.body
  );

  const unsubscribeUrl = "https://app.roadie.media/unsubscribe";

  const sectionCardsHtml =
    fullSections.length > 0
      ? fullSections
          .map((s) => {
            const colors = sectionColor(s.title);
            return `
              <div style="background:#1a1a1a;border-left:3px solid ${colors.border};border-radius:10px;padding:16px 16px 14px 16px;margin:0 0 12px 0;">
                <div style="color:${colors.text};font-weight:700;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 8px 0;">
                  ${escapeHtml(s.title)}
                </div>
                <div style="color:#ffffff;font-size:14px;line-height:1.6;margin:0;">
                  ${nl2br(s.body)}
                </div>
              </div>
            `.trim();
          })
          .join("")
      : `
          <div style="background:#1a1a1a;border-left:3px solid #00FF87;border-radius:10px;padding:16px 16px 14px 16px;margin:0 0 12px 0;">
            <div style="color:#00FF87;font-weight:700;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 8px 0;">
              FULL ANALYSIS
            </div>
            <div style="color:#ffffff;font-size:14px;line-height:1.6;margin:0;">
              ${nl2br(input.ai_full_analysis)}
            </div>
          </div>
        `.trim();

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Roadie Instagram Audit</title>
    </head>
    <body style="margin:0;padding:0;background:#0A0A0F;font-family:Arial, sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        Your Roadie Instagram audit is ready.
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0A0A0F;">
        <tr>
          <td align="center" style="padding:24px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;border-collapse:separate;">

              <!-- HEADER -->
              <tr>
                <td style="background:#111111;padding:32px;text-align:center;border-bottom:1px solid #00FF87;">
                  <div style="font-weight:800;color:#00FF87;font-size:28px;letter-spacing:0.12em;">
                    ROADIE
                  </div>
                </td>
              </tr>

              <!-- HERO -->
              <tr>
                <td style="background:#111111;padding:32px;">
                  <div style="color:#ffffff;font-weight:800;font-size:24px;line-height:1.3;margin:0 0 10px 0;">
                    ${escapeHtml(`Your Instagram audit is ready, ${artistName}`)}
                  </div>
                  <div style="color:#888888;font-size:14px;line-height:1.6;margin:0;">
                    ${escapeHtml(`Here's what we found when we analysed @${handle || "—"}`)}
                  </div>
                </td>
              </tr>

              <!-- STATS -->
              <tr>
                <td style="background:#111111;padding:0 32px 28px 32px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="padding:0 8px 0 0;" width="33%">
                        <div style="background:#1a1a1a;border-radius:10px;padding:16px;text-align:center;">
                          <div style="color:#ffffff;font-weight:800;font-size:20px;line-height:1.2;margin:0 0 6px 0;">
                            ${escapeHtml(followers)}
                          </div>
                          <div style="color:#00FF87;font-weight:800;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">
                            Followers
                          </div>
                        </div>
                      </td>
                      <td style="padding:0 4px;" width="33%">
                        <div style="background:#1a1a1a;border-radius:10px;padding:16px;text-align:center;">
                          <div style="color:#ffffff;font-weight:800;font-size:20px;line-height:1.2;margin:0 0 6px 0;">
                            ${escapeHtml(following)}
                          </div>
                          <div style="color:#00FF87;font-weight:800;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">
                            Following
                          </div>
                        </div>
                      </td>
                      <td style="padding:0 0 0 8px;" width="33%">
                        <div style="background:#1a1a1a;border-radius:10px;padding:16px;text-align:center;">
                          <div style="color:#ffffff;font-weight:800;font-size:20px;line-height:1.2;margin:0 0 6px 0;">
                            ${escapeHtml(posts)}
                          </div>
                          <div style="color:#00FF87;font-weight:800;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">
                            Posts
                          </div>
                        </div>
                      </td>
                    </tr>
                  </table>
                  <div style="margin:14px 0 0 0;color:#888888;font-size:13px;line-height:1.6;font-style:italic;">
                    ${nl2br(bio)}
                  </div>
                </td>
              </tr>

              <!-- CONTENT PATTERN -->
              <tr>
                <td style="background:#0A0A0F;padding:0 32px 18px 32px;">
                  <div style="background:#1a1a1a;border-left:3px solid #00FF87;border-radius:10px;padding:18px 16px 16px 16px;">
                    <div style="color:#00FF87;font-weight:800;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 10px 0;">
                      YOUR CONTENT PATTERN
                    </div>
                    <div style="color:#ffffff;font-size:14px;line-height:1.6;margin:0;">
                      ${nl2br(input.ai_pattern_analysis || "—")}
                    </div>
                  </div>
                </td>
              </tr>

              <!-- FULL ANALYSIS -->
              <tr>
                <td style="background:#0A0A0F;padding:0 32px 10px 32px;">
                  <div style="color:#ffffff;font-weight:800;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin:8px 0 12px 0;">
                    FULL ANALYSIS
                  </div>
                  ${sectionCardsHtml}
                </td>
              </tr>

              <!-- CTA -->
              <tr>
                <td style="background:#111111;padding:32px;text-align:left;">
                  <div style="color:#ffffff;font-weight:800;font-size:20px;line-height:1.3;margin:0 0 10px 0;">
                    See your full content plan
                  </div>
                  <div style="color:#888888;font-size:14px;line-height:1.6;margin:0 0 18px 0;">
                    Log in to Roadie to generate your personalised weekly content plan based on this audit.
                  </div>
                  <a href="https://app.roadie.media"
                     style="display:inline-block;background:#00FF87;color:#0A0A0F;text-decoration:none;font-weight:800;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;padding:14px 18px;border-radius:10px;">
                    GET MY CONTENT PLAN &rarr;
                  </a>
                </td>
              </tr>

              <!-- FOOTER -->
              <tr>
                <td style="background:#0A0A0F;padding:22px 32px 28px 32px;text-align:center;">
                  <div style="color:#888888;font-size:12px;line-height:1.6;margin:0 0 8px 0;">
                    Roadie Media &middot; <a href="mailto:hello@roadie.media" style="color:#888888;text-decoration:none;">hello@roadie.media</a>
                  </div>
                  <div style="color:#666666;font-size:11px;line-height:1.6;margin:0 0 10px 0;">
                    You received this because you requested a free Instagram audit.
                  </div>
                  <a href="${unsubscribeUrl}" style="color:#666666;font-size:11px;text-decoration:underline;">
                    Unsubscribe
                  </a>
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

