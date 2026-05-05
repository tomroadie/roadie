import { createClient } from "@/utils/supabase/server";
import { SavedIdeaActions } from "./saved-idea-actions";

type SavedIdeasSectionProps = {
  artistId: string;
};

type SavedIdeaRow = {
  id: string;
  idea_format: string;
  idea_hook: string;
  idea_caption: string;
  refined_caption: string | null;
  created_at: string;
};

function getAccentPill(format: string): string {
  const f = format.trim().toLowerCase();
  if (f.includes("reel")) return "bg-brand text-brand-foreground";
  if (f.includes("carousel")) return "bg-brand text-brand-foreground";
  if (f.includes("story")) return "bg-brand text-brand-foreground";
  if (f.includes("video")) return "bg-brand text-brand-foreground";
  return "bg-brand text-brand-foreground";
}

function buildCopyText(args: { format: string; hook: string; caption: string }): string {
  return [`Format: ${args.format}`, `Hook: ${args.hook}`, "", args.caption].join("\n");
}

export async function SavedIdeasSection({ artistId }: SavedIdeasSectionProps) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("saved_ideas")
    .select("id, idea_format, idea_hook, idea_caption, refined_caption, created_at")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const ideas = (data ?? []) as SavedIdeaRow[];
  if (!ideas.length) return null;

  return (
    <section className="mt-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
            Saved ideas
          </h2>
          <p className="mt-1 text-sm text-muted">Your favourites, ready to reuse.</p>
        </div>
      </div>

      <ul className="mt-6 flex flex-col gap-4">
        {ideas.map((idea) => {
          const caption = idea.refined_caption?.trim() || idea.idea_caption;
          const copyText = buildCopyText({
            format: idea.idea_format,
            hook: idea.idea_hook,
            caption,
          });

          return (
            <li key={idea.id}>
              <article className="rounded-xl border border-card-border bg-card p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <span
                      className={[
                        "inline-flex h-6 max-w-full items-center rounded-full px-2.5 text-[11px] font-black uppercase tracking-wide ring-1 ring-inset ring-brand/30",
                        "overflow-hidden text-ellipsis whitespace-nowrap",
                        getAccentPill(idea.idea_format),
                      ].join(" ")}
                    >
                      {idea.idea_format}
                    </span>
                    <h3 className="mt-3 text-base font-bold leading-snug text-foreground">
                      {idea.idea_hook}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-muted-strong">
                      {caption}
                    </p>
                  </div>

                  <SavedIdeaActions
                    ideaId={idea.id}
                    artistId={artistId}
                    copyText={copyText}
                  />
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

