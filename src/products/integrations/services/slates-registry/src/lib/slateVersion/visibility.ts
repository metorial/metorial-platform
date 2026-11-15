import type { Prisma } from '../../../prisma/generated/client';

export let buildSlateSupportsPrebuiltWhere = (
  supportsPrebuilt?: boolean
): Prisma.SlateWhereInput => {
  if (supportsPrebuilt === true) {
    return {
      OR: [
        { unbuiltCurrentVersionOid: { not: null } },
        { builtOrUnbuiltCurrentVersionOid: { not: null } }
      ]
    };
  }

  return { unbuiltCurrentVersionOid: { not: null } };
};

export let buildChangeNotificationSupportsPrebuiltWhere = (
  supportsPrebuilt?: boolean
): Prisma.ChangeNotificationWhereInput => {
  if (supportsPrebuilt === true) {
    return {
      slate: {
        OR: [
          { unbuiltCurrentVersionOid: { not: null } },
          { builtOrUnbuiltCurrentVersionOid: { not: null } }
        ]
      }
    };
  }

  return {
    AND: [
      {
        OR: [{ slateVersionOid: null }, { slateVersion: { backend: 'local_unbuilt' as const } }]
      },
      { slate: { unbuiltCurrentVersionOid: { not: null } } }
    ]
  };
};
