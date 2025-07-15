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

import { GoogleGenAI } from "@google/genai"
import { AIProvider, type GenerateContentOptions, type GenerateContentResponse } from "./ai-provider"

export class GeminiProvider extends AIProvider {
  private ai: GoogleGenAI

  constructor(apiKey: string) {
    super(apiKey)
    this.ai = new GoogleGenAI({ apiKey: apiKey })
  }

  async generateContent(options: GenerateContentOptions): Promise<GenerateContentResponse> {
    try {
      const response = await this.ai.models.generateContent({
        model: options.model,
        contents: options.contents,
      })

      return {
        text: response.text || "",
      }
    } catch (error) {
      throw new Error(`Gemini API error: ${error}`)
    }
  }

  async *generateContentStream(options: GenerateContentOptions): AsyncGenerator<{ text?: string }> {
    try {
      const result = await this.ai.models.generateContentStream({
        model: options.model,
        contents: options.contents,
      })

      for await (const chunk of result) {
        if (chunk.text) {
          yield { text: chunk.text }
        }
      }
    } catch (error) {
      throw new Error(`Gemini streaming error: ${error}`)
    }
  }

  async getEmbedding(model: string, text: string): Promise<number[]> {
    try {
      const result = await this.ai.models.embedContent({
        model: model,
        contents: [text],
      })
      return result.embeddings[0].values
    } catch (error) {
      throw new Error(`Gemini embedding error: ${error}`)
    }
  }

  async getEmbeddings(model: string, texts: string[]): Promise<number[][]> {
    try {
      const result = await this.ai.models.embedContent({
        model: model,
        contents: texts,
      })
      return result.embeddings.map((embedding) => embedding.values)
    } catch (error) {
      throw new Error(`Gemini embeddings error: ${error}`)
    }
  }
}
