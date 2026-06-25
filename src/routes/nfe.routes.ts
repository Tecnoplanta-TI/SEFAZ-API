import type { FastifyInstance } from 'fastify';
import { SefazApiError } from '../errors/sefaz-errors.js';
import {
  consultarNfePorChave,
  manifestarNfe,
} from '../services/sefaz.service.js';
import type { TipoEventoManifestacao } from '../config/sefaz-client.js';
import { normalizarChaveNfe, validarChaveNfe } from '../utils/chave.js';

type ConsultaBody = {
  chave: string;
};

type ManifestarBody = {
  chave: string;
  tipoEvento?: TipoEventoManifestacao;
  justificativa?: string;
};

type NfeRouteDeps = {
  consultarNfe?: (chave: string) => Promise<string>;
  manifestarNfe?: (
    chave: string,
    tipoEvento?: TipoEventoManifestacao,
    justificativa?: string,
  ) => Promise<void>;
};

function validarChaveRequest(chave: unknown): string | { error: string } {
  if (!chave || typeof chave !== 'string') {
    return { error: 'Campo "chave" é obrigatório.' };
  }

  const chaveNormalizada = normalizarChaveNfe(chave);

  if (!validarChaveNfe(chaveNormalizada)) {
    const tamanho = chaveNormalizada.length;

    return {
      error:
        tamanho !== 44
          ? `Chave com tamanho incorreto (${tamanho} dígitos). Informe 44 dígitos numéricos.`
          : 'Chave de acesso inválida. Verifique o dígito verificador.',
    };
  }

  return chaveNormalizada;
}

export async function nfeRoutes(
  app: FastifyInstance,
  deps: NfeRouteDeps = {},
): Promise<void> {
  const consultar = deps.consultarNfe ?? consultarNfePorChave;
  const manifestar = deps.manifestarNfe ?? manifestarNfe;

  app.post<{ Body: ConsultaBody }>('/nfe/consulta', async (request, reply) => {
    const chaveValidada = validarChaveRequest(request.body?.chave);

    if (typeof chaveValidada !== 'string') {
      return reply.status(400).send({
        status: 'error',
        message: chaveValidada.error,
      });
    }

    try {
      const xml = await consultar(chaveValidada);

      return reply.send({
        status: 'ok',
        chave: chaveValidada,
        xml,
      });
    } catch (error) {
      if (error instanceof SefazApiError) {
        return reply.status(error.statusCode).send({
          status: 'error',
          message: error.message,
          code: error.code,
          details: error.details,
        });
      }

      request.log.error(error);

      return reply.status(500).send({
        status: 'error',
        message: 'Erro interno ao consultar a NF-e.',
      });
    }
  });

  app.post<{ Body: ManifestarBody }>(
    '/nfe/manifestar',
    async (request, reply) => {
      const chaveValidada = validarChaveRequest(request.body?.chave);

      if (typeof chaveValidada !== 'string') {
        return reply.status(400).send({
          status: 'error',
          message: chaveValidada.error,
        });
      }

      const { tipoEvento = 210210, justificativa } = request.body ?? {};

      try {
        await manifestar(chaveValidada, tipoEvento, justificativa);

        return reply.send({
          status: 'ok',
          chave: chaveValidada,
          tipoEvento,
        });
      } catch (error) {
        if (error instanceof SefazApiError) {
          return reply.status(error.statusCode).send({
            status: 'error',
            message: error.message,
            code: error.code,
            details: error.details,
          });
        }

        request.log.error(error);

        return reply.status(500).send({
          status: 'error',
          message: 'Erro interno ao manifestar a NF-e.',
        });
      }
    },
  );
}
