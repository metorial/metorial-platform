import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  sessionErrorService,
  sessionEventService,
  sessionService,
  sessionTemplateService
} from '../src';

describe('module-session', () => {
  let org = useOrganization();

  it('creates, updates and archives a session without providers', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('session');

    let session = await sessionService.createSession({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name, metadata: { e2e: true }, providers: [] }
    });
    expect(session.name).toBe(name);
    expect(session.status).toBe('active');
    expect(session.clientSecret).toBeTruthy();

    let fetched = await sessionService.getSessionById({
      instance: fixture.instance,
      sessionId: session.id
    });
    expect(fetched.id).toBe(session.id);
    expect(fetched.clientSecret).toBe(session.clientSecret);

    let listed = await firstPage(
      await sessionService.listSessions({ instance: fixture.instance, ids: [session.id] })
    );
    expect(listed.map(item => item.id)).toEqual([session.id]);

    let events = await firstPage(
      await sessionEventService.listSessionEvents({
        instance: fixture.instance,
        sessionIds: [session.id]
      })
    );
    expect(events.map(event => event.type)).toContain('session_created');

    let renamed = uniqueId('renamed');
    let updated = await sessionService.updateSession({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      session: fetched,
      input: { name: renamed }
    });
    expect(updated.name).toBe(renamed);

    let archived = await sessionService.archiveSession({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      session: updated
    });
    expect(archived.status).toBe('archived');

    let afterArchive = await firstPage(
      await sessionService.listSessions({ instance: fixture.instance, ids: [session.id] })
    );
    expect(afterArchive).toEqual([]);
    expect(
      (
        await sessionService.getSessionById({
          instance: fixture.instance,
          sessionId: session.id
        })
      ).status
    ).toBe('archived');
  });

  it('creates, updates and archives a session template', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('template');

    let template = await sessionTemplateService.createSessionTemplate({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name, providers: [] }
    });
    expect(template.name).toBe(name);

    let fetched = await sessionTemplateService.getSessionTemplateById({
      instance: fixture.instance,
      sessionTemplateId: template.id
    });
    expect(fetched.id).toBe(template.id);

    let listed = await firstPage(
      await sessionTemplateService.listSessionTemplates({
        instance: fixture.instance,
        ids: [template.id]
      })
    );
    expect(listed.map(item => item.id)).toEqual([template.id]);

    let renamed = uniqueId('renamed');
    let updated = await sessionTemplateService.updateSessionTemplate({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      template: fetched,
      input: { name: renamed }
    });
    expect(updated.name).toBe(renamed);

    let archived = await sessionTemplateService.archiveSessionTemplate({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      sessionTemplate: updated
    });
    expect(archived.status).toBe('archived');

    let afterArchive = await firstPage(
      await sessionTemplateService.listSessionTemplates({
        instance: fixture.instance,
        ids: [template.id]
      })
    );
    expect(afterArchive).toEqual([]);
  });

  it('serves an empty error list and rejects unknown ids', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let errors = await firstPage(
      await sessionErrorService.listSessionErrors({ instance: fixture.instance })
    );
    expect(errors).toEqual([]);

    await expect(
      sessionService.getSessionById({ instance: fixture.instance, sessionId: uniqueId('ses') })
    ).rejects.toThrow();
    await expect(
      sessionTemplateService.getSessionTemplateById({
        instance: fixture.instance,
        sessionTemplateId: uniqueId('sest')
      })
    ).rejects.toThrow();
  });
});
