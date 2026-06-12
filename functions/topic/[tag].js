// functions/topic/[tag].js
// GET /topic/agents, /topic/llms, … — crawlable topic hub pages (R21).
// Rendered from the shared KV archive (which now stores a topic per item
// thanks to the server-side aggregator).

import { pageShell, storyRow, htmlResponse, notFound } from '../lib/page.js';
import { TOPIC_SLUGS, esc } from '../lib/feedlib.js';

const BLURBS = {
  Agents:   'Autonomous and tool-using AI systems — multi-agent orchestration, computer use, and agentic workflows.',
  Vision:   'Image, video and multimodal AI — diffusion models, generation, segmentation and visual understanding.',
  Robotics: 'Embodied AI — robots, drones, self-driving systems and real-world manipulation.',
  Policy:   'AI regulation, governance, safety and the legal fights shaping the field.',
  Research: 'Benchmarks, datasets, training techniques and the papers pushing the state of the art.',
  Tools:    'New AI products, APIs, SDKs and platform launches worth knowing about.',
  LLMs:     'Large language models — GPT, Claude, Gemini, Llama, open weights, prompting and RAG.',
};

export async function onRequest(context) {
  const { params, env } = context;
  const slug = String(params.tag || '').toLowerCase();
  const topic = TOPIC_SLUGS[slug];
  if (!topic) return notFound('Topic hubs: ' + Object.keys(TOPIC_SLUGS).map(s => '/topic/' + s).join(', '));

  let items = [];
  if (env.STATS) {
    try {
      const arch = JSON.parse(await env.STATS.get('arch:all') || '[]');
      if (Array.isArray(arch)) {
        items = arch.filter(i => (i.topic || '') === topic || (topic === 'Research' && i.type === 'paper')).slice(0, 60);
      }
    } catch (e) {}
  }

  const body = `
    <h1>${esc(topic)} — AI news &amp; research</h1>
    <p class="lede">${esc(BLURBS[topic] || '')} Updated continuously from ${20}+ curated sources.</p>
    <div class="topics">
      ${Object.entries(TOPIC_SLUGS).map(([s, t]) => s === slug
        ? `<a href="/topic/${s}" style="background:var(--accent-subtle);color:var(--accent)" aria-current="page">${t}</a>`
        : `<a href="/topic/${s}">${t}</a>`).join('')}
    </div>
    ${items.length
      ? items.map(storyRow).join('')
      : '<p class="lede">Stories are being gathered — check back shortly or browse the <a href="/archive.html">full archive</a>.</p>'}
    <p style="margin-top:30px;font-size:.85rem;color:var(--text-3)"><a href="/issues">Browse briefing issues →</a></p>`;

  const html = pageShell({
    title: `${topic} — AI news & research`,
    description: `${BLURBS[topic] || ''} Curated ${topic} coverage from PromptAI.`.slice(0, 158),
    canonical: `https://promptai.in/topic/${slug}`,
    breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Topics', href: '/issues' }, { label: topic }],
    body,
  });
  return htmlResponse(html, 1800);
}
