type BodyParserApp = {
  useBodyParser(parser: 'json' | 'urlencoded', options: Record<string, unknown>): unknown;
};

export type RequestSizeLimits = {
  json: string;
  urlencoded: string;
};

export function resolveRequestSizeLimits(): RequestSizeLimits {
  return {
    json: process.env.REQUEST_JSON_LIMIT?.trim() || '1mb',
    urlencoded: process.env.REQUEST_FORM_LIMIT?.trim() || '256kb',
  };
}

export function applyRequestSizeLimits(app: BodyParserApp, limits = resolveRequestSizeLimits()) {
  app.useBodyParser('json', { limit: limits.json });
  app.useBodyParser('urlencoded', { limit: limits.urlencoded, extended: true });
}
