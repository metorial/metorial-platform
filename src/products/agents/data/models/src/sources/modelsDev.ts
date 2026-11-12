import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import { deepMerge, omitPath } from '../lib/util';
import { parseWith } from '../lib/validate';

let repoUrl = 'https://github.com/anomalyco/models.dev.git';

let exec = promisify(execFile);

let numberOrRecord = v.union([v.number(), v.record(v.number())]);

let cacheCost = v.object({
  read: v.optional(v.number()),
  write: v.optional(numberOrRecord),
  explicit: v.optional(
    v.object({
      read: v.optional(v.number()),
      write: v.optional(numberOrRecord)
    })
  )
});

let costOverride = v.object({
  when: v.optional(v.record(v.any())),
  price: v.optional(v.number()),
  cache: v.optional(cacheCost)
});

let rateCost = v.object({
  price: v.optional(v.number()),
  unit: v.optional(v.string()),
  reasoning: v.optional(v.number()),
  cache: v.optional(cacheCost),
  overrides: v.optional(v.array(costOverride))
});

let modalityCost = v.object({
  input: v.optional(rateCost),
  output: v.optional(rateCost)
});

let cacheCapability = v.union([
  v.boolean(),
  v.object({
    implicit: v.optional(v.union([v.boolean(), v.record(v.any())])),
    explicit: v.optional(
      v.union([v.boolean(), v.object({ ttl: v.optional(v.array(v.string())) })])
    )
  })
]);

let upstreamModelSchema = v.object({
  name: v.optional(v.string()),
  description: v.optional(v.string()),
  family: v.optional(v.string()),
  type: v.optional(v.string()),
  status: v.optional(v.string()),
  open_weights: v.optional(v.boolean()),
  release_date: v.optional(v.string()),
  last_updated: v.optional(v.string()),
  knowledge: v.optional(v.string()),
  license: v.optional(v.string()),
  v2_only: v.optional(v.boolean()),
  modalities: v.optional(
    v.object({
      input: v.optional(v.array(v.string())),
      output: v.optional(v.array(v.string()))
    })
  ),
  capabilities: v.optional(
    v.object({
      tools: v.optional(
        v.object({
          supported: v.optional(v.boolean()),
          choice: v.optional(v.array(v.string()))
        })
      ),
      reasoning: v.optional(
        v.object({
          supported: v.optional(v.boolean()),
          toggle: v.optional(v.boolean()),
          effort: v.optional(v.array(v.string()))
        })
      ),
      structured_output: v.optional(v.boolean()),
      temperature: v.optional(v.boolean()),
      cache: v.optional(cacheCapability)
    })
  ),
  limit: v.optional(
    v.object({
      context: v.optional(v.number()),
      input: v.optional(v.number()),
      output: v.optional(v.number())
    })
  ),
  cost: v.optional(
    v.object({
      text: v.optional(modalityCost),
      image: v.optional(modalityCost),
      audio: v.optional(modalityCost),
      video: v.optional(modalityCost),
      web_search: v.optional(v.object({ price: v.optional(v.number()) }))
    })
  ),
  api: v.optional(v.record(v.any())),
  links: v.optional(v.array(v.object({ type: v.optional(v.string()), url: v.string() }))),
  weights: v.optional(v.array(v.object({ label: v.optional(v.string()), url: v.string() })))
});

let providerSchema = v.object({
  name: v.string(),
  env: v.optional(v.array(v.string())),
  npm: v.optional(v.string()),
  api: v.optional(v.string()),
  doc: v.optional(v.string())
});

let labSchema = v.object({
  name: v.optional(v.string()),
  description: v.optional(v.string())
});

export type UpstreamModel = ValidationTypeValue<typeof upstreamModelSchema>;

export interface ModelsDevLab {
  id: string;
  name: string | null;
  description: string | null;
  logoPath: string | null;
}

export interface ModelsDevLabModel {
  labId: string;
  id: string;
  data: UpstreamModel;
}

export interface ModelsDevProvider {
  id: string;
  name: string;
  env: string[];
  npm: string | null;
  api: string | null;
  doc: string | null;
  logoPath: string | null;
}

export interface ModelsDevProviderModel {
  providerId: string;
  id: string;
  baseModel: string | null;
  data: UpstreamModel;
}

export interface ModelsDevSnapshot {
  root: string;
  sha: string;
  labs: ModelsDevLab[];
  labModels: ModelsDevLabModel[];
  providers: ModelsDevProvider[];
  providerModels: ModelsDevProviderModel[];
  issues: string[];
}

