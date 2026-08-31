import fs from "node:fs";
import path from "node:path";

const inputDirectory = process.argv[2] || "/tmp";
const outputPath = process.argv[3] || path.join(import.meta.dirname, "main-stories.js");

const okIds = new Set([
  "1n607gu", "1n613wu", "1n63pbm", "1n64krd", "1ni0m3o",
  "1nvfee0", "1nvjkek", "1o1n5t0", "1o1p8kf", "1o7o53y",
  "1om2hab", "1om2k64", "1orz4vv", "1os00y2",
  "1pblj86", "1phlgmy", "1phnqel", "1phojot", "1pnfgfe",
  "1q7kj3n", "1q7kxto", "1q7ne2z", "1q7ngso", "1q7pdzx",
  "1qzgm4x", "1qzhbst", "1qzmt34", "1qzo1bc", "1ruq73t",
  "1s9rl5k", "1s9rxbg", "1s9tp5r", "1s9wgwu", "1sa1bt0",
  "1t13y4j", "1t17vtj", "1tu1zrz", "1u0jz1p", "1u0ohvc",
  "1uxekrn", "1uxeyb6", "1ur75ky", "1ur8dkg", "1ur2i1t",
  "1vcuq7t", "1vcvkya", "1vcwxkk", "1vcxjgw", "1vj2mfz", "1vj2tm3"
]);

const excludedWrongIds = new Set([
  "1n5zm13", // too little decision-relevant context
  "1n602yv", // centers on an acute panic attack rather than a bounded choice
  "1r5me2x", // conflict is not intelligible without omitted context
  "1vcwwun", // intimate content outside the intended topic range
  "1vp9hlc"  // school conflict with unclear adult consent context
]);

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isEligible(post) {
  return ["Asshole", "Not the A-hole"].includes(post.link_flair_text)
    && !/removed|update|WIBTA|meta/i.test(post.title)
    && !["[removed]", "[deleted]", ""].includes((post.selftext || "").trim())
    && wordCount(post.selftext) >= 120
    && wordCount(post.selftext) <= 700
    && post.num_comments >= 10;
}

function sanitizeTitle(title) {
  return title
    .replace(/^\s*(?:AITA|AITAH)\s*(?:for|if|when|to|[-:—?])?\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/^./, character => character.toUpperCase())
    .trim();
}

function sanitizeNarrative(selftext) {
  const keptLines = [];
  for (const rawLine of selftext.replaceAll("\r", "").split("\n")) {
    const line = rawLine.trim();
    if (/^(?:edit|update|eta)(?:\s*\d+)?\s*[:\-—]/i.test(line)) {
      if (keptLines.some(Boolean)) break;
      continue;
    }
    if (/^(?:throwaway|obligatory (?:throwaway|mobile)|fake names?)(?:\s|[.,:;…—-]|$)/i.test(line)) continue;
    if (/^(?:(?:so[, ]+)?(?:AITA|AITAH|WIBTA)|am i (?:the|an) (?:asshole|a-hole))\??\s*$/i.test(line)) continue;
    keptLines.push(line);
  }

  return keptLines.join("\n")
    .replace(/\[([^\]]+)\]\([^\s)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\/?[ru]\/\w+/gi, "")
    .replace(/^&gt;.*$/gm, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[>*_~`]/g, "")
    .replace(/\bAITA(?:H)? moment\b/gi, "point of conflict")
    .replace(/(?:^|(?<=[.!?]\s))[^.!?]*(?:AITA|AITAH|WIBTA|YTA|NTA|ESH|NAH)[^.!?]*[.!?]?/gi, " ")
    .replace(/(?:^|(?<=[.!?]\s))[^.!?]*(?:subreddit|redditors?|the comments)[^.!?]*[.!?]?/gi, " ")
    .replace(/(?:^|(?<=[.!?]\s))[^.!?]*(?:reddit|throwaway (?:account|acc))[^.!?]*[.!?]?/gi, " ")
    .replace(/(?:so\s+)?(?:just\s+)?(?:been\s+)?(?:wondering[^,.!?]*)?,?\s*(?:AITA|AITAH|WIBTA)\??\s*$/i, "")
    .replace(/(?:just gauging,?\s*)?am i (?:the|an) (?:asshole|a-hole)(?:\s+here)?(?:\s+for [^?]*)?(?:\s+or is (?:he|she|it|the other person))?\s*[?.]?/gi, "")
    .replace(/\s*am i (?:the|an) (?:asshole|a-hole)\??\s*$/i, "")
    .replace(/(?:so\s+)?(?:am|was|would|could)\s+i\b[^.!?\n]{0,180}\b(?:asshole|a-hole|ahole)\b[^.!?\n]*[.!?]?/gi, "")
    .replace(/(?:do you think\s+)?i(?:'m| am| might be| feel like)\b[^.!?\n]{0,120}\b(?:asshole|a-hole|ahole)\b[^.!?\n]*[.!?]?/gi, "")
    .replace(/\b(?:assholes?|a-holes?|aholes?)\b/gi, match => match.endsWith("s") ? "jerks" : "jerk")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
}

const archiveFiles = fs.readdirSync(inputDirectory)
  .filter(name => /^day-\d{8}\.json$/.test(name))
  .sort();

if (!archiveFiles.length) throw new Error(`No day-YYYYMMDD.json archive slices found in ${inputDirectory}`);

const postsById = new Map();
for (const name of archiveFiles) {
  const payload = JSON.parse(fs.readFileSync(path.join(inputDirectory, name), "utf8"));
  for (const post of payload.data || []) postsById.set(post.id, post);
}

const eligiblePosts = [...postsById.values()].filter(isEligible);
const wrongPosts = eligiblePosts
  .filter(post => post.link_flair_text === "Asshole" && !excludedWrongIds.has(post.id))
  .sort((a, b) => a.created_utc - b.created_utc);
const okPosts = [...okIds]
  .map(id => postsById.get(id))
  .filter(Boolean)
  .sort((a, b) => a.created_utc - b.created_utc);

if (wrongPosts.length !== 50) throw new Error(`Expected 50 in-the-wrong stories, found ${wrongPosts.length}`);
if (okPosts.length !== 50) throw new Error(`Expected 50 not-in-the-wrong stories, found ${okPosts.length}`);
if (okPosts.some(post => !isEligible(post) || post.link_flair_text !== "Not the A-hole")) {
  throw new Error("The not-in-the-wrong manifest contains an ineligible post");
}

const stories = [...wrongPosts, ...okPosts]
  .sort((a, b) => a.created_utc - b.created_utc || a.id.localeCompare(b.id))
  .map(post => ({
    id: `story_reddit_${post.id}`,
    sourceUrl: `https://www.reddit.com/r/AmItheAsshole/comments/${post.id}/`,
    publishedDate: new Date(post.created_utc * 1000).toISOString().slice(0, 10),
    communityVerdict: post.link_flair_text === "Asshole" ? "wrong" : "ok",
    title: sanitizeTitle(post.title),
    narrative: sanitizeNarrative(post.selftext),
    consensusShare: null,
    createdAt: "2026-08-28T00:00:00.000Z"
  }));

