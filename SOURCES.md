# PromptAI — Master Source List

All vetted AI research, news, blog and paper sources.
Status: ✅ Active | 🔄 Rotate in | ⚠️ Unreliable | ❌ Blocked/Paywalled

---

## 🟠 Currently Active Sources

### News Feed
| Source | RSS URL | Notes |
|---|---|---|
| Hacker News | `https://hacker-news.firebaseio.com/v0/topstories.json` | Firebase JSON, no CORS |
| TechCrunch AI | `https://techcrunch.com/category/artificial-intelligence/feed/` | ✅ Reliable |
| The Verge AI | `https://www.theverge.com/ai-artificial-intelligence/rss/index.xml` | ✅ Reliable |
| Ars Technica | `https://feeds.arstechnica.com/arstechnica/technology-lab` | ✅ Reliable |
| OpenAI Blog | `https://openai.com/blog/rss.xml` | ✅ Official |
| VentureBeat AI | `https://venturebeat.com/category/ai/feed/` | ✅ Reliable |
| Analytics Insight | `https://www.analyticsinsight.net/feed/` | ✅ Reliable |
| arXiv cs.AI+LG+CL | `https://rss.arxiv.org/rss/cs.AI+cs.LG+cs.CL` | ✅ Official |

### Blog Feed
| Source | RSS URL | Notes |
|---|---|---|
| The Gradient | `https://thegradient.pub/rss/` | ✅ High quality ML research |
| Towards Data Science | `https://medium.com/feed/towards-data-science` | ✅ Reliable |
| Google AI Blog | `https://blog.research.google/feeds/posts/default` | ✅ Official |
| MIT Sloan (AI) | `https://sloanreview.mit.edu/topic/artificial-intelligence/feed/` | ✅ Academic quality |
| VentureBeat AI | `https://venturebeat.com/category/ai/feed/` | ✅ Business angle |

### Papers Feed
| Source | Feed URL | Categories |
|---|---|---|
| arXiv cs.AI | `https://rss.arxiv.org/rss/cs.AI` | Artificial Intelligence |
| arXiv cs.LG | `https://rss.arxiv.org/rss/cs.LG` | Machine Learning |
| arXiv cs.CL | `https://rss.arxiv.org/rss/cs.CL` | NLP / LLMs |
| arXiv cs.CV | `https://rss.arxiv.org/rss/cs.CV` | Computer Vision |

---

## 🔄 Recommended Sources to Add Next

### High Quality — Easy to integrate
| Source | RSS URL | Why Add |
|---|---|---|
| Anthropic Blog | `https://www.anthropic.com/news/rss` | Claude/safety research |
| Hugging Face Blog | `https://huggingface.co/blog/feed.xml` | Open source AI |
| Fast.ai Blog | `https://www.fast.ai/index.xml` | Practical deep learning |
| Distill.pub | `https://distill.pub/rss.xml` | Visual ML explainers |
| Towards AI | `https://pub.towardsai.net/feed` | Community ML articles |
| KDnuggets | `https://www.kdnuggets.com/feed` | Data science + ML |
| Import AI (Jack Clark) | `https://jack-clark.net/feed/` | Weekly AI newsletter |
| The Batch (deeplearning.ai) | `https://www.deeplearning.ai/the-batch/feed/` | Andrew Ng's newsletter |
| AI Alignment Forum | `https://www.alignmentforum.org/feed.xml` | AI safety research |
| LessWrong AI | `https://www.lesswrong.com/feed.xml?view=frontpage` | Rationality + AI |

### Academic / Research
| Source | RSS/API | Why Add |
|---|---|---|
| Nature Machine Intelligence | Paywalled ❌ | Tier-1 journal |
| IEEE Spectrum AI | `https://spectrum.ieee.org/feeds/feed.rss` | Engineering perspective |
| Science Daily AI | `https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml` | Research digests |
| JMLR | `https://www.jmlr.org/jmlr.xml` | Journal of ML Research |
| Papers with Code | No RSS — use API | Trending papers + code |

### Company Blogs (Official)
| Source | RSS URL | Notes |
|---|---|---|
| Google DeepMind | `https://deepmind.google/discover/blog/rss.xml` | ⚠️ Unreliable feed |
| Meta AI | `https://ai.meta.com/blog/rss/` | Official Meta AI |
| Microsoft Research | `https://www.microsoft.com/en-us/research/feed/` | Azure AI + research |
| Cohere Blog | `https://cohere.com/blog/rss` | LLM API company |
| Mistral AI | No RSS yet | Watch for updates |
| Stability AI | `https://stability.ai/news/rss` | Image/video gen |

