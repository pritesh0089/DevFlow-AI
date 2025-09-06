// src/commands/init.ts
import inquirer from "inquirer";
import ora from "ora";
import fs from "node:fs/promises";

import { loadConfig, saveConfig } from "../utils/config.js";
import { SYSTEM } from "../prompts/system.js";

import {
  listSpaces,
  createSpace,
  createComponent,
  upsertComponent,
  explainStoryblokWriteError,
} from "../services/storyblok.js";

import { offlineTextToComponents } from "../services/ai_offline.js";
import { llmJSON, parseJSONLoose, DEFAULTS } from "../services/llm.js";
import { diffComponentSchema, formatSchemaDiff } from "../utils/diff.js";

type InitOpts = {
  offline?: boolean;
  noPost?: boolean;
};

type ProviderChoice =
  | "openai" | "openrouter" | "together" | "groq" | "mistral"
  | "deepinfra" | "fireworks" | "perplexity"
  | "anthropic" | "gemini" | "ollama" | "custom-openai";

export async function initCmd(opts: InitOpts = {}) {
  const cfg = loadConfig();

  // -------- Prompts --------
  const answers = await inquirer.prompt([
    { name: "project", message: "Project name:", default: "my-devflow-app" },
    { name: "framework", type: "list", choices: ["Next.js", "Nuxt", "Astro"] },
    {
      name: "storyblokToken",
      message: "Storyblok Personal Access Token:",
      default: cfg.STORYBLOK_TOKEN,
      mask: "*",
    },

    // Always ask provider (no default selection enforced)
    {
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
      ],
    },

    // API key (skip for Ollama; show label with provider)
    {
      name: "llmKey",
      message: (a: any) => `${a.provider} API Key:`,
      default: cfg.LLM_API_KEY,
      mask: "*",
      when: (a: any) => !opts.offline && a.provider !== "ollama",
    },

    // Base URL only for custom-openai
    {
      name: "baseURL",
      message: "Base URL (e.g. https://your-host/v1):",
      when: (a: any) => !opts.offline && a.provider === "custom-openai",
    },

    // Model (ask for all providers so the user can change if needed)
    {
      name: "model",
      message: "Model id:",
      default: (a: any) => {
        const p = (a.provider as ProviderChoice) || "openai";
        return (DEFAULTS[p]?.model) || cfg.LLM_MODEL || "";
      },
      when: (a: any) => !opts.offline,
    },

    { name: "desc", message: "Describe components (one sentence):" },
  ]);

  // Persist tokens for future runs (we do NOT persist provider to avoid “default”)
  const toSave: Record<string, any> = {};
  if (answers.storyblokToken) toSave.STORYBLOK_TOKEN = answers.storyblokToken;
  if (answers.llmKey) toSave.LLM_API_KEY = answers.llmKey;
  if (answers.model) toSave.LLM_MODEL = answers.model; // optional convenience
  saveConfig(toSave);

  const token = answers.storyblokToken as string;

  // -------- Verify Storyblok token --------
  const verify = ora("Verifying Storyblok token…").start();
  let spaces: any[] = [];
  try {
    spaces = await listSpaces(token);
    verify.succeed("Token OK");
  } catch (e: any) {
    verify.fail("Token check failed");
    throw e;
  }

  // -------- Choose space (create or select) --------
  const { action } = await inquirer.prompt([
    {
      name: "action",
      type: "list",
      message: "Create a new space or use existing?",
      choices: ["Create new", "Use existing"],
    },
  ]);

  let spaceId: number | string;

  if (action === "Create new") {
    const { spaceName } = await inquirer.prompt([
      { name: "spaceName", message: "New space name:", default: answers.project },
    ]);
    const s = await createSpace(token, spaceName);
    spaceId = s.id;
  } else {
    if (!Array.isArray(spaces) || spaces.length === 0) {
      throw new Error("No spaces found on your account. Create one first.");
    }
    const { sid } = await inquirer.prompt([
      {
        name: "sid",
        type: "list",
        message: "Choose a space:",
        choices: spaces.map((s: any) => ({
          name: `${s.name} (${s.id})`,
          value: s.id,
        })),
      },
    ]);
    spaceId = sid;
  }

  // -------- Generate components (LLM or offline with fallback) --------
  let components: any[] = [];

  if (opts.offline) {
    const s = ora("Generating offline component schemas…").start();
    components = offlineTextToComponents(answers.desc);
    s.succeed(`Got ${components.length} components (offline)`);
  } else {
    const provider = answers.provider as ProviderChoice;

    // Build provider config from choice + defaults
    const baseURL =
      provider === "custom-openai"
        ? answers.baseURL
        : DEFAULTS[provider]?.baseURL;

    const model =
      answers.model ||
      DEFAULTS[provider]?.model ||
      "gpt-4o-mini"; // final fallback name; rarely used

    const llmCfg = {
      provider,
      apiKey: answers.llmKey as string | undefined, // undefined for ollama
      baseURL,
      model,
    };

    const s = ora(`Asking ${provider} to draft component schemas…`).start();

    try {
      const text = await llmJSON(llmCfg as any, SYSTEM + "\nReturn ONLY JSON.", answers.desc);
      const arr = parseJSONLoose(text);
      components = arr;
      s.succeed(`AI proposed ${components.length} components`);
    } catch (err: any) {
      s.fail("AI schema generation failed");
      console.error(err?.message || err);

      const { continueOffline } = await inquirer.prompt([
        {
          name: "continueOffline",
          type: "confirm",
          message: "Continue offline using the deterministic generator instead?",
          default: true,
        },
      ]);

      if (!continueOffline) throw err;

      const s2 = ora("Generating offline component schemas…").start();
      components = offlineTextToComponents(answers.desc);
      s2.succeed(`Got ${components.length} components (offline)`);
    }
  }

  if (!components || components.length === 0) {
    console.log("No components generated. Nothing to do.");
    return;
  }

  // -------- Create/ensure root page component with restricted bloks --------
  const componentNames = components.map(c => c.name);
  
  // Check if we need a page component
  const hasPageComponent = components.some(c => c.name === 'page' && c.is_root);
  
  if (!hasPageComponent) {
    // Create root page component with body field restricted to generated components
    const pageComponent = {
      name: "page",
      display_name: "Page",
      is_root: true,
      is_nestable: false,
      schema: {
        body: {
          type: "bloks",
          description: "Page content blocks",
          restrict_type: "",
          component_whitelist: componentNames
        }
      }
    };
    
    components.unshift(pageComponent); // Add page as first component
    console.log(`\nAdded root 'page' component with bloks restricted to: ${componentNames.join(', ')}`);
  } else {
    // Update existing page component's bloks restrictions
    const pageComponent = components.find(c => c.name === 'page' && c.is_root);
    if (pageComponent?.schema) {
      for (const [fieldName, field] of Object.entries(pageComponent.schema)) {
        if ((field as any).type === 'bloks') {
          (field as any).restrict_type = "";
          (field as any).component_whitelist = componentNames;
        }
      }
    }
  }

  // -------- Optional: no-post mode (write payload to file) --------
  if (opts.noPost) {
    const outPath = "devflow.generated.components.json";
    await fs.writeFile(
      outPath,
      JSON.stringify({ spaceId, components }, null, 2),
      "utf8"
    );
    console.log(
      `\n[NO-POST] Wrote component payloads to ${outPath}\nEnable a plan/trial in Storyblok and rerun without --no-post to create them.`
    );
    return;
  }

  // -------- Upsert components to Storyblok --------
  let planErrorDetected = false;
  
  for (let i = 0; i < components.length; i++) {
    const c = components[i];
    const s = ora(`Processing component ${c.name}…`).start();
    
    try {
      const result = await upsertComponent(token, spaceId, c);
      
      if (result.action === 'created') {
        s.succeed(`Created: ${c.name}`);
      } else {
        // Show diff for updates
        const diff = diffComponentSchema(result.existingComponent, c);
        const diffSummary = formatSchemaDiff(diff);
        
        if (diffSummary === 'No changes') {
          s.succeed(`${c.name}: No changes`);
        } else {
          s.succeed(`Updated: ${c.name}`);
          console.log(`  ${diffSummary}`);
          
          // Warning for breaking changes
          if (diff.hasBreakingChanges) {
            console.log(`  ⚠️  BREAKING changes detected in ${c.name}`);
          }
        }
      }
    } catch (e: any) {
      const explanation = explainStoryblokWriteError(e);
      s.fail(`Failed: ${c?.name || "(unknown)"}`);
      
      if (explanation.isPlanRequired && !planErrorDetected) {
        planErrorDetected = true;
        console.log(`\n❌ ${explanation.message}\n`);
        
        const { useNoPost } = await inquirer.prompt([
          {
            name: "useNoPost",
            type: "confirm",
            message: "Switch to --no-post mode now (write JSON files instead)?",
            default: true,
          },
        ]);
        
        if (useNoPost) {
          console.log("\n📝 Switching to --no-post mode...\n");
          
          // Write remaining components to file
          const remainingComponents = components.slice(i);
          const outPath = "devflow.generated.components.json";
          await fs.writeFile(
            outPath,
            JSON.stringify({ spaceId, components: remainingComponents }, null, 2),
            "utf8"
          );
          console.log(`✅ Wrote ${remainingComponents.length} component(s) to ${outPath}`);
          console.log(`\nTo use these components:`);
          console.log(`1. Enable a plan in your Storyblok space`);
          console.log(`2. Run: devflow-ai init --offline (will detect and skip existing components)`);
          return;
        }
      }
      
      console.error(explanation.message);
      const { cont } = await inquirer.prompt([
        {
          name: "cont",
          type: "confirm",
          message: "Continue processing remaining components?",
          default: !explanation.isPlanRequired,
        },
      ]);
      if (!cont) throw e;
    }
  }

  console.log(
    `\nScaffold complete. Open your Storyblok space (${spaceId}) → Components to verify.`
  );
}
