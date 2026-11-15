import { renderWithLoader } from '@metorial/data-hooks';
import { DocumentEditorScene } from '@metorial/scene-docs';
import { SkillItemScene, useSkillWorkspace } from '@metorial/scene-skills';
import { useCurrentInstance, useSkillTemplate } from '@metorial/state';
import { useNavigate, useParams } from 'react-router-dom';

export let SkillTemplateItemPage = () => {
  let { skillTemplateId, itemId } = useParams();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let workspace = useSkillWorkspace();
  let skillTemplate = useSkillTemplate(instance.data?.id, skillTemplateId);
  let setRestrictHeight = (enabled: boolean) =>
    (window as any).metorial_setRestrictHeight?.(enabled);

  return renderWithLoader(
    { skillTemplate },
    { spaceTop: 20 }
  )(({ skillTemplate }) => (
    <SkillItemScene
      instanceId={instance.data?.id}
      storeId={skillTemplate.data.storeId}
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
        />
      )}
    />
  ));
};
