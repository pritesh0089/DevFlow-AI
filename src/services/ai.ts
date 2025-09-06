// src/services/ai.ts
import OpenAI from 'openai';
import { z } from 'zod';
import { SBComponent } from '../utils/types.js';
import { SYSTEM } from '../prompts/system.js';

const ArrayOfComponents = z.array(SBComponent);

export async function textToComponents(apiKey: string, description: string, model = process.env.DF_OPENAI_MODEL || 'gpt-4.1') {
  const openai = new OpenAI({ apiKey });
  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: description }
    ],
    response_format: { type: 'json_object' }
  });

  const content = res.choices[0]?.message?.content || '[]';
  const parsed = JSON.parse(content);
  const arrayish = Array.isArray(parsed) ? parsed : [parsed];
  return ArrayOfComponents.parse(arrayish);
}

/** Returns true when the error is an OpenAI billing/quota issue. */
export function isQuotaError(err: any): boolean {
  // OpenAI uses 429 for both rate-limit and quota; quota includes code/type "insufficient_quota"
  const code = err?.code || err?.error?.code;
  const type = err?.type || err?.error?.type;
  return err?.status === 429 && (code === 'insufficient_quota' || type === 'insufficient_quota');
}

/** Returns true when it's a 429 not classified as quota (likely rate-limit). */
export function isRateLimitError(err: any): boolean {
  if (isQuotaError(err)) return false;
  return err?.status === 429 || err?.name === 'RateLimitError';
}
