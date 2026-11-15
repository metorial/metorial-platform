import { Service } from '@lowerdeck/service';
import { db, Namespace, NamespaceCompartment, NamespaceProperty } from '@metorial/db';

export type NamespaceWithCompartment = Namespace & { compartment: NamespaceCompartment };

export type NamespacePropertyWithNamespace = NamespaceProperty & {
  namespace: NamespaceWithCompartment;
};

// Priority lives on the compartment, so equally ranked compartments need a deterministic
// tiebreaker to keep the boot payload stable between requests.
let compareProperties = (
  a: NamespacePropertyWithNamespace,
  b: NamespacePropertyWithNamespace
) =>
  b.namespace.compartment.priority - a.namespace.compartment.priority ||
  a.namespace.compartment.value.localeCompare(b.namespace.compartment.value) ||
  a.namespace.value.localeCompare(b.namespace.value);

let groupProperties = (
  properties: NamespacePropertyWithNamespace[],
  getOwnerOid: (property: NamespacePropertyWithNamespace) => bigint | null
) => {
  let propertiesByOwnerOid = new Map<bigint, NamespacePropertyWithNamespace[]>();

  for (let property of properties) {
    let ownerOid = getOwnerOid(property);
    if (ownerOid == null) continue;

    let ownerProperties = propertiesByOwnerOid.get(ownerOid);
    if (ownerProperties) ownerProperties.push(property);
    else propertiesByOwnerOid.set(ownerOid, [property]);
  }

  for (let ownerProperties of propertiesByOwnerOid.values()) {
    ownerProperties.sort(compareProperties);
  }

  return propertiesByOwnerOid;
};

class NamespaceServiceImpl {
  async getNamespacePropertiesByOrganizationOid(d: { organizations: { oid: bigint }[] }) {
    if (!d.organizations.length) {
      return new Map<bigint, NamespacePropertyWithNamespace[]>();
    }

    let properties = await db.namespaceProperty.findMany({
      where: {
        type: 'organization',
        organizationOid: { in: d.organizations.map(organization => organization.oid) }
      },
      include: { namespace: { include: { compartment: true } } }
    });

    return groupProperties(properties, property => property.organizationOid);
  }

  async getNamespacePropertiesByPortalOid(d: { portals: { oid: bigint }[] }) {
    if (!d.portals.length) return new Map<bigint, NamespacePropertyWithNamespace[]>();

    let properties = await db.namespaceProperty.findMany({
      where: {
        type: 'portal',
        portalOid: { in: d.portals.map(portal => portal.oid) }
      },
      include: { namespace: { include: { compartment: true } } }
    });

    return groupProperties(properties, property => property.portalOid);
  }
}

export let namespaceService = Service.create(
  'namespace',
  () => new NamespaceServiceImpl()
).build();
