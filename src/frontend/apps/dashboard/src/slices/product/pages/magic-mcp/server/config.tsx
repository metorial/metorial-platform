import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useMagicMcpServer } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { MagicMcpServerForm } from '../../../scenes/serverDeployments/form';

export let MagicMcpServerConfigPage = () => {
  let instance = useCurrentInstance();

  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);

  return renderWithLoader({ server })(({ server }) => (
    <MagicMcpServerForm type="update" magicMcpServerId={server.data.id} />
  ));
};
