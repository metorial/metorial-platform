import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsTableLayout } from '@metorial/details-layout';
import { useSandboxImage } from '@metorial/state';
import { Select } from '@metorial/ui';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ImageStack, useSandboxImagePaths } from '../../../scenes/sandbox/images/common';
import {
  SandboxImageVersionsTable,
  type ImageBuildFilter
} from '../../../scenes/sandbox/images/versionsTable';

export let SandboxImageVersionsPage = () => {
  let { imageId } = useParams();
  let paths = useSandboxImagePaths();
  let image = useSandboxImage(paths.instanceId, imageId);
  let [status, setStatus] = useState<ImageBuildFilter>('all');
  return renderWithLoader({ image })(({ image }) => (
    <DetailsTableLayout title="Versions">
      <ImageStack>
        <div style={{ width: 350 }}>
          {image.data.owner === 'own' && (
            <Select
              label="Status"
              value={status}
              onChange={value => setStatus(value as ImageBuildFilter)}
              items={[
                { id: 'all', label: 'All' },
                { id: 'succeeded', label: 'Succeeded' },
                { id: 'failed', label: 'Failed' },
                { id: 'progress', label: 'In Progress' }
              ]}
            />
          )}
        </div>

        <SandboxImageVersionsTable
          imageId={image.data.id}
          owner={image.data.owner}
          status={status}
        />
      </ImageStack>
    </DetailsTableLayout>
  ));
};
