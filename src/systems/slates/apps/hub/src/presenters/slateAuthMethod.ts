import type { Slate, SlateAuthMethod } from '../../prisma/generated/client';

export let slateAuthMethodPresenter = (
  method: SlateAuthMethod & {
    slate: Slate;
  }
) => ({
  object: 'slate.auth_method',

  id: method.id,
  slateId: method.slate.id,

  identifier: method.identifier,

  name: method.name,
  key: method.key,
  type: method.type,

  capabilities: method.spec.capabilities,
  inputSchema: method.spec.inputSchema,
  outputSchema: method.spec.outputSchema,
  scopes: method.spec.scopes,

  createdAt: method.createdAt
});
