import mongoose from 'mongoose';
import { env } from '../env';

export let client = await mongoose.connect(env.jackson.SSO_MONGO_URL, {
  serverSelectionTimeoutMS: 5000
});
