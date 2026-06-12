// functions/lib/sources.js
// ═══════════════════════════════════════════════════════════════════
// THE single source-of-truth for every feed PromptAI consumes (R2).
//
// Everything that needs a feed list imports from here:
//   • functions/api/refresh-feeds.js  (server-side aggregator — R1)
//   • functions/send-digest.js        (newsletter)
//   • functions/feed.js               (public RSS out)
//   • functions/rss-proxy.js          (allow-list, derived)
// The browser no longer keeps its own list — it gets the aggregated
// payload (incl. source metadata) from /api/feeds.
//
// Add a feed ONCE here and every consumer picks it up.
// ═══════════════════════════════════════════════════════════════════

// Per-source presentation metadata (favicon domain, label, brand color).
export const SRC_META = {
  hn:            { label: 'Hacker News',        domain: 'news.ycombinator.com', color: '#ff6600' },
  arxiv:         { label: 'arXiv',              domain: 'arxiv.org',          color: '#b31b1b' },
  tc:            { label: 'TechCrunch',         domain: 'techcrunch.com',     color: '#0a9e01' },
  verge:         { label: 'The Verge',          domain: 'theverge.com',       color: '#5200ff' },
  venturebeat:   { label: 'VentureBeat',        domain: 'venturebeat.com',    color: '#d6482b' },
  ars:           { label: 'Ars Technica',       domain: 'arstechnica.com',    color: '#ff4e00' },
  openai:        { label: 'OpenAI',             domain: 'openai.com',         color: '#10a37f' },
  google:        { label: 'Google AI',          domain: 'research.google',    color: '#4285f4' },
  hf:            { label: 'Hugging Face',       domain: 'huggingface.co',     color: '#ff9d00' },
  marktechpost:  { label: 'MarkTechPost',       domain: 'marktechpost.com',   color: '#0ea5e9' },
  analytics:     { label: 'Analytics Insight',  domain: 'analyticsinsight.net', color: '#a16207' },
  databricks:    { label: 'Databricks',         domain: 'databricks.com',     color: '#ff3621' },
  cohere:        { label: 'Cohere',             domain: 'cohere.com',         color: '#39594d' },
  gradient:      { label: 'The Gradient',       domain: 'thegradient.pub',    color: '#5b21b6' },
  tds:           { label: 'Towards Data Science', domain: 'towardsdatascience.com', color: '#334155' },
  fastai:        { label: 'fast.ai',            domain: 'fast.ai',            color: '#7c3aed' },
  distill:       { label: 'Distill',            domain: 'distill.pub',        color: '#ef4444' },
  langchain:     { label: 'LangChain',          domain: 'langchain.dev',      color: '#1c8a76' },
  interconnects: { label: 'Interconnects',      domain: 'interconnects.ai',   color: '#2563eb' },
  batch:         { label: 'The Batch',          domain: 'deeplearning.ai',    color: '#c2410c' },
  anthropic:     { label: 'Anthropic',          domain: 'anthropic.com',      color: '#d97757' },
  mistral:       { label: 'Mistral AI',         domain: 'mistral.ai',         color: '#fa520f' },
  perplexity:    { label: 'Perplexity',         domain: 'perplexity.ai',      color: '#20808d' },
  bair:          { label: 'Berkeley AI',        domain: 'bair.berkeley.edu',  color: '#003262' },
  msr:           { label: 'Microsoft Research', domain: 'microsoft.com',      color: '#0067b8' },
  mit:           { label: 'MIT News',           domain: 'news.mit.edu',       color: '#750014' },
};

