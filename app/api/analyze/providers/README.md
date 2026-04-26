# Analyze providers

`ANALYZE_PROVIDER` supports:

- `yandex`
- `chatgpt`
- `deepseek`
- `codexsale`
- `gemini`
- `claude`
- `ollama`

## Required base environment variables

- `API_SECRET`
- `CLIENT_ORIGIN`

## Provider API keys and models

- Yandex: `YC_API_KEY`, `YC_FOLDER_ID`
- ChatGPT: `OPENAI_API_KEY`, optional `OPENAI_MODEL`
- DeepSeek: `DEEPSEEK_API_KEY`, optional `DEEPSEEK_MODEL`
- CodexSale: `CODEXSALE_API_KEY`, optional `CODEXSALE_MODEL`, optional `CODEXSALE_REASONING_EFFORT`
- Gemini: `GEMINI_API_KEY`, optional `GEMINI_MODEL`
- Claude: `ANTHROPIC_API_KEY`, optional `CLAUDE_MODEL`
- Ollama bridge: `OLLAMA_SERVER_URL`, optional `OLLAMA_MODEL`

## Optional analysis tuning

- `ANALYZE_TEMPERATURE`
- `ANALYZE_MAX_TOKENS`
- `ANALYZE_CHUNK_SIZE`
- `ANALYZE_RETRY_COUNT`
- `NOTE_TEXT_LIMIT`

## Reindex all notes

By default only notes with `analyzed !== true` are processed.

To force full reindex of all notes pass one of these in the request:

- query parameter: `?reindexAll=true`
- JSON body: `{ "reindexAll": true }`
- JSON body: `{ "forceReindex": true }`

## Local Ollama bridge

Run on your PC:

`node app/api/analyze/ollama/server.js`
