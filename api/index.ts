import awsLambdaFastify from '@fastify/aws-lambda';
import { buildApp } from '../dist/app.js';

const app = await buildApp();
await app.ready();

export default awsLambdaFastify(app);

export const config = {
  maxDuration: 60,
};
