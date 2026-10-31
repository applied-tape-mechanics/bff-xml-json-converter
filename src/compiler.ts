/**
 * Brainfuck Compiler / Generator for:
 * 1. XML to JSON (bf/xml_to_json.bf)
 * 2. JSON to XML (bf/json_to_xml.bf)
 *
 * Run `npm run compile:bf` to regenerate both programs.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type TapeFn = (t: Tape) => void;

export class Tape {
  pos: number;
  readonly ops: string[] = [];

  constructor(pos = 0) {
    this.pos = pos;
  }

  goto(target: number): void {
    const diff = target - this.pos;
    if (diff > 0) this.ops.push('>'.repeat(diff));
    else if (diff < 0) this.ops.push('<'.repeat(-diff));
    this.pos = target;
  }

  add(n = 1): void {
    if (n > 0) this.ops.push('+'.repeat(n));
  }

  sub(n = 1): void {
    if (n > 0) this.ops.push('-'.repeat(n));
  }

  zero(): void {
    this.ops.push('[-]');
  }

  dot(): void {
    this.ops.push('.');
  }

  comma(): void {
    this.ops.push(',');
  }

  loopStart(): void {
    this.ops.push('[');
  }

  loopEnd(): void {
    this.ops.push(']');
  }

  emitStr(text: string, printCell = 30): void {
    const orig = this.pos;
    this.goto(printCell);
    let cur = 0;
    for (const b of new TextEncoder().encode(text)) {
      const diff = b - cur;
      if (diff > 0) this.add(diff);
      else if (diff < 0) this.sub(-diff);
      this.dot();
      cur = b;
    }
    this.zero();
    this.goto(orig);
  }

  code(): string {
    return this.ops.join('');
  }
}

export function testEqCell(
  t: Tape,
  srcCell: number,
  target: number,
  resCell: number,
  s1 = 24,
  s2 = 25,
): void {
  t.goto(s1); t.zero(); t.goto(s2); t.zero();
  t.goto(srcCell);
  t.loopStart();
  t.goto(s1); t.add();
  t.goto(s2); t.add();
  t.goto(srcCell); t.sub();
  t.loopEnd();
  t.goto(s2);
  t.loopStart();
  t.goto(srcCell); t.add();
  t.goto(s2); t.sub();
  t.loopEnd();
  t.goto(s1);
  if (target > 0) t.sub(target);
  t.goto(resCell); t.zero(); t.add();
  t.goto(s1);
  t.loopStart();
  t.goto(resCell); t.zero();
  t.goto(s1); t.zero();
  t.loopEnd();
  t.goto(0);
}

export function testEq(t: Tape, target: number, resCell: number, s1 = 24, s2 = 25): void {
  testEqCell(t, 0, target, resCell, s1, s2);
}

export function ifElse(
  t: Tape,
  flagCell: number,
  ifFn: TapeFn | null,
  elseFn: TapeFn | null = null,
  level = 0,
): void {
  const s1 = 12 + level * 2;
  const s2 = 13 + level * 2;
  t.goto(s1); t.zero(); t.goto(s2); t.zero();
  t.goto(flagCell);
  t.loopStart();
  t.goto(s1); t.add();
  t.goto(s2); t.add();
  t.goto(flagCell); t.sub();
  t.loopEnd();
  t.goto(s2);
  t.loopStart();
  t.goto(flagCell); t.add();
  t.goto(s2); t.sub();
  t.loopEnd();
  t.goto(s2); t.add();
  t.goto(s1);
  t.loopStart();
  t.goto(s2); t.zero();
  t.goto(s1); t.zero();
  t.goto(0);
  if (ifFn) ifFn(t);
  t.goto(s1);
  t.loopEnd();
  t.goto(s2);
  t.loopStart();
  t.goto(s2); t.zero();
  t.goto(0);
  if (elseFn) elseFn(t);
  t.goto(s2);
  t.loopEnd();
  t.goto(0);
}

export function buildXmlToJson(): string {
  const t = new Tape(0);
  for (let c = 1; c <= 25; c++) {
    t.goto(c); t.zero();
  }
  t.goto(0);
  t.emitStr('{');

  t.comma();
  t.loopStart();

  t.loopStart(); // if c0 != 0

  for (let c = 8; c <= 11; c++) {
    t.goto(c); t.zero();
  }
  t.goto(0);

  testEq(t, 60, 8); // '<' -> c8
  testEq(t, 62, 9); // '>' -> c9
  testEq(t, 47, 10); // '/' -> c10

  // Whitespace -> c11:
  testEq(t, 32, 21);
  testEq(t, 9, 22);
  t.goto(21); t.loopStart(); t.goto(11); t.add(); t.goto(21); t.zero(); t.loopEnd();
  t.goto(22); t.loopStart(); t.goto(11); t.add(); t.goto(22); t.zero(); t.loopEnd();
  t.goto(0);
  testEq(t, 10, 21);
  testEq(t, 13, 22);
  t.goto(21); t.loopStart(); t.goto(11); t.add(); t.goto(21); t.zero(); t.loopEnd();
  t.goto(22); t.loopStart(); t.goto(11); t.add(); t.goto(22); t.zero(); t.loopEnd();
  t.goto(0);

  // 1. Delimiter '<' (c8 == 1)
  const handleLt = (t: Tape) => {
    const ifInText = (t: Tape) => {
      t.emitStr('"');
      t.goto(2); t.zero(); // in_text = 0
      t.goto(4); t.zero(); t.add(); // saw_lt = 1
      t.goto(6); t.zero(); t.add(); // need_comma = 1
      t.goto(7); t.zero(); // just_closed_elem = 0
      t.goto(0);
    };

    const elseInText = (t: Tape) => {
      const ifExpVal = (t: Tape) => {
        t.emitStr('{');
        t.goto(5); t.zero(); // expect_value = 0
        t.goto(4); t.zero(); t.add(); // saw_lt = 1
        t.goto(6); t.zero(); // need_comma = 0
        t.goto(0);
      };
      const elseExpVal = (t: Tape) => {
        t.goto(4); t.zero(); t.add(); // saw_lt = 1
        t.goto(0);
      };
      ifElse(t, 5, ifExpVal, elseExpVal, 2);
    };

    ifElse(t, 2, ifInText, elseInText, 1);
    t.goto(0); t.zero();
  };

  t.goto(8); t.loopStart(); t.zero(); t.goto(0); handleLt(t); t.goto(8); t.loopEnd(); t.goto(0);

  // 2. Delimiter '/' (c10 == 1)
  const handleSlash = (t: Tape) => {
    const ifSawLt = (t: Tape) => {
      t.goto(4); t.zero(); // saw_lt = 0
      t.goto(3); t.zero(); t.add(); // in_closing_tag = 1
      const ifJustClosed = (t: Tape) => {
        t.emitStr('}');
        t.goto(7); t.zero();
      };
      ifElse(t, 7, ifJustClosed, null, 2);
      t.goto(7); t.zero(); t.add(); // just_closed_elem = 1
      t.goto(6); t.zero(); t.add(); // need_comma = 1
      t.goto(0);
    };
    const elseSawLt = (t: Tape) => {
      const ifTextSlash = (t: Tape) => {
        t.goto(0); t.dot();
      };
      ifElse(t, 2, ifTextSlash, null, 2);
    };
    ifElse(t, 4, ifSawLt, elseSawLt, 1);
    t.goto(0); t.zero();
  };

  t.goto(10); t.loopStart(); t.zero(); t.goto(0); handleSlash(t); t.goto(10); t.loopEnd(); t.goto(0);

  // 3. Delimiter '>' (c9 == 1)
  const handleGt = (t: Tape) => {
    const ifClosing = (t: Tape) => {
      t.goto(3); t.zero(); // in_closing_tag = 0
      t.goto(0);
    };
    const elseClosing = (t: Tape) => {
      const ifTagName = (t: Tape) => {
        t.emitStr('":');
        t.goto(1); t.zero(); // in_tag_name = 0
        t.goto(5); t.zero(); t.add(); // expect_value = 1
        t.goto(0);
      };
      ifElse(t, 1, ifTagName, null, 2);
    };
    ifElse(t, 3, ifClosing, elseClosing, 1);
    t.goto(0); t.zero();
  };

  t.goto(9); t.loopStart(); t.zero(); t.goto(0); handleGt(t); t.goto(9); t.loopEnd(); t.goto(0);

  // 4. Whitespace (c11 == 1)
  const handleWs = (t: Tape) => {
    const ifTextWs = (t: Tape) => {
      t.goto(0); t.dot();
    };
    ifElse(t, 2, ifTextWs, null, 1);
    t.goto(0); t.zero();
  };

  t.goto(11); t.loopStart(); t.zero(); t.goto(0); handleWs(t); t.goto(11); t.loopEnd(); t.goto(0);

  // 5. Regular character (c0 != 0)
  t.loopStart(); // if c0 != 0
  const handleReg = (t: Tape) => {
    const ifSawLtReg = (t: Tape) => {
      t.goto(4); t.zero(); // saw_lt = 0
      t.goto(1); t.zero(); t.add(); // in_tag_name = 1
      const ifNeedComma = (t: Tape) => {
        t.emitStr(',');
        t.goto(6); t.zero();
      };
      ifElse(t, 6, ifNeedComma, null, 2);
      t.emitStr('"');
      t.goto(7); t.zero(); // just_closed_elem = 0
      t.goto(0); t.dot(); t.zero();
    };

    const elseSawLtReg = (t: Tape) => {
      const ifExpValReg = (t: Tape) => {
        t.emitStr('"');
        t.goto(0); t.dot(); t.zero();
        t.goto(5); t.zero(); // expect_value = 0
        t.goto(2); t.zero(); t.add(); // in_text = 1
        t.goto(0);
      };
      const elseExpValReg = (t: Tape) => {
        const ifTagChar = (t: Tape) => {
          t.goto(0); t.dot(); t.zero();
        };
        const ifTextChar = (t: Tape) => {
          t.goto(0); t.dot(); t.zero();
        };
        const ifTag = (t: Tape) => {
          ifElse(t, 1, ifTagChar, null, 4);
        };
        ifElse(t, 2, ifTextChar, ifTag, 3);
      };
      ifElse(t, 5, ifExpValReg, elseExpValReg, 2);
    };

    ifElse(t, 4, ifSawLtReg, elseSawLtReg, 1);
    t.goto(0); t.zero();
  };

  handleReg(t);
  t.loopEnd(); // end c0 != 0

  t.goto(0);
  t.loopEnd(); // end outer c0 != 0

  t.comma();
  t.loopEnd(); // end read loop

  t.emitStr('}');
  return t.code();
}

export function printTagBuffer(t: Tape, baseCell: number): void {
  for (let i = 1; i <= 15; i++) {
    const cell = baseCell + i;
    t.goto(26); t.zero(); t.goto(27); t.zero();
    t.goto(cell);
    t.loopStart();
    t.goto(26); t.add();
    t.goto(27); t.add();
    t.goto(cell); t.sub();
    t.loopEnd();
    t.goto(27);
    t.loopStart();
    t.goto(cell); t.add();
    t.goto(27); t.sub();
    t.loopEnd();
    t.goto(26);
    t.loopStart();
    t.dot();
    t.zero();
    t.loopEnd();
  }
  t.goto(0);
}

export function copyTagBuffer(t: Tape, srcBase: number, dstBase: number): void {
  for (let i = 1; i <= 15; i++) {
    const src = srcBase + i;
    const dst = dstBase + i;
    t.goto(dst); t.zero();
    t.goto(26); t.zero();
    t.goto(src);
    t.loopStart();
    t.goto(dst); t.add();
    t.goto(26); t.add();
    t.goto(src); t.sub();
    t.loopEnd();
    t.goto(26);
    t.loopStart();
    t.goto(src); t.add();
    t.goto(26); t.sub();
    t.loopEnd();
  }
  t.goto(0);
}

export function buildJsonToXml(): string {
  const t = new Tape(0);
  for (let c = 1; c < 150; c++) {
    t.goto(c); t.zero();
  }
  t.goto(0);

  t.comma();
  t.loopStart();
  t.loopStart(); // if c0 != 0

  for (let c = 8; c <= 11; c++) {
    t.goto(c); t.zero();
  }
  t.goto(0);

  testEq(t, 34, 8);   // '"' -> c8
  testEq(t, 58, 9);   // ':' -> c9
  testEq(t, 123, 10); // '{' -> c10
  testEq(t, 125, 11); // '}' -> c11

  // 1. Delimiter '"' (c8 == 1)
  const handleQuote = (t: Tape) => {
    const ifInVal = (t: Tape) => {
      t.emitStr('</');
      printTagBuffer(t, 50);
      t.emitStr('>');
      t.goto(3); t.zero(); // in_val = 0
      t.goto(0);
    };

    const elseInVal = (t: Tape) => {
      const ifAfterKey = (t: Tape) => {
        t.emitStr('<');
        printTagBuffer(t, 50);
        t.emitStr('>');
        t.goto(2); t.zero(); // after_key = 0
        t.goto(3); t.zero(); t.add(); // in_val = 1
        t.goto(0);
      };
      const elseAfterKey = (t: Tape) => {
        const ifInKey = (t: Tape) => {
          t.goto(1); t.zero(); // in_key = 0
          t.goto(2); t.zero(); t.add(); // after_key = 1
          t.goto(0);
        };
        const elseInKey = (t: Tape) => {
          for (let i = 50; i <= 65; i++) {
            t.goto(i); t.zero();
          }
          t.goto(5); t.zero(); t.add(); // key_ptr = 1
          t.goto(1); t.zero(); t.add(); // in_key = 1
          t.goto(0);
        };
        ifElse(t, 1, ifInKey, elseInKey, 3);
      };
      ifElse(t, 2, ifAfterKey, elseAfterKey, 2);
    };
    ifElse(t, 3, ifInVal, elseInVal, 1);
    t.goto(0); t.zero();
  };

  t.goto(8); t.loopStart(); t.zero(); t.goto(0); handleQuote(t); t.goto(8); t.loopEnd(); t.goto(0);

  // 2. Delimiter '{' (c10 == 1)
  const handleLbrace = (t: Tape) => {
    const ifAfterKeyLbrace = (t: Tape) => {
      t.emitStr('<');
      printTagBuffer(t, 50);
      t.emitStr('>');
      t.goto(2); t.zero(); // after_key = 0
      const ifD0 = (t: Tape) => {
        copyTagBuffer(t, 50, 80);
        t.goto(4); t.add(); // D = 1
        t.goto(0);
      };
      const ifD1 = (t: Tape) => {
        copyTagBuffer(t, 50, 100);
        t.goto(4); t.add(); // D = 2
        t.goto(0);
      };
      ifElse(t, 4, ifD1, ifD0, 3);
    };
    ifElse(t, 2, ifAfterKeyLbrace, null, 1);
    t.goto(0); t.zero();
  };

  t.goto(10); t.loopStart(); t.zero(); t.goto(0); handleLbrace(t); t.goto(10); t.loopEnd(); t.goto(0);

  // 3. Delimiter '}' (c11 == 1)
  const handleRbrace = (t: Tape) => {
    const ifDIs2 = (t: Tape) => {
      t.emitStr('</');
      printTagBuffer(t, 100);
      t.emitStr('>');
      t.goto(4); t.sub(); // D = 1
      t.goto(0);
    };
    const ifDIs1 = (t: Tape) => {
      t.emitStr('</');
      printTagBuffer(t, 80);
      t.emitStr('>');
      t.goto(4); t.sub(); // D = 0
      t.goto(0);
    };
    testEqCell(t, 4, 2, 28); // c28 = 1 if D==2
    const elseDepth2 = (t: Tape) => {
      testEqCell(t, 4, 1, 29);
      ifElse(t, 29, ifDIs1, null, 3);
    };
    ifElse(t, 28, ifDIs2, elseDepth2, 2);
    t.goto(0); t.zero();
  };

  t.goto(11); t.loopStart(); t.zero(); t.goto(0); handleRbrace(t); t.goto(11); t.loopEnd(); t.goto(0);

  // 4. Delimiter ':' (c9 == 1)
  t.goto(9); t.loopStart(); t.zero(); t.goto(0); t.zero(); t.goto(9); t.loopEnd(); t.goto(0);

  // 5. Regular characters (c0 != 0):
  t.loopStart(); // if c0 != 0
  const handleReg = (t: Tape) => {
    const ifInValChar = (t: Tape) => {
      t.goto(0); t.dot(); t.zero();
    };

    const elseInValChar = (t: Tape) => {
      const ifInKeyChar = (t: Tape) => {
        for (let i = 1; i <= 15; i++) {
          testEqCell(t, 5, i, 28);
          const writeAtI = (t: Tape) => {
            t.goto(0);
            t.loopStart();
            t.goto(50 + i); t.add();
            t.goto(26); t.add();
            t.goto(0); t.sub();
            t.loopEnd();
            t.goto(26);
            t.loopStart();
            t.goto(0); t.add();
            t.goto(26); t.sub();
            t.loopEnd();
            t.goto(0);
          };
          ifElse(t, 28, writeAtI, null, 4);
        }
        t.goto(5); t.add(); // key_ptr += 1
        t.goto(0); t.zero();
      };
      ifElse(t, 1, ifInKeyChar, null, 3);
    };

    ifElse(t, 3, ifInValChar, elseInValChar, 2);
    t.goto(0); t.zero();
  };

  handleReg(t);
  t.loopEnd(); // end if c0 != 0

  t.goto(0);
  t.loopEnd(); // end outer c0 != 0

  t.comma();
  t.loopEnd(); // end read loop

  return t.code();
}

function main(): void {
  const bfDir = new URL('../bf/', import.meta.url);
  mkdirSync(bfDir, { recursive: true });

  console.log('Compiling XML to JSON Brainfuck state machine...');
  const xml2json = buildXmlToJson();
  const xmlPath = new URL('xml_to_json.bf', bfDir);
  writeFileSync(xmlPath, xml2json + '\n', 'utf-8');
  console.log(`Generated ${fileURLToPath(xmlPath)} (${xml2json.length.toLocaleString('en-US')} ops)`);

  console.log('Compiling JSON to XML Brainfuck state machine...');
  const json2xml = buildJsonToXml();
  const jsonPath = new URL('json_to_xml.bf', bfDir);
  writeFileSync(jsonPath, json2xml + '\n', 'utf-8');
  console.log(`Generated ${fileURLToPath(jsonPath)} (${json2xml.length.toLocaleString('en-US')} ops)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
