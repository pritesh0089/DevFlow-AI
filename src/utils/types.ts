import { z } from 'zod';

// Canonical Storyblok field types
const FieldType = z.enum([
  'bloks',
  'text',
  'textarea', 
  'richtext',
  'markdown',
  'number',
  'datetime',
  'boolean',
  'option',
  'options',
  'asset',
  'multiasset',
  'multilink',
  'table',
  'section',
  'custom'
]);

export const SBField = z.object({
  type: FieldType,
  display_name: z.string().optional(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  options: z.record(z.any()).optional(),
  default_value: z.any().optional(),
  // Bloks-specific fields
  restrict_type: z.string().optional(),
  component_whitelist: z.array(z.string()).optional()
}).strip(); // strip unknowns at field level

export const SBComponent = z.object({
  name: z.string(),
  display_name: z.string().nullable().optional(),
  is_root: z.boolean().optional().default(false),
  is_nestable: z.boolean().optional().default(true),
  schema: z.record(SBField)
}).strip(); // ⬅️ strip unknown top-level keys like "is"

export type TSBField = z.infer<typeof SBField>;
export type TSBComponent = z.infer<typeof SBComponent>;
