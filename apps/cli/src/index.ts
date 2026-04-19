#!/usr/bin/env node
/**
 * Pascal Agent CLI — headless interface for plan/apply/validate/test workflows.
 */

import { Command } from 'commander'
import { apply } from './commands/apply'
import { ask } from './commands/ask'
import { doctor } from './commands/doctor'
import { inspect } from './commands/inspect'
import { models } from './commands/models'
import { resolve } from './commands/resolve'
import { scene } from './commands/scene'
import { validate } from './commands/validate'

const program = new Command()

program
  .name('pascal-agent')
  .description('Autonomous AI coding agent for Pascal building editor')
  .version('0.1.0')

program
  .command('doctor')
  .description('Check agent health, providers, and configuration')
  .option('--json', 'Output as JSON')
  .action(doctor)

program
  .command('models')
  .description('List and test model providers')
  .addCommand(
    new Command('list')
      .description('List available providers')
      .option('--json', 'Output as JSON')
      .action((_opts) => models('list', { json: false })),
  )
  .addCommand(
    new Command('test')
      .description('Test provider connectivity')
      .option('--provider <name>', 'Provider to test')
      .option('--json', 'Output as JSON')
      .action((opts) => models('test', opts)),
  )

program
  .command('scene')
  .description('Scene operations')
  .addCommand(
    new Command('summary')
      .description('Get scene summary')
      .option('--scene <path>', 'Path to scene JSON file')
      .option('--json', 'Output as JSON')
      .action((opts) => scene('summary', opts)),
  )

program
  .command('inspect <id>')
  .description('Inspect a wall by ID')
  .option('--scene <path>', 'Path to scene JSON file')
  .option('--json', 'Output as JSON')
  .action(inspect)

program
  .command('resolve <reference>')
  .description('Resolve an English wall reference to a wall ID')
  .option('--scene <path>', 'Path to scene JSON file')
  .option('--json', 'Output as JSON')
  .action(resolve)

program
  .command('ask <prompt>')
  .description('Ask the agent to make a scene edit')
  .option('--scene <path>', 'Path to scene JSON file')
  .option('--dry-run', 'Only simulate, do not apply changes')
  .option('--provider <name>', 'Model provider to use')
  .option('--profile <name>', 'Configuration profile')
  .option('--json', 'Output as JSON')
  .action(ask)

program
  .command('validate')
  .description('Validate the current scene')
  .option('--scene <path>', 'Path to scene JSON file')
  .option('--scope <scope>', 'Scope: all, level, building')
  .option('--json', 'Output as JSON')
  .action(validate)

program
  .command('apply <planPath>')
  .description('Apply a plan from a JSON file')
  .option('--scene <path>', 'Path to scene JSON file')
  .option('--json', 'Output as JSON')
  .action(apply)

program
  .command('test-scenario [name]')
  .description('Run a built-in test scenario')
  .option('--json', 'Output as JSON')
  .option('--all', 'Run all scenarios')
  .action(async (name: string | undefined, options: { json?: boolean; all?: boolean }) => {
    const { runScenario, runAllScenarios } = await import('./scenarios/index')
    if (options.all || !name) {
      const passed = await runAllScenarios(options)
      process.exit(passed ? 0 : 1)
    } else {
      const result = await runScenario(name, options)
      process.exit(result.passed ? 0 : 1)
    }
  })

program.parse(process.argv)
