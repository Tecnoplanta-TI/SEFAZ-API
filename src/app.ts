import Fastify, { type FastifyInstance } from 'fastify';
import { nfeRoutes } from './routes/nfe.routes.js';

type BuildAppOptions = {
  consultarNfe?: (chave: string) => Promise<string>;
};

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.consultarNfe ? false : true,
  });

  app.get('/health', async () => ({ status: 'ok' }));
  await app.register(nfeRoutes, options);

  return app;
}
