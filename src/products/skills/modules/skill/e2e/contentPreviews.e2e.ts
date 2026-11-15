import { useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { consumerSkillReadRoles } from '@metorial/module-access';
import { describe, expect, it } from 'vitest';
import { skillContentPreviewService, skillService } from '../src';
import {
  consumerAuthorization,
  createConsumerAccessTag,
  createSkill,
  grantAccess,
  privileged
} from './_fixtures';

describe('module-skill content previews', () => {
  let org = useOrganization();

  it('only previews active skills granted to a consumer access tag', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { accessTag, accessTags } = await createConsumerAccessTag(fixture);

    let granted = await createSkill(fixture);
    let ungranted = await createSkill(fixture);
    let archived = await createSkill(fixture);
    await grantAccess(fixture, { accessTag, roles: consumerSkillReadRoles, skill: granted });
    await grantAccess(fixture, { accessTag, roles: consumerSkillReadRoles, skill: archived });
    await skillService.archiveSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skill: archived,
      authorization: privileged
    });

    let previews = await skillContentPreviewService.listSkillContentPreviews({
      project: fixture.project,
      instance: fixture.instance,
      authorization: await consumerAuthorization(fixture, accessTags),
      accessTags,
      skillIds: [granted.id, ungranted.id, archived.id],
      skillTemplateIds: []
    });

    expect(previews.map(preview => preview.type == 'skill' && preview.skillId)).toEqual([
      granted.id
    ]);
  });
});
