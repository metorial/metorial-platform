import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerAndProfileType } from '../../types';
import { v1ConsumerPresenter } from './consumer';
import { v1ConsumerProfilePresenter } from './consumerProfile';

export let v1ConsumerAndProfilePresenter = Presenter.create(consumerAndProfileType)
  .presenter(async ({ consumer, consumerProfile, assignedConsumerGroups }, opts) => {
    let consumerPresented = await v1ConsumerPresenter.present({ consumer }, opts).run();
    let consumerProfilePresented = await v1ConsumerProfilePresenter
      .present(
        {
          consumerProfile,
          assignedConsumerGroups,
          instanceConsumer: consumer
        },
        opts
      )
      .run();

    return {
      ...consumerPresented,
      profile: consumerProfilePresented
    };
  })
  .schema(
    v.intersection([
      v1ConsumerPresenter.schema,
      v.object({
        profile: v1ConsumerProfilePresenter.schema
      })
    ])
  )
  .build();
