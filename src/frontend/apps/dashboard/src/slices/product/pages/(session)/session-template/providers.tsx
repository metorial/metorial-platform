import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useSessionTemplate } from '@metorial/state';
import { Spacer } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { SessionTemplateProvidersManager } from '../../../scenes/sessionTemplates/providersManager';

export let SessionTemplateProvidersPage = () => {
  let instance = useCurrentInstance();
  let { sessionTemplateId } = useParams();
  let template = useSessionTemplate(instance.data?.id, sessionTemplateId);

  return renderWithLoader({ template })(({ template }) => (
    <>
      <Spacer size={16} />

      <SessionTemplateProvidersManager
        instanceId={instance.data!.id}
        sessionTemplateId={template.data.id}
      />
    </>
  ));
};
