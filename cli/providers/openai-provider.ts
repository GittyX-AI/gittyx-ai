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

import { AIProvider, StandardMessageRole, type GenerateContentOptions, type GenerateContentResponse } from "./ai-provider"
import { CoreMessage, generateText, streamText } from "ai"
import { openai } from "@ai-sdk/openai"

export class OpenAIProvider extends AIProvider {
    constructor(apiKey: string) {
        super(apiKey)
        if (!apiKey) {
            throw new Error("OpenAI API key is required.")
        }
    }

    private mapToCoreMessages(
        contents: Array<{ role: StandardMessageRole; parts: Array<{ text: string }> }>,
    ): CoreMessage[] {
        return contents.map((content) => {
            const textContent = content.parts.map((part) => part.text).join("\n")
            return { role: content.role, content: textContent } as CoreMessage
        })
    }

    async generateContent(options: GenerateContentOptions): Promise<GenerateContentResponse> {
        try {

            const messages = this.mapToCoreMessages(options.contents)

            const { text } = await generateText({
                model: openai(options.model),
                messages: messages,
            })

            return { text }
        } catch (error) {
            throw new Error(`OpenAI API error: ${error}`)
        }
    }

    async *generateContentStream(options: GenerateContentOptions): AsyncGenerator<{ text?: string }> {
        try {
            const messages = this.mapToCoreMessages(options.contents)

            const result = streamText({
                model: openai(options.model),
                messages: messages,
            })

            for await (const chunk of result.textStream) {
                yield { text: chunk }
            }
        } catch (error) {
            throw new Error(`OpenAI streaming error: ${error}`)
        }
    }

    async getEmbedding(model: string, text: string): Promise<number[]> {
        try {
            const embeddingModel = openai.embedding(model)
            const { embeddings } = await embeddingModel.doEmbed({ values: [text] })
            return embeddings[0]
        } catch (error) {
            throw new Error(`OpenAI embedding error: ${error}`)
        }
    }

    async getEmbeddings(model: string, texts: string[]): Promise<number[][]> {
        try {
            const embeddingModel = openai.embedding(model)
            const { embeddings } = await embeddingModel.doEmbed({ values: texts })
            return embeddings
        } catch (error) {
            throw new Error(`OpenAI embeddings error: ${error}`)
        }
    }
}
