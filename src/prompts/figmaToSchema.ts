export const FIGMA_TO_SCHEMA = (nodesJson: string) => `
You are given Figma nodes (minified JSON). Identify logical components (Hero, Card, FeatureGrid, TestimonialSlider).
Map layers to Storyblok fields using rules:
- TEXT → text or textarea
- IMAGE fills → image
- FRAME/AUTO_LAYOUT with repeated similar children → bloks (repeatable)
Output an array of components as strict JSON (same shape as TEXT_TO_SCHEMA). Input:
${nodesJson}
`;