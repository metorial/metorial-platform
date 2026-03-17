import {
  instancePresenter,
  portalPresenter,
  portalFeaturedContentPresenter,
  sessionPresenter
} from '../presenters';

type PortalBootSharedResponse = {
  portal: Awaited<ReturnType<typeof portalPresenter>>;
  instance: ReturnType<typeof instancePresenter>;
  portalUrl: string;
  publishableApiKey: string;
};

export let createUnauthenticatedPortalBootResponse = (d: PortalBootSharedResponse) => ({
  ...d,
  type: 'unauthenticated' as const,
  session: null,
  consumerSessionToken: null
});

export let createAuthenticatedPortalBootResponse = (
  d: PortalBootSharedResponse & {
    featuredContent: ReturnType<typeof portalFeaturedContentPresenter>;
    session: ReturnType<typeof sessionPresenter>;
    consumerSessionToken: {
      token: string;
      expiresAt: Date;
    };
  }
) => ({
  ...d,
  type: 'authenticated' as const
});
