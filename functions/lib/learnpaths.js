// functions/lib/learnpaths.js
// Single source of truth for the per-path Learn AI pages (/learn/<slug>) and
// the /learn hub. The same three paths exist as cards inside education.html;
// these give each one its own crawlable, rankable URL with real content +
// Course/HowTo structured data (review: "split Learn AI into per-path pages").
//
// Pure data — no env, no imports — so sitemap.js, learn/[slug].js and
// learn/index.js can all read it.

export const LEARN_PATHS = [
  {
    slug: 'use-ai-productively',
    level: 'Beginner',
    title: 'Use AI productively',
    tagline: 'Integrate AI into your daily work — no coding required.',
    audience: 'Professionals, students and curious beginners who want to get real work done with AI tools rather than build them.',
    outcome: 'You will be able to pick the right AI tool for a task, prompt it well, and fold it into your everyday workflow with confidence — and know where AI still gets things wrong.',
    time: '~20 hrs', steps: '5', extra: { label: 'Cost', value: 'Free' },
    intro: 'The fastest, most useful place to start. This path skips the math and the model internals and focuses on the one thing that pays off immediately: using today\u2019s AI assistants well. You\u2019ll build a mental model of what these tools can and can\u2019t do, learn to write prompts that get usable answers on the first try, and settle on a small toolkit you actually keep using.',
    plan: [
      { t: 'Build a foundation', d: 'Start with Andrew Ng\u2019s non-technical overview of what AI can and can\u2019t do.', label: 'AI for Everyone', url: 'https://www.coursera.org/learn/ai-for-everyone' },
      { t: 'Learn the workplace tools', d: 'Google\u2019s practical course on using generative AI at work — prompting, productivity and responsible use.', label: 'Google AI Essentials', url: 'https://www.coursera.org/learn/google-ai-essentials' },
      { t: 'Master prompting', d: 'Work through a structured, example-driven guide to writing prompts that actually work.', label: 'Learn Prompting', url: 'https://learnprompting.org/' },
      { t: 'Pick one or two tools', d: 'Go deep on a couple rather than dabbling in ten. Claude, ChatGPT and Perplexity each have a sweet spot.', label: 'Claude', url: 'https://claude.ai' },
      { t: 'Stay current', d: 'A weekly skim keeps your toolkit fresh without the firehose. The Batch is a good anchor — and so is our briefing.', label: 'The Batch', url: 'https://www.deeplearning.ai/the-batch/' },
    ],
  },
  {
    slug: 'build-ai-applications',
    level: 'Intermediate',
    title: 'Build AI applications',
    tagline: 'Ship products on AI APIs, fine-tuning and RAG.',
    audience: 'Developers comfortable with Python who want to build and deploy AI-powered features and products.',
    outcome: 'You will be able to design, build and deploy an AI application — from calling an API and grounding it with retrieval, through evaluation, to running it in production.',
    time: '~60 hrs', steps: '5', extra: { label: 'Code', value: 'Python' },
    intro: 'This path turns working knowledge of Python into the ability to ship. You\u2019ll move from the fundamentals of machine learning into hands-on deep learning, then into the modern application stack: transformers, retrieval-augmented generation, vector databases and the operational concerns that decide whether an AI feature survives contact with real users.',
    plan: [
      { t: 'Ground the fundamentals', d: 'Andrew Ng\u2019s specialization covers supervised/unsupervised learning, neural nets and the vocabulary you\u2019ll use everywhere else.', label: 'ML Specialization', url: 'https://www.deeplearning.ai/courses/machine-learning-specialization/' },
      { t: 'Get hands-on fast', d: 'fast.ai\u2019s top-down, code-first deep learning course gets you building models early.', label: 'Practical Deep Learning', url: 'https://course.fast.ai/' },
      { t: 'Learn transformers', d: 'The Hugging Face course teaches the library and the patterns behind nearly every modern NLP app.', label: 'Hugging Face NLP Course', url: 'https://huggingface.co/learn/nlp-course/chapter1/1' },
      { t: 'Build the app stack', d: 'Compose LLMs with tools, memory and retrieval over a vector database.', label: 'LangChain', url: 'https://python.langchain.com/docs/introduction/' },
      { t: 'Take it to production', d: 'Databricks\u2019 course covers fine-tuning, RAG, evaluation, deployment and monitoring end to end.', label: 'LLMs in Production', url: 'https://www.deeplearning.ai/courses/large-language-models-application-through-production/' },
    ],
  },
  {
    slug: 'research-ai-systems',
    level: 'Advanced',
    title: 'Research AI systems',
    tagline: 'Understand, replicate and advance the state of the art.',
    audience: 'Engineers and researchers who want to read papers fluently, reimplement methods, and contribute at the frontier.',
    outcome: 'You will be able to read and reproduce current research, build core architectures from scratch, and follow the field at the level where new ideas are formed.',
    time: '~120 hrs', steps: '5', extra: { label: 'Math', value: 'Heavy' },
    intro: 'The deep end. This path assumes comfort with code and a willingness to do the math. You\u2019ll work through rigorous deep-learning theory, a serious NLP course, and the rite of passage of building a GPT from scratch — then make reading the daily arXiv flow a habit so the frontier stops feeling like a moving target.',
    plan: [
      { t: 'Study deeply', d: 'Work through the Deep Learning Specialization rigorously — CNNs, sequence models, optimization.', label: 'Deep Learning Specialization', url: 'https://www.deeplearning.ai/courses/deep-learning-specialization/' },
      { t: 'Take a frontier course', d: 'Stanford CS224N (NLP) or CS231N (vision) — full lectures and assignments are public.', label: 'Stanford CS224N', url: 'https://web.stanford.edu/class/cs224n/' },
      { t: 'Build GPT from scratch', d: 'Karpathy\u2019s Zero to Hero series demystifies backprop through to a working language model.', label: 'Neural Networks: Zero to Hero', url: 'https://karpathy.ai/zero-to-hero.html' },
      { t: 'Read papers daily', d: 'Make the arXiv flow a habit — our Research feed surfaces and explains the day\u2019s papers.', label: 'PromptAI Research', url: 'https://promptai.in/#research' },
      { t: 'Follow the discourse', d: 'The Gradient and Distill.pub keep you close to how the field thinks, not just what it ships.', label: 'The Gradient', url: 'https://thegradient.pub/' },
    ],
  },
];

export function findPath(slug) {
  const i = LEARN_PATHS.findIndex((p) => p.slug === slug);
  if (i === -1) return null;
  return {
    path: LEARN_PATHS[i],
    prev: LEARN_PATHS[i - 1] || null,
    next: LEARN_PATHS[i + 1] || null,
  };
}
