import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderIssue } from '@metorial/state';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { ProtoGuardAlertsTable } from '../../../scenes/monitoring/protoGuardAlertsTable';
import { ProviderAuthErrorGroupScene } from '../../../scenes/providerAuthErrors/groupScene';
import { ProviderErrorTracingScene } from '../../../scenes/sessionTracing/providerErrorScene';

let ScrollBody = styled.div`
  overflow: auto;
  padding: 20px;
`;

export let ProviderIssuePage = () => {
  let instance = useCurrentInstance();
  let { providerIssueId } = useParams();
  let issue = useProviderIssue(instance.data?.id, providerIssueId);

  return renderWithLoader({ issue })(({ issue }) => {
    if (issue.data.type == 'provider_error') {
      return <ProviderErrorTracingScene issueId={issue.data.id} />;
    }

    if (issue.data.type == 'auth_error') {
      return <ProviderAuthErrorGroupScene issueId={issue.data.id} />;
    }

    return (
      <ScrollBody>
        <ProtoGuardAlertsTable issueId={issue.data.id} />
      </ScrollBody>
    );
  });
};
