// Cross-post newly published blog articles to Facebook, Instagram (+ LinkedIn
// when its secrets are added). Zero npm dependencies — Node 20 built-ins only.
//
// What gets posted:
//   - Normal push: git-diffs the last commit, takes ADDED files matching
//     blog/<slug>/index.html. Legacy blog/blog-*.html and edits to existing
//     posts are ignored, so nothing double-posts.
//   - Manual run with a URL input: posts that one URL.
//
// Metadata comes from the post's Open Graph tags (og:title/description/url/image).

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const {
  META_PAGE_ID, META_PAGE_TOKEN, META_IG_USER_ID,
  LINKEDIN_TOKEN, LINKEDIN_ORG_ID,
  MANUAL_URL,
} = process.env;

const GRAPH = 'https://graph.facebook.com/v21.0';

// Only canonical posts: blog/<slug>/index.html  (excludes blog/blog-*.html)
const POST_RE = /^blog\/[^/]+\/index\.html$/;

// ---------- 1. Which posts to publish ----------

function addedPosts() {
  const out = execSync('git diff --name-status --diff-filter=A HEAD~1 HEAD', { encoding: 'utf8' });
  return out
    .split('\n')
    .map((l) => l.trim().split('\t'))
    .filter(([s, f]) => s === 'A' && f && POST_RE.test(f))
    .map(([, f]) => f);
}

// ---------- 2. OG metadata ----------

function og(html, prop) {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']og:${prop}["'][^>]*content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:${prop}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? decodeEntities(m[1].trim()) : null;
}

function decodeEntities(s) {
  return s
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function metaFromHtml(html, fallbackUrl) {
  return {
    title: og(html, 'title'),
    desc: og(html, 'description'),
    url: og(html, 'url') || fallbackUrl,
    image: og(html, 'image'),
  };
}

const metaFromFile = (file) => metaFromHtml(readFileSync(file, 'utf8'), null);
const metaFromUrl = async (url) => metaFromHtml(await (await fetch(url)).text(), url);

// ---------- 3. Caption ----------

function caption(m) {
  const out = [m.title];
  if (m.desc) out.push('', m.desc);
  out.push('', `Read the full guide: ${m.url}`);
  out.push('', '#MortgageSingapore #HomeLoanSG #SingaporeProperty #HDB #PropertySG #NexusMortgage');
  return out.join('\n');
}

// ---------- 4. Platform posters ----------

async function postFacebook(m) {
  if (!META_PAGE_ID || !META_PAGE_TOKEN) return skip('Facebook', 'no secrets');
  const r = await fetch(`${GRAPH}/${META_PAGE_ID}/feed`, {
    method: 'POST',
    body: new URLSearchParams({ message: caption(m), link: m.url, access_token: META_PAGE_TOKEN }),
  });
  return report('Facebook', r);
}

async function postInstagram(m) {
  if (!META_IG_USER_ID || !META_PAGE_TOKEN) return skip('Instagram', 'no secrets');
  if (!m.image) return skip('Instagram', 'post has no og:image (IG requires an image)');

  const c = await fetch(`${GRAPH}/${META_IG_USER_ID}/media`, {
    method: 'POST',
    body: new URLSearchParams({ image_url: m.image, caption: caption(m), access_token: META_PAGE_TOKEN }),
  });
  const cj = await c.json();
  if (!c.ok || !cj.id) return fail('Instagram', cj);

  const p = await fetch(`${GRAPH}/${META_IG_USER_ID}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({ creation_id: cj.id, access_token: META_PAGE_TOKEN }),
  });
  return report('Instagram', p);
}

async function postLinkedIn(m) {
  if (!LINKEDIN_TOKEN || !LINKEDIN_ORG_ID) return skip('LinkedIn', 'no secrets');
  const payload = {
    author: `urn:li:organization:${LINKEDIN_ORG_ID}`,
    lifecycleState: 'PUBLISHED',
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    commentary: caption(m),
    content: { article: { source: m.url, title: (m.title || '').slice(0, 100), description: (m.desc || '').slice(0, 300) } },
  };
  const r = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LINKEDIN_TOKEN}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202401',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(payload),
  });
  return report('LinkedIn', r);
}

// ---------- helpers ----------

function skip(p, why) { console.log(`SKIP ${p}: ${why}`); return { p, ok: null }; }
function fail(p, j)  { console.error(`FAIL ${p}: ${JSON.stringify(j)}`); return { p, ok: false }; }
async function report(p, r) {
  const j = await r.json().catch(() => ({}));
  if (r.ok) { console.log(`OK   ${p}: posted ${j.id || ''}`); return { p, ok: true }; }
  return fail(p, j);
}

// ---------- main ----------

(async () => {
  let posts = [];
  if (MANUAL_URL) {
    console.log(`Manual run: ${MANUAL_URL}`);
    posts = [await metaFromUrl(MANUAL_URL)];
  } else {
    const files = addedPosts();
    if (!files.length) { console.log('No new canonical posts in this push. Nothing to do.'); return; }
    console.log('New posts:', files);
    posts = files.map(metaFromFile);
  }

  let hadError = false;
  for (const m of posts) {
    if (!m.title || !m.url) { console.error('Missing og:title/og:url, skipping:', m); hadError = true; continue; }
    console.log(`\n-- Cross-posting: ${m.title}\n   ${m.url}`);
    const results = await Promise.all([postFacebook(m), postInstagram(m), postLinkedIn(m)]);
    if (results.some((r) => r.ok === false)) hadError = true;
  }
  if (hadError) process.exit(1);
})();
