import { renderWithLoader } from '@metorial/data-hooks';
import { DocumentEditorScene } from '@metorial/scene-docs';
import { useCurrentInstance } from '@metorial/state';
import { useNavigate, useParams } from 'react-router-dom';

export let DocumentPage = () => {
  let { id } = useParams();
  let navigate = useNavigate();
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <DocumentEditorScene
      instanceId={instance.data.id}
      documentId={id}
      onBack={() => navigate(-1)}
      setRestrictHeight={enabled => (window as any).metorial_setRestrictHeight?.(enabled)}
    />
  ));
};
