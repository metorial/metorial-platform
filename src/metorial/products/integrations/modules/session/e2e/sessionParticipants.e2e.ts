import {
  connectSession,
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { sessionParticipantService, sessionService } from '../src';
import { createDeployment, sessionScope, useRemoteProviders } from './_fixtures';

describe('module-session session participants', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();
  let providers = useRemoteProviders({ org, otherOrg, server });

  it('hides participants of owner-only sessions from members by id and in lists', async () => {
    let scope = await sessionScope(org);
    let deploymentId = await createDeployment(org, providers.first);
    let session = await sessionService.createSession({
      ...scope,
      input: { name: uniqueId('session'), providers: [{ deploymentId }] }
    });

    let client = connectSession(session.id, org.keys.instanceSecret);
    expect((await client.initialize()).status).toBe(200);

    let participant = await eventually(async () => {
      let participants = await firstPage(
        await sessionParticipantService.listSessionParticipants({
          ...scope,
          sessionIds: [session.id]
        })
      );
      expect(participants.length).toBeGreaterThanOrEqual(1);
      return participants[0]!;
    });

    let { actor } = await loadOrganizationFixture(org.ids);
    let asMember = { instance: scope.instance, organizationActor: actor };
    let getAsMember = () =>
      sessionParticipantService.getSessionParticipantById({
        ...asMember,
        sessionParticipantId: participant.id
      });
    let listAsMember = async () =>
      (await firstPage(await sessionParticipantService.listSessionParticipants(asMember))).map(
        item => item.id
      );

    expect((await getAsMember()).id).toBe(participant.id);
    expect(await listAsMember()).toContain(participant.id);

    let row = await subspaceDb.sessionParticipant.findUniqueOrThrow({
      where: { id: participant.id }
    });
    await subspaceDb.session.updateMany({
      where: {
        OR: [
          { connections: { some: { participantOid: row.oid } } },
          { sessionMessages: { some: { senderParticipantOid: row.oid } } },
          { sessionMessages: { some: { responderParticipantOid: row.oid } } }
        ]
      },
      data: { isOwnerOnlyVisible: true }
    });

    await expectServiceError(getAsMember(), 'not_found');
    expect(await listAsMember()).not.toContain(participant.id);

    let internal = await sessionParticipantService.getSessionParticipantById({
      instance: scope.instance,
      sessionParticipantId: participant.id
    });
    expect(internal.id).toBe(participant.id);
  });
});
