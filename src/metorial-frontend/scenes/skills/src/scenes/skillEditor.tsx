import { renderWithLoader } from '@metorial/data-hooks';
import { useSkillMarketplaceEditorUrl, useSkillPluginEditorUrl } from '@metorial/state';
import { Button, theme } from '@metorial/ui';
import { RiExpandDiagonal2Line } from '@remixicon/react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import styled from 'styled-components';

let Wrapper = styled.div`
  &[data-expanded='true'] {
    overflow: hidden;
    position: fixed;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    z-index: 99999;
  }

  &[data-expanded='false'] {
    border: 1px solid ${theme.colors.gray400};
    border-radius: 12px;
    overflow: hidden;
    position: relative;
    width: 100%;
    height: calc(95vh - 240px);
  }
`;

let Nav = styled(motion.nav)`
  position: absolute;
  top: 0;
  left: 0;
  height: 34px;
  display: flex;
  align-items: center;
  padding: 0 5px;
  gap: 6px;
`;

let Iframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  border-radius: inherit;
  background: #fff;
`;

let EmbeddedEditor = (p: { url: string }) => {
  let [isExpanded, setIsExpanded] = useState(false);

  return (
    <Wrapper data-expanded={isExpanded}>
      <Nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Button
          size="1"
          variant="outline"
          iconLeft={<RiExpandDiagonal2Line />}
          onClick={() => setIsExpanded(expanded => !expanded)}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </Button>
      </Nav>

      <Iframe src={p.url} />
    </Wrapper>
  );
};

export let SkillMarketplaceEditorScene = (p: {
  instanceId: string | null | undefined;
  skillMarketplaceId: string | null | undefined;
}) => {
  let editorUrl = useSkillMarketplaceEditorUrl(p.instanceId, p.skillMarketplaceId);

  return renderWithLoader({ editorUrl })(({ editorUrl }) => (
    <EmbeddedEditor url={editorUrl.data.url} />
  ));
};

export let SkillPluginEditorScene = (p: {
  instanceId: string | null | undefined;
  skillPluginId: string | null | undefined;
}) => {
  let editorUrl = useSkillPluginEditorUrl(p.instanceId, p.skillPluginId);

  return renderWithLoader({ editorUrl })(({ editorUrl }) => (
    <EmbeddedEditor url={editorUrl.data.url} />
  ));
};
