import {
  presentInstance,
  presentPortal,
  presentPortalFeaturedContent,
  presentSession
} from '../presenters';

type PortalBootSharedResponse = {
  portal: Awaited<ReturnType<typeof presentPortal>>;
  instance: ReturnType<typeof presentInstance>;
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
    featuredContent: ReturnType<typeof presentPortalFeaturedContent>;
    session: ReturnType<typeof presentSession>;
    consumerSessionToken: {
      token: string;
      expiresAt: Date;
    };
  }
) => ({
  ...d,
  type: 'authenticated' as const
});
