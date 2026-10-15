import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { DetailsSettingsLayout } from '@metorial/details-layout';
import { useSandboxImage } from '@metorial/state';
import { Button, Flex, Input } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  ImageStack,
  useConfirmSandboxImageDeletion,
  useSandboxImagePaths
} from '../../../scenes/sandbox/images/common';

export let SandboxImageSettingsPage = () => {
  let { imageId } = useParams();
  let paths = useSandboxImagePaths();
  let navigate = useNavigate();
  let image = useSandboxImage(paths.instanceId, imageId);
  let update = image.useUpdateMutator();
  let remove = image.useDeleteMutator();
  let deletion = useConfirmSandboxImageDeletion({
    instanceId: paths.instanceId,
    imageId: imageId!,
    onDelete: async () => {
      let [result] = await remove.mutate();
      if (result) navigate(paths.images());
    }
  });
  let form = useForm({
    initialValues: { name: image.data?.name || '' },
    updateInitialValues: true,
    onSubmit: values => update.mutate({ name: values.name.trim() }),
    schema: yup => yup.object({ name: yup.string().trim().required('Name is required') })
  });
  return renderWithLoader({ image })(({ image }) =>
    image.data.owner === 'global' ? (
      <Navigate replace to={paths.image(image.data.id)} />
    ) : (
      <DetailsSettingsLayout>
        <ImageStack>
          <Box title="General">
            <form onSubmit={form.handleSubmit}>
              <Flex direction="column" gap={15}>
                <Input label="Name" {...form.getFieldProps('name')} />
                <form.RenderError field="name" />
                <Button
                  style={{ alignSelf: 'flex-start' }}
                  size="2"
                  type="submit"
                  loading={update.isLoading}
                  success={update.isSuccess}
                >
                  Save
                </Button>
                <update.RenderError />
              </Flex>
            </form>
          </Box>
          <Box title="Danger Zone" description="Deleting an image cancels running builds.">
            <Flex direction="column" gap={15}>
              <Button
                style={{ alignSelf: 'flex-start' }}
                size="2"
                color="red"
                loading={remove.isLoading || deletion.isLoading}
                success={remove.isSuccess}
                onClick={() => deletion.mutate()}
              >
                Delete Image
              </Button>
              <remove.RenderError />
              <deletion.RenderError />
            </Flex>
          </Box>
        </ImageStack>
      </DetailsSettingsLayout>
    )
  );
};
