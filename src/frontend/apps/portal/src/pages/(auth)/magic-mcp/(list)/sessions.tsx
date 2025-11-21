import { renderWithLoader } from '@metorial/data-hooks';
import { PageHeader } from '@metorial/layout';
import { useCurrentInstance } from '@metorial/state';
import { MagicMcpSessionsTable } from '../../../../scenes/magicMcp/sessionsTable';

export let MagicMcpSessionsPage = () => {
  let instance = useCurrentInstance();

  return (
    <>
      <PageHeader
        title="Magic MCP Connections"
        description="Revisit your Magic MCP session history."
      />

      {renderWithLoader({ instance })(({ instance }) => (
        <MagicMcpSessionsTable />
      ))}
    </>
  );
};
