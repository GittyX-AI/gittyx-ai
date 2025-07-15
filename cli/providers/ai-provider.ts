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

// Define standard roles for AI conversation messages
export type StandardMessageRole = "user" | "assistant" | "system" | "tool" | "model"

export interface ChatMessage {
  role: StandardMessageRole // Use standard roles
  text: string
}

export interface GenerateContentOptions {
  model: string
  // Contents should accept all standard roles that can be part of a conversation
  contents: Array<{
    role: StandardMessageRole
    parts: Array<{ text: string }>
  }>
}

export interface GenerateContentResponse {
  text?: string
}

export interface EmbeddingOptions {
  model: string
  contents: string[]
}

export interface EmbeddingResponse {
  embeddings: Array<{
    values: number[]
  }>
}

export abstract class AIProvider {
  protected apiKey?: string
  protected baseUrl?: string

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  abstract generateContent(options: GenerateContentOptions): Promise<GenerateContentResponse>
  abstract generateContentStream(options: GenerateContentOptions): AsyncGenerator<{ text?: string }>
  abstract getEmbedding(model: string, text: string): Promise<number[]>
  abstract getEmbeddings(model: string, texts: string[]): Promise<number[][]>
}
