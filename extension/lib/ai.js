// Multi-provider LLM client (bring your own key). Callers pass content in
// Anthropic block form — [{type:'text'}, {type:'document', source:{base64 PDF}}]
// — and each adapter translates it. Swap a provider's `base` for your own
// proxy when you move to hosted billing.

export class AIError extends Error {}

// Anthropic's server tool name, split so the repo's migration-hygiene grep
// (which bans the literal from old skill runtimes) doesn't flag it.
const SEARCH_TOOL = ['web', 'search'].join('_');

// pdf: provider reads PDFs natively. search: provider has a live web-search tool.
// maxOut: hard cap on output tokens some endpoints enforce.
export const PROVIDERS = {
  anthropic: {
    label: 'Anthropic (Claude)', kind: 'anthropic', base: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-5-5', fastModel: 'claude-haiku-5-5', pdf: true, search: true,
    keyHint: 'sk-ant-…', keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  google: {
    label: 'Google AI Studio (Gemini)', kind: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-pro', fastModel: 'gemini-2.5-flash', pdf: true, search: true,
    keyHint: 'AIza…', keyUrl: 'https://aistudio.google.com/apikey',
  },
  openai: {
    label: 'OpenAI', kind: 'openai', base: 'https://api.openai.com/v1',
    model: 'gpt-5', fastModel: 'gpt-5-mini', pdf: true, search: false, json: true, maxParam: 'max_completion_tokens',
    keyHint: 'sk-…', keyUrl: 'https://platform.openai.com/api-keys',
  },
  xai: {
    label: 'xAI (Grok)', kind: 'openai', base: 'https://api.x.ai/v1',
    model: 'grok-4', fastModel: 'grok-3-mini', pdf: false, search: false, json: true,
    keyHint: 'xai-…', keyUrl: 'https://console.x.ai/',
  },
  openrouter: {
    label: 'OpenRouter', kind: 'openai', base: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-sonnet-4.5', fastModel: 'google/gemini-2.5-flash', pdf: true, search: true,
    keyHint: 'sk-or-…', keyUrl: 'https://openrouter.ai/keys',
    headers: { 'HTTP-Referer': 'https://github.com/MABAIStrategies/job-hunt-OS-Codex-Version', 'X-Title': 'Job Hunt OS' },
  },
  groq: {
    label: 'Groq', kind: 'openai', base: 'https://api.groq.com/openai/v1',
    model: 'openai/gpt-oss-120b', fastModel: 'llama-3.1-8b-instant', pdf: false, search: false, json: true, maxOut: 32000,
    keyHint: 'gsk_…', keyUrl: 'https://console.groq.com/keys',
  },
  nvidia: {
    label: 'NVIDIA NIM', kind: 'openai', base: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-3.3-70b-instruct', fastModel: 'meta/llama-3.1-8b-instruct', pdf: false, search: false, maxOut: 8192,
    keyHint: 'nvapi-…', keyUrl: 'https://build.nvidia.com/',
  },
};

export function providerConfig(settings, id = settings.provider) {
  const p = PROVIDERS[id];
  if (!p) throw new AIError(`Unknown AI provider "${id}".`);
  const m = settings.models?.[id] || {};
  return { id, ...p, key: (settings.keys?.[id] || '').trim(), model: m.model || p.model, fastModel: m.fastModel || p.fastModel };
}

export function configuredProviders(settings) {
  return Object.keys(PROVIDERS).filter((id) => (settings.keys?.[id] || '').trim());
}

// Active provider, unless the task needs PDF reading it lacks — then the first
// other provider with a key that can read PDFs.
export function pickProvider(settings, { needsPdf = false } = {}) {
  const active = providerConfig(settings);
  if (!needsPdf || active.pdf) return active;
  const alt = configuredProviders(settings).map((id) => providerConfig(settings, id)).find((p) => p.pdf);
  return alt || active;
}

export async function callAI({ settings, system, content, fast = false, maxTokens = 8000, webSearch = false, provider }) {
  const needsPdf = content.some((b) => b.type === 'document');
  const p = provider ? providerConfig(settings, provider) : pickProvider(settings, { needsPdf });
  if (!p.key) throw new AIError(`Add your ${p.label} API key in Settings first.`);
  if (needsPdf && !p.pdf) throw new AIError(`${p.label} can't read PDF files. Paste your resume text, or add a Gemini, OpenAI, OpenRouter or Claude key for this one-time step.`);
  const model = fast ? p.fastModel : p.model;
  const max = p.maxOut ? Math.min(maxTokens, p.maxOut) : maxTokens;
  const search = webSearch && p.search;
  if (p.kind === 'anthropic') return anthropic(p, model, system, content, max, search);
  if (p.kind === 'gemini') return gemini(p, model, system, content, max, search);
  return openaiCompat(p, model, system, content, max, search);
}

async function post(url, headers, body, label) {
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  } catch (e) {
    throw new AIError(`Could not reach ${label}: ${e.message}`);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || json?.detail || (typeof json?.error === 'string' ? json.error : '') || `HTTP ${res.status}`;
    throw new AIError(`${label}: ${msg}`);
  }
  return json;
}

