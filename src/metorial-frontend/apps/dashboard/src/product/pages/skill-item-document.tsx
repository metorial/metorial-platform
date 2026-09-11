import { renderWithLoader } from '@metorial/data-hooks';
import { DocumentEditorScene } from '@metorial/scene-docs';
import { isSkillTextFile, SkillTextFileEditorScene } from '@metorial/scene-skills';
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
    <>
      {renderWithLoader(
        { item, skill },
        { spaceTop: 20 }
      )(({ item, skill }) => {
        if (
          item.data.kind == 'file' &&
          item.data.file &&
          isSkillTextFile({ fileName: item.data.path, fileType: item.data.file.fileType })
        ) {
          return (
            <SkillTextFileEditorScene
              instanceId={instance.data?.id}
              itemId={item.data.id}
              setRestrictHeight={enabled =>
                (window as any).metorial_setRestrictHeight?.(enabled)
              }
              storeId={skill.data.storeId}
            />
          );
        }

        return (
          <DocumentEditorScene
            instanceId={instance.data?.id}
            documentId={item.data.document?.id}
            onBack={() => navigate(-1)}
            setRestrictHeight={enabled =>
              (window as any).metorial_setRestrictHeight?.(enabled)
            }
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
        );
      })}
    </>
  );
};
