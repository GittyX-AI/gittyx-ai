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

import { GoogleGenAI } from "@google/genai";
import { logging } from "../utils/logging";
import { QueryClassification, ToolInput } from "./types";
import { getTrackedFiles, tools } from "./tools";

export class AgentRouter {

    private ai: GoogleGenAI;

    private model_name: string = "gemini-2.5-flash";

    constructor(apiKey: string, model_name?: string) {
        this.ai = new GoogleGenAI({ apiKey: apiKey });

        if (model_name) {
            this.model_name = model_name;
            logging(`AgentRouter - Using model: ${this.model_name}`);
        }
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

        const response = await this.ai.models.generateContent({
            model: this.model_name,
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        // const json = JSON.parse(response.text ?? '{}');
        const rawText = await response.text || '';
        const clean = rawText
            .trim()
            .replace(/^```json\s*/i, '')
            .replace(/```$/, '')
            .trim();
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
        const response = await this.ai.models.generateContent({
            model: this.model_name,
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
        return response.text;
    }
}


