#!/usr/bin/env node
import { Command } from 'commander';
import { initCmd } from '../commands/init.js';
import { syncFigmaCmd } from '../commands/sync-figma.js';


const program = new Command();
program
.name('devflow-ai')
.description('AI‑assisted Storyblok CLI: init projects, generate components from text/designs')
.version('0.1.0');


program.command('init').description('Create a space and components from a sentence').action(initCmd);
program.command('sync-figma').description('Generate components from a Figma file').action(syncFigmaCmd);


program.parseAsync();