import { unsubscribeFooter } from "@/lib/email";

function baseTemplate(content: string, artistId: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport"
    content="width=device-width,initial-scale=1">
  <style>
    body {
      background: #0A0A0F;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont,
        'Segoe UI', sans-serif;
      margin: 0; padding: 0;
    }
    .wrapper {
      max-width: 560px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    .logo {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #00FF87;
      margin-bottom: 32px;
    }
    h1 {
      font-size: 28px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.02em;
      line-height: 1.1;
      margin: 0 0 16px;
      color: #ffffff;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #aaaaaa;
      margin: 0 0 16px;
    }
    .highlight {
      color: #ffffff;
      font-weight: 600;
    }
    .cta {
      display: inline-block;
      background: #00FF87;
      color: #0A0A0F;
      font-weight: 900;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 14px 28px;
      border-radius: 8px;
      text-decoration: none;
      margin: 8px 0 24px;
    }
    .stat-row {
      display: flex;
      gap: 12px;
      margin: 20px 0;
    }
    .stat {
      background: #1A1A1A;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 12px 16px;
      flex: 1;
    }
    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #00FF87;
      font-weight: 700;
    }
    .stat-value {
      font-size: 22px;
      font-weight: 900;
      color: #ffffff;
      margin-top: 4px;
    }
    .idea-card {
      background: #1A1A1A;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
    }
    .idea-format {
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #00FF87;
      margin-bottom: 8px;
    }
    .idea-hook {
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.3;
    }
    .divider {
      border: none;
      border-top: 1px solid #222;
      margin: 24px 0;
    }
    a { color: #00FF87; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="logo">Tempo</div>
    ${content}
    ${unsubscribeFooter(artistId)}
  </div>
</body>
</html>`;
}

export function auditReadyEmail(data: {
  artistId: string;
  artistName: string;
  followers: number;
  following: number;
  postCount: number;
  patternAnalysis: string;
  appUrl: string;
}): { subject: string; html: string } {
  const subject = `${data.artistName} — your Tempo analysis is here`;
  const content = `
  <h1>${data.artistName}, your analysis is here</h1>

  <p>We've analysed your Instagram and here's
  what stands out:</p>

  <div class="stat-row">
    <div class="stat">
      <div class="stat-label">Followers</div>
      <div class="stat-value">
        ${data.followers.toLocaleString()}
      </div>
    </div>
    <div class="stat">
      <div class="stat-label">Posts</div>
      <div class="stat-value">
        ${data.postCount.toLocaleString()}
      </div>
    </div>
  </div>

  <p class="highlight">${data.patternAnalysis}</p>

  <p>Your full audit breaks this down further —
  positioning, content patterns, engagement reality,
  and exactly what to do next.</p>

  <a href="${data.appUrl}/home" class="cta">
    Read your full audit →
  </a>

  <p>Once you've read it, upgrading to Tempo
  unlocks your weekly content plan — 5 ideas
  every Monday shaped by this data.</p>

  <p style="color:#666;font-size:13px">
  — Tom at Tempo
  </p>`;

  return { subject, html: baseTemplate(content, data.artistId) };
}

export function freeDay3Email(data: {
  artistId: string;
  artistName: string;
  genre: string;
  appUrl: string;
}): { subject: string; html: string } {
  const subject = "What your content plan would look like";
  const content = `
<h1>Here's what we'd build for you</h1>

<p>Hi ${data.artistName},</p>

<p>Your audit is ready — and based on what
we found, here's the kind of plan we'd generate
for you this week.</p>

<div class="idea-card">
  <div class="idea-format">Reel</div>
  <div class="idea-hook">
    The story behind the song — what it cost
    you to write it
  </div>
</div>

<div class="idea-card">
  <div class="idea-format">Carousel</div>
  <div class="idea-hook">
    What ${data.genre} actually sounds like when
    you strip it back
  </div>
</div>

<p>Every Monday you'd get 5 ideas like these —
shaped by your audit data, your upcoming shows,
and what performed last week.</p>

<a href="${data.appUrl}/pricing" class="cta">
  Start your free trial →
</a>

<p style="color:#666;font-size:13px">
— Tom at Tempo
</p>`;

  return { subject, html: baseTemplate(content, data.artistId) };
}

export function freeDay7Email(data: {
  artistId: string;
  artistName: string;
  appUrl: string;
}): { subject: string; html: string } {
  const subject = "Most artists disappear between releases";
  const content = `
<h1>The ones who don't do this differently</h1>

<p>Hi ${data.artistName},</p>

<p>Most independent artists post consistently
around releases — then go quiet. Their audience
forgets they exist by the time the next one drops.
</p>

<p>The artists who keep growing don't post more.
They just never stop. Every week, something goes
up — a process shot, a caption that sounds like
them, a moment from rehearsal. Nothing polished.
Just present.</p>

<p class="highlight">An indie artist we work with
went from posting twice a month to every week.
Their engagement rate doubled in 6 weeks — not
because they worked harder, but because their
audience knew to expect them.</p>

<p>That's what a weekly plan does. It removes
the decision. You show up because the ideas are
already there.</p>

<a href="${data.appUrl}/pricing" class="cta">
  Start your free trial →
</a>

<p style="color:#666;font-size:13px">
— Tom at Tempo
</p>`;

  return { subject, html: baseTemplate(content, data.artistId) };
}

export function freeDay14Email(data: {
  artistId: string;
  artistName: string;
  appUrl: string;
}): { subject: string; html: string } {
  const subject =
    "Your audit found something. You haven't acted on it yet.";
  const content = `
<h1>The analysis is ready. The question is
what you do with it.</h1>

<p>Hi ${data.artistName},</p>

<p>Two weeks ago we analysed your Instagram.
We found real patterns — what's connecting with
your audience, what's being underused, where
the opportunity is.</p>

<p>That insight is sitting there. Most artists
who see it take one of two paths — they act on
it, or they don't. The ones who do show up
differently within a month.</p>

<p>Your weekly content plan would put that
analysis to work. 5 ideas every Monday, shaped
by exactly what we found in your audit.</p>

<a href="${data.appUrl}/pricing" class="cta">
  Put your audit to work →
</a>

<p style="color:#666;font-size:13px">
— Tom at Tempo
</p>`;

  return { subject, html: baseTemplate(content, data.artistId) };
}

export function trialWelcomeEmail(data: {
  artistId: string;
  artistName: string;
  appUrl: string;
}): { subject: string; html: string } {
  const subject = "Welcome to Tempo — here's how to get started";
  const content = `
<h1>You're in. Here's what to do first.</h1>

<p>Hi ${data.artistName},</p>

<p>Your 14-day trial has started. Here's how
to get the most out of it:</p>

<p><span class="highlight">Step 1 — Run your
audit.</span> If you haven't already, enter your
Instagram handle in settings. We'll analyse your
last 10 posts in about 3 minutes.</p>

<p><span class="highlight">Step 2 — Generate
your first plan.</span> Once your audit is ready,
hit "Generate my weekly plan" on your home screen.
Your first 5 ideas will be ready in under a
minute.</p>

<p><span class="highlight">Step 3 — Rate the
ideas.</span> Thumbs up or down on each idea.
This teaches Tempo your taste — future plans
get sharper as it learns what you like.</p>

<p>Every Friday you'll get a short check-in email
asking what's on your radar. Every Monday your
plan arrives shaped by your answer.</p>

<a href="${data.appUrl}/home" class="cta">
  Go to your account →
</a>

<p style="color:#666;font-size:13px">
— Tom at Tempo
</p>`;

  return { subject, html: baseTemplate(content, data.artistId) };
}

export function trialNoPlanDay2Email(data: {
  artistId: string;
  artistName: string;
  appUrl: string;
}): { subject: string; html: string } {
  const subject = "Your first plan is one click away";
  const content = `
<h1>It takes about 30 seconds.</h1>

<p>Hi ${data.artistName},</p>

<p>You signed up two days ago but haven't
generated your first plan yet.</p>

<p>It's quick — once your audit is done,
hit "Generate my weekly plan" and you'll have
5 ideas in under a minute.</p>

<p>If you haven't run your audit yet, that's
the first step — add your Instagram handle in
settings and we'll take it from there.</p>

<a href="${data.appUrl}/home" class="cta">
  Generate your first plan →
</a>

<p style="color:#666;font-size:13px">
— Tom at Tempo
</p>`;

  return { subject, html: baseTemplate(content, data.artistId) };
}

export function firstPlanGeneratedEmail(data: {
  artistId: string;
  artistName: string;
  appUrl: string;
}): { subject: string; html: string } {
  const subject = `${data.artistName} — your first Tempo plan is ready`;
  const content = `
<h1>Your first plan is ready.</h1>

<p>Hi ${data.artistName},</p>

<p>Five ideas are waiting for you — each one
shaped by your audit data and your sound.</p>

<p><span class="highlight">Here's how to use
them:</span></p>

<p><strong>Copy any idea</strong> directly into
your notes or scheduling tool. The hooks and
captions are ready to post.</p>

<p><strong>Rate each idea</strong> with a thumbs
up or down. This is how Tempo learns your taste
— the more you rate, the sharper your future
plans get.</p>

<p><strong>Submit for review</strong> (Pro) —
if you want expert eyes on an idea before you
post it, hit submit and we'll send feedback
within 48 hours.</p>

<p>Every Friday you'll get a short check-in
asking what's on your radar — shows, releases,
anything coming up. Every Monday your new plan
arrives shaped by your answer.</p>

<p>The more you use Tempo, the better it gets.
Your plans improve as it learns what performs
for your specific audience.</p>

<a href="${data.appUrl}/home" class="cta">
  View your plan →
</a>

<p style="color:#666;font-size:13px">
— Tom at Tempo
</p>`;

  return { subject, html: baseTemplate(content, data.artistId) };
}

export function trialEngagedDay5Email(data: {
  artistId: string;
  artistName: string;
  appUrl: string;
}): { subject: string; html: string } {
  const subject = "You're building something here";
  const content = `
<h1>This is how the system works.</h1>

<p>Hi ${data.artistName},</p>

<p>You've generated your plan and you're
using Tempo the right way. Here's what
happens from here.</p>

<p><span class="highlight">Every Friday</span>
— you'll get a check-in asking what's on your
radar. Shows, releases, anything worth building
content around.</p>

<p><span class="highlight">Every Monday</span>
— your plan arrives shaped by your check-in
and what performed best last week.</p>

<p>Over time, Tempo learns what works for your
specific audience — which formats get the most
engagement, what topics land, when to post.
Your plans get sharper every week.</p>

<p>The artists who get the most out of this
are the ones who keep rating their ideas.
Even a few thumbs up or down makes a
meaningful difference.</p>

<a href="${data.appUrl}/home" class="cta">
  Rate your ideas →
</a>

<p style="color:#666;font-size:13px">
— Tom at Tempo
</p>`;

  return { subject, html: baseTemplate(content, data.artistId) };
}

export function trialEndingEngagedEmail(data: {
  artistId: string;
  artistName: string;
  endDate: string;
  price: string;
  appUrl: string;
}): { subject: string; html: string } {
  const subject = `Your trial ends in 3 days — you're charged ${data.price} on ${data.endDate}`;
  const content = `
<h1>Your trial ends in 3 days.</h1>

<p>Hi ${data.artistName},</p>

<p>Your 14-day trial ends on
<span class="highlight">${data.endDate}</span>.
You'll be charged
<span class="highlight">${data.price}/month</span>
automatically — no action needed.</p>

<p>You've already got the system working.
Your next plan arrives Monday. Your Friday
check-in keeps shaping what comes next.</p>

<p>If you want to make any changes to your
plan before the trial ends, now's a good time
— your ideas and audit data carry over.</p>

<a href="${data.appUrl}/home" class="cta">
  View your account →
</a>

<p>Questions? Just reply to this email.</p>

<p style="color:#666;font-size:13px">
— Tom at Tempo
</p>`;

  return { subject, html: baseTemplate(content, data.artistId) };
}

export function trialEndingInactiveEmail(data: {
  artistId: string;
  artistName: string;
  endDate: string;
  price: string;
  appUrl: string;
}): { subject: string; html: string } {
  const subject =
    "Your trial ends in 3 days — you haven't really tried Tempo yet";
  const content = `
<h1>You've got 3 days left.
Let's actually use them.</h1>

<p>Hi ${data.artistName},</p>

<p>Your trial ends on
<span class="highlight">${data.endDate}</span>
and you'll be charged
<span class="highlight">${data.price}/month</span>
— but you haven't generated a plan yet.</p>

<p>Before that happens, it's worth actually
trying what you signed up for. Your audit is
ready. Your first plan takes 30 seconds to
generate.</p>

<p>If it's not for you, cancel before
${data.endDate} and you won't be charged. But
if you don't try it, you'll never know.</p>

<a href="${data.appUrl}/home" class="cta">
  Generate your plan now →
</a>

<p>To cancel:
<a href="${data.appUrl}/settings">go to settings</a>
→ manage subscription.</p>

<p style="color:#666;font-size:13px">
— Tom at Tempo
</p>`;

  return { subject, html: baseTemplate(content, data.artistId) };
}

export function weeklyPlanReadyEmail(data: {
  artistId: string;
  artistName: string;
  weekLabel: string;
  appUrl: string;
}): { subject: string; html: string } {
  const subject = `${data.artistName} — your weekly plan is ready`;
  const content = `
<h1>This week's plan is ready.</h1>

<p>Hi ${data.artistName},</p>

<p>Your 5 ideas for the week of
<span class="highlight">${data.weekLabel}</span>
are waiting for you.</p>

<p>Log in to copy ideas, rate them, or submit
one for review.</p>

<a href="${data.appUrl}/home" class="cta">
  View your plan →
</a>

<p style="color:#666;font-size:13px">
— Tom at Tempo
</p>`;

  return { subject, html: baseTemplate(content, data.artistId) };
}

export function checkinFridayEmail(data: {
  artistId: string;
  artistName: string;
  checkinUrl: string;
}): { subject: string; html: string } {
  const subject = "What's on your radar?";
  const content = `
<h1>Shape your plan for next week.</h1>

<p>Hi ${data.artistName},</p>

<p>Your weekly content plan generates on
Monday. Tell us what's coming up and we'll
build it around you.</p>

<p>Upcoming shows, releases in the pipeline,
studio time, collabs — anything worth building
content around. Doesn't have to be this week.</p>

<a href="${data.checkinUrl}" class="cta">
  Answer your check-in →
</a>

<p style="color:#555;font-size:13px">
Takes 2 minutes. The more context you give us,
the better your plan.
</p>

<p style="color:#666;font-size:13px">
— Tom at Tempo
</p>`;

  return { subject, html: baseTemplate(content, data.artistId) };
}

export function winbackDay1Email(data: {
  artistId: string;
  artistName: string;
}): { subject: string; html: string } {
  const subject = "You've cancelled — your data is safe";
  const content = `
<h1>Sorry to see you go.</h1>

<p>Hi ${data.artistName},</p>

<p>Your subscription has been cancelled.
Your account stays active until the end of
your current billing period.</p>

<p>Your audit data, plan history, and idea
ratings are all saved. If you come back,
you'll pick up exactly where you left off.</p>

<p>If you cancelled for a specific reason
and want to share it, just reply to this
email. I read every response.</p>

<p style="color:#666;font-size:13px">
— Tom at Tempo
</p>`;

  return { subject, html: baseTemplate(content, data.artistId) };
}

export function winbackDay7Email(data: {
  artistId: string;
  artistName: string;
  appUrl: string;
}): { subject: string; html: string } {
  const subject = "A lot can happen in a week";
  const content = `
<h1>In case you're reconsidering.</h1>

<p>Hi ${data.artistName},</p>

<p>It's been a week since you cancelled.
We've been thinking about what would make
Tempo actually useful for where you are right
now.</p>

<p>If the timing wasn't right, or if there
was something missing — reply and let me know.
I'd rather fix it than lose you.</p>

<p>If you want to come back, your account
and all your data are still here.</p>

<a href="${data.appUrl}/pricing" class="cta">
  Restart your subscription →
</a>

<p style="color:#666;font-size:13px">
— Tom at Tempo
</p>`;

  return { subject, html: baseTemplate(content, data.artistId) };
}

export function winbackDay30Email(data: {
  artistId: string;
  artistName: string;
  extensionUrl: string;
}): { subject: string; html: string } {
  const subject = "Come back to Tempo — 2 weeks on us";
  const content = `
<h1>We'd love to have you back.</h1>

<p>Hi ${data.artistName},</p>

<p>It's been a month. We've been improving
Tempo since you left — better plans, smarter
analysis, and a weekly check-in system that
shapes every plan around what's actually
happening in your world.</p>

<p>We'd like to offer you 2 weeks free to
try it again, no strings attached.</p>

<a href="${data.extensionUrl}" class="cta">
  Claim your 2 free weeks →
</a>

<p style="color:#555;font-size:13px">
This link is just for you and expires in
7 days.
</p>

<p style="color:#666;font-size:13px">
— Tom at Tempo
</p>`;

  return { subject, html: baseTemplate(content, data.artistId) };
}
