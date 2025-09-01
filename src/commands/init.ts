import inquirer from 'inquirer';
import ora from 'ora';
import { loadConfig, saveConfig } from '../utils/config.js';
import { textToComponents } from '../services/ai.js';
import { createSpace, createComponent, listSpaces } from '../services/storyblok.js';


export async function initCmd() {
const cfg = loadConfig();
const answers = await inquirer.prompt([
{ name: 'project', message: 'Project name:', default: 'my-devflow-app' },
{ name: 'framework', type: 'list', choices: ['Next.js', 'Nuxt', 'Astro'] },
{ name: 'storyblokToken', message: 'Storyblok Personal Access Token:', default: cfg.STORYBLOK_TOKEN, mask: '*' },
{ name: 'openai', message: 'OpenAI API Key:', default: cfg.OPENAI_API_KEY, mask: '*' },
{ name: 'desc', message: 'Describe components (one sentence):' }
]);


saveConfig({ STORYBLOK_TOKEN: answers.storyblokToken, OPENAI_API_KEY: answers.openai });


const spinner = ora('Verifying Storyblok token…').start();
const spaces = await listSpaces(answers.storyblokToken).catch(e => { spinner.fail('Token check failed'); throw e; });
spinner.succeed('Token OK');


const { action } = await inquirer.prompt([{ name: 'action', type: 'list', message: 'Create a new space or use existing?', choices: ['Create new', 'Use existing'] }]);


let spaceId: string | number;
if (action === 'Create new') {
const { spaceName } = await inquirer.prompt([{ name: 'spaceName', message: 'New space name:', default: answers.project }]);
const s = await createSpace(answers.storyblokToken, spaceName);
spaceId = s.id;
} else {
const pick = await inquirer.prompt([{ name: 'sid', type: 'list', message: 'Choose a space:', choices: spaces.map((s: any) => ({ name: `${s.name} (${s.id})`, value: s.id })) }]);
spaceId = pick.sid;
}


const compSpinner = ora('Asking AI to draft component schemas…').start();
const components = await textToComponents(answers.openai, answers.desc);
compSpinner.succeed(`AI proposed ${components.length} components`);


for (const c of components) {
const s = ora(`Creating component ${c.name}…`).start();
await createComponent(answers.storyblokToken, spaceId, c);
s.succeed(`Created: ${c.name}`);
}


console.log('\nScaffold complete. Next: connect your front‑end starter to this space.');
}