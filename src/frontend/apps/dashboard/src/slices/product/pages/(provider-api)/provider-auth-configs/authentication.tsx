import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProvider,
  useProviderAuthConfig,
  useProviderAuthImportSchema,
  useProviderDeployment
} from '@metorial/state';
import { Badge, Button, Spacer, Text, theme } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { styled } from 'styled-components';
import {
  getProviderAuthMethodSchemaFieldCount,
  getProviderAuthMethodTypeColor,
  getProviderAuthMethodTypeLabel,
  showProviderAuthMethodDetailsModal
} from '../../../scenes/providers/authMethodDetails';
import {
  formatAuthConfigSource,
  renderCapabilityStatus
} from './helpers';

let DetailBadges = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

let ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

let CallbackUrl = styled.span`
  word-break: break-all;
`;

let ReferenceCards = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

let ReferenceCard = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 12px;
  padding: 14px 16px;
  min-width: 220px;
  flex: 0 1 320px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

let CapabilityGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
`;

let CapabilityCard = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 92px;
`;

let WideCapabilityCard = styled(CapabilityCard)`
  grid-column: 1 / -1;
  min-height: unset;
`;

export let ProviderAuthConfigAuthenticationPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { providerDeploymentId, providerAuthConfigId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let authConfig = useProviderAuthConfig(
    instance.data?.id,
    providerDeploymentId,
    providerAuthConfigId
  );
  let shouldLoadImportSchema =
    authConfig.data?.source != null && authConfig.data.source !== 'manual';
  let provider = useProvider(
    instance.data?.id,
    deployment.data?.providerId ?? authConfig.data?.providerId ?? undefined
  );
  let authImportSchema = useProviderAuthImportSchema(
    instance.data?.id,
    providerAuthConfigId && shouldLoadImportSchema
      ? {
          providerDeploymentId,
          providerAuthConfigId
        }
      : null
  );

  return renderWithLoader({ authConfig, deployment, provider })(
    ({ authConfig, deployment, provider }) => {
      let authMethodName =
        authConfig.data.authMethod?.name ?? authConfig.data.authMethod?.key ?? 'Unknown method';
      let credentialName =
        authConfig.data.credentials?.name ?? authConfig.data.credentials?.id ?? null;
      let scopesCount = authConfig.data.authMethod?.scopes?.length ?? 0;
      let inputFieldCount = getProviderAuthMethodSchemaFieldCount(
        authConfig.data.authMethod.inputSchema
      );
      let outputFieldCount = getProviderAuthMethodSchemaFieldCount(
        authConfig.data.authMethod.outputSchema
      );
      let deploymentTargetId = authConfig.data.deploymentPreview?.id ?? deployment.data.id;
      let credentialTargetDeploymentId =
        authConfig.data.deploymentPreview?.id ?? deployment.data.id;
      let encryptionContent = authConfig.data.source === 'manual' ? (
        '—'
      ) : authImportSchema.data === null ? (
        '—'
      ) : authImportSchema.error ? (
        <Badge color="gray">Unavailable</Badge>
      ) : authImportSchema.isLoading ? (
        '...'
      ) : authImportSchema.data?.visibility === 'encrypted' ? (
        <Badge color="blue">Encrypted</Badge>
      ) : (
        '—'
      );
      let providerAuthImportStatus =
        provider.data.type.auth.status === 'enabled'
          ? provider.data.type.auth.import.status
          : 'disabled';
      let providerAuthExportStatus =
        provider.data.type.auth.status === 'enabled'
          ? provider.data.type.auth.export.status
          : 'disabled';
      let providerOAuthStatus =
        provider.data.type.auth.status === 'enabled'
          ? provider.data.type.auth.oauth.status
          : 'disabled';
      let autoRegistrationStatus =
        provider.data.oauth?.status === 'enabled'
          ? provider.data.oauth.autoRegistration.status
          : undefined;
      let oauthCallbackUrl =
        provider.data.oauth?.callbackUrl ??
        (provider.data.type.auth.status === 'enabled' &&
        provider.data.type.auth.oauth.status === 'enabled'
          ? provider.data.type.auth.oauth.oauthCallbackUrl
          : null);
      let capabilityItems = [
        {
          label: 'Source',
          content: formatAuthConfigSource(authConfig.data.source)
        },
        {
          label: 'Encryption',
          content: encryptionContent
        },
        {
          label: 'Auth Import',
          content: renderCapabilityStatus(providerAuthImportStatus)
        },
        {
          label: 'Auth Export',
          content: renderCapabilityStatus(providerAuthExportStatus)
        },
        {
          label: 'OAuth',
          content: renderCapabilityStatus(providerOAuthStatus)
        }
      ];

      if (autoRegistrationStatus) {
        capabilityItems.push({
          label: 'Auto-registration',
          content: renderCapabilityStatus(autoRegistrationStatus)
        });
      }

      return (
        <>
          <Box
            title="Authentication Method"
            description="Method-specific information and linked resources for this auth config."
          >
            <Text size="3" weight="strong">
              {authMethodName}
            </Text>

            <Spacer height={4} />

            <Text size="2" color="gray600">
              {authConfig.data.authMethod?.description ??
                `Authentication for ${provider.data.name}.`}
            </Text>

            <Spacer height={16} />

            <DetailBadges>
              <Badge
                color={getProviderAuthMethodTypeColor(authConfig.data.authMethod.type)}
                size="1"
              >
                {getProviderAuthMethodTypeLabel(authConfig.data.authMethod.type)}
              </Badge>
              {authConfig.data.isDefault ? (
                <Badge color="blue" size="1">
                  Default
                </Badge>
              ) : null}
              <Badge color="gray" size="1">
                {scopesCount} Scope{scopesCount === 1 ? '' : 's'}
              </Badge>
              <Badge color="cyan" size="1">
                {inputFieldCount} Input Field{inputFieldCount === 1 ? '' : 's'}
              </Badge>
              <Badge color="purple" size="1">
                {outputFieldCount} Output Field{outputFieldCount === 1 ? '' : 's'}
              </Badge>
            </DetailBadges>

            <Spacer height={16} />

            <ReferenceCards>
              {credentialName ? (
                <ReferenceCard>
                  <Text weight="bold" size="1">
                    Linked Credentials
                  </Text>
                  <Text size="2" weight="medium" color="gray700" as="div">
                    <Link
                      to={Paths.instance.providerAuthCredential(
                        organization.data,
                        project.data,
                        instance.data,
                        credentialTargetDeploymentId,
                        authConfig.data.credentials!.id
                      )}
                    >
                      {credentialName}
                    </Link>
                  </Text>
                </ReferenceCard>
              ) : null}

              <ReferenceCard>
                <Text weight="bold" size="1">
                  Deployment
                </Text>
                <Text size="2" weight="medium" color="gray700" as="div">
                  <Link
                    to={Paths.instance.providerDeployment(
                      organization.data,
                      project.data,
                      instance.data,
                      deploymentTargetId
                    )}
                  >
                    {authConfig.data.deploymentPreview?.name ??
                      deployment.data.name ??
                      deploymentTargetId}
                  </Link>
                </Text>
              </ReferenceCard>
            </ReferenceCards>

            <Spacer height={16} />

            <ActionRow>
              {authConfig.data.credentials ? (
                <Link
                  to={Paths.instance.providerAuthCredential(
                    organization.data,
                    project.data,
                    instance.data,
                    credentialTargetDeploymentId,
                    authConfig.data.credentials.id
                  )}
                >
                  <Button as="span" size="2" variant="outline">
                    View Credentials
                  </Button>
                </Link>
              ) : null}

              <Link
                to={Paths.instance.providerDeployment(
                  organization.data,
                  project.data,
                  instance.data,
                  deploymentTargetId
                )}
              >
                <Button as="span" size="2" variant="outline">
                  View Deployment
                </Button>
              </Link>

              <Button
                size="2"
                variant="outline"
                onClick={() => showProviderAuthMethodDetailsModal(authConfig.data.authMethod)}
              >
                View Auth Method Details
              </Button>
            </ActionRow>
          </Box>

          <Spacer height={20} />

          <Box
            title="Provider Capabilities"
            description="Provider-level authentication behavior and capability reference for this auth config."
          >
            <CapabilityGrid>
              {capabilityItems.map(item => (
                <CapabilityCard key={String(item.label)}>
                  <Text weight="bold" size="1">
                    {item.label}
                  </Text>
                  <Text size="2" weight="medium" color="gray700" as="div">
                    {item.content}
                  </Text>
                </CapabilityCard>
              ))}

              {oauthCallbackUrl ? (
                <WideCapabilityCard>
                  <Text weight="bold" size="1">
                    OAuth Callback URL
                  </Text>
                  <Text size="2" weight="medium" color="gray700" as="div">
                    <CallbackUrl>{oauthCallbackUrl}</CallbackUrl>
                  </Text>
                </WideCapabilityCard>
              ) : null}
            </CapabilityGrid>
          </Box>
        </>
      );
    }
  );
};
