import http from "node:http"

const PORT = Number(process.env.PORT ?? 8787)
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/chat"

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = ""
    request.on("data", chunk => {
      body += chunk
    })
    request.on("end", () => resolve(body))
    request.on("error", reject)
  })
}

async function callOllama({ model, prompt, temperature, maxTokens }) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      stream: false,
      options: {
        temperature,
        num_predict: maxTokens
      },
      messages: [
        { role: "system", content: "You are a strict semantic classifier." },
        { role: "user", content: prompt }
      ]
    })
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const data = await response.json()
  return data?.message?.content || ""
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json"
  })
  response.end(JSON.stringify(payload))
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method !== "POST" || request.url !== "/analyze") {
    sendJson(response, 404, { error: "Not found" })
    return
  }

  try {
    const rawBody = await readRequestBody(request)
    const payload = JSON.parse(rawBody)
    const result = await callOllama({
      model: payload.model || "llama3.1",
      prompt: payload.prompt || "",
      temperature: Number(payload.temperature ?? 0.1),
      maxTokens: Number(payload.maxTokens ?? 2500)
    })

    sendJson(response, 200, { content: result })
  } catch (error) {
    sendJson(response, 500, { error: String(error?.message || error) })
  }
})

server.listen(PORT, () => {
  process.stdout.write(`Ollama bridge listening on port ${PORT}\n`)
})
