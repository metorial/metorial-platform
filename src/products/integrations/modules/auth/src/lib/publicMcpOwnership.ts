import { withTransaction } from '@metorial-subspace/db';

export let stampPublicMcpOwnership = async (d: {
  ownerPublicMcpServerOid: bigint | null | undefined;
  authConfigOid?: bigint | null;
  configOid?: bigint | null;
  oauthSetupOid?: bigint | null;
}) => {
  let ownerPublicMcpServerOid = d.ownerPublicMcpServerOid;
  if (!ownerPublicMcpServerOid) return;

  await withTransaction(async db => {
    if (d.authConfigOid) {
      await db.providerAuthConfig.updateMany({
        where: { oid: d.authConfigOid },
        data: { ownerPublicMcpServerOid, source: 'public_mcp', isDefault: false }
      });
      await db.providerDeployment.updateMany({
        where: { defaultAuthConfigOid: d.authConfigOid },
        data: { defaultAuthConfigOid: null }
      });
    }

    if (d.configOid) {
      await db.providerConfig.updateMany({
        where: { oid: d.configOid },
        data: { ownerPublicMcpServerOid, isDefault: false }
      });
      await db.providerDeployment.updateMany({
        where: { defaultConfigOid: d.configOid },
        data: { defaultConfigOid: null }
      });
    }

    if (d.oauthSetupOid) {
      await db.providerOAuthSetup.updateMany({
        where: { oid: d.oauthSetupOid },
        data: { ownerPublicMcpServerOid }
      });
    }
  });
};
