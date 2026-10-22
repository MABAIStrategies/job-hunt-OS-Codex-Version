// Claude Messages API client. BYOK: the user's key goes straight from the
// extension to api.anthropic.com. Swap BASE_URL for your own proxy when you
// move to hosted billing.

const BASE_URL = 'https://api.anthropic.com/v1/messages';

export class AIError extends Error {}

export async function callClaude({ settings, system, content, model, maxTokens = 8000, webSearch = false }) {
  if (!settings.apiKey) throw new AIError('Add your Anthropic API key in Settings first.');
  const body = {
    model: model || settings.model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content }],
  };
  if (webSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }];

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new AIError(json?.error?.message || `Claude API error ${res.status}`);
  if (json.stop_reason === 'max_tokens') throw new AIError('Response was cut off (max tokens). Try again.');
  // With server tools (web search) the answer is the last text block.
  const texts = (json.content || []).filter((b) => b.type === 'text').map((b) => b.text);
  return texts.join('\n');
}

export function parseJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new AIError('Model did not return JSON.');
  return JSON.parse(raw.slice(start, end + 1));
}

// One retry on malformed JSON — cheap insurance.
export async function callClaudeJSON(opts) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callClaude(opts);
    try {
      return parseJSON(text);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
