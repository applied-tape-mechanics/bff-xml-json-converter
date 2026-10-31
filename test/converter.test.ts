import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { buildJsonToXml, buildXmlToJson } from '../src/compiler.ts';
import { ConverterEngine } from '../src/engine.ts';

const engine = new ConverterEngine();

describe('XML to JSON (Brainfuck)', () => {
  it('converts simple note XML to JSON', () => {
    const xml = '<note><to>Tove</to><from>Jani</from></note>';
    const res = engine.xmlToJson(xml);
    assert.equal(res.direction, 'xml2json');
    assert.deepEqual(res.result, { note: { to: 'Tove', from: 'Jani' } });
    assert.ok(res.element_count >= 2);
  });

  it('converts user profile XML to JSON', () => {
    const xml = '<user><name>Alice</name><age>30</age><city>Helsinki</city></user>';
    const res = engine.xmlToJson(xml);
    assert.deepEqual(res.result, {
      user: { name: 'Alice', age: '30', city: 'Helsinki' },
    });
  });

  it('converts nested catalog XML to JSON', () => {
    const xml = '<root><item><id>1</id><title>Hello</title></item></root>';
    const res = engine.xmlToJson(xml);
    assert.deepEqual(res.result, {
      root: { item: { id: '1', title: 'Hello' } },
    });
  });

  it('converts single tag XML to JSON', () => {
    const xml = '<person><name>Bob</name></person>';
    const res = engine.xmlToJson(xml);
    assert.deepEqual(res.result, { person: { name: 'Bob' } });
  });

  it('handles empty XML', () => {
    const res = engine.xmlToJson('');
    assert.deepEqual(res.result, {});
  });
});

describe('JSON to XML (Brainfuck)', () => {
  it('converts simple note JSON to XML', () => {
    const jsonStr = '{"note":{"to":"Tove","from":"Jani"}}';
    const res = engine.jsonToXml(jsonStr);
    assert.equal(res.direction, 'json2xml');
    assert.equal(res.result, '<note><to>Tove</to><from>Jani</from></note>');
  });

  it('converts user profile JSON to XML', () => {
    const jsonStr = '{"user":{"name":"Alice","age":"30","city":"Helsinki"}}';
    const res = engine.jsonToXml(jsonStr);
    assert.equal(res.result, '<user><name>Alice</name><age>30</age><city>Helsinki</city></user>');
  });

  it('converts single tag JSON to XML', () => {
    const jsonStr = '{"person":{"name":"Bob"}}';
    const res = engine.jsonToXml(jsonStr);
    assert.equal(res.result, '<person><name>Bob</name></person>');
  });

  it('handles empty JSON', () => {
    const res = engine.jsonToXml('');
    assert.equal(res.result, '');
  });
});

describe('bidirectional roundtrips', () => {
  it('xml roundtrip note', () => {
    const original = '<note><to>Tove</to><from>Jani</from></note>';
    const step1 = engine.xmlToJson(original);
    const step2 = engine.jsonToXml(step1.result as Record<string, any>);
    assert.equal(step2.result, original);
  });

  it('user roundtrip', () => {
    const original = '<user><name>Alice</name><age>30</age><city>Helsinki</city></user>';
    const step1 = engine.xmlToJson(original);
    const step2 = engine.jsonToXml(step1.result as Record<string, any>);
    assert.equal(step2.result, original);
  });
});

describe('compiler', () => {
  const stripped = (file: string) =>
    readFileSync(new URL(`../bf/${file}`, import.meta.url), 'utf-8').replace(/[^><+\-.,[\]]/g, '');

  it('regenerates bf/xml_to_json.bf exactly', () => assert.equal(buildXmlToJson(), stripped('xml_to_json.bf')));
  it('regenerates bf/json_to_xml.bf exactly', () => assert.equal(buildJsonToXml(), stripped('json_to_xml.bf')));
});

describe('HTTP API', () => {
  let app: FastifyInstance;
  before(async () => {
    app = await buildApp({ engine });
  });
  after(async () => {
    await app.close();
  });

  const json = (r: { json: () => unknown }) => r.json() as Record<string, any>;

  it('GET /health', async () => {
    const res = await app.inject('/health');
    assert.equal(res.statusCode, 200);
    const data = json(res);
    assert.equal(data.status, 'ok');
    assert.equal(data.app, 'bff-xml-json-converter');
    assert.equal(data.engine, 'brainfuck');
    assert.equal(data.backend_enabled, true);
  });

  it('GET / serves the web UI', async () => {
    const res = await app.inject('/');
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'] as string, /text\/html/);
    assert.ok(res.body.includes('XML ↔ JSON'));
    assert.ok(res.body.includes('Brainfuck'));
  });

  it('POST /convert/xml-to-json endpoint', async () => {
    const xml = '<person><name>Bob</name></person>';
    const res = await app.inject({
      method: 'POST',
      url: '/convert/xml-to-json',
      payload: xml,
      headers: { 'content-type': 'text/plain' },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(json(res).result, { person: { name: 'Bob' } });
  });

  it('POST /convert/json-to-xml endpoint', async () => {
    const jsonStr = '{"person":{"name":"Bob"}}';
    const res = await app.inject({
      method: 'POST',
      url: '/convert/json-to-xml',
      payload: jsonStr,
      headers: { 'content-type': 'text/plain' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(json(res).result, '<person><name>Bob</name></person>');
  });

  it('POST /convert auto-detects XML', async () => {
    const xml = '<person><name>Bob</name></person>';
    const res = await app.inject({
      method: 'POST',
      url: '/convert',
      payload: { payload: xml },
    });
    assert.equal(res.statusCode, 200);
    const data = json(res);
    assert.equal(data.direction, 'xml2json');
    assert.deepEqual(data.result, { person: { name: 'Bob' } });
  });

  it('POST /convert auto-detects JSON', async () => {
    const jsonStr = '{"person":{"name":"Bob"}}';
    const res = await app.inject({
      method: 'POST',
      url: '/convert',
      payload: { payload: jsonStr },
    });
    assert.equal(res.statusCode, 200);
    const data = json(res);
    assert.equal(data.direction, 'json2xml');
    assert.equal(data.result, '<person><name>Bob</name></person>');
  });

  it('GET /bf returns metadata', async () => {
    const data = json(await app.inject('/bf'));
    assert.ok(data.xml_to_json.length > 1000);
    assert.ok(data.json_to_xml.length > 1000);
    assert.ok(data.xml_to_json.code);
    assert.ok(allOps(data.xml_to_json.op_counts));
  });

  it('GET /bf/xml-to-json and /bf/json-to-xml return raw Brainfuck', async () => {
    const resXml = await app.inject('/bf/xml-to-json');
    assert.equal(resXml.statusCode, 200);
    assert.ok(resXml.body.length > 1000);

    const resJson = await app.inject('/bf/json-to-xml');
    assert.equal(resJson.statusCode, 200);
    assert.ok(resJson.body.length > 1000);
  });
});

describe('DISABLE_BACKEND', () => {
  it('returns 503 for processing and hides docs', async () => {
    const app = await buildApp({ engine, disableBackend: true });
    const res = await app.inject({
      method: 'POST',
      url: '/convert/xml-to-json',
      payload: '<a/>',
    });
    assert.equal(res.statusCode, 503);
    assert.match(res.json().detail, /DISABLE_BACKEND/);
    assert.equal((await app.inject('/openapi.json')).statusCode, 404);
    await app.close();
  });
});

function allOps(counts: Record<string, number>): boolean {
  return [...'><+-.,[]'].every((op) => op in counts);
}
