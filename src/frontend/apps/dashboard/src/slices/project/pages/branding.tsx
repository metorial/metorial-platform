import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { getConfig } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { useCurrentProject, useProjectBrand, withAuth } from '@metorial/state';
import { Button, Input, Spacer, Text, theme, toast } from '@metorial/ui';
import { useEffect, useState } from 'react';
import { styled } from 'styled-components';
import { useSetLayout } from './_layout';

let BrandingLayout = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

let LogoCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 12px;
  background: ${theme.colors.gray100};
`;

let LogoPreview = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 140px;
  padding: 20px;
  border-radius: 10px;
  border: 1px dashed ${theme.colors.gray400};
  background: ${theme.colors.gray100};
`;

let LogoImage = styled.img`
  max-width: 100%;
  max-height: 72px;
  object-fit: contain;
`;

let FileInput = styled.input`
  font: inherit;
`;

let FileActions = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

let getUploadErrorMessage = async (response: Response) => {
  let text = await response.text();
  if (!text) return `Upload failed with status ${response.status}`;

  try {
    let parsed = JSON.parse(text);
    return parsed?.error?.message ?? parsed?.message ?? text;
  } catch {
    return text;
  }
};

let uploadProjectBrandImage = async (d: { organizationId: string; file: File }) =>
  withAuth(async () => {
    let body = new FormData();
    body.set('file', d.file);
    body.set('purpose', 'project_brand_image');
    body.set('organization_id', d.organizationId);

    let response = await fetch(new URL('/files', getConfig().apiUrl), {
      method: 'POST',
      body,
      credentials: 'include',
      headers: {
        'metorial-version': '2025-01-01-dashboard'
      }
    });

    if (!response.ok) {
      throw new Error(await getUploadErrorMessage(response));
    }

    let payload = (await response.json()) as { id: string };
    return payload.id;
  });

export let ProjectBrandingPage = () => {
  let project = useCurrentProject();
  let brand = useProjectBrand(project.data?.organization.id, project.data?.id);
  let updateBrand = brand.updateMutator();
  let [selectedFile, setSelectedFile] = useState<File | null>(null);
  let [removeLogo, setRemoveLogo] = useState(false);
  let [previewUrl, setPreviewUrl] = useState<string | null>(null);
  let [isUploading, setIsUploading] = useState(false);

  useSetLayout({
    title: 'Branding',
    breadcrumbs: [{ label: 'Branding', to: 'branding' }]
  });

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    let nextPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [selectedFile]);

  let form = useForm({
    initialValues: {
      name: brand.data?.name ?? project.data?.name ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      if (!project.data) return;

      let nextName = values.name.trim();
      if (!nextName) {
        toast.error('Name is required');
        return;
      }

      try {
        let imageFileId: string | null | undefined;

        if (selectedFile) {
          setIsUploading(true);
          imageFileId = await uploadProjectBrandImage({
            organizationId: project.data.organization.id,
            file: selectedFile
          });
        } else if (removeLogo) {
          imageFileId = null;
        }

        await updateBrand.mutate({
          name: nextName,
          imageFileId
        });

        setSelectedFile(null);
        setRemoveLogo(false);
        toast.success('Branding updated');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update branding');
      } finally {
        setIsUploading(false);
      }
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required')
      })
  });

  return renderWithLoader({ project, brand })(({ brand }) => {
    let imageUrl = removeLogo ? null : (previewUrl ?? brand.data.imageUrl);

    return (
      <ContentLayout variant="medium">
        <PageHeader
          title="Branding"
          description="Set the project name and logo used in setup flows."
        />

        <form onSubmit={form.handleSubmit}>
          <BrandingLayout>
            <LogoCard>
              <Text as="p" size="2" weight="strong">
                Logo
              </Text>

              <LogoPreview>
                {imageUrl ? (
                  <LogoImage src={imageUrl} alt={form.values.name || brand.data.name} />
                ) : (
                  <Text size="2" color="gray600">
                    No logo uploaded yet
                  </Text>
                )}
              </LogoPreview>

              <FileActions>
                <FileInput
                  type="file"
                  accept="image/*"
                  onChange={event => {
                    let file = event.target.files?.[0] ?? null;
                    setSelectedFile(file);
                    setRemoveLogo(false);
                  }}
                />

                {(brand.data.imageUrl || selectedFile) && (
                  <Button
                    type="button"
                    variant="outline"
                    color="gray"
                    onClick={() => {
                      setSelectedFile(null);
                      setRemoveLogo(true);
                    }}
                  >
                    Remove Logo
                  </Button>
                )}
              </FileActions>

              {selectedFile && (
                <Text size="1" color="gray600">
                  Selected file: {selectedFile.name}
                </Text>
              )}
            </LogoCard>

            <Input label="Display Name" {...form.getFieldProps('name')} />
            <form.RenderError field="name" />

            <Spacer size={5} />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                loading={updateBrand.isLoading || isUploading}
                success={updateBrand.isSuccess}
              >
                Save
              </Button>
            </div>
          </BrandingLayout>
        </form>
      </ContentLayout>
    );
  });
};
