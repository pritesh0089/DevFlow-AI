// src/commands/fix-types.ts
import inquirer from "inquirer";
import ora from "ora";
import { loadConfig } from "../utils/config.js";
import { getComponents, updateComponent } from "../services/storyblok.js";
import { normalizeComponent } from "../utils/normalize.js";
import { diffComponentSchema, formatSchemaDiff } from "../utils/diff.js";

/**
 * Fixes field types in existing components by applying normalization
 */
export async function fixTypesCmd(opts: { dryRun?: boolean } = {}) {
  const cfg = loadConfig();
  
  const answers = await inquirer.prompt([
    {
      name: "storyblokToken",
      message: "Storyblok Personal Access Token:",
      default: cfg.STORYBLOK_TOKEN,
      mask: "*",
    },
    {
      name: "spaceId",
      message: "Space ID to fix types in:",
      validate: (input) => input ? true : "Space ID is required"
    },
    {
      name: "dryRun",
      type: "confirm",
      message: "Dry run only (show changes without applying)?",
      default: true,
      when: () => opts.dryRun === undefined
    }
  ]);

  const token = answers.storyblokToken;
  const spaceId = answers.spaceId;
  const dryRun = opts.dryRun !== undefined ? opts.dryRun : answers.dryRun;

  // Fetch all components
  const spinner = ora("Fetching existing components...").start();
  let components: any[];
  
  try {
    components = await getComponents(token, spaceId);
    spinner.succeed(`Found ${components.length} components`);
  } catch (e: any) {
    spinner.fail("Failed to fetch components");
    console.error(e?.message || e);
    return;
  }

  if (components.length === 0) {
    console.log("No components found in this space.");
    return;
  }

  // Analyze each component for type fixes
  const fixes: Array<{
    component: any;
    normalized: any;
    diff: any;
  }> = [];

  console.log("\nAnalyzing components for type fixes...\n");

  for (const component of components) {
    try {
      // Apply normalization to see what would change
      const normalized = normalizeComponent({
        name: component.name,
        display_name: component.display_name,
        is_root: component.is_root,
        is_nestable: component.is_nestable,
        schema: component.schema
      });

      // Calculate diff
      const diff = diffComponentSchema(component, normalized);
      
      if (diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0) {
        fixes.push({ component, normalized, diff });
        
        console.log(`📦 ${component.name}:`);
        console.log(`   ${formatSchemaDiff(diff)}`);
        if (diff.hasBreakingChanges) {
          console.log(`   ⚠️  Contains BREAKING changes`);
        }
        console.log();
      }
    } catch (e: any) {
      console.log(`❌ ${component.name}: Failed to normalize (${e.message})`);
    }
  }

  if (fixes.length === 0) {
    console.log("✅ All components already use canonical field types. No fixes needed.");
    return;
  }

  console.log(`\nFound ${fixes.length} components that need type fixes.`);
  
  const breakingCount = fixes.filter(f => f.diff.hasBreakingChanges).length;
  if (breakingCount > 0) {
    console.log(`⚠️  ${breakingCount} component(s) have BREAKING changes.`);
  }

  if (dryRun) {
    console.log("\n🔍 Dry run complete. Use --no-dry-run to apply these changes.");
    return;
  }

  // Confirm before applying
  const { proceed } = await inquirer.prompt([
    {
      name: "proceed",
      type: "confirm",
      message: `Apply type fixes to ${fixes.length} component(s)?`,
      default: false
    }
  ]);

  if (!proceed) {
    console.log("❌ Cancelled. No changes applied.");
    return;
  }

  // Apply fixes
  let successCount = 0;
  let failCount = 0;

  for (const fix of fixes) {
    const s = ora(`Fixing ${fix.component.name}...`).start();
    
    try {
      await updateComponent(token, spaceId, fix.component.id, fix.normalized);
      s.succeed(`Fixed: ${fix.component.name}`);
      successCount++;
    } catch (e: any) {
      s.fail(`Failed: ${fix.component.name}`);
      console.error(`   Error: ${e?.message || e}`);
      failCount++;
    }
  }

  console.log(`\n✅ Type fixes complete!`);
  console.log(`   Success: ${successCount}`);
  if (failCount > 0) {
    console.log(`   Failed: ${failCount}`);
  }
}