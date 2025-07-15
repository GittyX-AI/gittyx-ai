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

import { startDashboard } from "./server";
import AgentGittyx from "../agent/agent";
import { getCommitsWithDiffs } from "../utils/git";
import VectorService from "../vectorstore/service";
import { logging } from "../utils/logging";

import dotenv from "dotenv";
import { AIProviderFactory, ProviderConfig } from "../providers/provider-factory";
dotenv.config({ quiet: true });

const apiKey = process.env.GEMINI_API_KEY;

interface AnalyzeOptions {
  repo: string;
  limit: number;
  date: string;
  mode: string;
  port: number;
  embedding: string;
  generation: string;
  baseUrl?: string;
  model?: string;
  provider: "gemini" | "ollama" | "openai";

}
export async function analyzeRepo(options: AnalyzeOptions) {
  if (!apiKey && options.provider === "gemini") {
    throw new Error("Missing GEMINI_API_KEY"); 
  }

  if (options.provider === "ollama" && !options.baseUrl) {
    throw new Error("Base URL is required for Ollama provider");
  }

  if (!apiKey && options.provider === "openai") {
    throw new Error("Missing OPENAI_API_KEY");
  }
  console.log("\n▲ GittyX: Analyzing repository...\n");
  await getCommitsWithDiffs(options.limit);

  const providerConfig: ProviderConfig = {
    type: options.provider,
    apiKey,
    baseUrl: options.baseUrl,
    model: options.model,
    embeddingModel: options.embedding
  };

  const aiProvider = await AIProviderFactory.createProvider(providerConfig);

  const agent: AgentGittyx = new AgentGittyx(
    options.limit,
    providerConfig,
    aiProvider
  );
  const gittyxStore: VectorService = new VectorService(
    options.limit,
    providerConfig,
    aiProvider
  );

  await agent.summarizeCommits();
  await agent.generateOverallSummary();

  agent.getTimelineChartConfig();

  await gittyxStore.ingest();

  logging("Analysis complete.\n");
  await startDashboard(agent, gittyxStore, options.port, options.limit);
}
