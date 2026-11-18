export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LanguageModel {
  complete(messages: ModelMessage[]): Promise<string>;
}

interface ModelSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const readSettings = (): ModelSettings | null => {
  const apiKey = Deno.env.get('KIKI_LLM_API_KEY')?.trim() ?? '';
  const model = Deno.env.get('KIKI_LLM_MODEL')?.trim() ?? '';
  if (!apiKey || !model) {
    return null;
  }
  const baseUrl = (Deno.env.get('KIKI_LLM_BASE_URL')?.trim() || 'https://api.openai.com/v1').replace(/\/$/, '');
  return { apiKey, baseUrl, model };
};

export const createLanguageModel = (): LanguageModel | null => {
  const settings = readSettings();
  if (!settings) {
    return null;
  }

  return {
    complete: async (messages) => {
      const response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.model,
          temperature: 0,
          messages,
        }),
      });
      if (!response.ok) {
        console.error(JSON.stringify({ event: 'kiki_model_failed', status: response.status }));
        throw new Error('model_request_failed');
      }
      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('model_empty_reply');
      }
      return content;
    },
  };
};

export const readModelObject = (content: string): Record<string, unknown> | null => {
  const fenced = content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(fenced);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};
