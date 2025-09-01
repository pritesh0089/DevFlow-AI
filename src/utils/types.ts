import { z } from 'zod';


export const SBField = z.object({
name: z.string(),
type: z.enum([
'text', 'textarea', 'richtext', 'image', 'number', 'boolean', 'bloks', 'options', 'multilink'
]),
description: z.string().optional(),
required: z.boolean().optional(),
options: z.record(z.any()).optional()
});


export const SBComponent = z.object({
name: z.string(),
display_name: z.string().nullable().optional(),
is_root: z.boolean().default(false),
is_nestable: z.boolean().default(true),
schema: z.record(SBField)
});


export type TSBField = z.infer<typeof SBField>;
export type TSBComponent = z.infer<typeof SBComponent>;