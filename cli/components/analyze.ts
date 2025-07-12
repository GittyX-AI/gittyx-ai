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
import GittyXAgent from "../agent/agent";
import { getCommitsWithDiffs } from "../utils/git";
import VectorService from "../vectorstore/service";
import { logging } from "../utils/logging";

import dotenv from "dotenv";
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
}
export async function analyzeRepo(options: AnalyzeOptions) {
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  console.log("\n▲ GittyX: Analyzing repository...\n");
  await getCommitsWithDiffs(options.limit);

  const agent = new GittyXAgent(options.limit, apiKey, options.generation);
  const gittyxStore = new VectorService(options.limit, apiKey, options.embedding);

  await agent.summarizeCommits();
  await agent.generateOverallSummary();

  agent.getTimelineChartConfig();

  await gittyxStore.ingest();

  // 🧠 Add actual repo analysis logic here later...
  logging("Analysis complete.\n");

  // 🚀 Launch dashboard
  await startDashboard(agent, gittyxStore, options.port, options.limit);
}