export let ensureModelsDevRepo = async (opts: { repoPath?: string; cacheDir: string }) => {
  if (opts.repoPath) return opts.repoPath;

  let target = path.join(opts.cacheDir, 'models.dev');
  if (existsSync(path.join(target, '.git'))) {
    await exec('git', ['-C', target, 'fetch', '--depth', '1', 'origin', 'HEAD']);
    await exec('git', ['-C', target, 'reset', '--hard', 'FETCH_HEAD']);
  } else {
    await exec('git', ['clone', '--depth', '1', '--quiet', repoUrl, target]);
  }

  return target;
};

let readGitSha = async (root: string) => {
  try {
    let { stdout } = await exec('git', ['-C', root, 'rev-parse', 'HEAD']);
    return stdout.trim();
  } catch {
    return 'unknown';
  }
};

// Upstream symlinks provider model files and directories between providers, so this follows them.
let walkToml = async (dir: string, prefix = ''): Promise<string[]> => {
  if (!existsSync(dir)) return [];

  let result: string[] = [];
  for (let entry of await readdir(dir)) {
    let full = path.join(dir, entry);
    let info = await stat(full);

    if (info.isDirectory()) result.push(...(await walkToml(full, `${prefix}${entry}/`)));
    else if (entry.endsWith('.toml')) result.push(`${prefix}${entry}`);
  }

  return result.sort();
};

let readToml = async (file: string) =>
  parseToml(await readFile(file, 'utf8')) as Record<string, any>;

let listDirs = async (dir: string) => {
  if (!existsSync(dir)) return [];

  let entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory() || entry.isSymbolicLink())
    .map(entry => entry.name)
    .sort();
};

let logoIfExists = (file: string) => (existsSync(file) ? file : null);

export let readModelsDev = async (root: string): Promise<ModelsDevSnapshot> => {
  let issues: string[] = [];
  let sha = await readGitSha(root);

  let labs: ModelsDevLab[] = [];
  for (let labId of await listDirs(path.join(root, 'labs'))) {
    let file = path.join(root, 'labs', labId, 'lab.toml');
    let data = existsSync(file) ? parseWith(labSchema, await readToml(file), file) : {};

    labs.push({
      id: labId,
      name: data.name ?? null,
      description: data.description ?? null,
      logoPath: logoIfExists(path.join(root, 'labs', labId, 'logo.svg'))
    });
  }

  let rawLabModels = new Map<string, Record<string, any>>();
  let labModels: ModelsDevLabModel[] = [];
  for (let labId of await listDirs(path.join(root, 'models'))) {
    for (let rel of await walkToml(path.join(root, 'models', labId))) {
      let file = path.join(root, 'models', labId, rel);
      let id = rel.slice(0, -'.toml'.length);

      try {
        let raw = await readToml(file);
        rawLabModels.set(`${labId}/${id}`, raw);
        labModels.push({ labId, id, data: parseWith(upstreamModelSchema, raw, file) });
      } catch (err) {
        issues.push(`models.dev lab model ${labId}/${id}: ${(err as Error).message}`);
      }
    }
  }

  let providers: ModelsDevProvider[] = [];
  let providerModels: ModelsDevProviderModel[] = [];
  for (let providerId of await listDirs(path.join(root, 'providers'))) {
    let providerFile = path.join(root, 'providers', providerId, 'provider.toml');
    if (!existsSync(providerFile)) continue;

    let provider = parseWith(providerSchema, await readToml(providerFile), providerFile);
    providers.push({
      id: providerId,
      name: provider.name,
      env: provider.env ?? [],
      npm: provider.npm ?? null,
      api: provider.api ?? null,
      doc: provider.doc ?? null,
      logoPath: logoIfExists(path.join(root, 'providers', providerId, 'logo.svg'))
    });

    let modelsDir = path.join(root, 'providers', providerId, 'models');
    for (let rel of await walkToml(modelsDir)) {
      let id = rel.slice(0, -'.toml'.length);

      try {
        let raw = await readToml(path.join(modelsDir, rel));
        let baseModel = typeof raw.base_model === 'string' ? raw.base_model : null;
        let merged = raw;

        if (baseModel) {
          let base = rawLabModels.get(baseModel);
          if (!base)
            issues.push(`models.dev ${providerId}/${id}: base_model ${baseModel} not found`);
          merged = deepMerge(base ?? {}, raw);

          let omit = Array.isArray(raw.base_model_omit) ? raw.base_model_omit : [];
          for (let entry of omit) if (typeof entry === 'string') omitPath(merged, entry);
        }

        providerModels.push({
          providerId,
          id,
          baseModel,
          data: parseWith(upstreamModelSchema, merged, `${providerId}/${id}`)
        });
      } catch (err) {
        issues.push(
          `models.dev provider model ${providerId}/${id}: ${(err as Error).message}`
        );
      }
    }
  }

  return { root, sha, labs, labModels, providers, providerModels, issues };
};
