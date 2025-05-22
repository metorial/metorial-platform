'use client';

import styled from 'styled-components';
import { LinkPreview } from '../../../components/link-preview';

let AboutSection = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 40rem;
  flex-direction: column;
  padding: 0 1rem;
`;

let AboutText = styled.div`
  color: #999;
  font-size: 1.25rem;
  max-width: 60rem;
  font-weight: 500;
  margin: 0 auto 2.5rem;
  line-height: 1.2em;
  /* text-align: center; */

  @media (min-width: 768px) {
    font-size: 2.25rem;
  }
`;

export let LandingAbout = () => {
  return (
    <AboutSection>
      <AboutText>
        <LinkPreview url="https://metorial.com">Metorial</LinkPreview> lets you to connect to
        thousands of service providers using a single function call. We handle the nitty-gritty
        of running{' '}
        <LinkPreview url="https://github.com/metorial/mcp-containers">MCP servers</LinkPreview>
        , so you can focus on building your AI agents.
      </AboutText>
    </AboutSection>
  );
};
