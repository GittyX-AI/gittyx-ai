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

import { logging } from "../utils/logging";
import { QueryClassification, ToolInput } from "./types";
import { getTrackedFiles, tools } from "./tools";
import { AIProvider } from "../providers/ai-provider";
import { ProviderConfig } from "../providers/provider-factory";

export class AgentRouter {

    private aiProvider: AIProvider;
    private model_name: string;

    constructor(providerConfig: ProviderConfig, aiProvider: AIProvider) {
        this.aiProvider = aiProvider;

        if (providerConfig.model) {
            this.model_name = providerConfig.model;
            logging(`AgentRouter - Using model: ${this.model_name}`);
        }
    }

    extractJsonFromText(text: string): string | null {
        // 1. Handle ```json ... ``` blocks (Gemini)
        const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
        if (codeBlockMatch) return codeBlockMatch[1].trim();

        // 2. Handle plain JSON blocks anywhere in the text (Ollama)
        const jsonMatch = text.match(/{[\s\S]*}/);
        if (jsonMatch) return jsonMatch[0].trim();

        // 3. Fall back
        return null;
    }


    async classifyQuery(query: string): Promise<QueryClassification> {
        const toolList = Object.values(tools).map(tool => `- ${tool.name}: ${tool.description}`);

        const prompt = `
You are a smart AI router.

Your job is to decide how to handle user queries:
- If it's about a specific git tool, pick a tool and arguments.
- If it needs multiple commits as context, choose "vector".
- If it's a general question (like "what do you do?"), choose "chat".

Available tools:
${toolList.join("\n")}

User query:
"${query}"

Respond in JSON:
{
  "type": "tool" | "vector" | "chat",
  "toolName"?: string,
  "args"?: object
}
    `.trim();

        const response = await this.aiProvider.generateContent({
            model: this.model_name,
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        
        const rawText = response.text || '';
        const clean = this.extractJsonFromText(rawText);
        const json: QueryClassification = JSON.parse(clean);

        if (!["tool", "vector", "chat"].includes(json.type)) json.type = "chat";

        if (json.type === "tool" && json.toolName === "summarizeFileEvolution") {
            const filePath = await this.getFilePath(json.args?.file || '');
            json.args = { file: filePath };

        }
        logging(`AgentRouter - Decision: ${JSON.stringify(json)}`, "debug");

        return json;
    }

    async getFilePath(path: string): Promise<string> {
        const files = await getTrackedFiles();

        const prompt = `You are given a list of tracked files:${files.join("\n")}\n\nGiven a file path, return the absolute path to the file:\n${path}\nOnly respond with the absolute path.`;
        const response = await this.aiProvider.generateContent({
            model: this.model_name,
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
        return response.text;
    }
}


