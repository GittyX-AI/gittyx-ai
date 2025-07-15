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
import type { AIProvider } from "./ai-provider"
import { GeminiProvider } from "./gemini-provider"
import { OllamaProvider } from "./ollama-provider"
import cliProgress from "cli-progress"
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
          logging(`Ollama model: ${config.model} is not available`, "warn")
          logging(`Attempting to download model: ${config.model}`, "info")
          await this.downloadModel(config.baseUrl, config.model)
        }
        logging(`Ollama model: ${config.model} is available`, "info")

        // check if embedding model is available
        if (config.embeddingModel && (await this.isModelAvailable(config.baseUrl, config.embeddingModel)) === false) {
          logging(`Ollama embedding model: ${config.embeddingModel} is not available`, "warn")
          logging(`Attempting to download embedding model: ${config.embeddingModel}`, "info")
          await this.downloadModel(config.baseUrl, config.embeddingModel)
        }
        logging(`Ollama embedding model: ${config.embeddingModel} is available`, "info")
        return new OllamaProvider(config.baseUrl)
      default:
        throw new Error(`Unsupported provider type: ${config.type}`)
    }
  }

  static async isModelAvailable(baseUrl: string, model: string): Promise<boolean> {
    if (!baseUrl || !model) {
      logging("Base URL or model is missing for isModelAvailable check.", "warn")
      return false
    }
    try {
      const res = await fetch(`${baseUrl}/api/tags`)
      if (!res.ok) {
        logging(`Failed to fetch model tags: ${res.status} ${res.statusText}`, "error")
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
      logging(`Error checking model availability: ${error.message}`, "error")
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
      logging(`Failed to pull model: ${response.statusText}`, "error")
      throw new Error(`Failed to pull model: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) throw new Error("No response body from Ollama pull")

    const multibar = new cliProgress.MultiBar(
      {
        format: `Pulling {model} ({digest}) |{bar}| {percentage}% | {value}/{total} MB`,
        barCompleteChar: "█",
        barIncompleteChar: "░",
        hideCursor: true,
        clearOnComplete: false,
        stopOnComplete: true,
      },
      cliProgress.Presets.shades_classic
    )

    const bars = new Map<string, cliProgress.SingleBar>()
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
            multibar.stop()
            logging(`Ollama Error: ${parsed.error}`, "error")
            throw new Error(parsed.error)
          }

          const status: string = parsed.status || ""

          const isLayerPull =
            status.startsWith("pulling ") &&
            parsed.digest &&
            typeof parsed.total === "number"

          if (isLayerPull) {
            const digest = parsed.digest.startsWith("sha256:")
              ? parsed.digest.slice(7, 19)
              : parsed.digest.slice(0, 12)

            const key = digest
            const totalMb = Math.ceil(parsed.total / 1024 / 1024)
            const completedMb = parsed.completed
              ? Math.ceil(parsed.completed / 1024 / 1024)
              : 0

            if (!bars.has(key)) {
              const bar = multibar.create(totalMb, completedMb, { model, digest })
              bars.set(key, bar)
            } else {
              const bar = bars.get(key)!
              bar.update(completedMb)
            }
          } else {
            // Other general status
            if (status === "success") {
              multibar.stop()
              logging(`Model ${model} downloaded successfully.`, "info")
              return
            }

            if (status) {
              logging(`[Ollama] ${status}`, "info")
            }
          }
        } catch (err: any) {
          multibar.stop()
          logging(`Parsing or pull error: ${err.message || err}`, "error")
          throw err
        }
      }
    }

    multibar.stop() // fallback cleanup
  }
}
