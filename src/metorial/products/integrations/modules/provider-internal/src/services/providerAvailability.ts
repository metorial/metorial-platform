import { Service } from '@lowerdeck/service';
import { db } from '@metorial-subspace/db';
import { providerUpdatedQueue } from '../queues/lifecycle/provider';

let getSlateIdentifierVariants = (slateIdentifier: string) => {
  let normalized = slateIdentifier.replace(/^@/, '');
  return [normalized, `@${normalized}`];
};

let getSlateProvidersWhere = (slateIdentifiers: string[]) => ({
  ownerTenantOid: null,
  variants: {
    some: {
      slate: {
        identifierInRegistry: { in: slateIdentifiers.flatMap(getSlateIdentifierVariants) }
      }
    }
  }
});

class providerAvailabilityServiceImpl {
  async setSlateProvidersDisabled(d: { slateIdentifier: string; isDisabled: boolean }) {
    let providers = await db.provider.findMany({
      where: getSlateProvidersWhere([d.slateIdentifier]),
      select: { oid: true, id: true }
    });
    if (!providers.length) return { providerIds: [] };

    await db.provider.updateMany({
      where: { oid: { in: providers.map(provider => provider.oid) } },
      data: { isDisabled: d.isDisabled, disabledAt: d.isDisabled ? new Date() : null }
    });

    await providerUpdatedQueue.addMany(
      providers.map(provider => ({ providerId: provider.id }))
    );

    return { providerIds: providers.map(provider => provider.id) };
  }

  async getDisabledSlateIdentifiers(d: { slateIdentifiers: string[] }) {
    if (!d.slateIdentifiers.length) return new Set<string>();

    let providers = await db.provider.findMany({
      where: { ...getSlateProvidersWhere(d.slateIdentifiers), isDisabled: true },
      select: { variants: { select: { slate: { select: { identifierInRegistry: true } } } } }
    });

    return new Set(
      providers.flatMap(provider =>
        provider.variants.flatMap(variant =>
          variant.slate?.identifierInRegistry
            ? [variant.slate.identifierInRegistry.replace(/^@/, '')]
            : []
        )
      )
    );
  }
}

export let providerAvailabilityService = Service.create(
  'providerAvailabilityService',
  () => new providerAvailabilityServiceImpl()
).build();
