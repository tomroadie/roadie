/**
 * Concept generator types — the content model behind the Home board.
 *
 * A concept is a direction drawn from the artist's own data ("credit the
 * people around you"), not a prescription. Each one carries two or three
 * example executions so the artist picks the version that fits their week.
 */

export type ExecutionFormat = "reel" | "carousel" | "photo" | "story" | "text";
export type Effort = "low" | "medium" | "high";

export type ConceptExecution = {
  format: ExecutionFormat;
  /** What to make, in one or two plain sentences. */
  idea: string;
  effort: Effort;
};

export type Concept = {
  /** The direction, phrased as something to do. */
  title: string;
  /** Why it fits this artist, grounded in specific posts. */
  why: string;
  /** Post numbers (from the numbered list given to the model) that back the why. */
  evidence_posts: number[];
  executions: ConceptExecution[];
  /** ISO date of a key date this concept serves, if any. */
  key_date: string | null;
  /** "from_data" when backed by posts, "starting_point" when it isn't. */
  basis: "from_data" | "starting_point";
  /** True when the concept is about releases, gigs or announcements. Only these may cite news posts. */
  about_news: boolean;
};

export type ConceptPool = {
  /** One line the board shows above the cards. */
  focus: string;
  /** Why this focus, this week. Internal (admin/review), not shown to artists. */
  focus_why: string;
  concepts: Concept[];
};

/** A post as the generator sees it. Numbers are 1-based and stable per run. */
export type ContextPost = {
  n: number;
  date: string | null;
  type: string;
  caption: string;
  comments: number | null;
  /** null when Instagram hides the count (scrapes return -1). */
  likes: number | null;
  views: number | null;
  reach: number | null;
  saves: number | null;
  shares: number | null;
  /** Set in code: a release, gig or announcement post. */
  news: boolean;
  /** Set in code: comments well above this artist's typical post of the same kind. */
  standout: boolean;
};

export type ContextKeyDate = {
  date: string;
  title: string;
  type: string | null;
  notes: string | null;
};

export type ConceptContext = {
  artistId: string;
  artistName: string;
  genre: string | null;
  sound: string | null;
  voice: string | null;
  /** Onboarding answers. */
  confidence: string | null;
  toneTag: string | null;
  contentDays: number[];
  comingUpNote: string | null;
  handle: string | null;
  followers: number | null;
  /** Where the posts came from. "synced" = connected Instagram. */
  postSource: "synced" | "audit" | "none";
  /** When the audit scrape was taken; old scrapes mean stale posts. */
  auditCreatedAt: string | null;
  posts: ContextPost[];
  postsLast28Days: number;
  daysSinceLastPost: number | null;
  weeklyTarget: number;
  auditPattern: string | null;
  keyDates: ContextKeyDate[];
  /** Ideas the artist turned down, with reasons where given. */
  declined: { title: string; reason: string | null }[];
  /** Board ideas they said they posted (last 8 weeks), newest first. */
  postedIdeas: string[];
  /** Board ideas sitting on their shelf. */
  pinnedIdeas: string[];
  /** True when there's too little post data to ground concepts in. */
  coldStart: boolean;
};

export type GenerateResult = {
  pool: ConceptPool;
  context: ConceptContext;
  /** Problems found in the model output and fixed or dropped. */
  warnings: string[];
  attempts: number;
  model: string;
};
