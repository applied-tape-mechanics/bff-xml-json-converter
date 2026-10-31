# Brainfuck XML ↔ JSON Bidirectional Converter (`bff-xml-json-converter`)

> **[Applied Tape Mechanics](https://github.com/applied-tape-mechanics)** — *Empirical computation and discrete field dynamics on minimal linear substrates.*
> *Enterprise-grade cloud microservices—except the core business logic is pure Brainfuck. Best Friends Forever (`BFF`) with the most hostile programming language ever created.*

A bidirectional **XML-to-JSON** and **JSON-to-XML** enterprise data transformation service where all parsing, call-stack tracking, and serialization state machines are executed in **pure Brainfuck** ([`bf/xml_to_json.bf`](bf/xml_to_json.bf) and [`bf/json_to_xml.bf`](bf/json_to_xml.bf)), served by a TypeScript [Fastify](https://fastify.dev) REST API with OpenAPI/Swagger documentation, an interactive Web UI, and Docker containerization.

---

## 📦 Repository Structure & File Reference

```text
bff-xml-json-converter/
├── bf/
│   ├── xml_to_json.bf         # Pure Brainfuck XML-to-JSON streaming state machine (6,804 ops)
│   ├── json_to_xml.bf         # Pure Brainfuck JSON-to-XML stack-tracking state machine (52,532 ops)
│   └── README.md              # Detailed tape cell allocation for both Brainfuck engines
├── src/
│   ├── server.ts              # HTTP server entry point (reads PORT & DISABLE_BACKEND)
│   ├── app.ts                 # Fastify application, OpenAPI/Swagger routes & HTML template injection
│   ├── engine.ts              # Brainfuck VM wrapper executing xml_to_json.bf and json_to_xml.bf
│   ├── compiler.ts            # Deterministic compiler that generates bf/xml_to_json.bf & bf/json_to_xml.bf
│   └── index.html             # Interactive Web UI with Brainfuck Code/Tape Inspector & Client JS VM fallback
├── test/
│   └── converter.test.ts      # 22 automated tests (Brainfuck engines, round-trips, compiler determinism & HTTP API)
├── Dockerfile                 # Multi-stage Node 24 container (base, test, and production stages)
├── docker-compose.yml         # Production service (port 8003 -> 8000), Brainfuck healthcheck sidecar & test runner
├── package.json               # Service metadata, scripts & pinned bff-interpreter dependency
├── tsconfig.json              # TypeScript configuration
└── LICENSE                    # MIT License
```

---

## ✨ Features

- **Bidirectional Brainfuck Core (`bf/`)**:
  - `bf/xml_to_json.bf` (`6,804` instructions): Streaming delimiter state machine converting nested XML element hierarchies directly into valid JSON objects.
  - `bf/json_to_xml.bf` (`52,532` instructions): Stack-depth and token tracking state machine (with dedicated tape frames at `c80..c135` storing parent tag names across 3 nesting levels) converting JSON objects back into well-formed XML.
- **Deterministic Compiler (`src/compiler.ts`)**:
  - Generates both `.bf` programs using relative tape pointer tracking (`Tape`), balanced branch arithmetic, and isolated nested condition scratchpads.
- **Fastify REST API** (OpenAPI spec at `/openapi.json`, Swagger UI at `/docs`):
  - `POST /convert/xml-to-json`: Converts XML strings to structured JSON.
  - `POST /convert/json-to-xml`: Converts JSON strings or objects to XML.
  - `POST /convert`: Auto-detects input format (XML vs. JSON) or converts according to explicit `direction`.
  - `GET /bf`: Metadata, instruction breakdown, and source code for both Brainfuck engines.
  - `GET /bf/xml-to-json` & `GET /bf/json-to-xml`: Raw Brainfuck source code endpoints.
  - `GET /health`: Health status endpoint.
  - `GET /`: Interactive Web UI with Swap & Reverse and Brainfuck Code / Tape Inspector modal.
- **Zero-Submodule Runtime UI & Client-Side Fallback**:
  - Loads [`bff-ui`](https://github.com/applied-tape-mechanics/bff-ui) and [`bff-interpreter`](https://github.com/applied-tape-mechanics/bff-interpreter) at runtime from pinned GitHub releases via jsDelivr CDN (`@v1.0.0`).
  - Supports **OS 9** and **OS X** themes and runs 100% standalone in the browser via the JavaScript Brainfuck VM when hosted on GitHub Pages (`DISABLE_BACKEND=true`).

---

## 🧠 Brainfuck Tape Architecture

See [`bf/README.md`](bf/README.md) for the complete specification.

### 1. XML → JSON Tape (`bf/xml_to_json.bf`)
| Cells | Identifier | Purpose |
| :---: | :--- | :--- |
| `c0` | `char` | Current input byte read from `stdin` |
| `c1` | `in_tag_name` | Flag: `1` if reading opening tag name |
| `c2` | `in_text` | Flag: `1` if reading inner element text content |
| `c3` | `in_closing_tag` | Flag: `1` if skipping closing tag name |
| `c4` | `saw_lt` | Flag: previous byte was `<` |
| `c5` | `expect_value` | Flag: element opened, expecting child tag or text |
| `c6` | `need_comma` | Flag: emit `,` before next JSON property |
| `c7` | `just_closed_elem` | Flag: previous closed element contained child objects |
| `c8..c11` | `delim_flags` | Equality checks for `<` (60), `>` (62), `/` (47), whitespace |
| `c12..c25` | `scratch` | Level-isolated scratch cells for deterministic branches |
| `c30` | `print_cell` | Dedicated `stdout` character emitter |

### 2. JSON → XML Tape (`bf/json_to_xml.bf`)
| Cells | Identifier | Purpose |
| :---: | :--- | :--- |
| `c0` | `char` | Current input byte read from `stdin` |
| `c1` | `in_key` | Flag: accumulating JSON key name into buffer |
| `c2` | `after_key` | Flag: key ended, awaiting `:` and value |
| `c3` | `in_val` | Flag: streaming string value directly to `stdout` |
| `c4` | `stack_depth` | Current object nesting level (`0`, `1`, `2`) |
| `c5` | `key_ptr` | Write offset in active key buffer (`1..15`) |
| `c8..c11` | `delim_flags` | Equality checks for `"` (34), `:` (58), `{` (123), `}` (125) |
| `c50..c65` | `key_buffer` | Active element tag name buffer (up to 15 chars) |
| `c80..c95` | `stack_lvl_0` | Call stack frame 0 parent tag name |
| `c100..c115` | `stack_lvl_1` | Call stack frame 1 parent tag name |
| `c120..c135` | `stack_lvl_2` | Call stack frame 2 parent tag name |

---

## 🐳 Docker Setup (Zero Host Dependencies)

A pre-built production image is published automatically to **GitHub Container Registry (`ghcr.io`)**:

```bash
# Run the microservice directly from GHCR on http://localhost:8003
docker run --rm -p 8003:8000 ghcr.io/applied-tape-mechanics/bff-xml-json-converter:latest
```

### Using Docker Compose (Development, Testing & Production)

```bash
# Run the full 22-test suite (VM, round-trips, compiler determinism & HTTP API) inside Docker
docker compose run --rm test

# Run TypeScript type checking inside Docker
docker compose run --rm test npm run typecheck

# Recompile bf/xml_to_json.bf and bf/json_to_xml.bf inside Docker
docker compose run --rm test npm run compile:bf

# Pull and start pre-built release images (service + Brainfuck healthcheck sidecar) from GHCR
docker compose pull
docker compose up -d

# Or build locally from source and start in the background
docker compose up -d --build
```

Visit:
- **Interactive Web UI:** [http://localhost:8003](http://localhost:8003)
- **Swagger OpenAPI Docs:** [http://localhost:8003/docs](http://localhost:8003/docs)
- **Brainfuck Healthcheck Sidecar:** [http://localhost:8084](http://localhost:8084)

---

## 💻 Local Development (Node.js ≥ 22.18)

```bash
npm install
npm run dev          # watch mode on http://localhost:8000
npm test             # node:test
npm run typecheck    # tsc --noEmit
npm run compile:bf   # regenerate bf/xml_to_json.bf and bf/json_to_xml.bf
```

---

## 📡 API Examples

### 1. XML to JSON (`POST /convert/xml-to-json`)
```bash
curl -X POST http://localhost:8003/convert/xml-to-json \
  -H "Content-Type: application/json" \
  -d '{"xml": "<note><to>Tove</to><from>Jani</from></note>"}'
```

**Response:**
```json
{
  "direction": "xml2json",
  "source": "<note><to>Tove</to><from>Jani</from></note>",
  "result": {
    "note": {
      "to": "Tove",
      "from": "Jani"
    }
  },
  "element_count": 3,
  "character_count": 43
}
```

### 2. JSON to XML (`POST /convert/json-to-xml`)
```bash
curl -X POST http://localhost:8003/convert/json-to-xml \
  -H "Content-Type: application/json" \
  -d '{"json": {"note":{"to":"Tove","from":"Jani"}}}'
```

### 3. Auto-Detect Direction (`POST /convert`)
```bash
curl -X POST http://localhost:8003/convert \
  -H "Content-Type: application/json" \
  -d '{"content": "<user><name>Alice</name><role>Admin</role></user>"}'
```
