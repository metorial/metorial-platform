import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { flagsType } from '../../types';

export let v1FlagsPresenter = Presenter.create(flagsType)
  .presenter(async ({ flags }, opts) => ({
    object: 'flags',

    flags: Object.entries(flags).map(([slug, value]) => ({
      slug,
      value
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
