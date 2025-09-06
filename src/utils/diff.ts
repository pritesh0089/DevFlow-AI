import { TSBComponent } from "./types.js";

export type SchemaDiff = {
  added: string[];
  removed: string[];
  changed: Array<{
    field: string;
    oldType: string;
    newType: string;
    breaking: boolean;
  }>;
  hasBreakingChanges: boolean;
};

/**
 * Compares two component schemas and returns a diff summary
 * @param oldComponent - Existing component from Storyblok
 * @param newComponent - New component definition
 * @returns Schema diff with breaking change detection
 */
export function diffComponentSchema(oldComponent: any, newComponent: TSBComponent): SchemaDiff {
  const oldSchema = oldComponent?.schema || {};
  const newSchema = newComponent.schema || {};
  
  const oldFields = new Set(Object.keys(oldSchema));
  const newFields = new Set(Object.keys(newSchema));
  
  const added = [...newFields].filter(f => !oldFields.has(f));
  const removed = [...oldFields].filter(f => !newFields.has(f));
  const changed: SchemaDiff['changed'] = [];
  
  // Check for type changes in common fields
  for (const field of [...oldFields].filter(f => newFields.has(f))) {
    const oldType = oldSchema[field]?.type;
    const newType = newSchema[field]?.type;
    
    if (oldType !== newType) {
      const breaking = isBreakingTypeChange(oldType, newType);
      changed.push({
        field,
        oldType,
        newType,
        breaking
      });
    }
  }
  
  const hasBreakingChanges = removed.length > 0 || changed.some(c => c.breaking);
  
  return {
    added,
    removed,
    changed,
    hasBreakingChanges
  };
}

/**
 * Determines if a field type change is breaking
 * @param oldType - Previous field type
 * @param newType - New field type
 * @returns True if the change could break existing content
 */
function isBreakingTypeChange(oldType: string, newType: string): boolean {
  if (oldType === newType) return false;
  
  // Non-breaking changes (safe upgrades)
  const safeUpgrades: Record<string, string[]> = {
    'text': ['textarea', 'richtext', 'markdown'], // text can be upgraded to longer formats
    'textarea': ['richtext', 'markdown'], // textarea can be upgraded to rich formats
    'asset': ['multiasset'], // single asset can become multiple
    'option': ['options'] // single option can become multiple
  };
  
  return !(safeUpgrades[oldType]?.includes(newType));
}

/**
 * Formats a schema diff into a human-readable summary
 * @param diff - Schema diff object
 * @returns Formatted diff summary string
 */
export function formatSchemaDiff(diff: SchemaDiff): string {
  const parts: string[] = [];
  
  if (diff.added.length > 0) {
    parts.push(`+ Added fields: ${diff.added.join(', ')}`);
  }
  
  if (diff.removed.length > 0) {
    parts.push(`- Removed fields: ${diff.removed.join(', ')} [BREAKING]`);
  }
  
  if (diff.changed.length > 0) {
    const typeChanges = diff.changed.map(c => 
      `${c.field}: ${c.oldType} → ${c.newType}${c.breaking ? ' [BREAKING]' : ''}`
    );
    parts.push(`~ Changed types: ${typeChanges.join(', ')}`);
  }
  
  return parts.length > 0 ? parts.join('\n') : 'No changes';
}