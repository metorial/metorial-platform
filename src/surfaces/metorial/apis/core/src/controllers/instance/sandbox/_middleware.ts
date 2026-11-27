import { badRequestError, ServiceError } from '@lowerdeck/error';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup } from '../../../middleware/instanceGroup';

export let sandboxReadScopes = ['instance.sandbox:read'] as const;
export let sandboxWriteScopes = ['instance.sandbox:write'] as const;

export let sandboxInstanceGroup = instanceGroup.use(
  hasFlags(['sandbox-enabled', 'paid-sandboxes'])
);

export let requirePathParam = (params: Record<string, string | undefined>, name: string) => {
  let value = params[name];

  if (!value) {
    throw new ServiceError(
      badRequestError({
        message: `${name} is required`,
        description: `The ${name} path parameter is required.`
      })
    );
  }

  return value;
};
