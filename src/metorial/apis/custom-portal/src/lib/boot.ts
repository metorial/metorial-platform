import type { Flags } from '@metorial/module-flags';
import { instancePresenter, portalPresenter, sessionPresenter } from '../presenters';
import { brandPresenter } from '../presenters/brand';

type PortalBootSharedResponse = {
  portal: Awaited<ReturnType<typeof portalPresenter>>;
  instance: ReturnType<typeof instancePresenter>;
  portalUrl: string;
  publishableApiKey: string;
  brand: Awaited<ReturnType<typeof brandPresenter>>;
  portalMagicMcpUrl: string;
  flags: Flags;
};

export let createUnauthenticatedPortalBootResponse = async (d: PortalBootSharedResponse) => ({
  ...d,
  type: 'unauthenticated' as const,
  session: null,
  consumerSessionToken: null
});

export let createAuthenticatedPortalBootResponse = async (
  d: PortalBootSharedResponse & {
    session: ReturnType<typeof sessionPresenter>;
    consumerSessionToken: { token: string; expiresAt: Date };
  }
) => ({
  ...d,
  type: 'authenticated' as const
});
