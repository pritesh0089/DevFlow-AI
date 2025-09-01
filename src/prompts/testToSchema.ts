export const TEXT_TO_SCHEMA = (description: string) => `
Given this component description:
"""
${description}
"""
Produce an array of Storyblok components in JSON. Example shape:
[
{
"name": "hero",
"display_name": "Hero",
"is_root": false,
"is_nestable": true,
"schema": {
"title": { "type": "text", "description": "Hero title" },
"subtitle": { "type": "textarea" },
"image": { "type": "image" },
"cta": { "type": "multilink" }
}
}
]
Return ONLY JSON.`;