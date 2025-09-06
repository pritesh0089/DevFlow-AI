import { SBComponent, TSBComponent } from "./types.js";

const BOOL = (v: any) => v === true || v === 'true' || v === 1 || v === '1';

/**
 * Normalizes field type to canonical Storyblok type with synonym mapping
 * @param t - Raw field type from AI or user input
 * @returns Canonical Storyblok field type
 */
function normalizeFieldType(t: any): string {
  if (!t) return 'text';
  const s = String(t).toLowerCase().replace(/[\s_-]+/g, '');
  
  // Synonym mapping to canonical types
  if (s === 'richtext' || s === 'rich' || s === 'rte') return 'richtext';
  if (s === 'link' || s === 'url' || s === 'href' || s === 'linkurl') return 'multilink';
  if (s === 'date' || s === 'time' || s === 'timestamp' || s === 'dateline') return 'datetime';
  if (s === 'image' || s === 'file' || s === 'picture' || s === 'photo') return 'asset';
  if (s === 'blocks' || s === 'block' || s === 'nested') return 'bloks';
  if (s === 'group' || s === 'fieldset') return 'section';
  if (s === 'dropdown' || s === 'select' || s === 'singleoption') return 'option';
  if (s === 'checkboxes' || s === 'multioptions' || s === 'multichoice') return 'options';
  if (s === 'files' || s === 'images' || s === 'gallery') return 'multiasset';
  if (s === 'references' || s === 'relation' || s === 'ref') return 'multilink'; // Handle as multilink for now
  
  // Return as-is if already canonical, otherwise default to text
  const canonical = ['bloks', 'text', 'textarea', 'richtext', 'markdown', 'number', 'datetime', 'boolean', 'option', 'options', 'asset', 'multiasset', 'multilink', 'table', 'section', 'custom'];
  return canonical.includes(s) ? s : 'text';
}

/**
 * Infers field type from field name patterns
 * @param fieldName - The field name to analyze
 * @param currentType - Current field type (if any)
 * @returns Inferred canonical field type
 */
function inferTypeFromKey(fieldName: string, currentType?: string): string {
  if (!fieldName) return currentType || 'text';
  
  const name = fieldName.toLowerCase();
  
  // DateTime patterns
  if (/^(date|published|created|updated|timestamp|time)(_at|_on)?$/.test(name)) {
    return 'datetime';
  }
  
  // Asset patterns (images, files)
  if (/^(image|avatar|logo|icon|cover|photo|picture|file|attachment|document)(_url|_path)?$/.test(name)) {
    return 'asset';
  }
  
  // Link patterns
  if (/^(url|link|href|website|external)(_link|_url)?$/.test(name)) {
    return 'multilink';
  }
  
  // Rich content patterns
  if (/^(body|content|description|bio|about|rich)(_text|_content)?$/.test(name)) {
    return 'richtext';
  }
  
  // Numeric patterns
  if (/^(count|price|qty|quantity|amount|number|order|sort|weight|height|width)$/.test(name)) {
    return 'number';
  }
  
  // Boolean patterns
  if (/^(is_|has_|enable|active|visible|published|featured)/.test(name) || /^(enabled|active|visible|published|featured)$/.test(name)) {
    return 'boolean';
  }
  
  // Relationship patterns - use multilink for references
  if (/^(author|category|tags|related|items|posts|articles|entries)$/.test(name)) {
    return 'multilink';
  }
  
  return currentType || 'text';
}

export function normalizeComponent(raw: any): TSBComponent {
  const c: any = { ...raw };

  // Aliases → canonical keys
  if (c.displayName && !c.display_name) c.display_name = c.displayName;
  if (c.root !== undefined && c.is_root === undefined) c.is_root = BOOL(c.root);
  if (c.isRoot !== undefined && c.is_root === undefined) c.is_root = BOOL(c.isRoot);
  if (c.nestable !== undefined && c.is_nestable === undefined) c.is_nestable = BOOL(c.nestable);
  if (c.isNestable !== undefined && c.is_nestable === undefined) c.is_nestable = BOOL(c.isNestable);

  // Some models return an "is" object; ignore it
  delete c.is;

  // Ensure name is kebab/underscore safe
  if (typeof c.name === 'string') c.name = c.name.trim().toLowerCase().replace(/\s+/g, '_');

  // Normalize schema with field type inference and canonical mapping
  const schema: Record<string, any> = {};
  for (const [k, v] of Object.entries(c.schema || {})) {
    const field = { ...(v as any) };
    delete (field as any).name; // Storyblok doesn't use inner "name"
    
    // Apply type normalization and inference
    let fieldType = field.type;
    if (fieldType) {
      fieldType = normalizeFieldType(fieldType);
    }
    // Infer type from field name if type is generic or missing
    if (!fieldType || fieldType === 'text') {
      fieldType = inferTypeFromKey(k, fieldType);
    }
    
    field.type = fieldType;
    schema[k] = field;
  }
  c.schema = schema;

  // Final validation + strip of unknown keys
  return SBComponent.parse(c);
}