const prohibited = /\b(?:AITA|AITAH|WIBTA|YTA|NTA|ESH|NAH|OP|reddit|subreddit|redditors?|assholes?|a-holes?|aholes?)\b|\bthe comments\b/i;
const contaminated = stories.filter(story => prohibited.test(story.narrative));
if (contaminated.length) {
  throw new Error(`Model-facing clues remain in: ${contaminated.map(story => story.id).join(", ")}`);
}

const output = `// Generated by build_main_stories.mjs; source outcomes are sealed from model prompts.\nwindow.MAIN_EXPERIMENT_STORIES = ${JSON.stringify(stories, null, 2)};\n`;
fs.writeFileSync(outputPath, output, "utf8");
const studyPath = path.join(path.dirname(outputPath), "second-opinion-main-100.json");
const study = {
  schema: "second-opinion-study-v1",
  seedVersion: 7,
  promptVersion: "in-the-wrong-v2",
  stories,
  trials: [],
  exportedAt: "2026-08-28T00:00:00.000Z"
};
fs.writeFileSync(studyPath, `${JSON.stringify(study, null, 2)}\n`, "utf8");
const manifestPath = path.join(path.dirname(outputPath), "reddit-story-candidates.md");
const manifestRows = stories.map(story => {
  const outcome = story.communityVerdict === "wrong" ? "In the wrong" : "Not in the wrong";
  const title = story.title.replaceAll("|", "\\|");
  return `| ${story.id.replace("story_reddit_", "")} | ${story.publishedDate} | ${outcome} | ${title} | [Source](${story.sourceUrl}) |`;
});
const manifest = `# Main-experiment Reddit stories

Frozen on 2026-08-28 for the Second Opinion experiment. Do not expose this file,
source titles, or sealed outcomes to the model.

## Sampling and screening

- Sampling frame: up to 100 archived posts from each of three fixed UTC dates per
  month (the 1st, 8th, and 15th), from 2025-09-01 through 2026-08-15.
- Included only final \`Asshole\` and \`Not the A-hole\` flairs from
  \`r/AmItheAsshole\`; the final set is balanced 50/50.
- Mechanical eligibility required an intact original post, 120–700 source words,
  at least 10 comments, and no update, meta, or hypothetical post title.
- Manual screening removed cases with too little decision-relevant context,
  unbounded acute-distress framing, intimate content outside the study's scope,
  or unclear consent context. The larger not-in-the-wrong pool was purposively
  sampled for date and topic variety.
- Model-facing text removes forum/verdict language, usernames and links, Markdown,
  edits, updates, and final verdict requests. No community outcome or reaction is
  included in a prompt.

This is a balanced purposive test set, not a probability sample of all posts.
Final flair is the community label used by the subreddit; \`consensusShare\` stays
blank because comment judgments were not separately sampled and coded.

## Frozen set

| Reddit ID | Published | Sealed outcome | Internal title | Audit link |
| --- | --- | --- | --- | --- |
${manifestRows.join("\n")}
`;
fs.writeFileSync(manifestPath, manifest, "utf8");
console.log(`Wrote ${stories.length} stories (${wrongPosts.length} wrong, ${okPosts.length} okay) plus study JSON and audit manifest`);
