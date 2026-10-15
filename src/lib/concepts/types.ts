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
  /** Synced posts only: how it did against their own usual ("2.1×", "−30%"). */
  vsUsual?: string | null;
  /** Synced posts only: what the image shows, the artist's correction first. */
  looks?: string | null;
  /** Synced posts only: the content concept it sits in. */
  concept?: string | null;
  /** Set in code: where it ranks among these posts, top three only ("2nd for reach of 15"). */
  ranks?: string | null;
};

export type ContextKeyDate = {
  date: string;
  title: string;
  type: string | null;
  notes: string | null;
  /** Summary of the date's linked page (other acts, release details). */
  linkContext?: string | null;
};

export type ConceptContext = {
  artistId: string;
  artistName: string;
  genre: string | null;
  sound: string | null;
  voice: string | null;
  /** Onboarding answers. */
  confidence: string | null;
  contentDays: number[];
  comingUpNote: string | null;
  /** This week's check-in answers (their words), if they gave any. */
  weekNotes: { comingUp: string | null; unposted: string | null; wantToPost: string | null } | null;
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
  /** The last two published boards, newest first: each idea's title and how it said to do it. */
  recentBoards?: { published: string; ideas: { title: string; ways: string[] }[] }[];
  /** True when there's too little post data to ground concepts in. */
  coldStart: boolean;
  /**
   * Their content concepts (themes), best first, each against their own usual.
   * Optional: older saved contexts don't have it.
   */
  themeStats?: { name: string; ratio: number | null; posts: number }[];
  /**
   * What we know about them beyond Instagram: a summary of their website,
   * bio or press, and notes from the Tempo team. Optional.
   */
  brief?: { context: string | null; notes: string | null } | null;
};

export type GenerateResult = {
  pool: ConceptPool;
  context: ConceptContext;
  /** Problems found in the model output and fixed or dropped. */
  warnings: string[];
  attempts: number;
  model: string;
};
