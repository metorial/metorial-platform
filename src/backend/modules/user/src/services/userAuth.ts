import { Context } from '@metorial/context';
import { User, UserSession, withTransaction } from '@metorial/db';
import { badRequestError, ServiceError, unauthorizedError } from '@metorial/error';
import { Service } from '@metorial/service';
import { userService } from './user';
import { userSessionService } from './userSession';

class UserAuthService {
  async loginWithPassword(d: {
    input: {
      email: string;
      password: string;
    };
    context: Context;
  }) {
    return withTransaction(async db => {
      let user = await db.user.findFirst({
        where: {
          email: d.input.email
        }
      });
      let isValid = user?.passwordHash
        ? await Bun.password.verify(d.input.password, user.passwordHash)
        : false;

      if (!user || !isValid) {
        throw new ServiceError(
          badRequestError({
            message: 'Invalid email or password'
          })
        );
      }

      return await userSessionService.createUserSession({
        user,
        context: d.context
      });
    });
  }

  async signupWithPassword(d: {
    input: {
      name: string;
      email: string;
      password: string;
    };
    context: Context;
  }) {
    return withTransaction(async db => {
      let user = await userService.createUser({
        input: {
          name: d.input.name,
          email: d.input.email,
          password: d.input.password
        },
        context: d.context
      });

      return await userSessionService.createUserSession({
        user,
        context: d.context
      });
    });
  }

  async authenticateWithSessionSecret(d: { sessionClientSecret: string; context: Context }) {
    let session = await userSessionService.getSessionByClientSecretSafe({
      clientSecret: d.sessionClientSecret,
      context: d.context
    });
    if (!session) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Session not found or expired'
        })
      );
    }

    return {
      session,
      user: session.user
    };
  }

  async DANGEROUSLY_authenticateWithUserId(d: { userId: string; context: Context }) {
    let user = await userService.getUser({
      userId: d.userId
    });

    return {
      user
    };
  }

  async logout(d: { context: Context; session: UserSession & { user: User } }) {
    return await userSessionService.deleteUserSession({
      user: d.session.user,
      session: d.session,
      context: d.context
    });
  }
}

export let userAuthService = Service.create(
  'userAuthService',
  () => new UserAuthService()
).build();
