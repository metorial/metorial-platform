import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildDetectionCatalog,
  findDetectionTool,
  getDetectionCatalog,
  type DetectionPlatform
} from '../src/detection';
import { agentSeeds } from '../src/registry/agents';
import { detectionSeeds } from '../src/registry/detection';

let detectionPlatforms: DetectionPlatform[] = ['macos', 'windows', 'linux'];

let committedCatalog = path.join(import.meta.dirname, '..', 'detection.json');

let genericExecutables = new Set([
  'bash',
  'bun',
  'code',
  'copilot',
  'deno',
  'docker',
  'electron',
  'git',
  'go',
  'goose',
  'java',
  'node',
  'npm',
  'npx',
  'python',
  'python3',
  'ruby',
  'sh',
  'uv',
  'uvx',
  'vibe',
  'zsh'
]);

let pathRoots = ['~/', '%APPDATA%/', '%LOCALAPPDATA%/', '%PROGRAMFILES%/'];

let executableName = (name: string) => name.toLowerCase().replace(/\.exe$/, '');

let catalog = getDetectionCatalog();

describe('detection registry', () => {
  it('only lists seeded agents, each once', () => {
    let agents = new Set(agentSeeds.map(seed => seed.id));
    let ids = detectionSeeds.map(seed => seed.agentId);

    expect(ids.filter(id => !agents.has(id))).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every tool at least one signal', () => {
    for (let tool of catalog.tools) {
      let signals = [
        ...tool.ide_extension_ids,
        ...detectionPlatforms.flatMap(platform =>
          Object.values(tool.platforms[platform]).flat()
        )
      ];

      expect(signals.length, tool.key).toBeGreaterThan(0);
    }
  });

  it('never matches on generic executable names', () => {
    for (let tool of catalog.tools)
      for (let platform of detectionPlatforms) {
        let { binaries, process_names } = tool.platforms[platform];

        for (let name of [...binaries, ...process_names]) {
          expect(genericExecutables.has(executableName(name)), `${tool.key} ${name}`).toBe(
            false
          );
        }
      }
  });

  it('never gives two tools the same executable, process, folder or extension', () => {
    for (let platform of detectionPlatforms) {
      let owners = new Map<string, Set<string>>();
      let claim = (kind: string, value: string, key: string) => {
        let id = `${kind}:${kind == 'process' || kind == 'binary' ? executableName(value) : value}`;
        owners.set(id, new Set([...(owners.get(id) ?? []), key]));
      };

      for (let tool of catalog.tools) {
        let signatures = tool.platforms[platform];

        for (let name of signatures.binaries) claim('binary', name, tool.key);
        for (let name of signatures.process_names) claim('process', name, tool.key);
        for (let dir of [...signatures.config_dirs, ...signatures.apps])
          claim('path', dir, tool.key);
        for (let id of tool.ide_extension_ids) claim('extension', id, tool.key);
      }

      let shared = [...owners].filter(([, keys]) => keys.size > 1).map(([id]) => id);
      expect(shared, platform).toEqual([]);
    }
  });

  it('lists each process name once per tool, ignoring case', () => {
    for (let tool of catalog.tools)
      for (let platform of detectionPlatforms) {
        let names = tool.platforms[platform].process_names.map(executableName);
        expect(new Set(names).size, `${tool.key} ${platform}`).toBe(names.length);
      }
  });

  it('writes paths from a known root and apps in the shape each OS uses', () => {
    for (let tool of catalog.tools) {
      let { macos, windows, linux } = tool.platforms;

      for (let dir of [
        ...macos.config_dirs,
        ...windows.config_dirs,
        ...windows.apps,
        ...linux.config_dirs,
        ...linux.apps
      ]) {
        expect(
          pathRoots.some(root => dir.startsWith(root)),
          `${tool.key} ${dir}`
        ).toBe(true);
        expect(dir.includes('\\'), `${tool.key} ${dir}`).toBe(false);
      }

      for (let app of macos.apps)
        expect(app.endsWith('.app'), `${tool.key} ${app}`).toBe(true);
      for (let name of windows.process_names)
        expect(name.endsWith('.exe'), `${tool.key} ${name}`).toBe(true);
      for (let id of tool.ide_extension_ids)
        expect(id, tool.key).toMatch(/^[a-z0-9-]+\.[a-z0-9-]+$/);
    }
  });
});

describe('buildDetectionCatalog', () => {
  it('describes each tool with its agent and maker', () => {
    expect(findDetectionTool('claude-code')).toMatchObject({
      key: 'claude-code',
      name: 'Claude Code',
      maker: { id: 'anthropic', name: 'Anthropic' },
      ide_extension_ids: ['anthropic.claude-code']
    });
    expect(findDetectionTool('not-a-tool')).toBeNull();
    expect(catalog.tools.map(tool => tool.key)).toEqual(
      [...catalog.tools.map(tool => tool.key)].sort()
    );
  });

  it('versions the catalog by its content', () => {
    let changed = buildDetectionCatalog({
      seeds: detectionSeeds.map(seed =>
        seed.agentId == 'aider' ? { ...seed, ideExtensionIds: ['aider.aider'] } : seed
      )
    });

    expect(buildDetectionCatalog().version).toBe(catalog.version);
    expect(changed.version).not.toBe(catalog.version);
    expect(catalog.version).toMatch(/^[0-9a-f]{16}$/);
  });

  it('refuses a signature for an agent that is not seeded', () => {
    expect(() => buildDetectionCatalog({ seeds: [{ agentId: 'ghost' }] })).toThrow(
      'detection seed ghost has no agent seed'
    );
  });

  it('matches the committed detection.json (run `bun run detection` after a change)', async () => {
    let committed = JSON.parse(await readFile(committedCatalog, 'utf8'));

    expect(committed).toEqual(catalog);
  });
});
