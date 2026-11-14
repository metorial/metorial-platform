import { renderWithLoader } from '@metorial/data-hooks';
import { DocumentEditorScene } from '@metorial/scene-docs';
import { SkillItemScene, useSkillWorkspace } from '@metorial/scene-skills';
import { useCurrentInstance, useCurrentOrganization, useSkill } from '@metorial/state';
import { useNavigate, useParams } from 'react-router-dom';

export let SkillItemDocumentPage = () => {
  let { skillId, itemId } = useParams();
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();
  let workspace = useSkillWorkspace();
  let skill = useSkill(instance.data?.id, skillId);
  let setRestrictHeight = (enabled: boolean) =>
    (window as any).metorial_setRestrictHeight?.(enabled);

  return (
    <>
      {renderWithLoader(
        { skill },
        { spaceTop: 20 }
      )(({ skill }) => (
        <SkillItemScene
          instanceId={instance.data?.id}
          storeId={skill.data.storeId}
          itemId={itemId}
          setRestrictHeight={setRestrictHeight}
          renderDocument={documentId => (
            <DocumentEditorScene
              instanceId={instance.data?.id}
              documentId={documentId}
              chrome={workspace ? 'external' : undefined}
              onBack={() => navigate(-1)}
              setRestrictHeight={setRestrictHeight}
              hideSharingControls
              skillShareContext={
                skillId
                  ? {
                      mode: 'dashboard',
                      organizationId: organization.data?.id,
                      skills: [{ id: skillId, name: skill.data.name }]
                    }
                  : null
              }
            />
          )}
        />
      ))}
    </>
  );
};
