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

import { output } from "../utils/output"
import type { AIProvider } from "./ai-provider"
import { GeminiProvider } from "./gemini-provider"
import { OllamaProvider } from "./ollama-provider"
import { OpenAIProvider } from "./openai-provider"

export type ProviderType = "gemini" | "ollama" | "openai"

export interface ProviderConfig {
  type: ProviderType
  apiKey?: string
  baseUrl?: string
  model?: string
  embeddingModel?: string
}

export interface OllamaTagsResponse {
  models?: Array<{
    name: string
  }>
}

export class AIProviderFactory {
  static async createProvider(config: ProviderConfig): Promise<AIProvider> {
    switch (config.type) {
      case "openai":
        if (!config.apiKey) {
          throw new Error("API key is required for OpenAI provider")
        }
        return new OpenAIProvider(config.apiKey)
      case "gemini":
        if (!config.apiKey) {
          throw new Error("API key is required for Gemini provider")
        }
        return new GeminiProvider(config.apiKey)
      case "ollama":
        // check if model is available
        const isModelAvailable = await this.isModelAvailable(config.baseUrl, config.model)
        if (!isModelAvailable) {
          output.warn(`Ollama model: ${config.model} is not available`)
          output.info(`Attempting to download model: ${config.model}`)
          await this.downloadModel(config.baseUrl, config.model)
        }
        output.debug(`Ollama model: ${config.model} is available`)

        // check if embedding model is available
        if (config.embeddingModel && (await this.isModelAvailable(config.baseUrl, config.embeddingModel)) === false) {
          output.warn(`Ollama embedding model: ${config.embeddingModel} is not available`)
          output.info(`Attempting to download embedding model: ${config.embeddingModel}`)
          await this.downloadModel(config.baseUrl, config.embeddingModel)
        }
        output.debug(`Ollama embedding model: ${config.embeddingModel} is available`)
        return new OllamaProvider(config.baseUrl)
      default:
        throw new Error(`Unsupported provider type: ${config.type}`)
    }
  }

  static async isModelAvailable(baseUrl: string, model: string): Promise<boolean> {
    if (!baseUrl || !model) {
      output.warn("Base URL or model is missing for isModelAvailable check.")
      return false
    }
    try {
      const res = await fetch(`${baseUrl}/api/tags`)
      if (!res.ok) {
        output.error(`Failed to fetch model tags: ${res.status} ${res.statusText}`)
        return false
      }
      const data: OllamaTagsResponse = await res.json()
      const availableModels = data.models?.map(m => m.name) || []
      // check if model have a tag at the end
      if (!model.includes(":")) {
        return availableModels.includes(model + ":latest")
      }

      return availableModels.includes(model) ?? false
    } catch (error: any) {
      output.error(`Error checking model availability: ${error.message}`)
      return false
    }
  }

  static async downloadModel(baseUrl: string, model: string): Promise<void> {
    if (!baseUrl || !model) throw new Error("Base URL or model is missing.")

    const response = await fetch(`${baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model }),
    })

    if (!response.ok) {
      output.error(`Failed to pull model: ${response.statusText}`)
      throw new Error(`Failed to pull model: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) throw new Error("No response body from Ollama pull")

    // Simple progress tracking for model download
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const parsed = JSON.parse(line)

          if (parsed.error) {
            output.error(`Ollama Error: ${parsed.error}`)
            throw new Error(parsed.error)
          }

          const status: string = parsed.status || ""
          if (status === "success") {
            output.info(`Model ${model} downloaded successfully.`)
            return
          }
          if (status) {
            output.debug(`[Ollama] ${status}`)
          }
        } catch (err: any) {
          output.error(`Parsing or pull error: ${err.message || err}`)
          throw err
        }
      }
    }
  }
}
