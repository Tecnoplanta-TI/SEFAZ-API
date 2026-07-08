import Fastify, { type FastifyInstance } from 'fastify';
import { cteRoutes } from './routes/cte.routes.js';
import { nfeRoutes } from './routes/nfe.routes.js';

type BuildAppOptions = {
  consultarNfe?: (chave: string) => Promise<string>;
  consultarCte?: (chave: string) => Promise<string>;
};

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.consultarNfe || options.consultarCte ? false : true,
  });

  app.get('/health', async () => ({ status: 'ok' }));
  await app.register(nfeRoutes, options);
  await app.register(cteRoutes, options);

  return app;
}
