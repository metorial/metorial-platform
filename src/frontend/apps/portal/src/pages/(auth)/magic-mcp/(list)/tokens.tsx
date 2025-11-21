import { renderWithLoader } from '@metorial/data-hooks';
import { PageHeader } from '@metorial/layout';
import { useCurrentInstance } from '@metorial/state';
import { MagicMcpTokensTable } from '../../../../scenes/magicMcp/tokensTable';

export let MagicMcpTokensPage = () => {
  let instance = useCurrentInstance();

  return (
    <>
      <PageHeader
        title="Magic MCP Tokens"
        description="Magic MCP tokens allow secure access to your Magic MCP servers."
      />

      {renderWithLoader({ instance })(({ instance }) => (
        <MagicMcpTokensTable />
      ))}
    </>
  );
};
