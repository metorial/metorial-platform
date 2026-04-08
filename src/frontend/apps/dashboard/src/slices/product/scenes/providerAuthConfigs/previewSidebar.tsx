import {
  useCurrentOrganization,
  useCurrentProject,
  useProjectBrand,
  useProviderListings
} from '@metorial/state';
import { Button, Spacer, Text, Title, theme } from '@metorial/ui';
import { RiCheckLine } from '@remixicon/react';
import { Link } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';

export type PreviewMode = 'managed' | 'manual_existing' | 'manual_new';

export let SetupFlowLayout = styled.div<{ $showPreview: boolean }>`
  display: grid;
  grid-template-columns: ${({ $showPreview }) =>
    $showPreview ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 0fr)'};
  gap: ${({ $showPreview }) => ($showPreview ? '24px' : '0px')};
  align-items: start;
  transition:
    grid-template-columns 0.2s ease-in-out,
    gap 0.2s ease-in-out;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
    gap: 24px;
  }
`;

let SetupFlowSidebar = styled.aside<{ $visible: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  overflow: hidden;
  max-height: ${({ $visible }) => ($visible ? '2000px' : '0px')};
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transform: ${({ $visible }) => ($visible ? 'translateX(0)' : 'translateX(12px)')};
  pointer-events: ${({ $visible }) => ($visible ? 'auto' : 'none')};
  visibility: ${({ $visible }) => ($visible ? 'visible' : 'hidden')};
  transition:
    max-height 0.2s ease-in-out,
    opacity 0.2s ease-in-out,
    transform 0.2s ease-in-out,
    visibility 0.2s ease-in-out;

  @media (max-width: 980px) {
    max-height: none;
    opacity: 1;
    transform: none;
    pointer-events: auto;
    visibility: visible;
  }
`;

let SetupFlowSidebarMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

let SetupFlowPreviewCard = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};
  overflow: hidden;
`;

let SetupFlowPreviewScreen = styled.div`
  background: white;
  box-shadow: ${theme.shadows.medium};
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 520px;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
`;

let SetupFlowPreviewHeader = styled.div`
  padding: 32px 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid ${theme.colors.gray200};
  width: 100%;
`;

let SetupFlowPreviewHeaderText = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

let SetupFlowPreviewCheckList = styled.div`
  display: flex;
  flex-direction: column;
`;

let SetupFlowPreviewCheckItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;

  &:not(:last-child) {
    border-bottom: 1px solid #eee;
  }
`;

let SetupFlowPreviewCheckIcon = styled.div`
  width: 16px;
  flex-shrink: 0;
`;

let SetupFlowPreviewCheckContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;

  h2 {
    font-size: 14px;
    font-weight: 600;
  }

  p {
    font-size: 12px;
    color: #666;
    font-weight: 500;
  }
`;

let SetupFlowPreviewBody = styled.div`
  padding: 20px 32px 0;
  width: 100%;
`;

let SetupFlowPreviewBrand = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  overflow: hidden;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

let SetupFlowPreviewBrandImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

let SetupFlowPreviewIconsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

let SetupFlowPreviewProviderIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 20px;
  font-weight: 600;
`;

let SetupFlowPreviewFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  color: ${theme.colors.gray600};
  padding: 16px 24px 24px;
`;

let SetupFlowPreviewFooterLogo = styled.img`
  width: 14px;
  height: 14px;
  border-radius: 3px;
`;

let SetupFlowPreviewFooterLink = styled.a`
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 3px;
  color: ${theme.colors.gray900};
  text-decoration: none;
  font-weight: 500;
`;

let SetupFlowPreviewBrandingLink = styled(Link)`
  font-size: 12px;
  color: ${theme.colors.gray600};
  text-decoration: none;
  font-weight: 500;

  &:hover {
    color: ${theme.colors.gray800};
    text-decoration: underline;
  }
`;

let SetupFlowPreviewBrandingSlot = styled.div`
  min-height: 18px;
  display: flex;
  align-items: flex-start;
`;

let METORIAL_LOGO_URL =
  'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg';

let chevronPulse = keyframes`
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
`;

let SetupFlowPreviewChevronSvg = styled.svg<{ $delay: number }>`
  animation: ${chevronPulse} 1.5s ease-in-out infinite;
  animation-delay: ${p => p.$delay}s;
`;

let SetupFlowChevronIcon = ({ delay = 0 }: { delay?: number }) => (
  <SetupFlowPreviewChevronSvg
    $delay={delay}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
  >
    <path
      d="M6 4L10 8L6 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </SetupFlowPreviewChevronSvg>
);

let previewIntroItems = [
  {
    title: 'Encrypted & Private',
    description: 'Your data is encrypted end-to-end.'
  },
  {
    title: 'Choose What to Share',
    description: 'You have full control over what data you share.'
  }
];

export let SetupFlowPreviewSidebar = (p: {
  instanceId: string;
  providerName: string;
  providerId?: string | null;
  providerImageUrl?: string | null;
  showBrandingLink?: boolean;
  previewMode?: PreviewMode;
  previewAuthName?: string;
  previewAuthDescription?: string;
}) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let projectBrand = useProjectBrand(project.data?.organization.id, project.data?.id);
  let providerListings = useProviderListings(p.instanceId, { orderByRank: true });
  let providerListing = providerListings.data?.items.find(
    listing => listing.provider.id === p.providerId
  );
  let projectBrandImageUrl = projectBrand.data?.imageUrl;
  let projectBrandName = projectBrand.data?.name ?? project.data?.name ?? 'Metorial';
  let resolvedProviderImageUrl = providerListing?.imageUrl ?? p.providerImageUrl;
  let previewMode = p.previewMode ?? 'manual_existing';
  let previewHeadline = p.previewAuthName?.trim()
    ? p.previewAuthName.trim()
    : 'Sign in required';
  let previewSubtext = p.previewAuthDescription?.trim()
    ? p.previewAuthDescription.trim()
    : "You'll be redirected to connect your account.";
  let previewBrandImageUrl = projectBrandImageUrl;
  let previewBrandName = projectBrandName;
  let previewBrandInitial = previewBrandName.charAt(0).toUpperCase();
  let brandingPath =
    organization.data && project.data
      ? `/o/${organization.data.slug}/project/${project.data.slug}/branding`
      : null;

  return (
    <SetupFlowSidebar $visible={true}>
      <SetupFlowSidebarMain>
        <div>
          <Text size="2" weight="strong">
            Authentication Screen Preview
          </Text>
          <Text size="1" color="gray600">
            This is how your users will see the connection flow.
          </Text>
        </div>

        <SetupFlowPreviewCard
          style={{
            background: theme.colors.gray200,
            padding: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{ width: '100%' }}>
            <SetupFlowPreviewScreen>
              <SetupFlowPreviewHeader>
                <SetupFlowPreviewIconsRow>
                  <SetupFlowPreviewBrand>
                    {previewBrandImageUrl ? (
                      <SetupFlowPreviewBrandImage
                        src={previewBrandImageUrl}
                        alt={previewBrandName}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: theme.colors.gray100,
                          color: theme.colors.gray900,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 20,
                          fontWeight: 700
                        }}
                      >
                        {previewBrandInitial}
                      </div>
                    )}
                  </SetupFlowPreviewBrand>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      color: theme.colors.gray600
                    }}
                  >
                    <SetupFlowChevronIcon delay={0} />
                    <SetupFlowChevronIcon delay={0.3} />
                    <SetupFlowChevronIcon delay={0.6} />
                  </div>

                  <SetupFlowPreviewProviderIcon
                    style={
                      resolvedProviderImageUrl
                        ? {
                            background: `url(${resolvedProviderImageUrl}) center/contain no-repeat`
                          }
                        : undefined
                    }
                  >
                    {!resolvedProviderImageUrl ? p.providerName.charAt(0).toUpperCase() : null}
                  </SetupFlowPreviewProviderIcon>
                </SetupFlowPreviewIconsRow>

                <SetupFlowPreviewHeaderText>
                  <Title size="5" weight="strong" style={{ textAlign: 'center' }}>
                    {p.providerName ? `Connect to ${p.providerName}` : 'Choose a provider'}
                  </Title>
                </SetupFlowPreviewHeaderText>
              </SetupFlowPreviewHeader>

              <SetupFlowPreviewBody>
                <Text size="4" weight="strong">
                  {previewHeadline}
                </Text>
                <Text size="2" color="gray600">
                  {previewSubtext}
                </Text>

                <Spacer size={15} />

                <SetupFlowPreviewCheckList>
                  {previewIntroItems.map(item => (
                    <SetupFlowPreviewCheckItem key={item.title}>
                      <SetupFlowPreviewCheckIcon>
                        <RiCheckLine size={16} />
                      </SetupFlowPreviewCheckIcon>

                      <SetupFlowPreviewCheckContent>
                        <h2>{item.title}</h2>
                        <p>{item.description}</p>
                      </SetupFlowPreviewCheckContent>
                    </SetupFlowPreviewCheckItem>
                  ))}
                </SetupFlowPreviewCheckList>

                <Spacer size={30} />
                <div style={{ pointerEvents: 'none' }}>
                  <Button type="button" color="black" size="3" fullWidth>
                    Connect Account
                  </Button>
                </div>

                <SetupFlowPreviewFooter>
                  <span>Secured by</span>
                  <SetupFlowPreviewFooterLink
                    href="https://metorial.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <SetupFlowPreviewFooterLogo src={METORIAL_LOGO_URL} alt="Metorial" />
                    Metorial
                  </SetupFlowPreviewFooterLink>
                </SetupFlowPreviewFooter>
              </SetupFlowPreviewBody>
            </SetupFlowPreviewScreen>
          </div>
        </SetupFlowPreviewCard>

        <SetupFlowPreviewBrandingSlot>
          {brandingPath && p.showBrandingLink && (
            <SetupFlowPreviewBrandingLink
              to={brandingPath}
              target="_blank"
              rel="noopener noreferrer"
            >
              Click here to customize branding and white-label settings
            </SetupFlowPreviewBrandingLink>
          )}
        </SetupFlowPreviewBrandingSlot>
      </SetupFlowSidebarMain>
    </SetupFlowSidebar>
  );
};
