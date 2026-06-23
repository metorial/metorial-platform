import { renderWithLoader } from '@metorial/data-hooks';
import {
  metorialAssistantSlug,
  useAssistant,
  useCreateConversation,
  useCurrentInstance,
  useCurrentOrganization,
  useUser
} from '@metorial/state';
import { theme } from '@metorial/ui';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import React, { useEffect, useId, useMemo, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import type {
  AssistantConversationNavigationState,
  AssistantModelOption,
  AssistantSuggestion
} from '../components';
import { AssistantComposer } from '../components';

// @ts-ignore
import assistantFace from '../../assets/face.png';

let CenterLayout = styled.div<{
  'data-layout': 'page' | 'embedded';
  'data-full-width': boolean;
}>`
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  min-width: 0;
  min-height: ${p =>
    p['data-layout'] == 'embedded'
      ? p['data-full-width']
        ? 'auto'
        : '100%'
      : 'calc(100vh - 120px)'};
  max-width: ${p => (p['data-full-width'] ? '100%' : '1000px')};
  margin: 0 auto;
  padding: ${p =>
    p['data-full-width']
      ? p['data-layout'] == 'embedded'
        ? '0'
        : '50px 0 0 0'
      : p['data-layout'] == 'embedded'
        ? '32px 20px'
        : '50px 20px 0px 20px'};
  justify-content: ${p => (p['data-full-width'] ? 'flex-start' : 'center')};
  box-sizing: border-box;
`;

let Hero = styled.div<{ 'data-full-width': boolean }>`
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  max-width: ${p => (p['data-full-width'] ? '100%' : '860px')};
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin: 0px auto;
`;

let brandGlow = keyframes`
  0%,
  100% {
    opacity: 0.46;
    transform: translate(-50%, calc(-50% + 3px)) scale(0.88);
  }

  45% {
    opacity: 0.78;
    transform: translate(-50%, calc(-50% + 8px)) scale(1.08);
  }
`;

let brandFloat = keyframes`
  0%,
  100% {
    transform: translate3d(0, 4px, 0) rotate(3deg) scale(1);
  }

  50% {
    transform: translate3d(0, -12px, 0) rotate(-4deg) scale(1.018);
  }
`;

let brandSheen = keyframes`
  0% {
    transform: translateX(-95%) rotate(-8deg);
    opacity: 0;
  }

  22% {
    opacity: 0;
  }

  42% {
    opacity: 0.82;
  }

  58% {
    opacity: 0.3;
  }

  78%,
  100% {
    transform: translateX(105%) rotate(-8deg);
    opacity: 0;
  }
`;

let BrandIconWrap = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 18px;
  position: relative;
  cursor: pointer;
  border-radius: 18px;

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, ${theme.colors.foreground} 24%, transparent);
    outline-offset: 6px;
  }

  &::before {
    content: '';
    position: absolute;
    width: 92px;
    height: 52px;
    top: 50%;
    left: 50%;
    border-radius: 999px;
    background:
      radial-gradient(circle at 36% 45%, rgba(247, 183, 49, 0.28), transparent 56%),
      radial-gradient(circle at 66% 42%, rgba(255, 107, 107, 0.2), transparent 58%),
      radial-gradient(circle at 58% 58%, rgba(138, 92, 246, 0.14), transparent 54%);
    filter: blur(16px);
    transform: translate(-50%, -50%) scale(0.92);
    opacity: 0.62;
    animation: ${brandGlow} 8s ease-in-out infinite;
    pointer-events: none;
  }
`;

let BrandIconMotion = styled(motion.div)`
  position: relative;
  z-index: 1;
  transform-style: preserve-3d;
  will-change: transform;
`;

let BrandIconScale = styled(motion.div)`
  position: relative;
  transform-origin: center;
`;

let BrandIconShadow = styled(motion.div)`
  position: absolute;
  z-index: 0;
  top: 50%;
  left: 50%;
  width: 80px;
  height: 44px;
  margin-top: -12px;
  margin-left: -40px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 45% 45%, rgba(247, 183, 49, 0.28), transparent 58%),
    radial-gradient(circle at 58% 50%, rgba(255, 107, 107, 0.18), transparent 62%);
  filter: blur(16px);
  opacity: 0.72;
  pointer-events: none;
`;

let BrandIconGlyph = styled.div`
  position: relative;
  width: 80px;
  height: 71px;
  animation: ${brandFloat} 4.8s ease-in-out infinite;
`;

let BrandIconSvg = styled.svg`
  width: 80px;
  height: auto;
  overflow: visible;

  .brand-sheen {
    transform-origin: center;
    animation: ${brandSheen} 6.5s cubic-bezier(0.22, 1, 0.36, 1) infinite;
  }
