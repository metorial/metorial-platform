#!/usr/bin/env bun
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { exportSettingsSchema, listSettingIssues, renderExampleConfig } from './registry';
import type { Audience, SettingsIssue } from './types';

let usage = `Usage:
  metorial-settings check   --edition <edition> [--config <file>] <module...>
  metorial-settings schema  --edition <edition> [--audience customer|derived|deployment] <module...>
  metorial-settings example --edition <edition> <module...>

Each <module> is a file that declares settings when imported (usually a service's settings files).`;

let audiences: Audience[] = ['customer', 'derived', 'deployment'];

let headings: Record<Audience, string> = {
  customer: 'Must be provided by the customer',
  derived: 'Derived values that could not be computed',
  deployment: 'Missing from the deployment (set by the installer or Helm/Compose files)'
};

let fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

let importAll = async (modules: string[]) => {
  let issues: SettingsIssue[] = [];
  let errors: string[] = [];

  for (let path of modules) {
    try {
      await import(resolve(path));
    } catch (error: any) {
      if (Array.isArray(error?.issues)) issues.push(...error.issues);
      else errors.push(`${path}: ${error?.message ?? error}`);
    }
  }

  let seen = new Set<string>();

  return {
    errors,
    issues: issues.filter(issue => {
      let id = `${issue.group}.${issue.key}`;
      if (seen.has(id)) return false;

      seen.add(id);
      return true;
    })
  };
};

let [command, ...rest] = process.argv.slice(2);

let { values, positionals } = parseArgs({
  args: rest,
  allowPositionals: true,
  options: {
    edition: { type: 'string' },
    config: { type: 'string' },
    audience: { type: 'string' }
  }
});

if (!command || !values.edition || !positionals.length) fail(usage);

process.env.METORIAL_EDITION = values.edition;
process.env.METORIAL_SETTINGS_MODE = 'collect';
if (values.config) process.env.METORIAL_CONFIG_FILE = resolve(values.config);

let { issues: thrownIssues, errors } = await importAll(positionals);

let seenIssues = new Set<string>();
let issues = [...listSettingIssues(), ...thrownIssues].filter(issue => {
  if (seenIssues.has(issue.env)) return false;

  seenIssues.add(issue.env);
  return true;
});

if (errors.length) fail(errors.join('\n'));

if (command == 'schema') {
  let audience = audiences.find(item => item == values.audience);
  console.log(JSON.stringify(exportSettingsSchema({ audience }), null, 2));
} else if (command == 'example') {
  console.log(renderExampleConfig({ audience: 'customer' }));
} else if (command == 'check') {
  for (let audience of audiences) {
    let group = issues.filter(issue => issue.audience == audience);
    if (!group.length) continue;

    console.error(`${headings[audience]}:`);
    for (let issue of group) {
      console.error(`  ${issue.group}.${issue.key} (${issue.env}) - ${issue.message}`);
    }
  }

  if (issues.length) process.exit(1);

  console.log(`Settings are valid for the ${values.edition} edition`);
} else {
  fail(usage);
}
