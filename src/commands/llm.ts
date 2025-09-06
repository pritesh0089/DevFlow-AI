// src/commands/llm.ts
import inquirer from "inquirer";
import ora from "ora";
import { loadConfig, saveConfig } from "../utils/config.js";
import { DEFAULTS, LLMConfig, normalizeProvider, llmJSON, parseJSONLoose } from "../services/llm.js";
import { SYSTEM } from "../prompts/system.js";

export async function llmSelectCmd() {
  const cfg = loadConfig();

  const { provider } = await inquirer.prompt([{
    name: "provider",
    type: "list",
    message: "Choose an LLM provider",
    choices: [
      { name: "OpenAI", value: "openai" },
      { name: "OpenRouter", value: "openrouter" },
      { name: "Together.ai", value: "together" },
      { name: "Groq (OpenAI-compatible)", value: "groq" },
      { name: "Mistral", value: "mistral" },
      { name: "DeepInfra", value: "deepinfra" },
      { name: "Fireworks", value: "fireworks" },
      { name: "Perplexity", value: "perplexity" },
      { name: "Anthropic (Claude)", value: "anthropic" },
      { name: "Google Gemini", value: "gemini" },
      { name: "Ollama (local)", value: "ollama" },
      new inquirer.Separator(),
      { name: "Custom (OpenAI-compatible base URL)", value: "custom-openai" },
    ]
  }]);

  const p = normalizeProvider(provider);
  const defaults = DEFAULTS[p];

  const questions: any[] = [];
  if (p !== "ollama") {
    questions.push({ name: "apiKey", message: "API key:", default: cfg.LLM_API_KEY, mask: "*" });
  }
  if (p === "custom-openai") {
    questions.push({ name: "baseURL", message: "Base URL (e.g. https://your-host/v1):", default: cfg.LLM_BASE_URL });
  } else if (defaults?.baseURL) {
    questions.push({ name: "baseURL", message: "Base URL:", default: defaults.baseURL });
  }
  questions.push({ name: "model", message: "Model id:", default: cfg.LLM_MODEL || defaults?.model });

  const ans = await inquirer.prompt(questions);

  const toSave: any = {
    LLM_PROVIDER: p,
    LLM_API_KEY: ans.apiKey || cfg.LLM_API_KEY,
    LLM_BASE_URL: ans.baseURL || defaults?.baseURL || cfg.LLM_BASE_URL,
    LLM_MODEL: ans.model || cfg.LLM_MODEL || defaults?.model
  };
  saveConfig(toSave);

  console.log("\nLLM provider saved.\nYou can run `devflow-ai llm test` to verify.\n");
}

export async function llmTestCmd() {
  const cfgRaw = loadConfig();
  const cfg: LLMConfig = {
    provider: normalizeProvider(cfgRaw.LLM_PROVIDER || "openai"),
    apiKey: cfgRaw.LLM_API_KEY,
    baseURL: cfgRaw.LLM_BASE_URL || DEFAULTS[cfgRaw.LLM_PROVIDER || "openai"].baseURL,
    model: cfgRaw.LLM_MODEL || DEFAULTS[cfgRaw.LLM_PROVIDER || "openai"].model
  };

  const spinner = ora(`Testing ${cfg.provider} (${cfg.model})…`).start();
  try {
    const json = await llmJSON(
      cfg,
      SYSTEM,
      "Hero with title and image. Return JSON array of Storyblok components."
    );
    const arr = parseJSONLoose(json);
    spinner.succeed(`OK. Received ${arr.length} component(s).`);
    console.log(JSON.stringify(arr.slice(0, 1), null, 2));
  } catch (e: any) {
    spinner.fail("LLM test failed.");
    console.error(e?.message || e);
  }
}
