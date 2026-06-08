import { PaginationSearchParamsProvider, renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { ProtoGuardAlertsTable } from '../../../../scenes/monitoring/protoGuardAlertsTable';

let PageWrapper = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export let ProtoGuardFilterEventsPage = () => {
  let instance = useCurrentInstance();
  let { filterId } = useParams();

  return renderWithLoader({ instance })(({}) => (
    <PageWrapper>
      <PaginationSearchParamsProvider enabled={true}>
        <ProtoGuardAlertsTable filterId={filterId} />
      </PaginationSearchParamsProvider>
    </PageWrapper>
  ));
};