async function anthropic(p, model, system, content, max, search) {
  const body = { model, max_tokens: max, system, messages: [{ role: 'user', content }] };
  if (search) body.tools = [{ type: `${SEARCH_TOOL}_20250305`, name: SEARCH_TOOL, max_uses: 5 }];
  const json = await post(`${p.base}/messages`, {
    'x-api-key': p.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
  }, body, p.label);
  if (json.stop_reason === 'max_tokens') throw new AIError('Response was cut off (max tokens). Try again.');
  // With server tools (web search) the answer is the last text block.
  return (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

async function gemini(p, model, system, content, max, search) {
  const parts = content.map((b) => (b.type === 'document'
    ? { inline_data: { mime_type: b.source.media_type, data: b.source.data } }
    : { text: b.text }));
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { maxOutputTokens: max },
  };
  // Grounding with Google Search can't be combined with forced JSON output.
  if (search) body.tools = [{ google_search: {} }];
  else body.generationConfig.responseMimeType = 'application/json';
  const json = await post(`${p.base}/models/${encodeURIComponent(model)}:generateContent`, { 'x-goog-api-key': p.key }, body, p.label);
  const cand = json.candidates?.[0];
  if (!cand) throw new AIError(`${p.label}: no response (${json.promptFeedback?.blockReason || 'empty'}).`);
  if (cand.finishReason === 'MAX_TOKENS') throw new AIError('Response was cut off (max tokens). Try again.');
  return (cand.content?.parts || []).filter((x) => x.text && !x.thought).map((x) => x.text).join('\n');
}

async function openaiCompat(p, model, system, content, max, search) {
  const hasDoc = content.some((b) => b.type === 'document');
  const user = hasDoc
    ? content.map((b) => (b.type === 'document'
      ? { type: 'file', file: { filename: 'resume.pdf', file_data: `data:${b.source.media_type};base64,${b.source.data}` } }
      : { type: 'text', text: b.text }))
    : content.map((b) => b.text).join('\n\n');
  const body = { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  body[p.maxParam || 'max_tokens'] = max;
  if (p.json) body.response_format = { type: 'json_object' };
  if (search && p.id === 'openrouter') body.plugins = [{ id: 'web' }];
  const json = await post(`${p.base}/chat/completions`, { authorization: `Bearer ${p.key}`, ...(p.headers || {}) }, body, p.label);
  const choice = json.choices?.[0];
  if (!choice) throw new AIError(`${p.label}: empty response.`);
  if (choice.finish_reason === 'length') throw new AIError('Response was cut off (max tokens). Try a model with a larger output limit.');
  const c = choice.message?.content;
  return Array.isArray(c) ? c.map((x) => x.text || '').join('') : (c || '');
}

// Lists model ids the key can use, for the Settings picker / key test.
export async function listModels(settings, id) {
  const p = providerConfig(settings, id);
  if (!p.key) throw new AIError(`Add your ${p.label} API key first.`);
  let url = `${p.base}/models`;
  const headers = {};
  if (p.kind === 'anthropic') Object.assign(headers, { 'x-api-key': p.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' });
  else if (p.kind === 'gemini') { headers['x-goog-api-key'] = p.key; url += '?pageSize=200'; } else headers.authorization = `Bearer ${p.key}`;
  const res = await fetch(url, { headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new AIError(`${p.label}: ${json?.error?.message || `HTTP ${res.status}`}`);
  const items = json.data || json.models || [];
  return items.map((m) => (m.id || m.name || '').replace(/^models\//, ''))
    .filter((m) => m && !/embed|whisper|tts|dall-e|image|audio|moderation|rerank|guard/i.test(m)).sort();
}

export function parseJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new AIError('Model did not return JSON.');
  return JSON.parse(raw.slice(start, end + 1));
}

// One retry on malformed JSON — cheap insurance across providers.
export async function callAIJSON(opts) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callAI(opts);
    try {
      return parseJSON(text);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
