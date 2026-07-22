import type { FastifyInstance } from 'fastify';
import { SefazApiError } from '../errors/sefaz-errors.js';
import {
  consultarNfePorChave,
  manifestarNfe,
} from '../services/sefaz.service.js';
import type { TipoEventoManifestacao } from '../config/sefaz-client.js';
import {
  normalizarChaveNfe,
  obterModeloChave,
  validarChaveDocumento,
} from '../utils/chave.js';
import { resolverCnpjRequest } from '../utils/cnpj-request.js';
import { extrairXmlPostingDate } from '../utils/xml-nfe.js';

type ConsultaBody = {
  chave: string;
  cnpj?: string;
};

type ManifestarBody = {
  chave: string;
  cnpj?: string;
  tipoEvento?: TipoEventoManifestacao;
  justificativa?: string;
};

type NfeRouteDeps = {
  consultarNfe?: (chave: string, cnpj?: string) => Promise<string>;
  manifestarNfe?: (
    chave: string,
    tipoEvento?: TipoEventoManifestacao,
    justificativa?: string,
    cnpj?: string,
  ) => Promise<void>;
};

function validarChaveRequest(chave: unknown): string | { error: string } {
  if (!chave || typeof chave !== 'string') {
    return { error: 'Campo "chave" é obrigatório.' };
  }

  const chaveNormalizada = normalizarChaveNfe(chave);

  if (!validarChaveDocumento(chaveNormalizada, '55')) {
    const tamanho = chaveNormalizada.length;
    const modelo = obterModeloChave(chaveNormalizada);

    if (tamanho !== 44) {
      return {
        error: `Chave com tamanho incorreto (${tamanho} dígitos). Informe 44 dígitos numéricos.`,
      };
    }

    if (modelo === '57') {
      return {
        error: 'Chave de CT-e (modelo 57). Use o endpoint POST /cte/consulta.',
      };
    }

    return {
      error:
        modelo !== '55'
          ? `Chave de NF-e inválida (modelo ${modelo}). O modelo esperado é 55.`
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

    const cnpjValidado = resolverCnpjRequest(request.body?.cnpj);

    if (typeof cnpjValidado !== 'string') {
      return reply.status(400).send({
        status: 'error',
        message: cnpjValidado.error,
      });
    }

    try {
      const xml = await consultar(chaveValidada, cnpjValidado);
      const xmlPostingDate = extrairXmlPostingDate(xml) ?? null;

      return reply.send({
        status: 'ok',
        chave: chaveValidada,
        cnpj: cnpjValidado,
        xml,
        xmlPostingDate,
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

      const cnpjValidado = resolverCnpjRequest(request.body?.cnpj);

      if (typeof cnpjValidado !== 'string') {
        return reply.status(400).send({
          status: 'error',
          message: cnpjValidado.error,
        });
      }

      const { tipoEvento = 210210, justificativa } = request.body ?? {};

      try {
        await manifestar(chaveValidada, tipoEvento, justificativa, cnpjValidado);

        return reply.send({
          status: 'ok',
          chave: chaveValidada,
          cnpj: cnpjValidado,
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
