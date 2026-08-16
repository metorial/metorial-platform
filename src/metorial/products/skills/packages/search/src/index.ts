import { delay } from '@lowerdeck/delay';
import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { createVoyagerClient } from '@metorial-platform-systems/voyager-client';
import { env } from './env';

let getIndexName = (suffix?: string) =>
  [env.service.VOYAGER_INDEX_PREFIX, 'cargo', suffix].filter(Boolean).join('_');

export let voyager = createVoyagerClient({
  endpoint: env.service.VOYAGER_URL
});

export let voyagerSourceProm = new ProgrammablePromise<
  Awaited<ReturnType<typeof voyager.source.upsert>>
>();
export let voyagerSource = voyagerSourceProm.promise;

(async () => {
  while (true) {
    console.log('Attempting to create Cargo source in Voyager...');

    try {
      let source = await voyager.source.upsert({
        name: 'Cargo',
        identifier: getIndexName()
      });

      console.log('Successfully created Cargo source in Voyager', source.id);
      voyagerSourceProm.resolve(source);
      return;
    } catch (error) {
      console.error(
        'Failed to create Cargo source in Voyager, retrying in 5 seconds...',
        error
      );
    }

    await delay(5000);
  }
})();

export let voyagerIndex = {
  skill: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('skill'),
    name: 'Skills'
  }),

  skillGroup: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('skill_group'),
    name: 'Skill Groups'
  }),

  skillTemplate: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('skill_template'),
    name: 'Skill Templates'
  }),

  skillPlugin: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('skill_plugin'),
    name: 'Skill Plugins'
  }),

  skillMarketplace: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('skill_marketplace'),
    name: 'Skill Marketplaces'
  })
};