### Newsletter-style Sources
| Source | Notes |
|---|---|
| TLDR AI (tldr.tech) | No RSS — email only |
| Ben's Bites | No RSS — Substack |
| The Rundown AI | No RSS — email only |
| Import AI | `https://jack-clark.net/feed/` ✅ |
| Interconnects (Nathan Lambert) | `https://www.interconnects.ai/feed` ✅ |

---

## ⚠️ Removed / Unreliable
| Source | Issue |
|---|---|
| MIT Technology Review | Rate limits + paywalled RSS |
| Wired AI | Blocks RSS scrapers |
| DeepMind Blog | Inconsistent feed format |
| Medium tag feeds | High spam ratio, low quality |
| AI Magazine | Low content quality |

---

## 📊 Social Media Channels to Add to Buffer

| Platform | Handle/Page to create | Content type |
|---|---|---|
| Twitter/X | `@promptai_in` | News snippets + paper highlights |
| LinkedIn | `PromptAI` company page | Professional insights + research |
| Instagram | `@promptai.in` | Visual cards with paper summaries |
| Facebook | `PromptAI` page | Long-form article shares |
| Threads | `@promptai.in` | Casual AI commentary |

**Buffer RSS setup:** `https://promptai.in/feed.xml` → auto-posts to all channels.

**Content calendar suggestion:**
- **Daily:** 1 HN top story + 1 arXiv paper highlight
- **Weekly:** 1 blog deep-dive + weekly digest newsletter
- **Monthly:** Source curation review (check for new high-quality feeds)

---

## 🔧 How to Add a New Source

1. Test the RSS URL: `https://api.rss2json.com/v1/api.json?rss_url=YOUR_URL`
2. If `"status":"ok"` with 5+ items → source is good
3. Add to `BLOG_FEEDS` array in `index.html` with appropriate `src` key
4. Add source badge in `sourceBadge()` map
5. Add colour in `catColor()` map
6. Add to `ALLOWED` list in `netlify/functions/rss-proxy.js`
7. Redeploy to Netlify

---

*Last updated: June 2026 · PromptAI team*

---

## 🏆 Forbes AI 50 — Company Blogs & RSS Status

*Source: Forbes AI 50 list (2025/2026 edition) · Published with Sequoia + Meritech Capital*

| Company | Category | Blog RSS | Status |
|---|---|---|---|
| OpenAI | Foundation Models | `https://openai.com/blog/rss.xml` | ✅ Active |
| Anthropic | Foundation Models | `https://www.anthropic.com/news/rss` | ✅ Active |
| xAI (Grok) | Foundation Models | No RSS | ❌ No feed |
| Mistral AI | Foundation Models | `https://mistral.ai/news/rss` | 🔄 Added |
| Perplexity AI | AI Search | `https://blog.perplexity.ai/feed` | 🔄 Added |
| Cohere | Enterprise LLMs | `https://cohere.com/blog/rss` | 🔄 Added |
| Databricks | AI/Data Platform | `https://www.databricks.com/blog/feed` | 🔄 Added |
| LangChain | AI Dev Tools | `https://blog.langchain.dev/rss/` | 🔄 Added |
| Weights & Biases | ML Tooling | `https://wandb.ai/fully-connected/rss/` | 🔄 Added |
| Hugging Face | Open Source AI | `https://huggingface.co/blog/feed.xml` | ✅ Active |
| Meta AI | Foundation Models | `https://ai.meta.com/blog/rss/` | ✅ Active |
| Scale AI | Data Labelling | No public RSS | ❌ No feed |
| Harvey | Legal AI | No public RSS | ❌ No feed |
| Sierra | Customer AI | No public RSS | ❌ No feed |
| Writer | Enterprise AI | No public RSS | ❌ No feed |
| Character.AI | Consumer AI | No public RSS | ❌ No feed |
| Cursor (Anysphere) | AI Coding | No public RSS | ❌ No feed |
| Together AI | AI Infrastructure | No public RSS | ❌ No feed |
| Runway | Video/Image AI | No public RSS | ❌ No feed |
| ElevenLabs | Voice AI | No public RSS | ❌ No feed |
| Synthesia | Video AI | No public RSS | ❌ No feed |
| Glean | Enterprise Search | No public RSS | ❌ No feed |
| Moveworks | IT Automation AI | No public RSS | ❌ No feed |
| Cognition AI | AI Dev Agents | No public RSS | ❌ No feed |
| Pika Labs | Video Generation | No public RSS | ❌ No feed |

> **Note:** Companies without RSS feeds are covered indirectly through TechCrunch, The Verge, VentureBeat, and Ars Technica — all already active on PromptAI.

### How to Monitor Forbes AI 50 Companies Without RSS
1. **Google Alerts** → set up alerts for each company name → delivers to email daily
2. **Buffer** → follow their LinkedIn/X pages to reshare their posts
3. **TechCrunch/VentureBeat** → already aggregated — covers funding news, launches, research

