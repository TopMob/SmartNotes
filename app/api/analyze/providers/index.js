import { buildAnalysisPrompt } from "./prompt"
import { safeParseJsonArray } from "./utils"

const TEMPERATURE = Number(process.env.ANALYZE_TEMPERATURE ?? 0.1)
const MAX_TOKENS = Number(process.env.ANALYZE_MAX_TOKENS ?? 2500)

function requireEnvValue(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing env: ${name}`)
  }
  return value
}

async function postJson(url, payload, headers) {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return response.json()
}

async function callYandex(prompt) {
  const apiKey = requireEnvValue("YC_API_KEY")
  const folderId = requireEnvValue("YC_FOLDER_ID")

  const data = await postJson(
    "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
    {
      modelUri: `gpt://${folderId}/yandexgpt/latest`,
      completionOptions: {
        stream: false,
        temperature: TEMPERATURE,
        maxTokens: MAX_TOKENS
      },
      messages: [
        { role: "system", text: "You are a strict semantic classifier." },
        { role: "user", text: prompt }
      ]
    },
    {
      "Content-Type": "application/json",
      Authorization: `Api-Key ${apiKey}`
    }
  )

  return safeParseJsonArray(data?.result?.alternatives?.[0]?.message?.text || "")
}

async function callOpenAiCompatible(prompt, { apiKeyEnvName, modelEnvName, defaultModel, baseUrl }) {
  const apiKey = requireEnvValue(apiKeyEnvName)
  const model = process.env[modelEnvName] || defaultModel

  const data = await postJson(
    `${baseUrl}/chat/completions`,
    {
      model,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: "You are a strict semantic classifier." },
        { role: "user", content: prompt }
      ]
    },
    {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    }
  )

  return safeParseJsonArray(data?.choices?.[0]?.message?.content || "")
}

async function callGemini(prompt) {
  const apiKey = requireEnvValue("GEMINI_API_KEY")
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash"

  const data = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      systemInstruction: {
        parts: [{ text: "You are a strict semantic classifier. Return only valid JSON." }]
      },
      generationConfig: {
        temperature: TEMPERATURE,
        maxOutputTokens: MAX_TOKENS,
        responseMimeType: "application/json"
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    },
    {
      "Content-Type": "application/json"
    }
  )

  if (data?.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked prompt: ${data.promptFeedback.blockReason}`)
  }

  const textBlocks = (data?.candidates || [])
    .flatMap(candidate => candidate?.content?.parts || [])
    .map(part => part?.text)
    .filter(text => typeof text === "string")

  const blockedCandidate = (data?.candidates || []).find(candidate => {
    const finishReason = candidate?.finishReason
    return finishReason && finishReason !== "STOP"
  })

  if (!textBlocks.length && blockedCandidate?.finishReason) {
    throw new Error(`Gemini finished without text: ${blockedCandidate.finishReason}`)
  }

  for (const textBlock of textBlocks) {
    const parsedResult = safeParseJsonArray(textBlock)
    if (Array.isArray(parsedResult)) {
      return parsedResult
    }
  }

  return null
}

async function callClaude(prompt) {
  const apiKey = requireEnvValue("ANTHROPIC_API_KEY")
  const model = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest"

  const data = await postJson(
    "https://api.anthropic.com/v1/messages",
    {
      model,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: "You are a strict semantic classifier.",
      messages: [
        { role: "user", content: prompt }
      ]
    },
    {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    }
  )

  const firstBlock = Array.isArray(data?.content) ? data.content[0] : null
  return safeParseJsonArray(firstBlock?.text || "")
}

async function callOllama(prompt) {
  const serverUrl = process.env.OLLAMA_SERVER_URL || "http://127.0.0.1:8787"
  const model = process.env.OLLAMA_MODEL || "llama3.1"

  const data = await postJson(
    `${serverUrl}/analyze`,
    {
      model,
      prompt,
      temperature: TEMPERATURE,
      maxTokens: MAX_TOKENS
    },
    {
      "Content-Type": "application/json"
    }
  )

  return safeParseJsonArray(data?.content || "")
}

const providerExecutors = {
  yandex: callYandex,
  chatgpt: prompt => callOpenAiCompatible(prompt, {
    apiKeyEnvName: "OPENAI_API_KEY",
    modelEnvName: "OPENAI_MODEL",
    defaultModel: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1"
  }),
  deepseek: prompt => callOpenAiCompatible(prompt, {
    apiKeyEnvName: "DEEPSEEK_API_KEY",
    modelEnvName: "DEEPSEEK_MODEL",
    defaultModel: "deepseek-chat",
    baseUrl: "https://api.deepseek.com"
  }),
  gemini: callGemini,
  claude: callClaude,
  ollama: callOllama
}

export async function analyzeWithProvider({ providerName, folders, notes }) {
  const executeProvider = providerExecutors[providerName]
  if (!executeProvider) {
    throw new Error(`Unsupported provider: ${providerName}`)
  }

  const prompt = buildAnalysisPrompt({ folders, notes })
  return executeProvider(prompt)
}
