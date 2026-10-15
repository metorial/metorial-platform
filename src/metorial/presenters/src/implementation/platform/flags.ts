import { v } from '@lowerdeck/validation';
import { isFlagEnabled, type FlagValue } from '@metorial/module-flags';
import { Presenter } from '@metorial/presenter';
import { flagsType } from '../../types';

export let v1FlagsPresenter = Presenter.create(flagsType)
  .presenter(async ({ flags }, opts) => ({
    object: 'flags',

    flags: Object.entries(flags)
      .filter((entry): entry is [string, FlagValue] => typeof entry[1] != 'number')
      .map(([slug, value]) => ({
        slug,
        value: isFlagEnabled(value)
      }))
  }))
  .schema(
    v.object({
      object: v.literal('flags'),

      flags: v.array(
        v.object({
          slug: v.string(),
          value: v.boolean()
        })
      )
    })
  )
  .build();
