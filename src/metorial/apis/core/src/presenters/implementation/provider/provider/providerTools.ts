import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerToolsType } from '../../../types';
import { v1ProviderToolPresenter } from './providerTool';

export let v1ProviderToolsPresenter = Presenter.create(providerToolsType)
  .presenter(async ({ items }, opts) => {
    let res = await Promise.all(
      items.map(tool => v1ProviderToolPresenter.present({ tool }, opts).run())
    );
    return {
      object: 'provider.tools' as const,
      items: res
    };
  })
  .schema(
    v.object({
      object: v.literal('provider.tools'),
      items: v.array(v1ProviderToolPresenter.schema)
    })
  )
  .build();
