import { ContentLayout, PageHeader } from '@metorial/layout';
import { styled } from 'styled-components';
import { Explainer } from '../../../../components/explainer';
import { UsageScene } from '../../scenes/usage/usage';

let Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

let Grid = styled.div`
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
`;

export let LogsHomePage = () => {
  return (
    <ContentLayout>
      <PageHeader
        title="Logs"
        description="Trace sessions, MCP connections, errors, and more across Metorial."
      />

      <Stack>
        <UsageScene
          title="Connection Activity"
          description="Sessions opened against your providers over time."
          entities={[{ type: 'provider' }]}
          entityNames={{ provider: 'Sessions' }}
          from={7}
          interval={{ unit: 'day', count: 1 }}
          labelBy="owner"
        />

        <Grid>
          <UsageScene
            title="Provider Usage"
            description="Requests handled by each provider in this instance."
            entities={[{ type: 'provider' }]}
            entityNames={{ provider: 'Providers' }}
            from={7}
            interval={{ unit: 'day', count: 1 }}
            labelBy="owner"
          />

          <UsageScene
            title="Provider Deployments"
            description="Traffic served by your provider deployments."
            entities={[{ type: 'provider_deployment' }]}
            entityNames={{ provider_deployment: 'Deployments' }}
            from={7}
            interval={{ unit: 'day', count: 1 }}
            labelBy="owner"
          />
        </Grid>

        <Grid>
          <UsageScene
            title="Provider Configs"
            description="Sessions that used a configured provider."
            entities={[{ type: 'provider_config' }]}
            entityNames={{ provider_config: 'Configs' }}
            from={7}
            interval={{ unit: 'day', count: 1 }}
            labelBy="owner"
          />

          <UsageScene
            title="Auth Configs"
            description="Usage attributed to each auth configuration."
            entities={[{ type: 'provider_auth_config' }]}
            entityNames={{ provider_auth_config: 'Auth Configs' }}
            from={7}
            interval={{ unit: 'day', count: 1 }}
            labelBy="owner"
          />
        </Grid>
      </Stack>

      <Explainer
        title="Understanding your Metorial logs"
        description="Learn how to read the activity charts and drill down into sessions, runs, and errors."
        youtubeId="utz9yBfQ88k"
        id="logs-home"
      />
    </ContentLayout>
  );
};
