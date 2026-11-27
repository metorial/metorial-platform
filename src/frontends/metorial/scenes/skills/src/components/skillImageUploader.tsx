import { isGeneratedAvatarUrl, getAvatarUrl } from '@metorial/frontend-config';
import { AvatarUploader } from '@metorial/avatar-uploader';
import { type Skill, useUploadFile } from '@metorial/state';
import { useState } from 'react';

export let ResourceImageUploader = (p: {
  instanceId: string;
  resource: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
  updateResource: {
    mutate: (input: { imageFileId: string | null }) => Promise<unknown>;
    isLoading: boolean;
  };
  description: string;
}) => {
  let createFile = useUploadFile();
  let [isOpen, setIsOpen] = useState(false);
  let imageUrl = p.resource.imageUrl ?? getAvatarUrl(p.resource.id);
  let isCustomImage = !isGeneratedAvatarUrl(imageUrl);

  return (
    <AvatarUploader
      imageUrl={imageUrl}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      isLoading={p.updateResource.isLoading || createFile.isLoading}
      title="Upload Image"
      description={p.description}
      uploadLabel={isCustomImage ? 'Upload' : 'Upload Image'}
      onRemove={
        isCustomImage ? () => p.updateResource.mutate({ imageFileId: null }) : undefined
      }
      onUpload={async file => {
        let [uploadedFile] = await createFile.mutate({
          instanceId: p.instanceId,
          file,
          purpose: 'skill_image'
        });

        if (uploadedFile) {
          await p.updateResource.mutate({
            imageFileId: uploadedFile.id
          });
        }
      }}
    />
  );
};

export let SkillImageUploader = (p: {
  instanceId: string;
  skill: Skill;
  updateSkill: {
    mutate: (input: { imageFileId: string | null }) => Promise<unknown>;
    isLoading: boolean;
  };
}) => (
  <ResourceImageUploader
    instanceId={p.instanceId}
    resource={p.skill}
    updateResource={p.updateSkill}
    description="Upload an image to represent this skill in discovery flows."
  />
);
