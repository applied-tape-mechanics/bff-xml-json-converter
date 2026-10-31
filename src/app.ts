/**
 * Fastify server, OpenAPI docs and interactive web UI for the Brainfuck XML <-> JSON converter.
 */

import { readFileSync } from 'node:fs';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { ConverterEngine } from './engine.ts';

export const APP_ID = 'bff-xml-json-converter';
export const VERSION = '1.0.0';

export interface AppOptions {
  disableBackend?: boolean;
  engine?: ConverterEngine;
  logger?: boolean;
}

interface GenericConvertBody {
  payload?: string;
  direction?: string;
  xml?: string;
  json?: string | Record<string, any>;
  content?: string;
  data?: string;
  text?: string;
}

const resultSchema = {
  type: 'object',
  properties: {
    direction: { type: 'string', enum: ['xml2json', 'json2xml'] },
    source: { type: 'string' },
    result: {
      anyOf: [
        { type: 'object', additionalProperties: true },
        { type: 'string' },
      ],
    },
    element_count: { type: 'integer' },
    character_count: { type: 'integer' },
  },
} as const;

const errorSchema = {
  type: 'object',
  properties: { detail: { type: 'string' } },
} as const;

const errorResponses = { 400: errorSchema, 422: errorSchema, 503: errorSchema } as const;

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const disableBackend = options.disableBackend ?? false;
  const engine = options.engine ?? new ConverterEngine();
  const indexTemplate = readFileSync(new URL('./index.html', import.meta.url), 'utf-8');

  const app = Fastify({ logger: options.logger ?? false });

  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, (body as Buffer).toString('utf-8'));
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    const detail = status === 400 && /json/i.test(error.message) ? `Invalid JSON body: ${error.message}` : error.message;
    void reply.status(status).send({ detail });
  });

  if (!disableBackend) {
    await app.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'Brainfuck XML <-> JSON Converter (bff-xml-json-converter)',
          description:
            'Microservice providing bidirectional XML <-> JSON conversions using pure Brainfuck state machines.',
          version: VERSION,
        },
      },
    });
    await app.register(fastifySwaggerUi, { routePrefix: '/docs' });
    app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());
  }

  const guard = () => {
    if (disableBackend) {
      throw Object.assign(new Error('Backend API processing is disabled (DISABLE_BACKEND=true).'), {
        statusCode: 503,
      });
    }
  };

  const unprocessable = (label: string, err: unknown) =>
    Object.assign(new Error(`${label} failed: ${err instanceof Error ? err.message : String(err)}`), {
      statusCode: 422,
    });

  app.get(
    '/health',
    {
      schema: {
        summary: 'Health status',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              app: { type: 'string' },
              engine: { type: 'string' },
              version: { type: 'string' },
              backend_enabled: { type: 'boolean' },
            },
          },
        },
      },
    },
    async () => ({
      status: 'ok',
      app: APP_ID,
      engine: 'brainfuck',
      version: VERSION,
      backend_enabled: !disableBackend,
    }),
  );

  app.get<{ Querystring: { include_code: boolean } }>(
    '/bf',
    {
      schema: {
        summary: 'Brainfuck state machine metadata',
        querystring: {
          type: 'object',
          properties: { include_code: { type: 'boolean', default: true } },
        },
      },
    },
    async (req) => engine.getBfInfo(req.query.include_code),
  );

  app.get(
    '/bf/xml-to-json',
    { schema: { summary: 'XML to JSON source', produces: ['text/plain'] } },
    async (_req, reply) => reply.type('text/plain; charset=utf-8').send(engine.codeXml2Json),
  );

  app.get(
    '/bf/json-to-xml',
    { schema: { summary: 'JSON to XML source', produces: ['text/plain'] } },
    async (_req, reply) => reply.type('text/plain; charset=utf-8').send(engine.codeJson2Xml),
  );

  app.post(
    '/convert/xml-to-json',
    {
      schema: {
        summary: 'Convert XML to JSON',
        response: { 200: resultSchema, ...errorResponses },
      },
    },
    async (req) => {
      guard();
      let xmlText = '';
      if (typeof req.body === 'string') {
        xmlText = req.body;
      } else if (req.body && typeof req.body === 'object') {
        const b = req.body as GenericConvertBody;
        xmlText = b.xml || b.payload || '';
      }
      try {
        return engine.xmlToJson(xmlText);
      } catch (err) {
        throw unprocessable('XML to JSON conversion', err);
      }
    },
  );

  app.post(
    '/convert/json-to-xml',
    {
      schema: {
        summary: 'Convert JSON to XML',
        response: { 200: resultSchema, ...errorResponses },
      },
    },
    async (req) => {
      guard();
      let jsonPayload: string | Record<string, any> = '';
      if (typeof req.body === 'string') {
        jsonPayload = req.body;
      } else if (req.body && typeof req.body === 'object') {
        const b = req.body as GenericConvertBody;
        jsonPayload = b.json || b.payload || b;
      }
      try {
        return engine.jsonToXml(jsonPayload);
      } catch (err) {
        throw unprocessable('JSON to XML conversion', err);
      }
    },
  );

  app.post(
    '/convert',
    {
      schema: {
        summary: 'Auto-convert between XML and JSON',
        response: { 200: resultSchema, ...errorResponses },
      },
    },
    async (req) => {
      guard();
      let payloadStr = '';
      let direction = 'auto';

      if (typeof req.body === 'string') {
        payloadStr = req.body;
      } else if (req.body && typeof req.body === 'object') {
        const b = req.body as GenericConvertBody;
        direction = b.direction || 'auto';
        if (b.xml !== undefined) {
          payloadStr = b.xml;
          direction = 'xml2json';
        } else if (b.json !== undefined) {
          payloadStr = typeof b.json === 'object' ? JSON.stringify(b.json) : String(b.json);
          direction = 'json2xml';
        } else {
          payloadStr = b.payload || b.content || b.data || b.text || '';
        }
      }

      try {
        return engine.autoConvert(payloadStr, direction);
      } catch (err) {
        throw unprocessable('Conversion', err);
      }
    },
  );

  app.get('/', { schema: { hide: true } }, async (_req, reply) =>
    reply
      .type('text/html; charset=utf-8')
      .send(
        indexTemplate
          .replace('__BF_XML2JSON__', () => JSON.stringify(engine.codeXml2Json))
          .replace('__BF_JSON2XML__', () => JSON.stringify(engine.codeJson2Xml)),
      ),
  );

  return app;
}
