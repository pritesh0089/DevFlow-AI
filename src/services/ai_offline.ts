// src/services/ai_offline.ts
import { TSBComponent } from "../utils/types.js";

/**
 * Generates components from text description using deterministic patterns
 * Uses canonical Storyblok field types
 */
export function offlineTextToComponents(desc: string): TSBComponent[] {
  const text = (desc || "").toLowerCase();
  const out: TSBComponent[] = [];

  // BLOG POST
  if (text.includes("blog") || text.includes("post") || text.includes("article")) {
    out.push({
      name: "blog_post",
      display_name: "Blog Post",
      is_root: false,
      is_nestable: true,
      schema: {
        title: { type: "text", description: "Post title" },
        body: { type: "richtext", description: "Post content" },
        author: { type: "multilink", description: "Author reference" },
        date: { type: "datetime", description: "Publication date" },
        cover_image: { type: "asset", description: "Featured image" },
        tags: { type: "multilink", description: "Related tags" },
        published: { type: "boolean", description: "Published status" }
      }
    } as TSBComponent);
  }

  // HERO
  if (text.includes("hero")) {
    out.push({
      name: "hero",
      display_name: "Hero",
      is_root: false,
      is_nestable: true,
      schema: {
        title: { type: "text", description: "Hero title" },
        subtitle: { type: "textarea", description: "Hero subtitle" },
        cover_image: { type: "asset", description: "Main/Background image" },
        cta: { type: "multilink", description: "CTA target (page or URL)" }
      }
    } as TSBComponent);
  }

  // FEATURE GRID + ITEM
  if (text.includes("feature") && (text.includes("grid") || text.includes("list"))) {
    out.push({
      name: "featuregrid",
      display_name: "Feature Grid",
      is_root: false,
      is_nestable: true,
      schema: {
        heading: { type: "text", description: "Section heading" },
        items: { type: "bloks", description: "Repeatable feature items", 
                restrict_type: "", component_whitelist: ["feature_item"] }
      }
    } as TSBComponent);

    out.push({
      name: "feature_item",
      display_name: "Feature Item",
      is_root: false,
      is_nestable: true,
      schema: {
        icon: { type: "asset", description: "Feature icon" },
        title: { type: "text", description: "Feature title" },
        copy: { type: "textarea", description: "Feature description" }
      }
    } as TSBComponent);
  }

  // FAQ
  if (text.includes("faq") || text.includes("question")) {
    out.push({
      name: "faq",
      display_name: "FAQ",
      is_root: false,
      is_nestable: true,
      schema: {
        question: { type: "text", description: "Question" },
        answer: { type: "richtext", description: "Answer content" }
      }
    } as TSBComponent);
  }

  // CONTACT FORM
  if (text.includes("contact") || text.includes("form")) {
    out.push({
      name: "contact_form",
      display_name: "Contact Form",
      is_root: false,
      is_nestable: true,
      schema: {
        heading: { type: "text", description: "Form heading" },
        email: { type: "text", description: "Contact email" },
        phone: { type: "text", description: "Contact phone" },
        submit: { type: "text", description: "Submit button text" }
      }
    } as TSBComponent);
  }

  // TESTIMONIAL
  if (text.includes("testimonial") || text.includes("review")) {
    out.push({
      name: "testimonial",
      display_name: "Testimonial",
      is_root: false,
      is_nestable: true,
      schema: {
        avatar: { type: "asset", description: "Customer photo" },
        name: { type: "text", description: "Customer name" },
        quote: { type: "textarea", description: "Quoted testimonial" },
        rating: { type: "number", description: "Star rating" }
      }
    } as TSBComponent);
  }

  // GALLERY
  if (text.includes("gallery") || text.includes("images")) {
    out.push({
      name: "gallery",
      display_name: "Image Gallery",
      is_root: false,
      is_nestable: true,
      schema: {
        title: { type: "text", description: "Gallery title" },
        images: { type: "multiasset", description: "Gallery images" }
      }
    } as TSBComponent);
  }

  // Fallback generic component if nothing matched
  if (out.length === 0) {
    out.push({
      name: "generic_component",
      display_name: "Generic",
      is_root: false,
      is_nestable: true,
      schema: {
        title: { type: "text", description: "Component title" },
        body: { type: "richtext", description: "Rich content" },
        cover_image: { type: "asset", description: "Featured image" }
      }
    } as TSBComponent);
  }

  // Deduplicate by name (in case of overlaps)
  const seen = new Set<string>();
  return out.filter(c => (seen.has(c.name) ? false : (seen.add(c.name), true)));
}
