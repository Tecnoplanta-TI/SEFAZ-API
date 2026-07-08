import type { FastifyInstance } from 'fastify';
import { SefazApiError } from '../errors/sefaz-errors.js';
import { consultarCtePorChave } from '../services/sefaz-cte.service.js';
import {
  normalizarChaveNfe,
  obterModeloChave,
  validarChaveDocumento,
} from '../utils/chave.js';
import { extrairXmlPostingDate } from '../utils/xml-nfe.js';

type ConsultaBody = {
  chave: string;
};

type CteRouteDeps = {
  consultarCte?: (chave: string) => Promise<string>;
};

function validarChaveCteRequest(chave: unknown): string | { error: string } {
  if (!chave || typeof chave !== 'string') {
    return { error: 'Campo "chave" é obrigatório.' };
  }

  const chaveNormalizada = normalizarChaveNfe(chave);

  if (!validarChaveDocumento(chaveNormalizada, '57')) {
    const tamanho = chaveNormalizada.length;
    const modelo = obterModeloChave(chaveNormalizada);

    if (tamanho !== 44) {
      return {
        error: `Chave com tamanho incorreto (${tamanho} dígitos). Informe 44 dígitos numéricos.`,
      };
    }

    if (modelo === '55') {
      return {
        error: 'Chave de NF-e (modelo 55). Use o endpoint POST /nfe/consulta.',
      };
    }

    return {
      error:
        modelo !== '57'
          ? `Chave de CT-e inválida (modelo ${modelo}). O modelo esperado é 57.`
          : 'Chave de acesso inválida. Verifique o dígito verificador.',
    };
  }

  return chaveNormalizada;
}

export async function cteRoutes(
  app: FastifyInstance,
  deps: CteRouteDeps = {},
): Promise<void> {
  const consultar = deps.consultarCte ?? consultarCtePorChave;

  app.post<{ Body: ConsultaBody }>('/cte/consulta', async (request, reply) => {
    const chaveValidada = validarChaveCteRequest(request.body?.chave);

    if (typeof chaveValidada !== 'string') {
      return reply.status(400).send({
        status: 'error',
        message: chaveValidada.error,
      });
    }

    try {
      const xml = await consultar(chaveValidada);
      const xmlPostingDate = extrairXmlPostingDate(xml) ?? null;

      return reply.send({
        status: 'ok',
        chave: chaveValidada,
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
        message: 'Erro interno ao consultar o CT-e.',
      });
    }
  });
}
