import { buildAnalysisPrompt } from "./prompt.js"
import { safeParseJsonArray } from "./utils.js"
import { createAnalysisTaskInput } from "./schema.js"

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

function extractAssistantText(messageContent) {
  if (typeof messageContent === "string") {
    return messageContent
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map(block => {
        if (typeof block === "string") {
          return block
        }

        if (typeof block?.text === "string") {
          return block.text
        }

        if (typeof block?.content === "string") {
          return block.content
        }

        return ""
      })
      .filter(Boolean)
      .join("\n")
  }

  if (typeof messageContent?.text === "string") {
    return messageContent.text
  }

  return ""
}

function extractOpenAiCompatibleText(data) {
  const choice = data?.choices?.[0]
  const messageText = extractAssistantText(choice?.message?.content)
  if (messageText) {
    return messageText
  }

  if (typeof choice?.text === "string") {
    return choice.text
  }

  if (typeof data?.output_text === "string") {
    return data.output_text
  }

  if (Array.isArray(data?.output)) {
    return data.output
      .flatMap(item => item?.content || [])
      .map(block => block?.text || "")
      .filter(Boolean)
      .join("\n")
  }

  return ""
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

  return {
    parsed: safeParseJsonArray(data?.result?.alternatives?.[0]?.message?.text || ""),
    model: "yandexgpt/latest"
  }
}

async function callOpenAiCompatible(prompt, { apiKeyEnvName, modelEnvName, defaultModel, baseUrl, extraPayload = {} }) {
  const apiKey = requireEnvValue(apiKeyEnvName)
  const model = process.env[modelEnvName] || defaultModel

  const data = await postJson(
    `${baseUrl}/chat/completions`,
    {
      model,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      ...extraPayload,
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

  const rawText = extractOpenAiCompatibleText(data)
  const parsed = safeParseJsonArray(rawText)

  if (!Array.isArray(parsed)) {
    console.error("Analyze provider returned non-array content", {
      providerBaseUrl: baseUrl,
      model,
      preview: rawText.slice(0, 500)
    })
  }

  return {
    parsed,
    model
  }
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
      return {
        parsed: parsedResult,
        model
      }
    }
  }

  return {
    parsed: null,
    model
  }
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
  return {
    parsed: safeParseJsonArray(firstBlock?.text || ""),
    model
  }
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

  return {
    parsed: safeParseJsonArray(data?.content || ""),
    model
  }
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
  codexsale: prompt => callOpenAiCompatible(prompt, {
    apiKeyEnvName: "CODEXSALE_API_KEY",
    modelEnvName: "CODEXSALE_MODEL",
    defaultModel: "gpt-5.4",
    baseUrl: "https://codex.sale/v1",
    extraPayload: {
      reasoningEffort: process.env.CODEXSALE_REASONING_EFFORT || "medium"
    }
  }),
  gemini: callGemini,
  claude: callClaude,
  ollama: callOllama
}

export async function analyzeWithProvider({ providerName, userContext, folders, notes }) {
  const executeProvider = providerExecutors[providerName]
  if (!executeProvider) {
    throw new Error(`Unsupported provider: ${providerName}`)
  }

  const prompt = buildAnalysisPrompt({
    task: createAnalysisTaskInput(),
    userContext,
    folders,
    notes
  })
  const result = await executeProvider(prompt)

  if (Array.isArray(result)) {
    return {
      parsed: result,
      model: providerName
    }
  }

  return result
}
