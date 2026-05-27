import { verifyCheckinToken } from "@/lib/checkin-token";
import { CheckinForm } from "./checkin-form";

const ARTIST_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ artist_id?: string; token?: string }>;
}) {
  const params = await searchParams;
  const artistId = params.artist_id?.trim() ?? "";
  const token = params.token?.trim() ?? "";

  const linkInvalid =
    !artistId || !token || !ARTIST_ID_UUID_RE.test(artistId);
  const tokenInvalid =
    !linkInvalid && !verifyCheckinToken(artistId, token);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col px-4 py-16 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">
        Tempo
      </p>
      <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-foreground">
        Weekly check-in
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Help us shape your content plan for next week.
      </p>

      <div className="mt-8 rounded-xl border border-card-border bg-card p-6">
        {linkInvalid ? (
          <p className="text-sm text-muted">
            This check-in link is invalid. Use the link from your email.
          </p>
        ) : tokenInvalid ? (
          <p className="text-sm text-muted">
            This check-in link is invalid or expired. Use the link from your
            latest email.
          </p>
        ) : (
          <CheckinForm artistId={artistId} token={token} />
        )}
      </div>
    </div>
  );
}
