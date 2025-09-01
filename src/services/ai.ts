import OpenAI from 'openai';
import { z } from 'zod';
import { SBComponent } from '../utils/types.js';
import { SYSTEM } from '../prompts/system.js';


const ArrayOfComponents = z.array(SBComponent);


export async function textToComponents(apiKey: string, description: string, model = process.env.DF_OPENAI_MODEL || 'gpt-4.1') {
const openai = new OpenAI({ apiKey });
const user = description;
const res = await openai.chat.completions.create({
model,
messages: [ { role: 'system', content: SYSTEM }, { role: 'user', content: user } ],
response_format: { type: 'json_object' }
});
const content = res.choices[0]?.message?.content || '[]';
const parsed = JSON.parse(content);
// If model returns a single object, wrap in array
const arrayish = Array.isArray(parsed) ? parsed : [parsed];
return ArrayOfComponents.parse(arrayish);
}