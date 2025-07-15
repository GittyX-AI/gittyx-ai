// Copyright 2025 TATI Mohammed

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//      http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { logging } from "../utils/logging"
import { AIProvider, type GenerateContentOptions, type GenerateContentResponse } from "./ai-provider"

interface OllamaMessage {
  role: string
  content: string
}

interface OllamaRequest {
  model: string
  messages: OllamaMessage[]
  stream?: boolean
}

interface OllamaResponse {
  message?: {
    content: string
  }
  response?: string
  done?: boolean
}

interface OllamaEmbeddingRequest {
  model: string
  prompt: string
}

interface OllamaEmbeddingResponse {
  embedding?: number[]
  error?: string
}

export class OllamaProvider extends AIProvider {
  constructor(baseUrl = "http://127.0.0.1:11434") {
    super(undefined, baseUrl)
  }

  private convertToOllamaMessages(contents: GenerateContentOptions["contents"]): OllamaMessage[] {
    return contents.map((content) => ({
      role: content.role === "model" ? "assistant" : content.role,
      content: content.parts.map((part) => part.text).join("\n"),
    }))
  }

  async generateContent(options: GenerateContentOptions): Promise<GenerateContentResponse> {
    try {
      const messages = this.convertToOllamaMessages(options.contents)

      const request: OllamaRequest = {
        model: options.model,
        messages: messages,
        stream: false,
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
      }

      const data: OllamaResponse = await response.json()

      return {
        text: data.message?.content || data.response || "",
      }
    } catch (error) {
      throw new Error(`Ollama API error: ${error}`)
    }
  }

  async *generateContentStream(options: GenerateContentOptions): AsyncGenerator<{ text?: string }> {
    try {
      const messages = this.convertToOllamaMessages(options.contents)

      const request: OllamaRequest = {
        model: options.model,
        messages: messages,
        stream: true,
      }

      logging(`Ollama request: ${JSON.stringify(request)}`, "debug")

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        throw new Error(`Ollama streaming error: ${response.status} ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No response body reader available")
      }

      const decoder = new TextDecoder()
      let buffer = ""

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data: OllamaResponse = JSON.parse(line)

                if (data.message?.content) {
                  yield { text: data.message.content }
                } else if (data.response) {
                  yield { text: data.response }
                }

                if (data.done) {
                  return
                }
              } catch (parseError) {
                // Skip invalid JSON lines
                continue
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      throw new Error(`Ollama streaming error: ${error}`)
    }
  }

  async getEmbedding(model: string, text: string): Promise<number[]> {
    try {
      const request: OllamaEmbeddingRequest = {
        model: model,
        prompt: text,
      }

      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        throw new Error(`Ollama embedding error: ${response.status} ${response.statusText}`)
      }

      const data: OllamaEmbeddingResponse = await response.json()

      if (data.error) {
        throw new Error(`Ollama embedding API error: ${data.error}`)
      }

      if (!data.embedding) {
        throw new Error("No embedding returned from Ollama API")
      }

      return data.embedding
    } catch (error) {
      throw new Error(`Ollama embedding error: ${error}`)
    }
  }

  async getEmbeddings(model: string, texts: string[]): Promise<number[][]> {
    try {
      // Ollama doesn't support batch embeddings, so we'll make individual requests
      const embeddings: number[][] = []

      for (const text of texts) {
        const embedding = await this.getEmbedding(model, text)
        embeddings.push(embedding)
      }

      return embeddings
    } catch (error) {
      throw new Error(`Ollama embeddings error: ${error}`)
    }
  }
}
