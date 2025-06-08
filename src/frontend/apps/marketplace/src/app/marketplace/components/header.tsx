'use client';

import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import { ContainerTextFlip } from '../../../components/container-text-flip';
import { PlaceholdersAndVanishInput } from '../../../components/placeholders-and-vanish-input';

let HeaderSection = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 80rem;
  margin: 100px auto 0;
  overflow: hidden;
  border-radius: 0.5rem;
  padding: 1rem;

  @media (min-width: 768px) {
    margin-top: 100px;
    margin: 230px auto 100px auto;
  }
`;

let HeaderTitle = styled.p`
  pointer-events: none;
  white-space: pre-wrap;
  background: linear-gradient(to right, black, rgba(200, 200, 200, 0.8));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-align: center;
  font-size: 2.25rem;
  font-weight: 600;
  margin-bottom: 1rem;

  @media (min-width: 768px) {
    font-size: 6rem;
    margin-bottom: 2rem;
  }
`;

let HeaderSubtitle = styled.span`
  text-align: center;
  font-size: 1rem;
  font-weight: 500;
  color: #555;

  @media (min-width: 768px) {
    font-size: 1.125rem;
  }
`;

let InputWrapper = styled.div`
  display: flex;
  padding: 20px 0;
`;

let MobileBr = styled.br`
  display: none;

  @media (max-width: 768px) {
    display: block;
  }
`;

export let LandingHeader = ({ search }: { search?: string }) => {
  let router = useRouter();

  return (
    <HeaderSection>
      <HeaderTitle>
        <span>Connect to</span> <MobileBr />
        <ContainerTextFlip
          words={[
            'Google Drive',
            'Slack',
            'GitHub',
            'Apify',
            'PostHog',
            'Axiom',
            'Azure',
            'Base',
            'Chroma',
            'Notion',
            'Stripe',
            'Playwright',
            'Exa',
            'Heroku',
            'OpenAI',
            'Paddle',
            'Make',
            'Chargebee',
            'Pipedream',
            'Anthropic',
            'Neon',
            'Ramp',
            'Pushover',
            'Browserbase',
            'Cloudflare',
            'Zapier'
          ]}
        />
      </HeaderTitle>

      <HeaderSubtitle>
        Connect to thousands of MCP servers in a single function call.
      </HeaderSubtitle>

      <InputWrapper>
        <PlaceholdersAndVanishInput
          placeholders={['Stripe', 'Google Drive', 'Slack', 'Notion', 'GitHub']}
          initialValue={search}
          onSubmit={event => {
            let form = event.currentTarget;
            let input = form.querySelector('input') as HTMLInputElement;
            let value = input.value;
            if (!value) return;

            router.push(`/marketplace/servers?search=${value}`);
          }}
        />
      </InputWrapper>
    </HeaderSection>
  );
};
