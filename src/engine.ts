/**
 * Brainfuck XML <-> JSON Converter Engine.
 * Executes pure Brainfuck streaming state machines for both conversion directions.
 */

import { readFileSync } from 'node:fs';
import { BrainfuckVM, cleanCode, compile, type Program } from 'bff-interpreter';

export interface ConversionResult {
  direction: 'xml2json' | 'json2xml';
  source: string;
  result: Record<string, any> | string;
  element_count: number;
  character_count: number;
}

export interface BfProgramInfo {
  name: string;
  description: string;
  length: number;
  op_counts: Record<string, number>;
  code?: string;
}

const BF_OPS = '><+-.,[]';
const decoder = new TextDecoder();

function loadBf(dir: URL, file: string): string {
  const path = new URL(file, dir);
  try {
    return cleanCode(readFileSync(path, 'utf-8'));
  } catch (err) {
    throw new Error(`Missing Brainfuck program at ${path.pathname}`, { cause: err });
  }
}

function countKeys(obj: unknown): number {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    let count = Object.keys(obj).length;
    for (const val of Object.values(obj)) {
      count += countKeys(val);
    }
    return count;
  }
  return 0;
}

export class ConverterEngine {
  readonly codeXml2Json: string;
  readonly codeJson2Xml: string;
  private readonly programXml2Json: Program;
  private readonly programJson2Xml: Program;

  constructor(bfDir: URL = new URL('../bf/', import.meta.url)) {
    this.codeXml2Json = loadBf(bfDir, 'xml_to_json.bf');
    this.codeJson2Xml = loadBf(bfDir, 'json_to_xml.bf');
    this.programXml2Json = compile(this.codeXml2Json);
    this.programJson2Xml = compile(this.codeJson2Xml);
  }

  getBfInfo(includeCode = true): { xml_to_json: BfProgramInfo; json_to_xml: BfProgramInfo } {
    const analyze = (code: string, name: string, description: string): BfProgramInfo => {
      const op_counts: Record<string, number> = {};
      for (const op of BF_OPS) op_counts[op] = code.split(op).length - 1;
      const info: BfProgramInfo = { name, description, length: code.length, op_counts };
      if (includeCode) info.code = code;
      return info;
    };
    return {
      xml_to_json: analyze(
        this.codeXml2Json,
        'xml_to_json.bf',
        'Streaming delimiter state machine converting XML elements to JSON object structures',
      ),
      json_to_xml: analyze(
        this.codeJson2Xml,
        'json_to_xml.bf',
        'Stack-depth tracking state machine converting JSON objects to XML element tags',
      ),
    };
  }

  private run(program: Program, text: string): string {
    return decoder.decode(new BrainfuckVM().run(program, text));
  }

  /** Converts raw XML to JSON object using Brainfuck state machine. */
  xmlToJson(xmlInput: string): ConversionResult {
    const cleaned = xmlInput.trim();
    if (!cleaned) {
      return {
        direction: 'xml2json',
        source: xmlInput,
        result: {},
        element_count: 0,
        character_count: 0,
      };
    }

    const rawOutput = this.run(this.programXml2Json, cleaned);
    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(rawOutput);
    } catch (exc) {
      throw new Error(`Brainfuck emitted invalid JSON: ${exc instanceof Error ? exc.message : String(exc)}\nRaw output: ${rawOutput.slice(0, 300)}`);
    }

    return {
      direction: 'xml2json',
      source: cleaned,
      result: parsed,
      element_count: countKeys(parsed),
      character_count: cleaned.length,
    };
  }

  /** Converts JSON string or object to XML using Brainfuck state machine. */
  jsonToXml(jsonInput: string | Record<string, any>): ConversionResult {
    let rawJson: string;
    if (typeof jsonInput === 'object' && jsonInput !== null) {
      rawJson = JSON.stringify(jsonInput);
    } else {
      rawJson = String(jsonInput ?? '').trim();
    }

    if (!rawJson) {
      return {
        direction: 'json2xml',
        source: '',
        result: '',
        element_count: 0,
        character_count: 0,
      };
    }

    let compactJson: string;
    try {
      compactJson = JSON.stringify(JSON.parse(rawJson));
    } catch {
      compactJson = rawJson;
    }

    const xmlStr = this.run(this.programJson2Xml, compactJson);
    const openTags = (xmlStr.match(/<[a-zA-Z0-9_-]+/g) || []).length;
    const closeTags = (xmlStr.match(/<\/[a-zA-Z0-9_-]+/g) || []).length;
    const tagCount = Math.max(0, openTags - closeTags);

    return {
      direction: 'json2xml',
      source: compactJson,
      result: xmlStr,
      element_count: Math.max(tagCount, Math.floor(openTags / 2)),
      character_count: compactJson.length,
    };
  }

  /** Auto-detects format if direction is not provided, or routes accordingly. */
  autoConvert(payload: string, direction?: string | null): ConversionResult {
    const cleaned = payload.trim();
    let dir = (direction ?? 'auto').toLowerCase();

    if (dir === 'auto') {
      if (cleaned.startsWith('<')) {
        dir = 'xml2json';
      } else if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
        dir = 'json2xml';
      } else {
        dir = 'xml2json';
      }
    }

    if (['xml2json', 'xml-to-json', 'xml'].includes(dir)) {
      return this.xmlToJson(cleaned);
    } else if (['json2xml', 'json-to-xml', 'json'].includes(dir)) {
      return this.jsonToXml(cleaned);
    } else {
      throw new Error(`Unsupported conversion direction: ${direction}`);
    }
  }
}
