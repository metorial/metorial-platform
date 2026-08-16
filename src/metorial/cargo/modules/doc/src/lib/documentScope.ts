import { ServiceError, preconditionFailedError } from '@lowerdeck/error';

export let requireDocumentScope = (document: {
  id: string;
  projectOid: bigint | null;
  instanceOid: bigint | null;
}) => {
  if (document.projectOid == null || document.instanceOid == null) {
    throw new ServiceError(
      preconditionFailedError({
        message: `Document ${document.id} is not linked to a project and instance`
      })
    );
  }

  return {
    project: { oid: document.projectOid },
    instance: { oid: document.instanceOid }
  };
};