`;

let BrandIconFace = styled.img`
  position: absolute;
  z-index: 2;
  top: 33px;
  left: 3px;
  width: 38px;
  height: auto;
  pointer-events: none;
  user-select: none;
`;

let Title = styled.h1`
  margin: 0;
  font-size: 28px;
  line-height: 1.1;
  text-align: center;
  font-weight: 600;
`;

let Description = styled.p`
  text-align: center;
  color: ${theme.colors.gray600};
  font-size: 13px;
  margin-top: 20px;
  font-weight: 500;
`;

let defaultSuggestions: AssistantSuggestion[] = [
  {
    id: 'provider-errors',
    label: 'Summarize provider errors',
    prompt: 'Summarize the most important provider errors in this instance.'
  },
  {
    id: 'configuration-review',
    label: 'Review configuration',
    prompt: 'Review this instance configuration and suggest the most useful next steps.'
  },
  {
    id: 'find-files',
    label: 'Find relevant files',
    prompt: 'Find the most relevant files and recent changes for the issue I am investigating.'
  }
];

let getModelOptions = (assistant: ReturnType<typeof useAssistant>['data']) => {
  return (
    assistant?.availableModels.map(
      model =>
        ({
          id: model.id,
          label: model.name,
          description: model.provider.name
        }) satisfies AssistantModelOption
    ) ?? []
  );
};

let BRAND_ICON_INFLUENCE_RADIUS = 112;
let BRAND_ICON_MAX_OFFSET = 16;

let AssistantBrandIcon = () => {
  let id = useId().replace(/:/g, '');
  let gradientId = `assistant-brand-gradient-${id}`;
  let highlightId = `assistant-brand-highlight-${id}`;
  let maskId = `assistant-brand-mask-${id}`;
  let glowId = `assistant-brand-glow-${id}`;
  let [growthStep, setGrowthStep] = useState(0);
  let iconPath =
    'M21.8266 -1.98249e-08C20.6587 2.55214 21.8266 2.11861e-07 18.8359 6.53515L25.441 1.1984C25.441 1.1984 19.8937 11.2913 17.9649 14.3957C16.0362 17.5 13.1514 23.0018 8.20053 22.56C3.24968 22.1181 -0.405659 17.7465 0.0361938 12.7956C0.327707 9.5292 2.32981 6.82677 5.08021 5.49282L15.35 0.550123C13.953 2.30008 15.35 0.550116 11.7729 5.03115L21.8266 -1.98249e-08Z';
  let targetX = useMotionValue(0);
  let targetY = useMotionValue(0);
  let x = useSpring(targetX, { stiffness: 140, damping: 18, mass: 0.7 });
  let y = useSpring(targetY, { stiffness: 140, damping: 18, mass: 0.7 });
  let shadowX = useTransform(x, value => -value * 0.45);
  let shadowY = useTransform(y, value => -value * 0.7);
  let rotateX = useTransform(y, [-BRAND_ICON_MAX_OFFSET, BRAND_ICON_MAX_OFFSET], [4, -4]);
  let rotateY = useTransform(x, [-BRAND_ICON_MAX_OFFSET, BRAND_ICON_MAX_OFFSET], [-5, 5]);

  let resetMagnet = () => {
    targetX.set(0);
    targetY.set(0);
  };

  let handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    let rect = event.currentTarget.getBoundingClientRect();
    let centerX = rect.left + rect.width / 2;
    let centerY = rect.top + rect.height / 2;
    let deltaX = event.clientX - centerX;
    let deltaY = event.clientY - centerY;
    let distance = Math.hypot(deltaX, deltaY);

    if (distance > BRAND_ICON_INFLUENCE_RADIUS) {
      resetMagnet();
      return;
    }

    let pull = distance / BRAND_ICON_INFLUENCE_RADIUS;
    targetX.set((deltaX / BRAND_ICON_INFLUENCE_RADIUS) * BRAND_ICON_MAX_OFFSET * pull);
    targetY.set((deltaY / BRAND_ICON_INFLUENCE_RADIUS) * BRAND_ICON_MAX_OFFSET * pull);
  };

  let handleBrandClick = () => {
    setGrowthStep(current => (current + 1) % 5);
  };

  return (
    <BrandIconWrap
      aria-label="Animate assistant brand icon"
      role="button"
      tabIndex={0}
      onClick={handleBrandClick}
      onKeyDown={event => {
        if (event.key == 'Enter' || event.key == ' ') {
          event.preventDefault();
          handleBrandClick();
        }
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetMagnet}
    >
      <BrandIconShadow style={{ x: shadowX, y: shadowY }} />
      <BrandIconMotion style={{ x, y, rotateX, rotateY }}>
        <BrandIconScale
          animate={{ scale: 1 + growthStep * 0.09 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18, mass: 0.55 }}
        >
          <BrandIconGlyph>
            <BrandIconSvg width="26" height="23" viewBox="0 0 26 23" fill="none">
              <defs>
                <linearGradient
                  id={gradientId}
                  className="assistant-gradient"
                  x1="0"
                  y1="0"
                  x2="26"
                  y2="23"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#fff4c2" />
                  <stop offset="20%" stopColor="#f7b731" />
                  <stop offset="52%" stopColor="#ff6b6b" />
                  <stop offset="78%" stopColor="#a66cff" />
                  <stop offset="100%" stopColor="#5f4bdb" />
                  <animateTransform
                    attributeName="gradientTransform"
                    type="translate"
                    values="-3 -1; 3 1.5; -3 -1"
                    dur="12s"
                    repeatCount="indefinite"
                  />
                </linearGradient>
                <linearGradient
                  id={highlightId}
                  x1="0"
                  y1="0"
                  x2="26"
                  y2="0"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="42%" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="52%" stopColor="#ffe8a3" stopOpacity="0.9" />
                  <stop offset="64%" stopColor="#fff7d1" stopOpacity="0.58" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                <radialGradient id={glowId} cx="50%" cy="42%" r="62%">
                  <stop offset="0%" stopColor="#fff7d1" stopOpacity="0.3" />
                  <stop offset="52%" stopColor="#f7b731" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#ff6b6b" stopOpacity="0" />
                </radialGradient>
                <mask id={maskId}>
                  <path d={iconPath} fill="white" />
                </mask>
              </defs>
              <g mask={`url(#${maskId})`}>
                <rect x="-2" y="-2" width="30" height="27" fill={`url(#${gradientId})`} />
                <rect x="-2" y="-2" width="30" height="27" fill={`url(#${glowId})`} />
                <rect
                  className="brand-sheen"
                  x="-12"
                  y="-3"
                  width="18"
                  height="29"
                  fill={`url(#${highlightId})`}
                />
              </g>
            </BrandIconSvg>
            <BrandIconFace src={assistantFace} alt="" />
          </BrandIconGlyph>
        </BrandIconScale>
      </BrandIconMotion>
    </BrandIconWrap>
  );
};

