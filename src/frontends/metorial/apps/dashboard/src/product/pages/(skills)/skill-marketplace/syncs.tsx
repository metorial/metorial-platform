import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, Spacer } from '@metorial/ui';
import { RiArrowLeftLine } from '@remixicon/react';
import { Link, useParams } from 'react-router-dom';
import { SkillSyncsTable } from '../skillSyncs';

export let SkillMarketplaceSyncsPage = () => {
  let { skillMarketplaceId } = useParams();

  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return (
    <>
      <Link
        to={Paths.instance.skillMarketplace(
          organization.data,
          project.data,
          instance.data,
          skillMarketplaceId
        )}
      >
        <Button as="span" size="2" variant="outline" iconLeft={<RiArrowLeftLine />}>
          Back to Overview
        </Button>
      </Link>

      <Spacer height={15} />

      <SkillSyncsTable
        emptyMessage="No syncs found for this skill marketplace."
        query={skillMarketplaceId ? { skillMarketplaceId, order: 'desc' } : null}
      />
    </>
  );
};