// ── RSS/Atom feeds ─────────────────────────────────────────────────
// kind: 'news' | 'blog'
// digest: include in the email briefing
// web:    include in the site's live feed (/api/feeds)
export const FEEDS = [
  // News
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', src: 'tc',           kind: 'news', web: true,  digest: true  },
  { url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml', src: 'verge',    kind: 'news', web: true,  digest: true  },
  { url: 'https://venturebeat.com/category/ai/feed/',                    src: 'venturebeat',  kind: 'news', web: true,  digest: true  },
  { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',     src: 'ars',          kind: 'news', web: true,  digest: true  },
  { url: 'https://openai.com/news/rss.xml',                              src: 'openai',       kind: 'news', web: true,  digest: false },
  { url: 'https://huggingface.co/blog/feed.xml',                         src: 'hf',           kind: 'news', web: true,  digest: false },
  { url: 'https://www.marktechpost.com/feed/',                           src: 'marktechpost', kind: 'news', web: true,  digest: false },
  { url: 'https://www.analyticsinsight.net/feed/',                       src: 'analytics',    kind: 'news', web: true,  digest: false },
  { url: 'https://blog.research.google/feeds/posts/default',             src: 'google',       kind: 'news', web: true,  digest: false },
  { url: 'https://www.databricks.com/blog/feed',                         src: 'databricks',   kind: 'news', web: true,  digest: false },
  { url: 'https://cohere.com/blog/rss',                                  src: 'cohere',       kind: 'news', web: true,  digest: false },
  // Blogs / deep dives
  { url: 'https://thegradient.pub/rss/',                                 src: 'gradient',     kind: 'blog', web: true,  digest: true  },
  { url: 'https://medium.com/feed/towards-data-science',                 src: 'tds',          kind: 'blog', web: true,  digest: false },
  { url: 'https://blog.research.google/feeds/posts/default',             src: 'google',       kind: 'blog', web: true,  digest: true  },
  { url: 'https://huggingface.co/blog/feed.xml',                         src: 'hf',           kind: 'blog', web: true,  digest: true  },
  { url: 'https://www.deeplearning.ai/the-batch/feed/',                  src: 'batch',        kind: 'blog', web: false, digest: true  },
  { url: 'https://www.fast.ai/index.xml',                                src: 'fastai',       kind: 'blog', web: true,  digest: true  },
  { url: 'https://distill.pub/rss.xml',                                  src: 'distill',      kind: 'blog', web: true,  digest: false },
  { url: 'https://blog.langchain.dev/rss/',                              src: 'langchain',    kind: 'blog', web: true,  digest: false },
  { url: 'https://interconnects.ai/feed',                                src: 'interconnects', kind: 'blog', web: true, digest: false },
];

// arXiv paper feeds (fetched direct — export.arxiv.org mirrors rss.arxiv.org)
export const ARXIV_FEEDS = {
  all:     'https://rss.arxiv.org/rss/cs.AI+cs.LG+cs.CL+cs.CV',
  'cs.AI': 'https://rss.arxiv.org/rss/cs.AI',
  'cs.LG': 'https://rss.arxiv.org/rss/cs.LG',
  'cs.CL': 'https://rss.arxiv.org/rss/cs.CL',
  'cs.CV': 'https://rss.arxiv.org/rss/cs.CV',
};
export const PAPER_CAT_MAP = {
  'cs.AI': { label: 'AI',               cls: 'cat-llm' },
  'cs.LG': { label: 'Machine Learning', cls: 'cat-ml' },
  'cs.CL': { label: 'NLP / LLM',        cls: 'cat-nlp' },
  'cs.CV': { label: 'Computer Vision',  cls: 'cat-cv' },
  'cs.RO': { label: 'Robotics',         cls: 'cat-rl' },
  'cs.NE': { label: 'Neural Nets',      cls: 'cat-ai' },
};

// Digest (email) selections, derived — no more separate drifting lists.
export const DIGEST_NEWS_FEEDS  = FEEDS.filter(f => f.kind === 'news' && f.digest).map(f => f.url);
export const DIGEST_BLOG_FEEDS  = FEEDS.filter(f => f.kind === 'blog' && f.digest).map(f => f.url);
export const DIGEST_PAPER_FEEDS = ['https://rss.arxiv.org/rss/cs.AI', 'https://rss.arxiv.org/rss/cs.LG'];

// Live-site selections.
export const WEB_NEWS_FEEDS = FEEDS.filter(f => f.kind === 'news' && f.web);
export const WEB_BLOG_FEEDS = FEEDS.filter(f => f.kind === 'blog' && f.web);

// rss-proxy allow-list — every feed host above, plus hosts the legacy
// client-side fallback may still request.
const EXTRA_ALLOWED = [
  'rss.arxiv.org', 'export.arxiv.org', 'api.rss2json.com',
  'sloanreview.mit.edu', 'www.anthropic.com', 'ai.meta.com',
  'blog.perplexity.ai', 'mistral.ai', 'wandb.ai',
  'spectrum.ieee.org', 'www.sciencedaily.com', 'www.jmlr.org',
  'www.unite.ai', 'www.microsoft.com', 'news.mit.edu', 'bair.berkeley.edu',
];
export const ALLOWED_DOMAINS = [...new Set([
  ...FEEDS.map(f => { try { return new URL(f.url).hostname; } catch (e) { return null; } }).filter(Boolean),
  ...EXTRA_ALLOWED,
])];
