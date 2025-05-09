import { styled } from 'styled-components';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export let ProjectDeveloperPage = () => {
  return null;
  // let project = useCurrentProject();
  // let instance = useSelectedInstance();
  // let apiKeys = useApiKeys(
  //   instance.data?.id
  //     ? {
  //         type: 'instance_access_token',
  //         instanceId: instance.data.id
  //       }
  //     : undefined
  // );
  // let createApplicationModal = () =>
  //   showModal(({ dialogProps, close }) => {
  //     let mutator = applications.createMutator();
  //     let form = useForm({
  //       initialValues: { name: '', description: '' as string | undefined },
  //       onSubmit: async values => {
  //         let [res] = await mutator.mutate(values);
  //         if (res) close();
  //       },
  //       schema: yup =>
  //         yup.object().shape({
  //           name: yup.string().required('Name is required'),
  //           description: yup.string()
  //         })
  //     });
  //     return (
  //       <Dialog.Wrapper {...dialogProps}>
  //         <Dialog.Title>Create Application</Dialog.Title>
  //         <Dialog.Description>
  //           Create a new application to manage your API keys.
  //         </Dialog.Description>
  //         <form onSubmit={form.handleSubmit}>
  //           <Input label="Name" {...form.getFieldProps('name')} />
  //           <form.RenderError field="name" />
  //           <Spacer height={15} />
  //           <Input label="Description" {...form.getFieldProps('description')} />
  //           <form.RenderError field="description" />
  //           <Spacer height={15} />
  //           <Dialog.Actions>
  //             <Button size="1" variant="soft" onClick={close} type="button">
  //               Cancel
  //             </Button>
  //             <Button size="1" type="submit">
  //               Create
  //             </Button>
  //           </Dialog.Actions>
  //         </form>
  //       </Dialog.Wrapper>
  //     );
  //   });
  // let updateApplicationModal = (applicationId: string) =>
  //   showModal(({ dialogProps, close }) => {
  //     let application = applications.data?.find(a => a.id === applicationId);
  //     let mutator = applications.updateMutator();
  //     let form = useForm({
  //       initialValues: {
  //         name: application?.name ?? undefined,
  //         description: application?.description ?? undefined
  //       },
  //       onSubmit: async values => {
  //         let [res] = await mutator.mutate({
  //           ...values,
  //           applicationId
  //         });
  //         if (res) close();
  //       },
  //       schema: yup =>
  //         yup.object().shape({
  //           name: yup.string().required('Name is required'),
  //           description: yup.string()
  //         })
  //     });
  //     return (
  //       <Dialog.Wrapper {...dialogProps}>
  //         <Dialog.Title>Update Application</Dialog.Title>
  //         <Dialog.Description>Update the application details.</Dialog.Description>
  //         <form onSubmit={form.handleSubmit}>
  //           <Input label="Name" {...form.getFieldProps('name')} />
  //           <form.RenderError field="name" />
  //           <Spacer height={15} />
  //           <Input label="Description" {...form.getFieldProps('description')} />
  //           <form.RenderError field="description" />
  //           <Spacer height={15} />
  //           <Dialog.Actions>
  //             <Button size="1" variant="soft" onClick={close} type="button">
  //               Cancel
  //             </Button>
  //             <Button size="1" type="submit">
  //               Update
  //             </Button>
  //           </Dialog.Actions>
  //         </form>
  //       </Dialog.Wrapper>
  //     );
  //   });
  // let createApiKeyModal = ({ applicationId }: { applicationId: string }) =>
  //   showModal(({ dialogProps, close }) => {
  //     let application = applications.data?.find(a => a.id === applicationId);
  //     let mutator = applications.createApiKeyMutator();
  //     let form = useForm({
  //       initialValues: {
  //         name: '',
  //         description: '',
  //         expiresAt: undefined,
  //         type: 'secret' as 'secret' | 'publishable'
  //       },
  //       onSubmit: async values => {
  //         let [res] = await mutator.mutate({
  //           ...values,
  //           applicationId
  //         });
  //         if (res && instanceId) {
  //           close();
  //           let secret = await revealSecret({ instanceId, apiKeyId: res.id });
  //           setTimeout(() => {
  //             if (res && secret) {
  //               showModal(({ dialogProps, close }) => {
  //                 return (
  //                   <Dialog.Wrapper variant="padded" {...dialogProps}>
  //                     <Dialog.Title>API Key Created</Dialog.Title>
  //                     <Dialog.Description>
  //                       Your new API key is ready to use. Please don't share it with anyone and
  //                       keep it in a safe place, such as a password manager.{' '}
  //                       {!res.canRevealInfinitely && <>You won't be able to see it again.</>}
  //                     </Dialog.Description>
  //                     <Copy label="API Key" value={secret} />
  //                     <Spacer height={15} />
  //                     <Dialog.Actions>
  //                       <Button onClick={close}>Close</Button>
  //                     </Dialog.Actions>
  //                   </Dialog.Wrapper>
  //                 );
  //               });
  //             }
  //           }, 100);
  //         }
  //       },
  //       schema: yup =>
  //         yup.object().shape({
  //           name: yup.string().required('Name is required'),
  //           description: yup.string(),
  //           expiresAt: yup
  //             .date()
  //             .optional()
  //             .min(new Date(), 'Expires at must be in the future'),
  //           type: yup.string().oneOf(['publishable', 'secret'])
  //         }) as any
  //     });
  //     return (
  //       <Dialog.Wrapper {...dialogProps}>
  //         <Dialog.Title>Create API Key</Dialog.Title>
  //         <Dialog.Description>Create a new API key for the application.</Dialog.Description>
  //         <form onSubmit={form.handleSubmit}>
  //           <Input label="Name" {...form.getFieldProps('name')} />
  //           <form.RenderError field="name" />
  //           <Spacer height={15} />
  //           <Input label="Description" {...form.getFieldProps('description')} />
  //           <form.RenderError field="description" />
  //           <Spacer height={15} />
  //           <DatePicker
  //             label="Expires At"
  //             type="single"
  //             value={form.values.expiresAt}
  //             onChange={v => form.setFieldValue('expiresAt', v)}
  //             resettable
  //           />
  //           <form.RenderError field="expiresAt" />
  //           <Spacer height={15} />
  //           <Select
  //             label="Type"
  //             value={form.values.type}
  //             items={[
  //               { id: 'secret', label: 'Secret' },
  //               { id: 'publishable', label: 'Publishable' }
  //             ]}
  //             onChange={v => form.setFieldValue('type', v)}
  //           />
  //           <form.RenderError field="type" />
  //           <Spacer height={15} />
  //           <Dialog.Actions>
  //             <Button size="1" variant="soft" onClick={close} type="button">
  //               Cancel
  //             </Button>
  //             <Button size="1" type="submit">
  //               Create
  //             </Button>
  //           </Dialog.Actions>
  //         </form>
  //       </Dialog.Wrapper>
  //     );
  //   });
  // let updateApiKeyModal = ({
  //   applicationId,
  //   apiKeyId
  // }: {
  //   applicationId: string;
  //   apiKeyId: string;
  // }) =>
  //   showModal(({ dialogProps, close }) => {
  //     let application = applications.data?.find(a => a.id === applicationId);
  //     let apiKey = application?.apiKeys.find(k => k.id === apiKeyId);
  //     let mutator = applications.updateApiKeyMutator();
  //     let form = useForm({
  //       initialValues: {
  //         name: apiKey?.name ?? undefined,
  //         description: apiKey?.description ?? undefined,
  //         expiresAt: apiKey?.expiresAt ?? undefined,
  //         type: apiKey?.type ?? undefined
  //       },
  //       onSubmit: async values => {
  //         let [res] = await mutator.mutate({
  //           ...values,
  //           apiKeyId
  //         });
  //         if (res) close();
  //       },
  //       schema: yup =>
  //         yup.object().shape({
  //           name: yup.string().required('Name is required'),
  //           description: yup.string(),
  //           expiresAt: yup
  //             .date()
  //             .optional()
  //             .min(new Date(), 'Expires at must be in the future'),
  //           type: yup.string().oneOf(['publishable', 'secret'])
  //         }) as any
  //     });
  //     return (
  //       <Dialog.Wrapper {...dialogProps}>
  //         <Dialog.Title>Update API Key</Dialog.Title>
  //         <Dialog.Description>Update the API key details.</Dialog.Description>
  //         <form onSubmit={form.handleSubmit}>
  //           <Input label="Name" {...form.getFieldProps('name')} />
  //           <form.RenderError field="name" />
  //           <Spacer height={15} />
  //           <Input label="Description" {...form.getFieldProps('description')} />
  //           <form.RenderError field="description" />
  //           <Spacer height={15} />
  //           <DatePicker
  //             label="Expires At"
  //             type="single"
  //             value={form.values.expiresAt}
  //             onChange={v => form.setFieldValue('expiresAt', v)}
  //             resettable
  //           />
  //           <form.RenderError field="expiresAt" />
  //           <Spacer height={15} />
  //           <Select
  //             label="Type"
  //             value={form.values.type}
  //             items={[
  //               { id: 'secret', label: 'Secret' },
  //               { id: 'publishable', label: 'Publishable' }
  //             ]}
  //             onChange={v => form.setFieldValue('type', v)}
  //           />
  //           <form.RenderError field="type" />
  //           <Spacer height={15} />
  //           <Dialog.Actions>
  //             <Button size="1" variant="soft" onClick={close} type="button">
  //               Cancel
  //             </Button>
  //             <Button size="1" type="submit">
  //               Update
  //             </Button>
  //           </Dialog.Actions>
  //         </form>
  //       </Dialog.Wrapper>
  //     );
  //   });
  // let rollApiKeyModal = ({
  //   applicationId,
  //   apiKeyId
  // }: {
  //   applicationId: string;
  //   apiKeyId: string;
  // }) =>
  //   showModal(({ dialogProps, close }) => {
  //     let mutator = applications.rollApiKeyMutator();
  //     let [remainsValidForSeconds, setRemainsValidForSeconds] = useState('0');
  //     return (
  //       <Dialog.Wrapper {...dialogProps}>
  //         <Dialog.Title>Roll API Key</Dialog.Title>
  //         <Dialog.Description>
  //           Rolling your API key will invalidate the current secret and generate a new one. You
  //           can configure a buffer time for which both the old and new keys will be valid. This
  //           gives you time to update your applications with the new key.
  //         </Dialog.Description>
  //         <Select
  //           value={remainsValidForSeconds}
  //           onChange={v => setRemainsValidForSeconds(v)}
  //           items={[
  //             { id: '0', label: 'Revoke immediately' },
  //             { id: '60', label: '1 minute' },
  //             { id: '300', label: '5 minutes' },
  //             { id: '3600', label: '1 hour' },
  //             { id: '86400', label: '1 day' }
  //           ]}
  //         />
  //         <Spacer height={15} />
  //         <Dialog.Actions>
  //           <Button onClick={close}>Close</Button>
  //           <Button
  //             onClick={async () => {
  //               let [res] = await mutator.mutate({
  //                 apiKeyId,
  //                 remainingSecondsLeft: parseInt(remainsValidForSeconds)
  //               });
  //               if (!res || !instanceId) return;
  //               let secret = res.newApiKey.secret;
  //               if (!secret) {
  //                 secret = await revealSecret({
  //                   apiKeyId: res.newApiKey.id,
  //                   instanceId
  //                 });
  //               }
  //               close();
  //               if (res) {
  //                 setTimeout(() => {
  //                   showModal(({ dialogProps, close }) => {
  //                     return (
  //                       <Dialog.Wrapper {...dialogProps} variant="padded">
  //                         <Dialog.Title>API Key Rolled</Dialog.Title>
  //                         <Dialog.Description>
  //                           A new secret has been generated for your API key. Please keep it in
  //                           a safe place, such as a password manager.{' '}
  //                           {!res.newApiKey.canRevealInfinitely && (
  //                             <>You won't be able to see it again.</>
  //                           )}
  //                         </Dialog.Description>
  //                         <Copy label="API Key" value={secret ?? 'xxx'} />
  //                         <Spacer height={15} />
  //                         <Dialog.Actions>
  //                           <Button onClick={close}>Close</Button>
  //                         </Dialog.Actions>
  //                       </Dialog.Wrapper>
  //                     );
  //                   });
  //                 }, 100);
  //               }
  //             }}
  //           >
  //             Roll
  //           </Button>
  //         </Dialog.Actions>
  //       </Dialog.Wrapper>
  //     );
  //   });
  // let deleteApiKeyMutation = applications.deleteApiKeyMutator();
  // let deleteApiKeyModal = ({
  //   applicationId,
  //   apiKeyId
  // }: {
  //   applicationId: string;
  //   apiKeyId: string;
  // }) =>
  //   confirm({
  //     title: 'Delete API Key',
  //     description: 'Are you sure you want to delete this API key?',
  //     confirmText: 'Delete',
  //     onConfirm: async () => {
  //       let [res] = await deleteApiKeyMutation.mutate({
  //         apiKeyId
  //       });
  //       if (res) toast.success('API Key deleted successfully');
  //     }
  //   });
  // let deleteApplicationMutation = applications.deleteMutator();
  // let deleteApplicationModal = ({ applicationId }: { applicationId: string }) =>
  //   confirm({
  //     title: 'Delete Application',
  //     description: 'Are you sure you want to delete this application?',
  //     confirmText: 'Delete',
  //     onConfirm: async () => {
  //       let [res] = await deleteApplicationMutation.mutate({
  //         applicationId
  //       });
  //       if (res) toast.success('Application deleted successfully');
  //     }
  //   });
  // let initializingRef = useRef<string>(undefined);
  // let createApplication = applications.createMutator();
  // let [creatingInitialApplication, setCreatingInitialApplication] = useState(false);
  // useEffect(() => {
  //   if (
  //     instance &&
  //     project.data &&
  //     !applications.error &&
  //     !applications.isLoading &&
  //     !applications.data?.length &&
  //     initializingRef.current !== instance.id
  //   ) {
  //     setCreatingInitialApplication(true);
  //     initializingRef.current = instance.id;
  //     createApplication
  //       .mutate({
  //         name: `${instance!.name} Application`
  //       })
  //       .finally(() => {
  //         setCreatingInitialApplication(false);
  //       });
  //   }
  // }, [instance, applications.data, applications.isLoading, applications.error]);
  // let sevenDaysAgo = subDays(new Date(), 7);
  // return (
  //   <>
  //     <PageHeader
  //       title="Developer"
  //       description="Manage your API keys and applications."
  //       actions={
  //         <Button size="2" onClick={createApplicationModal}>
  //           Create Application
  //         </Button>
  //       }
  //     />
  //     {instances && (
  //       <div style={{ display: 'flex' }}>
  //         <Select
  //           label="Environment"
  //           items={instances?.map(i => ({ id: i.id, label: i.name })) ?? []}
  //           value={instanceId}
  //           onChange={setInstanceId}
  //         />
  //       </div>
  //     )}
  //     <Spacer height={20} />
  //     <Wrapper>
  //       {renderWithLoader({
  //         project,
  //         applications,
  //         creatingInitialApplication
  //       })(({ applications }) => (
  //         <>
  //           {applications.data
  //             .filter(
  //               app =>
  //                 app.status == 'active' || (app.deletedAt && app.deletedAt > sevenDaysAgo)
  //             )
  //             .sort((a, b) => {
  //               if (a.status == 'active' && b.status != 'active') return -1;
  //               if (a.status != 'active' && b.status == 'active') return 1;
  //               return a.id.localeCompare(b.id);
  //             })
  //             .map(application => (
  //               <Entity.Wrapper
  //                 key={application.id}
  //                 style={{
  //                   opacity: application.status == 'deleted' ? 0.5 : 1
  //                 }}
  //               >
  //                 <Entity.Header>
  //                   <div
  //                     style={{
  //                       display: 'flex',
  //                       alignItems: 'center',
  //                       justifyContent: 'space-between',
  //                       gap: 10,
  //                       width: '100%'
  //                     }}
  //                   >
  //                     <div>
  //                       <Title as="h2" size="3" weight="bold" truncate>
  //                         {application.name}
  //                       </Title>
  //                       {application.description && (
  //                         <Text size="2" color="gray600" weight="strong" truncate>
  //                           {application.description}
  //                         </Text>
  //                       )}
  //                     </div>
  //                     <div
  //                       style={{
  //                         display: 'flex',
  //                         gap: 10
  //                       }}
  //                     >
  //                       <Button
  //                         size="1"
  //                         iconLeft={<RiAddLine />}
  //                         onClick={() => createApiKeyModal({ applicationId: application.id })}
  //                         disabled={application.status != 'active'}
  //                       >
  //                         Create API Key
  //                       </Button>
  //                       <Menu
  //                         items={[
  //                           {
  //                             id: 'update',
  //                             label: 'Update',
  //                             disabled: application.status != 'active'
  //                           },
  //                           {
  //                             id: 'delete',
  //                             label: 'Delete',
  //                             disabled: application.status != 'active'
  //                           },
  //                           {
  //                             id: 'create-api-key',
  //                             label: 'Create API Key',
  //                             disabled: application.status != 'active'
  //                           }
  //                         ]}
  //                         onItemClick={item => {
  //                           if (item == 'update') updateApplicationModal(application.id);
  //                           if (item == 'delete')
  //                             deleteApplicationModal({ applicationId: application.id });
  //                           if (item == 'create-api-key')
  //                             createApiKeyModal({ applicationId: application.id });
  //                         }}
  //                       >
  //                         <Button
  //                           disabled={application.status != 'active'}
  //                           size="1"
  //                           variant="outline"
  //                           iconLeft={<RiMoreLine />}
  //                           title="Open application options"
  //                         />
  //                       </Menu>
  //                     </div>
  //                   </div>
  //                 </Entity.Header>
  //                 <Entity.ContentRaw style={{ padding: '5px 0px 0px 0px' }}>
  //                   <Table
  //                     headers={[
  //                       'Status',
  //                       'Type',
  //                       'Name',
  //                       'Secret',
  //                       'Expires',
  //                       'Last Used',
  //                       ' '
  //                     ]}
  //                     padding={{ sides: '20px' }}
  //                     data={application.apiKeys
  //                       .filter(
  //                         apiKey =>
  //                           apiKey.status == 'active' ||
  //                           (apiKey.deletedAt && apiKey.deletedAt > sevenDaysAgo) ||
  //                           (apiKey.expiresAt && apiKey.expiresAt > sevenDaysAgo)
  //                       )
  //                       .map(apiKey => [
  //                         <Badge size="1" color={apiKey.status == 'active' ? 'green' : 'gray'}>
  //                           {capitalize(apiKey.status)}
  //                         </Badge>,
  //                         <Badge size="1" color={apiKey.type == 'secret' ? 'blue' : 'purple'}>
  //                           {capitalize(apiKey.type)}
  //                         </Badge>,
  //                         <Flex gap={3} direction="column">
  //                           <Text size="2" weight="strong">
  //                             {apiKey.name}
  //                           </Text>
  //                           <Text size="1" color="gray600" truncate>
  //                             {apiKey.description}
  //                           </Text>
  //                         </Flex>,
  //                         <ApiKeySecret apiKey={apiKey} instanceId={instanceId!} />,
  //                         apiKey.expiresAt ? <RenderDate date={apiKey.expiresAt} /> : 'Never',
  //                         apiKey.lastUsedAt ? (
  //                           <RenderDate date={apiKey.lastUsedAt} />
  //                         ) : (
  //                           'Never'
  //                         ),
  //                         <Menu
  //                           items={[
  //                             {
  //                               id: 'update',
  //                               label: 'Update',
  //                               disabled: apiKey.status != 'active'
  //                             },
  //                             {
  //                               id: 'delete',
  //                               label: 'Delete',
  //                               disabled: apiKey.status != 'active'
  //                             },
  //                             {
  //                               id: 'roll',
  //                               label: 'Roll',
  //                               disabled: apiKey.status != 'active'
  //                             }
  //                           ]}
  //                           onItemClick={item => {
  //                             if (item == 'update')
  //                               updateApiKeyModal({
  //                                 applicationId: application.id,
  //                                 apiKeyId: apiKey.id
  //                               });
  //                             if (item == 'delete')
  //                               deleteApiKeyModal({
  //                                 applicationId: application.id,
  //                                 apiKeyId: apiKey.id
  //                               });
  //                             if (item == 'roll')
  //                               rollApiKeyModal({
  //                                 applicationId: application.id,
  //                                 apiKeyId: apiKey.id
  //                               });
  //                           }}
  //                         >
  //                           <Button
  //                             size="1"
  //                             variant="outline"
  //                             iconLeft={<RiMoreLine />}
  //                             title="Open API key options"
  //                           />
  //                         </Menu>
  //                       ])}
  //                   />
  //                 </Entity.ContentRaw>
  //               </Entity.Wrapper>
  //             ))}
  //         </>
  //       ))}
  //     </Wrapper>
  //   </>
  // );
};

