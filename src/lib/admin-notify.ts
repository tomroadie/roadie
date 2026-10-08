/** A plain email to the Tempo admin (ADMIN_EMAIL, else tom@roadie.media). Never throws. */
export async function notifyAdminEmail(subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: "Tempo <hello@roadie.media>",
        to: [process.env.ADMIN_EMAIL?.trim() || "tom@roadie.media"],
        subject,
        html,
      }),
    });
    if (!res.ok) console.error("admin email failed", res.status);
  } catch (e) {
    console.error("admin email failed", e);
  }
}

export function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
