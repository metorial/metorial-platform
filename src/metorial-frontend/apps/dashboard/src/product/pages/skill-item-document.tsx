import { DocumentEditorScene } from '@metorial/scene-docs';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useSkill,
  useStoreItem
} from '@metorial/state';
import { useNavigate, useParams } from 'react-router-dom';

export let SkillItemDocumentPage = () => {
  let { skillId, itemId } = useParams();
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();
  let skill = useSkill(instance.data?.id, skillId);
  let item = useStoreItem(instance.data?.id, skill.data?.storeId, itemId);

  return (
    <DocumentEditorScene
      instanceId={instance.data?.id}
      documentId={item.data?.document?.id}
      loadError={skill.error ?? item.error}
      onBack={() => navigate(-1)}
      setRestrictHeight={enabled => (window as any).metorial_setRestrictHeight?.(enabled)}
      hideSharingControls
      skillShareContext={
        skillId
          ? {
              mode: 'dashboard',
              organizationId: organization.data?.id,
              skills: [{ id: skillId, name: skill.data?.name ?? null }]
            }
          : null
      }
    />
  );
};
