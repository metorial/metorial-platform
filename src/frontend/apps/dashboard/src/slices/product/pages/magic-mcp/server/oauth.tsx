import { Callout } from '@metorial/ui';

export let MagicMcpServerOauthPage = () => {
  return (
    <Callout color="orange">
      OAuth configuration is unavailable for this Subspace-based Magic MCP server.
    </Callout>
  );
};

export let MagicMcpServerOauthCallout = ({ noSpacer: _noSpacer }: { noSpacer?: boolean }) => {
  return (
    <Callout color="orange">
      Set up a default oauth connection for this Magic MCP server.
    </Callout>
  );
};
