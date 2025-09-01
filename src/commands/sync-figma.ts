import inquirer from 'inquirer';
import ora from 'ora';
import { loadConfig, saveConfig } from '../utils/config.js';
import { getFile, extractNodes } from '../services/figma.js';
import { textToComponents } from '../services/ai.js';
import { createComponent } from '../services/storyblok.js';


export async function syncFigmaCmd() {
const cfg = loadConfig();
const a = await inquirer.prompt([
{ name: 'spaceId', message: 'Storyblok space ID:' },
{ name: 'storyblokToken', message: 'Storyblok Personal Access Token:', default: cfg.STORYBLOK_TOKEN, mask: '*' },
{ name: 'openai', message: 'OpenAI API Key:', default: cfg.OPENAI_API_KEY, mask: '*' },
{ name: 'figma', message: 'Figma file URL or key:' },
{ name: 'figmaToken', message: 'Figma API token:', default: cfg.FIGMA_TOKEN, mask: '*' }
]);
saveConfig({ STORYBLOK_TOKEN: a.storyblokToken, OPENAI_API_KEY: a.openai, FIGMA_TOKEN: a.figmaToken });


const s1 = ora('Fetching Figma JSON…').start();
const file = await getFile(a.figmaToken, a.figma);
s1.succeed('Figma JSON downloaded');


const nodes = extractNodes(file);
const compact = JSON.stringify(nodes.slice(0, 500)); // shrink prompt size; real impl would chunk


const s2 = ora('Inferring components from design…').start();
const comps = await textToComponents(a.openai, compact);
s2.succeed(`Inferred ${comps.length} components`);


for (const c of comps) {
const s = ora(`Creating/Updating ${c.name}…`).start();
await createComponent(a.storyblokToken, a.spaceId, c);
s.succeed(c.name);
}
}