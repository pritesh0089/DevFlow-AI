#!/usr/bin/env node
import { Command } from "commander";
import { initCmd } from "../commands/init.js";
import { syncFigmaCmd } from "../commands/sync-figma.js";
import { llmSelectCmd, llmTestCmd } from "../commands/llm.js";
import { fixTypesCmd } from "../commands/fix-types.js";

const program = new Command();
program.name("devflow-ai")
  .description("AI-assisted Storyblok CLI: init projects, generate components from text/designs")
  .version("0.1.0");

program.command("init")
  .description("Create a space and components from a sentence")
  .option("--offline", "Generate schemas without calling any AI API")
  .action((opts) => initCmd(opts));

program.command("sync-figma")
  .description("Generate components from a Figma file")
  .action(syncFigmaCmd);

program.command("llm")
  .description("Configure and test your LLM provider")
  .command("select").description("Choose provider and set credentials").action(llmSelectCmd).parent!
  .command("test").description("Verify provider works").action(llmTestCmd);

program.command("fix-types")
  .description("Upgrade existing component field types (image/file→asset, etc.)")
  .option("--dry-run", "Show changes without applying them", true)
  .option("--no-dry-run", "Apply changes immediately")
  .action((opts) => fixTypesCmd(opts));

program.parseAsync();
