import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useAllSessionErrors, useCurrentInstance } from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ServerErrorPage = () => {
  let instance = useCurrentInstance();
  let { serverErrorId } = useParams();
  let errors = useAllSessionErrors(instance.data?.id, {
    sessionErrorGroupId: serverErrorId
  });

  return renderWithPagination(errors)(errors => (
    <>
      <Table
        headers={['Code', 'Message', 'Session', 'Created']}
        data={errors.data.items.map(error => ({
          data: [
            error.code ? (
              <Badge color="red">{error.code}</Badge>
            ) : (
              <Badge color="gray">Unknown</Badge>
            ),
            <Text size="2">
              {error.message?.slice(0, 100)}
              {error.message && error.message.length > 100 ? '...' : ''}
            </Text>,
            <Text size="2">{error.sessionId}</Text>,
            <RenderDate date={error.createdAt} />
          ],
          href: Paths.instance.session(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            error.sessionId
          )
        }))}
      />

      {errors.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No error occurrences found.
        </Text>
      )}
    </>
  ));
};
