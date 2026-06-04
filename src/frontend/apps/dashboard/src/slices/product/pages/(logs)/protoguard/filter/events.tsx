import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ProtoGuardAlertsTable } from '../../../../scenes/monitoring/protoGuardAlertsTable';

export let ProtoGuardFilterEventsPage = () => {
  let instance = useCurrentInstance();
  let { filterId } = useParams();

  return renderWithLoader({ instance })(({}) => <ProtoGuardAlertsTable filterId={filterId} />);
};
