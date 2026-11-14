import { renderWithLoader } from '@metorial/data-hooks';
import {
  useProviderVersion,
  useSecurityReview,
  useSecurityReviewsEnabled
} from '@metorial/state';
import { Button, Spacer, Text, theme } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { RiArrowRightLine, RiLockLine } from '@remixicon/react';
import { Link } from 'react-router-dom';
import { styled } from 'styled-components';
import { SecurityReviewMeta } from './assessment';
import {
  getDisplayedRevision,
  isSecurityReviewUnavailable,
  SecurityAssessmentBody
} from './body';
import { getReviewRevisions } from './lib';

let Footer = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid ${theme.colors.gray300};
`;

let FooterMeta = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

export let SecurityAssessmentCard = ({
  instanceId,
  providerId,
  reportHref,
  title = 'Protoguard Security Assessment',
  spacing = 15
}: {
  instanceId: string | null | undefined;
  providerId: string | null | undefined;
  reportHref: string;
  title?: string;
  spacing?: number;
}) => {
  let isEnabled = useSecurityReviewsEnabled();
  let review = useSecurityReview(instanceId, providerId);
  let displayed = review.data ? getDisplayedRevision(review.data) : null;
  let version = useProviderVersion(instanceId, displayed?.providerVersionId);

  if (!isEnabled) return null;
  if (isSecurityReviewUnavailable(review.error)) return null;
  if (review.data?.status == 'disabled') return null;
  if (!review.data && !review.error) return null;

  return (
    <>
      {renderWithLoader({ review })(({ review }) => {
        let { current } = getReviewRevisions(review.data);

        return (
          <Box title={title}>
            <SecurityAssessmentBody
              review={review.data}
              versionLabel={version.data?.version}
              usage={review.data.usageReview?.currentRevision}
            />

            <Footer>
              {current ? (
                <SecurityReviewMeta
                  revision={current}
                  versionLabel={version.data?.version}
                  checkedAt={review.data.lastCheckedAt}
                />
              ) : (
                <Text size="1" color="gray600" as="span">
                  <FooterMeta>
                    <RiLockLine size={13} />
                    Metorial Protoguard Security Assessment
                  </FooterMeta>
                </Text>
              )}

              <Link to={reportHref}>
                <Button as="span" size="1" variant="outline" iconRight={<RiArrowRightLine />}>
                  Read Full Report
                </Button>
              </Link>
            </Footer>
          </Box>
        );
      })}

      {spacing > 0 && <Spacer height={spacing} />}
    </>
  );
};
