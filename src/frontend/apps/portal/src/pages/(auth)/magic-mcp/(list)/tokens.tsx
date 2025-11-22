import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { MagicMcpTokensTable } from '../../../../scenes/magicMcp/tokensTable';

export let MagicMcpTokensPage = () => {
  return (
    <ContentLayout>
      <PageHeader
        title="Magic MCP Tokens"
        description="Magic MCP tokens allow secure access to your Magic MCP servers."
      />

      {renderWithLoader({})(({}) => (
        <MagicMcpTokensTable />
      ))}
    </ContentLayout>
  );
};
