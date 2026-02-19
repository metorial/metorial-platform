import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useSession } from '@metorial/state';
import { Attributes, RenderDate, Spacer } from '@metorial/ui';
import { ID, SideBox } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ProviderSessionOverviewPage = () => {
  let instance = useCurrentInstance();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return renderWithLoader({ session })(({ session }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: session.data.name ?? 'Unnamed Session'
          },
          {
            label: 'ID',
            content: <ID id={session.data.id} />
          },
          {
            label: 'Status',
            content: session.data.status
          },
          {
            label: 'Created At',
            content: <RenderDate date={session.data.createdAt!} />
          }
        ]}
      />

      <Spacer height={15} />

      {session.data.connectionUrl && (
        <SideBox title="Connection URL" description="Use this URL to connect to this session.">
          <div>
            <strong>URL:</strong>{' '}
            <code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
              {session.data.connectionUrl}
            </code>
          </div>
        </SideBox>
      )}
    </>
  ));
};