export let AssistantStartScene = (p: {
  assistantSlug?: string;
  showBrandIcon?: boolean;
  showHeader?: boolean;
  fullWidth?: boolean;
  title?: string;
  description?: string;
  suggestions?: AssistantSuggestion[];
  conversationInput?: Record<string, unknown>;
  layout?: 'page' | 'embedded';
  onOpenConversation: (
    conversationId: string,
    state: AssistantConversationNavigationState
  ) => void;
}) => {
  let organization = useCurrentOrganization();
  let instance = useCurrentInstance();
  let assistant = useAssistant(
    organization.data?.id,
    instance.data?.id,
    p.assistantSlug ?? metorialAssistantSlug
  );
  let createConversation = useCreateConversation();
  let user = useUser();
  let showHeader = p.showHeader ?? true;

  let [draft, setDraft] = useState('');
  let [selectedModelId, setSelectedModelId] = useState<string>();

  let modelOptions = useMemo(() => getModelOptions(assistant.data), [assistant.data]);

  useEffect(() => {
    if (!assistant.data) return;
    setSelectedModelId(current => current ?? assistant.data?.defaultModel?.id ?? undefined);
  }, [assistant.data]);

  let isSubmitting = createConversation.isLoading;

  let handleSubmit = async () => {
    if (!draft.trim() || !organization.data || !instance.data || !assistant.data) return;

    let [conversation] = await createConversation.mutate({
      organizationId: organization.data.id,
      instanceId: instance.data.id,
      assistantId: assistant.data.id,
      input: p.conversationInput
    });
    if (!conversation) return;

    let initialPrompt = draft.trim();
    setDraft('');

    p.onOpenConversation(conversation.id, {
      initialPrompt,
      initialModelId: selectedModelId
    });
  };

  return renderWithLoader({ organization, instance, assistant })(() => (
    <CenterLayout data-layout={p.layout ?? 'page'} data-full-width={p.fullWidth ?? false}>
      <Hero data-full-width={p.fullWidth ?? false}>
        {showHeader ? (
          <div>
            {p.showBrandIcon ? <AssistantBrandIcon /> : null}

            <Title>{p.title ?? `How can I help you, ${user.data?.firstName}?`}</Title>

            {p.description ? <Description>{p.description}</Description> : null}
          </div>
        ) : null}

        <AssistantComposer
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          selectedModelId={selectedModelId}
          modelOptions={modelOptions}
          onSelectModel={setSelectedModelId}
          suggestions={p.suggestions ?? defaultSuggestions}
          onSelectSuggestion={suggestion => setDraft(suggestion.prompt)}
          submitLabel="Start conversation"
        />
      </Hero>
    </CenterLayout>
  ));
};
