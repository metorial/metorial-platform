import { PaginationSearchParamsProvider, renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { AlertsTable } from '../../../scenes/monitoring/alertsTable';

let PageWrapper = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export let MonitorPage = () => {
  let instance = useCurrentInstance();
  let { monitorId } = useParams();

  return renderWithLoader({ instance })(({}) => (
    <PageWrapper>
      <PaginationSearchParamsProvider enabled={true}>
        <AlertsTable monitorId={monitorId} />
      </PaginationSearchParamsProvider>
    </PageWrapper>
  ));
};
