import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useMagicMcpServer,
  useProviderDeployments,
  useSessionTemplateProviders
} from '@metorial/state';
import { useParams } from 'react-router-dom';
import { SessionTemplateProvidersManager } from '../../../scenes/sessionTemplates/providersManager';

export let MagicMcpServerProvidersPage = () => {
  let instance = useCurrentInstance();
  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);
  let templateProviders = useSessionTemplateProviders(
    instance.data?.id,
    server.data?.sessionTemplateId
  );
  let deployments = useProviderDeployments(instance.data?.id);

  return renderWithLoader({ server, templateProviders, deployments })(({ server }) =>
    server.data.sessionTemplateId ? (
      <>
        <SessionTemplateProvidersManager
          instanceId={instance.data!.id}
          sessionTemplateId={server.data.sessionTemplateId}
        />
      </>
    ) : null
  );
};
