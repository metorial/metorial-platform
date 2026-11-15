import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { getSkillClientNameFromTitle } from '../lib/skillClientName';
import { enqueueSkillLifecycle } from '../queues/lifecycle';

let isSkillRootPath = (path: string) => path.replace(/^\/+/, '').toLowerCase() == 'skill.md';

Fabric.listen('document.title_changed:after', async ({ documentId, previousTitle, title }) => {
  let nextClientName = getSkillClientNameFromTitle(title);
  if (!nextClientName) return;

  let item = await db.storeItem.findFirst({
    where: { document: { id: documentId } },
    select: { path: true, storeOid: true }
  });
  if (!item || !isSkillRootPath(item.path)) return;

  let skill = await db.skill.findFirst({
    where: { storeOid: item.storeOid },
    select: { id: true, clientName: true }
  });
  if (!skill) return;

  let followsTitle =
    !skill.clientName || skill.clientName == getSkillClientNameFromTitle(previousTitle);
  if (!followsTitle || skill.clientName == nextClientName) return;

  await db.skill.update({ where: { id: skill.id }, data: { clientName: nextClientName } });
  await enqueueSkillLifecycle({ skillId: skill.id, event: 'updated' });
});
