# Brainfuck XML <-> JSON Converters (`bf/`)

This directory contains two pure Brainfuck streaming state machines:
1. `xml_to_json.bf` (6,804 operations)
2. `json_to_xml.bf` (52,532 operations)

Both programs read plain text streams from `stdin` and produce converted streams directly on `stdout`.

---

## 1. XML to JSON Converter (`bf/xml_to_json.bf`)

Converts well-formed XML documents into nested JSON representations.

### Memory Layout
| Cells | Name | Purpose |
|---|---|---|
| `c0` | `char` | Current input byte |
| `c1` | `in_tag_name` | Flag: reading opening tag name |
| `c2` | `in_text` | Flag: reading element text content |
| `c3` | `in_closing_tag` | Flag: skipping closing tag name |
| `c4` | `saw_lt` | Flag: previous byte was `<` |
| `c5` | `expect_value` | Flag: element opened, expecting child tag or text |
| `c6` | `need_comma` | Flag: emit `,` before next key |
| `c7` | `just_closed_elem`| Flag: previous closed element had child objects |
| `c8` | `is_lt` | Equality check for `<` (ASCII 60) |
| `c9` | `is_gt` | Equality check for `>` (ASCII 62) |
| `c10` | `is_slash` | Equality check for `/` (ASCII 47) |
| `c11` | `is_ws` | Equality check for whitespace |
| `c12..c23`| `scratch` | Level-isolated scratch cells for deterministic branches |
| `c24, c25`| `test_eq_scratch`| Scratch cells for byte comparisons |
| `c30` | `print_cell` | Dedicated string emitter cell |

---

## 2. JSON to XML Converter (`bf/json_to_xml.bf`)

Converts nested JSON objects back into valid XML representations with tape-buffered tag names and nesting stack.

### Memory Layout
| Cells | Name | Purpose |
|---|---|---|
| `c0` | `char` | Current input byte |
| `c1` | `in_key` | Flag: accumulating key name characters |
| `c2` | `after_key` | Flag: key ended, expecting `:` and value |
| `c3` | `in_val` | Flag: reading string value |
| `c4` | `stack_depth` | Current nesting level (0, 1, 2) |
| `c5` | `key_ptr` | Current write offset in key buffer (1..15) |
| `c8` | `is_quote` | Equality check for `"` (ASCII 34) |
| `c9` | `is_colon` | Equality check for `:` (ASCII 58) |
| `c10` | `is_lbrace` | Equality check for `{` (ASCII 123) |
| `c11` | `is_rbrace` | Equality check for `}` (ASCII 125) |
| `c12..c23`| `scratch` | Level-isolated scratch cells |
| `c24..c27`| `copy_scratch`| Buffering & equality scratch cells |
| `c30` | `print_cell` | Dedicated string emitter cell |
| `c50..c65`| `key_buffer` | Active element tag name buffer |
| `c80..c95`| `stack_lvl_0` | Stack frame 0 parent tag name |
| `c100..c115`| `stack_lvl_1` | Stack frame 1 parent tag name |
| `c120..c135`| `stack_lvl_2` | Stack frame 2 parent tag name |

---

## Recompilation
To regenerate both `.bf` state machines:
```bash
npm run compile:bf
```
