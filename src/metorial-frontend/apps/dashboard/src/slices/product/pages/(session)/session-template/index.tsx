import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useSessionTemplate,
  useSessionTemplateProviders
} from '@metorial/state';
import { Attributes, Button, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import {
  SessionTemplateProvidersManager,
  showAddProviderSidePanel
} from '../../../scenes/sessionTemplates/providersManager';

export let SessionTemplateOverviewPage = () => {
  let instance = useCurrentInstance();

  let { sessionTemplateId } = useParams();
  let template = useSessionTemplate(instance.data?.id, sessionTemplateId);
  let providers = useSessionTemplateProviders(instance.data?.id, sessionTemplateId);

  return renderWithLoader({ template })(({ template }) => {
    return (
      <>
        <Attributes
          itemWidth="450px"
          attributes={[
            {
              label: 'ID',
              content: <ID id={template.data.id} />
            },
            {
              label: 'Created',
              content: <RenderDate date={template.data.createdAt!} />
            }
          ]}
        />

        <Spacer height={20} />

        <Box
          title="Connected Providers"
          description="Managed which providers and configurations are available when creating sessions from this template."
          rightActions={
            <Button
              size="2"
              onClick={() =>
                showAddProviderSidePanel({
                  instanceId: instance.data!.id,
                  sessionTemplateId: sessionTemplateId!,
                  onComplete: () => providers.refetch()
                })
              }
            >
              Add Provider
            </Button>
          }
        >
          <SessionTemplateProvidersManager
            instanceId={instance.data!.id}
            sessionTemplateId={template.data.id}
          />
        </Box>
      </>
    );
  });
};