// let SecretWrapper = styled('div')`
//   max-width: 300px;
//   min-width: 150px;
//   position: relative;
//   display: flex;
//   gap: 10px;
//   align-items: center;
//   padding: 10px 0px;
// `;

// let Code = styled('pre')`
//   margin: 0;
//   flex-shrink: 1;
//   flex-grow: 1;

//   font-size: 12px;
//   font-weight: 600;
//   color: ${theme.colors.gray700};

//   word-break: break-all;
//   word-wrap: break-word;
//   white-space: pre-wrap;

//   transition: all 0.2s;
// `;

// let Overlay = styled('div')`
//   position: absolute;
//   top: 0;
//   left: 0;
//   right: 0;
//   bottom: 0;

//   display: flex;
//   align-items: center;
//   justify-content: center;

//   transition: all 0.2s;
// `;

// let Action = styled('div')`
//   display: flex;
//   align-items: center;
//   width: 30px;
//   flex-shrink: 0;
// `;

// export let ApiKeySecret = ({ apiKey, instanceId }: { apiKey: ApiKey; instanceId: string }) => {
//   let reveal = useRevealableApiKey({
//     apiKeyId: apiKey.id,
//     instanceId
//   });

//   let secret = reveal.value ?? apiKey.secret;
//   let copy = useCopy(secret!);

//   return (
//     <SecretWrapper>
//       {apiKey.canReveal || secret ? (
//         <>
//           <Code style={!secret ? { filter: 'blur(10px)' } : {}}>
//             {secret ?? apiKey.secretRedactedLong}
//           </Code>

//           <Action style={{ opacity: secret ? 1 : 0 }}>
//             <Tooltip content="Copy Secret">
//               <Button
//                 variant="outline"
//                 size="1"
//                 onClick={() => copy.copy()}
//                 disabled={!secret}
//                 iconRight={<RiClipboardLine />}
//                 success={copy.copied}
//               />
//             </Tooltip>
//           </Action>
//         </>
//       ) : (
//         <Code>{apiKey.secretRedacted}</Code>
//       )}

//       <Overlay
//         style={secret || !apiKey.canReveal ? { opacity: 0, pointerEvents: 'none' } : {}}
//       >
//         <div>
//           <Button
//             onClick={() => {
//               reveal.reveal();
//             }}
//             variant="solid"
//             loading={reveal.isLoading || !!reveal.value}
//             size="1"
//           >
//             Reveal Secret
//           </Button>
//         </div>
//       </Overlay>
//     </SecretWrapper>
//   );
// };
