import { type Skill, useUploadFile } from '@metorial/state';
import { Button, CenteredSpinner, theme } from '@metorial/ui';
import { useState } from 'react';
import styled from 'styled-components';
import { ImageUploader } from './imageUploader';

let Wrapper = styled('div')`
  display: flex;
  gap: 12px;
`;

let Image = styled('figure')`
  width: 60px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  display: flex;
  transition: all 0.3s;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;

    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
  }

  &:hover {
    box-shadow: 0 0 0 5px ${theme.colors.primary};
    background: ${theme.colors.primary};
  }
`;

let Actions = styled('div')`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

export let SkillImageUploader = (p: {
  instanceId: string;
  skill: Skill;
  updateSkill: {
    mutate: (input: { imageFileId: string | null }) => Promise<unknown>;
    isLoading: boolean;
  };
}) => {
  let createFile = useUploadFile();
  let [isOpen, setIsOpen] = useState(false);
  let isCustomImage = !p.skill.imageUrl.includes('avatar-cdn.metorial.com');

  return (
    <Wrapper>
      <Image onClick={() => setIsOpen(true)}>
        <img src={p.skill.imageUrl} />

        {(p.updateSkill.isLoading || createFile.isLoading) && (
          <div className="loading">
            <CenteredSpinner />
          </div>
        )}
      </Image>

      <Actions>
        {isCustomImage ? (
          <>
            <Button
              size="2"
              type="button"
              variant="outline"
              onClick={() => {
                p.updateSkill.mutate({
                  imageFileId: null
                });
              }}
            >
              Remove
            </Button>

            <Button size="2" type="button" variant="outline" onClick={() => setIsOpen(true)}>
              Upload
            </Button>
          </>
        ) : (
          <Button size="2" type="button" variant="outline" onClick={() => setIsOpen(true)}>
            Upload Image
          </Button>
        )}

        <ImageUploader
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          photoUrl={p.skill.imageUrl}
          label="Upload Image"
          description="Upload an image to represent this skill in discovery flows."
          onReset={
            isCustomImage ? () => p.updateSkill.mutate({ imageFileId: null }) : undefined
          }
          onSave={async file => {
            let [uploadedFile] = await createFile.mutate({
              instanceId: p.instanceId,
              file,
              purpose: 'skill_image'
            });

            if (uploadedFile) {
              await p.updateSkill.mutate({
                imageFileId: uploadedFile.id
              });
            }
          }}
        />
      </Actions>
    </Wrapper>
  );
};
