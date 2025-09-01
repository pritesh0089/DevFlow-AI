# 1) Install deps
pnpm i # or npm/yarn


# 2) Build & link local CLI
pnpm build && pnpm link -g


# 3) Configure tokens (one‑time)
devflow-ai login
# Prompts for: STORYBLOK_TOKEN, FIGMA_TOKEN, OPENAI_API_KEY


# 4) Create a space and components from text
devflow-ai init


# 5) Generate components from a Figma file in an existing project
devflow-ai sync-figma "https://www.figma.com/file/<KEY>/..."