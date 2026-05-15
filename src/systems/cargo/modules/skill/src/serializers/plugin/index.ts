import { Hash } from '@lowerdeck/hash';
import { slugify } from '@lowerdeck/slugify';
import { db, env } from '@metorial-cargo/db';
import semver from 'semver';
import { internalImageService } from '../../internal/image';
import { createApplicator } from '../_lib/apply';
import type { PluginSerializerInput } from '../_lib/types';

export let getPluginPath = (d: PluginSerializerInput) =>
  d.skillMarketplacePlugin ? `plugins/${d.skillMarketplacePlugin.pluginSlug}` : undefined;

let json = (data: any) => JSON.stringify(data, null, 2);

export let applyPlugin = createApplicator('plugin', async (input, context) => {
  let skills = await db.skillPluginSkill.findMany({
    where: {
      skillPluginOid: input.skillPlugin.oid,
      status: 'active',
      skill: {
        status: 'active'
      }
    },
    include: { skill: { include: { store: true } } }
  });

  let skillHashes = skills
    .map(s =>
      [
        1,
        s.oid,
        s.skill.oid,
        s.updatedAt.getTime(),
        s.skill.updatedAt.getTime(),
        s.skill.store.lastEditedAt.getTime()
      ].join(':')
    )
    .join('|');

  let hash = await Hash.sha256(
    [1, input.skillPlugin.oid, input.skillPlugin.updatedAt.getTime(), skillHashes].join(':')
  );
  if (context.hashIsEqual(hash)) return;
  context.setHash?.(hash);

  if (input.skillPlugin.versionHash !== hash) {
    let nextVersion = semver.inc(input.skillPlugin.version ?? '0.0.0', 'patch')!;

    await db.skillPlugin.updateMany({
      where: { oid: input.skillPlugin.oid },
      data: { versionHash: hash, version: nextVersion }
    });

    input.skillPlugin.version = nextVersion;
  }

  context.setBasePath(getPluginPath(input));

  let mcpJson = json({
    metorial: {
      type: 'http',
      url: `${env.service.API_URL}/connect/plugin/${input.skillPlugin.slug}`
    }
  });
  await context.setFile('mcp.json', mcpJson);
  await context.setFile('.mcp.json', mcpJson);

  let image = input.skillPlugin.image;
  if (image?.type !== 'file') {
    for (let skill of skills) {
      if (skill.skill.image?.type === 'file') {
        image = skill.skill.image;
      }
    }
  }
  if (image?.type !== 'file') {
    let tenant = await db.tenant.findFirstOrThrow({
      where: { oid: input.skillPlugin.tenantOid }
    });
    if (tenant.image?.type === 'file') {
      image = tenant.image;
    }
  }

  let downloadImage = await internalImageService.downloadImage({
    id: input.skillPlugin.id,
    image
  });
  let logoIcon = `assets/logo.${downloadImage.extension}`;
  await context.setFile(logoIcon, await downloadImage.fetch());

  let baseInfo = {
    name: slugify(input.skillMarketplacePlugin?.pluginSlug ?? input.skillPlugin.name),
    description: input.skillPlugin.description,
    version: input.skillPlugin.version,
    author: {
      name: 'Metorial',
      email: 'hey@metorial.com'
    }
  };

  let claudePlugin = json(baseInfo);
  await context.setFile('.claude-plugin/plugin.json', claudePlugin);

  let cursorPlugin = json(baseInfo);
  await context.setFile('.cursor-plugin/plugin.json', cursorPlugin);

  let codexPlugin = json({
    ...baseInfo,
    skills: './skills/',
    mcpServers: './.mcp.json',
    interface: {
      displayName: input.skillPlugin.name,
      shortDescription: input.skillPlugin.description,
      longDescription: input.skillPlugin.longDescription,
      capabilities: ['Interactive', 'Write', 'Read'],
      brandColor: '#0099ff',
      composerIcon: `./${logoIcon}`,
      logo: `./${logoIcon}`,
      screenshots: []
    }
  });
  await context.setFile('.codex-plugin/plugin.json', codexPlugin);

  let cursor: string | null = null;
  let limit = 25;

  while (true) {
    let agents = await db.skillAgent.findMany({
      where: {
        skillOid: { in: skills.map(s => s.skill.oid) },
        status: 'active',
        id: cursor ? { gt: cursor } : undefined
      },
      include: { document: { include: { content: true } } },
      take: limit
    });

    for (let agent of agents) {
      await context.setFile(`agents/${agent.slug}.md`, agent.document.content.content);
    }

    if (agents.length < limit) break;
    cursor = agents[agents.length - 1]!.id as string;
  }
});
