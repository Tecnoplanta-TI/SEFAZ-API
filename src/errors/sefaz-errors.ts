export class SefazApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SefazApiError';
  }
}

export type TipoDocumentoDistribuicao = 'nfe' | 'cte';

const DOCUMENTO_CONFIG: Record<
  TipoDocumentoDistribuicao,
  {
    resumoPrefix: string;
    procPrefix: string;
    resumoCode: string;
    label: string;
  }
> = {
  nfe: {
    resumoPrefix: 'resNFe',
    procPrefix: 'procNFe',
    resumoCode: 'RESUMO_NFE',
    label: 'NF-e',
  },
  cte: {
    resumoPrefix: 'resCTe',
    procPrefix: 'procCTe',
    resumoCode: 'RESUMO_CTE',
    label: 'CT-e',
  },
};

export function mapSefazResult(params: {
  cStat?: string;
  xMotivo?: string;
  schema?: string;
  xml?: string;
  tipoDocumento?: TipoDocumentoDistribuicao;
}): { xml: string } {
  const { cStat, xMotivo, schema, xml } = params;
  const tipoDocumento = params.tipoDocumento ?? 'nfe';
  const config = DOCUMENTO_CONFIG[tipoDocumento];

  if (cStat === '656') {
    throw new SefazApiError(
      xMotivo ?? 'Uso indevido do serviço de distribuição DF-e.',
      503,
      'SEFAZ_BLOCKED',
      { cStat },
    );
  }

  if (cStat === '137') {
    throw new SefazApiError(
      xMotivo ?? 'Nenhum documento localizado para a chave informada.',
      404,
      'DOCUMENTO_NAO_LOCALIZADO',
      { cStat },
    );
  }

  if (cStat !== '138') {
    throw new SefazApiError(
      xMotivo ?? 'Resposta inesperada da SEFAZ.',
      502,
      'SEFAZ_UNEXPECTED_STATUS',
      { cStat },
    );
  }

  if (!xml || !schema) {
    throw new SefazApiError(
      'A SEFAZ não retornou o documento fiscal.',
      502,
      'SEFAZ_EMPTY_DOCUMENT',
      { cStat },
    );
  }

  if (schema.startsWith(config.resumoPrefix)) {
    throw new SefazApiError(
      `A SEFAZ retornou apenas o resumo da ${config.label}.`,
      422,
      config.resumoCode,
      { cStat, schema },
    );
  }

  if (!schema.startsWith(config.procPrefix)) {
    throw new SefazApiError(
      `Tipo de documento não suportado: ${schema}`,
      502,
      'SEFAZ_UNSUPPORTED_SCHEMA',
      { cStat, schema },
    );
  }

  return { xml };
}
