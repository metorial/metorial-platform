import { badRequestError, ServiceError } from '@mtsrc/error';
import { Tokens } from '@mtsrc/tokens';
import type { ValidationType } from '@mtsrc/validation';
import { addSeconds } from 'date-fns';
import { env } from '../env';

let ticketToken = new Tokens({
  secret: env.keys.AUTH_TICKET_SECRET
});

export let tickets = {
  encode: (data: { [key: string]: any }) => {
    return ticketToken.sign({
      type: 'auth_ticket',
      data,
      expiresAt: addSeconds(new Date(), 30)
    });
  },
  decode: async <T>(ticket: string, validation: ValidationType<T>) => {
    try {
      let payload = await ticketToken.verify({
        token: ticket,
        expectedType: 'auth_ticket'
      });
      if (!payload.verified)
        throw new ServiceError(badRequestError({ message: 'Invalid ticket' }));

      let val = validation.validate(payload.data);
      if (!val.success) throw new ServiceError(badRequestError({ message: 'Invalid ticket' }));

      return val.value;
    } catch (e) {
      throw new ServiceError(badRequestError({ message: 'Invalid ticket' }));
    }
  }
};
