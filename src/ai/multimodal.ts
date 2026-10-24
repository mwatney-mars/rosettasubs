import { AIProviderName, SrtCue } from '../types';
import { getLanguageName } from '../languages';
import { normalizeToSrt, parseSrt, serializeSrt } from '../subtitleConverter';
import { subtitleContentCache } from '../cache';

export interface TranslateOptions {
  srtContent: string;
  fromLang: string;
  toLang: string;
  aiProvider: AIProviderName;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  batchSize?: number;
}

export interface MultimodalTranscribeOptions {
  mediaBase64: string;
  mimeType: string;
  targetLang: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

interface CueBatchItem {
  i: number;
  t: string;
}

async function callGeminiEndpoint(
  prompt: string,
  apiKey: string,
  model: string,
  baseUrl: string
): Promise<Response> {
  const url = `${baseUrl.replace(/\/+$/, '')}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const generationConfig: Record<string, unknown> = {
    temperature: 0.1,
    responseMimeType: 'application/json'
  };
  if (model.includes('2.5')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig
    })
  });
}

async function callGeminiJson(
  prompt: string,
  apiKey: string,
  model = 'gemini-2.0-flash',
  baseUrl?: string
): Promise<string> {
  const candidateEndpoints = baseUrl
    ? [{ url: baseUrl, model }]
    : apiKey.startsWith('AQ.')
      ? [
          {
            url: 'https://aiplatform.googleapis.com/v1/publishers/google',
            model: model === 'gemini-2.0-flash' ? 'gemini-2.5-flash' : model
          },
          { url: 'https://generativelanguage.googleapis.com/v1beta', model }
        ]
      : [{ url: 'https://generativelanguage.googleapis.com/v1beta', model }];

  let lastStatus = 500;
  let lastErrText = '';

  for (const candidate of candidateEndpoints) {
    const res = await callGeminiEndpoint(prompt, apiKey, candidate.model, candidate.url);
    if (res.ok) {
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    }
    lastStatus = res.status;
    lastErrText = await res.text().catch(() => '');
  }

  throw new Error(`Gemini API error (${lastStatus}): ${lastErrText.slice(0, 800)}`);
}

async function callOpenAiJson(
  prompt: string,
  apiKey: string,
  model = 'gpt-4o-mini',
  baseUrl = 'https://api.openai.com/v1'
): Promise<string> {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a professional subtitle translator. Always respond with valid JSON only.'
        },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content || '[]';
}

function parseJsonBatchResponse(rawText: string): CueBatchItem[] {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as CueBatchItem[];
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      'items' in parsed &&
      Array.isArray((parsed as { items: unknown }).items)
    ) {
      return (parsed as { items: CueBatchItem[] }).items;
    }
  } catch {
    const recovered: CueBatchItem[] = [];
    const itemRe = /\{\s*"i"\s*:\s*(\d+)\s*,\s*"t"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
    let match: RegExpExecArray | null;
    while ((match = itemRe.exec(cleaned)) !== null) {
      try {
        recovered.push({
          i: Number(match[1]),
          t: JSON.parse(`"${match[2]}"`) as string
        });
      } catch {
        // ignore unparseable cue fragment
      }
    }
    if (recovered.length > 0) {
      return recovered;
    }
  }
  return [];
}

async function translateBatch(
  batch: SrtCue[],
  fromLangName: string,
  toLangName: string,
  options: TranslateOptions
): Promise<Map<number, string>> {
  const payload: CueBatchItem[] = batch.map((c) => ({ i: c.index, t: c.text }));
  const prompt = [
    `Translate the following subtitle dialogue lines from ${fromLangName} to ${toLangName}.`,
    'Preserve line breaks (\\n), speaker tags, italics tags (<i>...</i>), and natural conversational tone.',
    'Return ONLY a JSON array of objects with the exact same "i" (index) and translated "t" (text):',
    '[{"i": 1, "t": "..."}]',
    '',
    JSON.stringify(payload)
  ].join('\n');

  const apiKey =
    options.apiKey ||
    (options.aiProvider === 'openai'
      ? process.env.OPENAI_API_KEY
      : process.env.GEMINI_API_KEY);

  if (!apiKey) {
    throw new Error(`Missing API key for AI provider: ${options.aiProvider}`);
  }

  const rawJson =
    options.aiProvider === 'openai'
      ? await callOpenAiJson(
          prompt,
          apiKey,
          options.model || 'gpt-4o-mini',
          options.baseUrl || 'https://api.openai.com/v1'
        )
      : await callGeminiJson(
          prompt,
          apiKey,
          options.model || 'gemini-2.0-flash',
          options.baseUrl
        );

  const items = parseJsonBatchResponse(rawJson);
  const map = new Map<number, string>();
  for (const item of items) {
    if (typeof item.i === 'number' && typeof item.t === 'string') {
      map.set(item.i, item.t);
    }
  }
  return map;
}

export async function translateSrtContent(options: TranslateOptions): Promise<string> {
  const cues = parseSrt(options.srtContent);
  if (cues.length === 0) return options.srtContent;

  const fromName = getLanguageName(options.fromLang);
  const toName = getLanguageName(options.toLang);
  const batchSize = options.batchSize ?? 90;

  const batches: SrtCue[][] = [];
  for (let i = 0; i < cues.length; i += batchSize) {
    batches.push(cues.slice(i, i + batchSize));
  }

  const translatedMap = new Map<number, string>();
  const concurrency = 16;
  let firstError: Error | undefined;
  let succeededBatches = 0;

  for (let i = 0; i < batches.length; i += concurrency) {
    const slice = batches.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      slice.map((batch) => translateBatch(batch, fromName, toName, options))
    );
    for (const res of settled) {
      if (res.status === 'fulfilled') {
        succeededBatches++;
        for (const [idx, text] of res.value.entries()) {
          translatedMap.set(idx, text);
        }
      } else if (!firstError) {
        firstError = res.reason instanceof Error ? res.reason : new Error(String(res.reason));
      }
    }
    if (succeededBatches === 0 && firstError) {
      throw firstError;
    }
  }

  const translatedCues: SrtCue[] = cues.map((cue) => ({
    ...cue,
    text: translatedMap.get(cue.index) || cue.text
  }));

  return serializeSrt(translatedCues);
}

async function annotateBatch(
  batch: SrtCue[],
  fromLangName: string,
  toLangName: string,
  options: TranslateOptions
): Promise<Map<number, string>> {
  const payload: CueBatchItem[] = batch.map((c) => ({ i: c.index, t: c.text }));
  const prompt = [
    `Analyze the following ${fromLangName} subtitle lines for a language learner whose native language is ${toLangName}.`,
    `For lines containing B2/C1 slang, idioms, or non-literal expressions, append a short inline note at the end in brackets: " [term: ${toLangName} meaning]".`,
    'Omit lines that do not contain B2/C1 idioms or slang.',
    'Return ONLY a JSON array of objects for the annotated lines: [{"i": 1, "t": "original text [idiom: meaning]"}]',
    '',
    JSON.stringify(payload)
  ].join('\n');

  const apiKey =
    options.apiKey ||
    (options.aiProvider === 'openai'
      ? process.env.OPENAI_API_KEY
      : process.env.GEMINI_API_KEY);

  if (!apiKey) {
    throw new Error(`Missing API key for AI provider: ${options.aiProvider}`);
  }

  const rawJson =
    options.aiProvider === 'openai'
      ? await callOpenAiJson(
          prompt,
          apiKey,
          options.model || 'gpt-4o-mini',
          options.baseUrl || 'https://api.openai.com/v1'
        )
      : await callGeminiJson(
          prompt,
          apiKey,
          options.model || 'gemini-2.0-flash',
          options.baseUrl
        );

  const items = parseJsonBatchResponse(rawJson);
  const map = new Map<number, string>();
  for (const item of items) {
    if (typeof item.i === 'number' && typeof item.t === 'string') {
      map.set(item.i, item.t);
    }
  }
  return map;
}

export async function annotateSrtIdioms(options: TranslateOptions): Promise<string> {
  const cues = parseSrt(options.srtContent);
  if (cues.length === 0) return options.srtContent;

  const fromName = getLanguageName(options.fromLang);
  const toName = getLanguageName(options.toLang);
  const batchSize = options.batchSize ?? 250;

  const batches: SrtCue[][] = [];
  for (let i = 0; i < cues.length; i += batchSize) {
    batches.push(cues.slice(i, i + batchSize));
  }

  const annotatedMap = new Map<number, string>();
  const concurrency = 8;

  for (let i = 0; i < batches.length; i += concurrency) {
    const slice = batches.slice(i, i + concurrency);
    const results = await Promise.all(
      slice.map((batch) => annotateBatch(batch, fromName, toName, options))
    );
    for (const batchMap of results) {
      for (const [idx, text] of batchMap.entries()) {
        annotatedMap.set(idx, text);
      }
    }
  }

  const annotatedCues: SrtCue[] = cues.map((cue) => ({
    ...cue,
    text: annotatedMap.get(cue.index) || cue.text
  }));

  return serializeSrt(annotatedCues);
}

export async function transcribeMediaToSrt(
  options: MultimodalTranscribeOptions
): Promise<string> {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing Gemini API key for multimodal audio/video transcription');
  }

  const targetName = getLanguageName(options.targetLang);
  const model = options.model || 'gemini-2.5-flash';
  const baseUrl = (
    options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
  ).replace(/\/+$/, '');

  const cacheKey = `mm:${model}:${options.targetLang}:${options.mediaBase64.slice(0, 64)}:${options.mediaBase64.length}`;
  const cached = subtitleContentCache.get(cacheKey);
  if (cached) return cached;

  const prompt = [
    `Listen to this media clip and generate accurate SubRip (.srt) subtitles in ${targetName}.`,
    'Use standard SRT format with sequential numbering and HH:MM:SS,mmm --> HH:MM:SS,mmm timestamps.',
    'Output ONLY the raw .srt content without markdown code blocks.'
  ].join('\n');

  const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: options.mimeType,
                data: options.mediaBase64
              }
            },
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini multimodal transcription error (${res.status}): ${errText.slice(0, 800)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const rawText = (data.candidates?.[0]?.content?.parts?.[0]?.text || '')
    .replace(/^```(?:srt)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const normalized = normalizeToSrt(rawText, 'srt');
  if (normalized.trim()) {
    subtitleContentCache.set(cacheKey, normalized);
  }
  return normalized;
}
