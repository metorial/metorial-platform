import type { SecurityReview, SecurityReviewRevision } from '@metorial/state';
import {
  Badge,
  Callout,
  getProgressStepStates,
  ProgressSteps,
  RenderDate,
  Spinner,
  Text,
  theme,
  Title,
  Tooltip
} from '@metorial/ui';
import { LevelBadge, ScoreRing } from '@metorial/ui-product';
import {
  RiErrorWarningLine,
  RiFlashlightLine,
  RiLockLine,
  RiShieldCheckLine,
  RiSparkling2Line,
  RiTimeLine
} from '@remixicon/react';
import React from 'react';
import { styled } from 'styled-components';
import {
  bandColors,
  bandLabels,
  confidenceLabels,
  confidenceLevels,
  getReviewRevisions,
  isDeterministicRevision,
  levelLabels,
  reviewStages
} from './lib';

let VerdictRow = styled.div`
  display: flex;
  gap: 24px;
  align-items: center;

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

let VerdictCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`;

let BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

let Eyebrow = styled.span`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${theme.colors.gray600};
`;

let Axes = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;

  @media (max-width: 640px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

let Axis = styled.div`
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: ${theme.colors.gray100};

  svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: ${theme.colors.gray600};
  }
`;

let AxisTitle = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: ${theme.colors.gray900};
`;

let AxisStatus = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray600};
`;

let Notices = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
`;

let ProgressStrip = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: ${theme.colors.gray200};
  font-size: 13px;
  color: ${theme.colors.gray800};
`;

let ProgressStripLabel = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

let PlaceholderIcon = styled.span`
  display: flex;
  color: ${theme.colors.gray600};
`;

let StepsWrapper = styled.div`
  margin-top: 20px;
`;

let Activity = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  font-size: 12px;
  color: ${theme.colors.gray700};
`;

let ActivityDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
  background: ${theme.colors.blue800};
`;

let AiLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.gray700};
`;

export let SecurityReviewAiLabel = ({
  revision
}: {
  revision: SecurityReviewRevision | null;
}) => {
  if (revision && isDeterministicRevision(revision)) {
    return (
      <AiLabel>
        <RiShieldCheckLine size={14} />
        Deterministic Checks Only
      </AiLabel>
    );
  }

  if (!revision) {
    return (
      <AiLabel>
        <RiSparkling2Line size={14} />
        AI Review
      </AiLabel>
    );
  }

  return (
    <Tooltip content="AI-generated assessment, not a security audit. Review the evidence before making security decisions.">
      <AiLabel>
        <RiSparkling2Line size={14} />
        AI-Generated
      </AiLabel>
    </Tooltip>
  );
};

export let SecurityReviewVerdict = ({
  revision,
  detailed
}: {
  revision: SecurityReviewRevision;
  detailed?: boolean;
}) => {
  let scores = revision.scores;
  let summary = revision.report.summary;
  let [verdict, reason] = scores?.headline ?? [];

  return (
    <>
      <VerdictRow>
        <ScoreRing
          score={scores?.securityScore}
          color={scores ? bandColors[scores.band] : 'gray'}
          caption="Security / 100"
          label={scores ? bandLabels[scores.band] : undefined}
          placeholder={
            <PlaceholderIcon>
              <RiShieldCheckLine size={28} />
            </PlaceholderIcon>
          }
        />

        <VerdictCopy>
          {scores && (
            <BadgeRow>
              <LevelBadge level={scores.risk}>{levelLabels[scores.risk]} Risk</LevelBadge>
              {(detailed || scores.confidence == 'low') && (
                <LevelBadge level={confidenceLevels[scores.confidence]}>
                  {confidenceLabels[scores.confidence]} Confidence
                </LevelBadge>
              )}
              {scores.lethalTrifecta && <Badge color="red">Lethal Trifecta</Badge>}
            </BadgeRow>
          )}

          {verdict && (
            <Title as="h3" size="4" weight="strong">
              {verdict}
              {reason && (
                <>
                  <br />
                  <span style={{ color: theme.colors.gray600 }}>{reason}</span>
                </>
              )}
            </Title>
          )}

          {summary ? (
            <Text size="2" color="gray700">
              {summary.text}
            </Text>
          ) : (
            !scores && (
              <Text size="2" color="gray600">
                No score was published for this revision.
              </Text>
            )
          )}
        </VerdictCopy>
      </VerdictRow>

      {(summary || scores) && (
        <Axes>
          <Axis>
            <RiShieldCheckLine size={16} />
            <div>
              <AxisTitle>
                Security Quality
                {scores && (
                  <AxisStatus>
                    {bandLabels[scores.band]} · {scores.securityScore}/100
                  </AxisStatus>
                )}
              </AxisTitle>
              {summary && (
                <Text size="1" color="gray700" style={{ marginTop: 4 }}>
                  {summary.trustNote}
                </Text>
              )}
            </div>
          </Axis>

          <Axis>
            <RiFlashlightLine size={16} />
            <div>
              <AxisTitle>
                {scores?.confidence == 'low' ? 'Observed Exposure' : 'Tool Exposure'}
                {scores && <AxisStatus>{levelLabels[scores.exposure]}</AxisStatus>}
              </AxisTitle>
              {summary && (
                <Text size="1" color="gray700" style={{ marginTop: 4 }}>
                  {summary.exposureNote}
                </Text>
              )}
            </div>
          </Axis>
        </Axes>
      )}
    </>
  );
};

export let SecurityReviewProgress = ({
  revision,
  toolCount
}: {
  revision: SecurityReviewRevision | null;
  toolCount?: number;
}) => {
  let stageIndex = revision?.stage
    ? reviewStages.findIndex(stage => stage.id == revision.stage)
    : -1;
  let stage = stageIndex >= 0 ? reviewStages[stageIndex] : null;
  let isQueued = !revision || revision.status == 'queued' || !stage;

  let states = getProgressStepStates(
    reviewStages.map(stage => stage.id),
    stage?.id
  );

  return (
    <>
      <VerdictRow>
        <ScoreRing
          placeholder={
            <PlaceholderIcon>
              {isQueued ? <RiTimeLine size={28} /> : <Spinner size={26} />}
            </PlaceholderIcon>
          }
        />

        <VerdictCopy>
          <Eyebrow>
            {isQueued
              ? 'Waiting to begin'
              : `Review in progress · Step ${stageIndex + 1} of ${reviewStages.length}`}
          </Eyebrow>
          <Title as="h3" size="4" weight="strong">
            {stage?.title ?? 'Your security review is queued.'}
          </Title>
          <Text size="2" color="gray700">
            {stage?.detail ?? 'The review starts as soon as a reviewer is available.'}
          </Text>
        </VerdictCopy>
      </VerdictRow>

      <StepsWrapper>
        <ProgressSteps
          orientation="horizontal"
          aria-label="Security review stages"
          steps={reviewStages.map(item => ({
            id: item.id,
            label: item.label,
            description:
              item.id == 'analyzing' && toolCount
                ? `${toolCount} tools and data access`
                : item.description,
            state: states[item.id]
          }))}
        />
      </StepsWrapper>

      <Activity>
        <ActivityDot />
        {revision?.activity ??
          (isQueued ? 'Waiting for an available reviewer' : stage?.description)}
      </Activity>
    </>
  );
};

export let SecurityReviewStatus = ({
  icon,
  eyebrow,
  title,
  description,
  action
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <VerdictRow>
    <ScoreRing placeholder={<PlaceholderIcon>{icon}</PlaceholderIcon>} />

    <VerdictCopy>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Title as="h3" size="4" weight="strong">
        {title}
      </Title>
      <Text size="2" color="gray700">
        {description}
      </Text>
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </VerdictCopy>
  </VerdictRow>
);

export let SecurityReviewNotices = ({
  review,
  revision,
  versionLabel
}: {
  review: SecurityReview;
  revision: SecurityReviewRevision;
  versionLabel?: string | null;
}) => {
  let { inProgress } = getReviewRevisions(review);
  let isCurrent = review.currentRevision?.id == revision.id;
  let notices: React.ReactNode[] = [];

  if (inProgress && isCurrent) {
    let stage = reviewStages.find(stage => stage.id == inProgress.stage);

    notices.push(
      <ProgressStrip key="reassessing">
        <ProgressStripLabel>
          <Spinner size={14} />
          <span>
            {inProgress.status == 'queued'
              ? 'A new assessment is queued.'
              : `Reassessing${stage ? ` · ${stage.label}` : ''}${inProgress.activity ? ` · ${inProgress.activity}` : ''}`}
          </span>
        </ProgressStripLabel>
        <Text size="1" color="gray600">
          The current report stays available
        </Text>
      </ProgressStrip>
    );
  }

  if (review.status == 'outdated' && isCurrent) {
    notices.push(
      <Callout key="outdated" color="gray" size="1">
        <strong>A newer version is available.</strong> This report covers{' '}
        {versionLabel ? `version ${versionLabel}` : 'an earlier version'}. The latest version
        has its own assessment.
      </Callout>
    );
  }

  if (revision.blockReason == 'billing') {
    notices.push(
      <Callout key="billing" color="orange" size="1">
        <strong>The AI review is paused.</strong> Your organization has reached its security
        review allowance. Only deterministic checks ran for this revision. Upgrade your plan to
        resume AI reviews.
      </Callout>
    );
  } else if (revision.blockReason == 'ai_disabled') {
    notices.push(
      <Callout key="ai-disabled" color="gray" size="1">
        <strong>AI review is disabled for this project.</strong> Only deterministic checks ran,
        and no provider source was sent for AI review.
      </Callout>
    );
  } else if (revision.blockReason == 'admin_disabled') {
    notices.push(
      <Callout key="admin-disabled" color="gray" size="1">
        <strong>AI review is unavailable for this provider.</strong> Only deterministic checks
        ran.
      </Callout>
    );
  }

  if (revision.awaitingTools) {
    notices.push(
      <Callout key="awaiting-tools" color="blue" size="1">
        <strong>Some tools are not inspected yet.</strong> This server lists its tools only
        once credentials are connected. Exposure covers the observed tools, and the review
        updates when the full tool list is available.
      </Callout>
    );
  } else if (revision.scores?.confidence == 'low') {
    notices.push(
      <Callout key="low-confidence" color="yellow" size="1">
        <strong>Limited evidence.</strong> Parts of this provider could not be verified. See
        Method and Limits for the gaps.
      </Callout>
    );
  }

  if (revision.report.provenance?.class == 'impersonation_suspected') {
    notices.push(
      <Callout key="impersonation" color="red" size="1">
        <strong>Verify publisher ownership before sharing credentials.</strong> The brand in
        the name or description does not match the host or OAuth issuer.
      </Callout>
    );
  }

  if (!notices.length) return null;

  return <Notices>{notices}</Notices>;
};

export let SecurityReviewMeta = ({
  revision,
  versionLabel,
  checkedAt
}: {
  revision: SecurityReviewRevision;
  versionLabel?: string | null;
  checkedAt?: Date | string | null;
}) => (
  <Text
    size="1"
    color="gray600"
    as="div"
    style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
  >
    <span>
      Assessed <RenderDate date={revision.completedAt ?? revision.createdAt} format="date" />
    </span>
    {checkedAt && (
      <span>
        · Verified <RenderDate date={checkedAt} format="date" />
      </span>
    )}
    {versionLabel && <span>· Version {versionLabel}</span>}
    {revision.scores && (
      <span>· {confidenceLabels[revision.scores.confidence]} confidence</span>
    )}
  </Text>
);

export let securityReviewIcons = {
  failed: <RiErrorWarningLine size={28} />,
  locked: <RiLockLine size={28} />
};
