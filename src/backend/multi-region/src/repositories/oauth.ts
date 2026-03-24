import { Service } from '@lowerdeck/service';
import { cell } from '../cell';
import { globalDB, Prisma } from '../db';

let oauthApplicationInclude = {
  owner: true,
  organization: true,
  clientSecrets: true
} as const;

let oauthAuthorizationRequestInclude = {
  oauthApplication: {
    include: oauthApplicationInclude
  },
  createdBy: true,
  claimedBy: true,
  user: true
} as const;

let oauthTokenInclude = {
  owner: true,
  oauthApplication: {
    include: oauthApplicationInclude
  }
} as const;

class OAuthGlobalRepository {
  async getOAuthApplicationByClientId(d: { clientId: string }) {
    return await globalDB.oAuthApplication.findFirst({
      where: {
        clientId: d.clientId
      },
      include: oauthApplicationInclude
    });
  }

  async getCliAuthOAuthApplication() {
    return await globalDB.oAuthApplication.findFirst({
      where: {
        type: 'cli_auth',
        status: 'active'
      },
      include: oauthApplicationInclude
    });
  }

  async createOAuthAuthorizationRequest(d: {
    id: string;
    oauthApplicationId: string;
    type: 'interactive' | 'device_code';
    scopes: string[];
    oidcScopes?: string[];
    urlToken: string;
    code: string;
    deviceCode?: string | null;
    userCode?: string | null;
    clientIp?: string | null;
    state?: string | null;
    redirectUri?: string | null;
    nonce?: string | null;
    codeChallengeMethod: 'none' | 's256';
    codeChallenge?: string | null;
    expiresAt: Date;
  }) {
    return await globalDB.oAuthAuthorizationRequest.create({
      data: {
        id: d.id,
        type: d.type,
        status: 'pending',
        scopes: d.scopes,
        oidcScopes: d.oidcScopes ?? [],
        urlToken: d.urlToken,
        code: d.code,
        deviceCode: d.deviceCode ?? null,
        userCode: d.userCode ?? null,
        clientIp: d.clientIp ?? null,
        state: d.state ?? null,
        redirectUri: d.redirectUri ?? null,
        nonce: d.nonce ?? null,
        codeChallengeMethod: d.codeChallengeMethod,
        codeChallenge: d.codeChallenge ?? null,
        expiresAt: d.expiresAt,
        oauthApplicationId: d.oauthApplicationId,
        createdByOid: (await cell).oid
      },
      include: oauthAuthorizationRequestInclude
    });
  }

  async getOAuthAuthorizationRequestByUrlToken(d: { urlToken: string }) {
    return await globalDB.oAuthAuthorizationRequest.findFirst({
      where: {
        urlToken: d.urlToken
      },
      include: oauthAuthorizationRequestInclude
    });
  }

  async getOAuthAuthorizationRequestByCode(d: { code: string }) {
    return await globalDB.oAuthAuthorizationRequest.findFirst({
      where: {
        code: d.code
      },
      include: oauthAuthorizationRequestInclude
    });
  }

  async getOAuthAuthorizationRequestByDeviceCode(d: { deviceCode: string }) {
    return await globalDB.oAuthAuthorizationRequest.findFirst({
      where: {
        deviceCode: d.deviceCode
      },
      include: oauthAuthorizationRequestInclude
    });
  }

  async getOAuthAuthorizationRequestById(d: { id: string }) {
    return await globalDB.oAuthAuthorizationRequest.findFirst({
      where: {
        id: d.id
      },
      include: oauthAuthorizationRequestInclude
    });
  }

  async touchOAuthAuthorizationRequestPoll(d: { id: string; at: Date }) {
    return await globalDB.oAuthAuthorizationRequest.update({
      where: {
        id: d.id
      },
      data: {
        lastPollAt: d.at
      },
      include: oauthAuthorizationRequestInclude
    });
  }

  async claimOAuthAuthorizationRequest(d: { id: string }) {
    let currentCell = await cell;
    let accepted = await globalDB.$transaction(async tx => {
      let count = await tx.oAuthAuthorizationRequest.updateMany({
        where: {
          id: d.id,
          status: 'pending',
          claimedByOid: null,
          expiresAt: {
            gt: new Date()
          }
        },
        data: {
          claimedByOid: currentCell.oid
        }
      });

      if (count.count !== 1) return null;

      return await tx.oAuthAuthorizationRequest.findFirst({
        where: {
          id: d.id
        },
        include: oauthAuthorizationRequestInclude
      });
    });

    return accepted;
  }

  async acceptOAuthAuthorizationRequest(d: { id: string; userId: string; expiresAt: Date }) {
    let currentCell = await cell;

    return await globalDB.$transaction(async tx => {
      let count = await tx.oAuthAuthorizationRequest.updateMany({
        where: {
          id: d.id,
          status: 'pending',
          claimedByOid: currentCell.oid
        },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
          userId: d.userId,
          expiresAt: d.expiresAt
        }
      });

      if (count.count !== 1) return null;

      return await tx.oAuthAuthorizationRequest.findFirst({
        where: {
          id: d.id
        },
        include: oauthAuthorizationRequestInclude
      });
    });
  }

  async rejectOAuthAuthorizationRequest(d: { id: string; userId: string }) {
    return await globalDB.$transaction(async tx => {
      let count = await tx.oAuthAuthorizationRequest.updateMany({
        where: {
          id: d.id,
          status: 'pending'
        },
        data: {
          status: 'denied',
          deniedAt: new Date(),
          userId: d.userId
        }
      });

      if (count.count !== 1) return null;

      return await tx.oAuthAuthorizationRequest.findFirst({
        where: {
          id: d.id
        },
        include: oauthAuthorizationRequestInclude
      });
    });
  }

  async getOAuthTokenByRefreshToken(d: { refreshToken: string }) {
    return await globalDB.oAuthToken.findFirst({
      where: {
        refreshToken: d.refreshToken
      },
      include: oauthTokenInclude
    });
  }

  async getOAuthTokenByAccessToken(d: { accessToken: string }) {
    return await globalDB.oAuthToken.findFirst({
      where: {
        accessToken: d.accessToken
      },
      include: oauthTokenInclude
    });
  }
}

export let oauthGlobalRepository = Service.create(
  'oauthGlobalRepository',
  () => new OAuthGlobalRepository()
).build();

export type GlobalOAuthApplicationWithRelations = Prisma.OAuthApplicationGetPayload<{
  include: typeof oauthApplicationInclude;
}>;

export type GlobalOAuthAuthorizationRequestWithRelations =
  Prisma.OAuthAuthorizationRequestGetPayload<{
    include: typeof oauthAuthorizationRequestInclude;
  }>;

export type GlobalOAuthTokenWithRelations = Prisma.OAuthTokenGetPayload<{
  include: typeof oauthTokenInclude;
}>;
