import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { fromServiceFamily, requireAgentTracking } from '@metorial/module-agent-tracking-sync';
import { cached, cacheKey } from '../lib/cache';
import { lookupModelNames } from '../lib/catalog';
import {
  filterValueItem,
  isFilterValueOf,
  unknownNames,
  unknownOption
} from '../lib/filterValues';
import { lookupMembers, unique, unknownMemberKey } from '../lib/members';
import { individualsHiddenError, loadPrivacy } from '../lib/privacy';
import { filtersHiddenError } from '../lib/privateSpend';
import { filterFields, filterValuesLimit } from '../lib/queries';
import {
  normalizeRange,
  queryRange,
  rangeCacheKey,
  resolveRange,
  type NormalizedRange,
  type RangeInput
} from '../lib/range';
import { cachedRead, type ReadScope } from '../lib/scope';
import { fromService, queryCallOptions } from '../lib/service';
import type {
  AgentTrackingFilterValue,
  AgentTrackingFilterValues,
  AgentTrackingMember,
  FilterField
} from '../lib/types';

class AgentTrackingFilterValueServiceImpl {
  async listFilterValues(
    d: ReadScope & {
      field: FilterField;
      search?: string;
      values?: string[];
      range: RangeInput;
    }
  ): Promise<AgentTrackingFilterValues> {
    let range = normalizeRange(d.range);
    let now = new Date();
    let search = d.search?.trim() || undefined;

    if (d.values && search) {
      throw new ServiceError(
        badRequestError({ message: 'Pass either search or value, not both.' })
      );
    }

    let privacy = await loadPrivacy(d);
    if (privacy.hideIndividuals) {
      throw new ServiceError(
        d.field == 'member' ? individualsHiddenError : filtersHiddenError
      );
    }

    if (d.values) {
      let values = unique(d.values);
      return await fromService(() => this.describeValues({ ...d, values, range, now }));
    }

    return await cachedRead({
      scope: d,
      read: 'filterValues.list',
      input: { field: d.field, search, range: rangeCacheKey(range, now) },
      load: async instanceId => {
        let resolved = resolveRange(range, now);
        let agentTracking = requireAgentTracking();

        let result = await agentTracking.query.values(
          {
            organizationId: d.organization.id,
            scope: { instanceIds: [instanceId] },
            dataset: 'usage',
            field: filterFields[d.field],
            search,
            range: queryRange(resolved),
            limit: filterValuesLimit
          },
          queryCallOptions
        );

        let values = result.values.filter(
          (item): item is typeof item & { value: string } => typeof item.value == 'string'
        );

        let members =
          d.field == 'member'
            ? await lookupMembers({
                scope: d,
                ids: values.map(item => item.value),
                names: new Map(values.map(item => [item.value, item.label?.name ?? null]))
              })
            : new Map<string, AgentTrackingMember>();

        let items = values.map(item =>
          filterValueItem(
            d.field,
            d.field == 'client' ? fromServiceFamily(item.value) : item.value,
            {
              member: members.get(item.value),
              name: item.label?.name,
              requests: item.count
            }
          )
        );

        let unknownName = unknownNames[d.field];
        let offerUnknown =
          !!unknownName &&
          (!search || unknownName.toLowerCase().includes(search.toLowerCase()));

        return {
          field: d.field,
          range: resolved,
          items: offerUnknown ? [...items, unknownOption] : items,
          truncated: result.truncated
        };
      }
    });
  }

  private async describeValues(
    d: ReadScope & {
      field: FilterField;
      values: string[];
      range: NormalizedRange;
      now: Date;
    }
  ): Promise<AgentTrackingFilterValues> {
    let resolved = resolveRange(d.range, d.now);
    let withUnknown = !!unknownNames[d.field] && d.values.includes(unknownMemberKey);
    let named = d.values.filter(
      value => !(withUnknown && value == unknownMemberKey) && isFilterValueOf(d.field, value)
    );

    let items =
      d.field == 'member' && named.length
        ? await cached({
            key: await cacheKey({
              organizationId: d.organization.id,
              instanceId: d.instance.id,
              read: 'filterValues.describe',
              input: { field: d.field, values: named }
            }),
            load: () => this.describeNamed({ ...d, values: named })
          })
        : await this.describeNamed({ ...d, values: named });

    return {
      field: d.field,
      range: resolved,
      items: withUnknown ? [...items, unknownOption] : items,
      truncated: false
    };
  }

  private async describeNamed(
    d: ReadScope & { field: FilterField; values: string[] }
  ): Promise<AgentTrackingFilterValue[]> {
    if (!d.values.length) return [];

    let [members, names] = await Promise.all([
      d.field == 'member' ? lookupMembers({ scope: d, ids: d.values }) : undefined,
      d.field == 'model' ? lookupModelNames(d.values) : undefined
    ]);

    return d.values.map(value =>
      filterValueItem(d.field, value, {
        member: members?.get(value),
        name: names?.get(value)
      })
    );
  }
}

export let agentTrackingFilterValueService = Service.create(
  'agentTrackingFilterValueService',
  () => new AgentTrackingFilterValueServiceImpl()
).build();
