// src/services/llm.ts
import OpenAI from "openai";

// Dynamic imports (loaded only if chosen)
async function loadAnthropic() { return (await import("@anthropic-ai/sdk")).default; }
async function loadGemini() { return (await import("@google/generative-ai")).GoogleGenerativeAI; }

export type LLMProvider =
  | "openai" | "openrouter" | "together" | "groq" | "mistral" | "deepinfra" | "fireworks" | "perplexity"
  | "anthropic" | "gemini" | "ollama"
  | "custom-openai";

export type LLMConfig = {
  provider: LLMProvider;
  apiKey?: string;          // not needed for ollama
  baseURL?: string;         // custom / openai-compatible providers
  model?: string;           // provider model id
};

export const DEFAULTS: Record<string, Partial<LLMConfig>> = {
  openai:       { baseURL: "https://api.openai.com/v1",             model: "gpt-4o-mini" },
  openrouter:   { baseURL: "https://openrouter.ai/api/v1",          model: "gpt-oss-120b" },
  together:     { baseURL: "https://api.together.xyz/v1",           model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo" },
  groq:         { baseURL: "https://api.groq.com/openai/v1",        model: "llama-3.1-70b-versatile" },
  mistral:      { baseURL: "https://api.mistral.ai/v1",             model: "mistral-large-latest" },
  deepinfra:    { baseURL: "https://api.deepinfra.com/v1/openai",   model: "meta-llama/Meta-Llama-3.1-70B-Instruct" },
  fireworks:    { baseURL: "https://api.fireworks.ai/inference/v1", model: "accounts/fireworks/models/llama-v3p1-70b-instruct" },
  perplexity:   { baseURL: "https://api.perplexity.ai",             model: "llama-3.1-70b-instruct" },
  anthropic:    {                                                /* uses its own SDK */   model: "claude-3-5-sonnet-latest" },
  gemini:       {                                                /* uses its own SDK */   model: "gemini-1.5-pro" },
  ollama:       { baseURL: "http://localhost:11434",               model: "llama3.1" },
  "custom-openai": { /* user supplies baseURL+model */ }
};

// -------------- helpers ----------------

/**
 * Attempts to fix common JSON syntax errors
 */
function tryFixJSON(jsonStr: string): string {
  return jsonStr
    .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3') // Fix unquoted keys: {name: -> {"name":
    .replace(/:\s*'([^']*)'/g, ': "$1"') // Fix single quotes: 'value' -> "value"
    .replace(/,\s*}/g, '}') // Remove trailing commas: {a: 1,} -> {a: 1}
    .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
    .replace(/([^"\\])\n/g, '$1') // Remove unescaped newlines
    .replace(/\t/g, ' '); // Replace tabs with spaces
}

function extractJSON(text: string): string {
  if (!text) throw new Error("Empty LLM response");
  
  // Try to find JSON array first
  let a = text.indexOf("[");
  let b = text.lastIndexOf("]");
  if (a !== -1 && b > a) {
    return text.slice(a, b + 1);
  }
  
  // Try to find JSON object
  let i = text.indexOf("{");
  let j = text.lastIndexOf("}");
  if (i !== -1 && j > i) {
    return text.slice(i, j + 1);
  }
  
  throw new Error("No JSON found in LLM response");
}

// OpenAI-compatible (OpenAI, OpenRouter, Together, Groq, Mistral, DeepInfra, Fireworks, Perplexity, Custom)
async function chatOpenAICompat(cfg: LLMConfig, system: string, user: string): Promise<string> {
  if (!cfg.apiKey) throw new Error("Missing API key");
  const headers: Record<string, string> = {};
  if ((cfg.baseURL || "").includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "http://localhost";
    headers["X-Title"] = "DevFlow AI";
  }
  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, defaultHeaders: headers });
  const r = await client.chat.completions.create({
    model: cfg.model!,
    temperature: 0,
    messages: [
      { role: "system", content: system + "\nReturn ONLY JSON." },
      { role: "user", content: user }
    ],
  });
  return r.choices?.[0]?.message?.content || "";
}

// Anthropic (native)
async function chatAnthropic(cfg: LLMConfig, system: string, user: string): Promise<string> {
  if (!cfg.apiKey) throw new Error("Missing API key");
  const Anthropic = await loadAnthropic();
  const client = new Anthropic({ apiKey: cfg.apiKey });
  const r = await client.messages.create({
    model: cfg.model!,
    max_tokens: 4000,
    temperature: 0,
    system: system + "\nReturn ONLY JSON.",
    messages: [{ role: "user", content: user }]
  });
  const text = r.content?.[0]?.type === "text" ? r.content[0].text : (r.content as any[]).map((p:any)=>p.text).join("\n");
  return text || "";
}

// Gemini (native)
async function chatGemini(cfg: LLMConfig, system: string, user: string): Promise<string> {
  if (!cfg.apiKey) throw new Error("Missing API key");
  const GoogleGenerativeAI = await loadGemini();
  const genAI = new GoogleGenerativeAI(cfg.apiKey);
  const model = genAI.getGenerativeModel({
    model: cfg.model!,
    systemInstruction: system,
    generationConfig: { responseMimeType: "application/json", temperature: 0 }
  });
  const r = await model.generateContent(user);
  return (await r.response.text()) || "";
}

// Ollama (local http://localhost:11434)
async function chatOllama(cfg: LLMConfig, system: string, user: string): Promise<string> {
  const base = cfg.baseURL || DEFAULTS.ollama.baseURL!;
  const body = {
    model: cfg.model || DEFAULTS.ollama.model,
    stream: false,
    messages: [
      { role: "system", content: system + "\nReturn ONLY JSON." },
      { role: "user", content: user }
    ]
  };
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const j: any = await res.json();
  return j?.message?.content || "";
}

// -------------- public API ----------------

export function normalizeProvider(p: string): LLMProvider {
  const m = p.trim().toLowerCase();
  const known = Object.keys(DEFAULTS);
  const hit = known.find(k => k === m);
  if (!hit) throw new Error(`Unknown provider '${p}'`);
  return hit as LLMProvider;
}

/** Core: returns JSON string produced by the selected provider. */
export async function llmJSON(cfg: LLMConfig, system: string, user: string): Promise<string> {
  switch (cfg.provider) {
    case "openai":
    case "openrouter":
    case "together":
    case "groq":
    case "mistral":
    case "deepinfra":
    case "fireworks":
    case "perplexity":
    case "custom-openai":
      return chatOpenAICompat(cfg, system, user);
    case "anthropic":
      return chatAnthropic(cfg, system, user);
    case "gemini":
      return chatGemini(cfg, system, user);
    case "ollama":
      return chatOllama(cfg, system, user);
    default:
      throw new Error(`Provider not implemented: ${cfg.provider}`);
  }
}

/** Safe JSON → object parse with extraction if providers add prose */
export function parseJSONLoose(text: string) {
  const raw = extractJSON(text);
  
  // Try parsing as-is first
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error1) {
    // Try fixing common JSON issues
    try {
      const fixed = tryFixJSON(raw);
      const parsed = JSON.parse(fixed);
      console.log("⚠️  Fixed malformed JSON from LLM");
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error2) {
      // Log the problematic JSON for debugging
      console.error("❌ Failed to parse LLM JSON response:");
      console.error("Original:", raw.substring(0, 200) + (raw.length > 200 ? "..." : ""));
      console.error("Parse error:", (error1 as Error).message);
      throw new Error(`Invalid JSON from LLM: ${(error1 as Error).message}`);
    }
  }
}
