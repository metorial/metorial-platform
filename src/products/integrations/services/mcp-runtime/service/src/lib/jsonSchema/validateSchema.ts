import z from 'zod';

export let validateJsonSchema = ({ schema }: { schema: any }) => {
  try {
    z.fromJSONSchema(schema).safeParse({});
    return true;
  } catch (e) {
    return false;
  }
};
