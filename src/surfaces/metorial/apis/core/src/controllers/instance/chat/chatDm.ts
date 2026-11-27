import { v } from '@lowerdeck/validation';
import { chatDmService } from '@metorial-subspace/module-chat';
import { chatChannelPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { chatGroup } from './_shared';

let openDmBodyValidator = v.union([
  v.object({
    type: v.literal('single', { description: 'Open a DM with one user.' }),
    user: v.union(
      [
        v.object({
          type: v.literal('email', { description: 'Identify the user by email address.' }),
          email: v.string({ description: "The user's email address" })
        }),
        v.object({
          type: v.literal('phone_number', {
            description: 'Identify the user by phone number.'
          }),
          phone_number: v.string({ description: "The user's phone number" })
        }),
        v.object({
          type: v.literal('generic', {
            description: 'Identify the user by their provider-specific ID.'
          }),
          user_id: v.string({ description: "The user's provider-specific ID" })
        })
      ],
      { description: 'User to open the DM with.' }
    )
  }),
  v.object({
    type: v.literal('group', { description: 'Open a DM with several users.' }),
    users: v.union(
      [
        v.object({
          type: v.literal('email', { description: 'Identify the users by email address.' }),
          emails: v.array(v.string(), { description: "The users' email addresses" })
        }),
        v.object({
          type: v.literal('phone_number', {
            description: 'Identify the users by phone number.'
          }),
          phone_numbers: v.array(v.string(), { description: "The users' phone numbers" })
        }),
        v.object({
          type: v.literal('generic', {
            description: 'Identify the users by their provider-specific IDs.'
          }),
          user_ids: v.array(v.string(), { description: "The users' provider-specific IDs" })
        })
      ],
      { description: 'Users to open the group DM with.' }
    )
  })
]);

export let chatDmController = Controller.create(
  {
    name: 'Chat DMs',
    description: 'A chat DM is a direct message channel with one or more users on a chat.'
  },
  {
    open: chatGroup
      .post(instancePath('chats/:chatId/dms', 'chats.dms.open'), {
        name: 'Open chat DM',
        description: 'Opens (or retrieves) a direct message channel with one or more users.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .body('default', openDmBodyValidator)
      .output(chatChannelPresenter)
      .do(async ctx => {
        let chatChannel =
          ctx.body.type === 'single'
            ? await chatDmService.openSingleDm({
                instance: ctx.instance,
                chat: ctx.chat,
                input:
                  ctx.body.user.type === 'email'
                    ? { type: 'email', email: ctx.body.user.email }
                    : ctx.body.user.type === 'phone_number'
                      ? { type: 'phone_number', phoneNumber: ctx.body.user.phone_number }
                      : { type: 'generic', userId: ctx.body.user.user_id }
              })
            : await chatDmService.openGroupDm({
                instance: ctx.instance,
                chat: ctx.chat,
                input:
                  ctx.body.users.type === 'email'
                    ? { type: 'email', emails: ctx.body.users.emails }
                    : ctx.body.users.type === 'phone_number'
                      ? { type: 'phone_number', phoneNumbers: ctx.body.users.phone_numbers }
                      : { type: 'generic', userIds: ctx.body.users.user_ids }
              });

        return chatChannelPresenter.present({ chatChannel });
      })
  }
);
