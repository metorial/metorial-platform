import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useMonitorAlert } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

type MonitorAlert = any;

let PageWrapper = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

let EmptyText = ({ children }: { children: React.ReactNode }) => (
  <Text size="2" color="gray600">
    {children}
  </Text>
);

let AlertAccessContent = ({ alert }: { alert: MonitorAlert }) => {
  return (
    <PageWrapper>
      <Box title="Events">
        {alert.events.length ? (
          <Table
            headers={['Event', 'When']}
            data={alert.events.map((event: any) => [
              <Text size="2" weight="strong">
                {event.type}
              </Text>,
              <RenderDate date={event.createdAt} />
            ])}
          />
        ) : (
          <EmptyText>No lifecycle events recorded.</EmptyText>
        )}
      </Box>

      <Box title="Recipients">
        {alert.recipients.length ? (
          <Table
            headers={['Recipient', 'Viewed']}
            data={alert.recipients.map((recipient: any) => [
              <ID id={recipient.recipientId ?? recipient.id} />,
              recipient.viewedAt ? <RenderDate date={recipient.viewedAt} /> : 'Not viewed'
            ])}
          />
        ) : (
          <EmptyText>No recipients recorded.</EmptyText>
        )}
      </Box>
    </PageWrapper>
  );
};

export let AlertAccessPage = () => {
  let instance = useCurrentInstance();
  let { monitorAlertId } = useParams();
  let alert = useMonitorAlert(instance.data?.id, monitorAlertId);

  return renderWithLoader({ alert })(({ alert }) => <AlertAccessContent alert={alert.data} />);
};
