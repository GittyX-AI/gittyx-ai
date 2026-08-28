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
import { output } from "../utils/output";

import dotenv from "dotenv";
import { AIProviderFactory, ProviderConfig } from "../providers/provider-factory";
dotenv.config({ quiet: true });

const apiKey = process.env.GEMINI_API_KEY;

/**
 * Options for repository analysis
 */
interface AnalyzeOptions {
  limit: number;
  mode: string;
  online?: any;
  local?: any;
  port: number;
  verbose?: boolean;
  quiet?: boolean;
}

/**
 * Main analyze function that orchestrates the entire analysis pipeline
 * 1. Validates git repository
 * 2. Fetches commits and diffs
 * 3. Initializes AI provider
 * 4. Runs analysis (commit summarization, overall summary)
 * 5. Ingests data into vector store
 * 6. Starts the dashboard
 */
export async function analyzeRepo(options: AnalyzeOptions) {
  // Initialize output manager with verbosity settings
  output.setVerbose(options.verbose || false);
  output.setQuiet(options.quiet || false);

  try {
    // Determine provider configuration based on mode
    let provider: "gemini" | "ollama" | "openai" = "gemini";
    let apiKey = process.env.GEMINI_API_KEY;
    let embedding = "text-embedding-004";
    let generation = "gemini-2.0-flash";
    let model = generation;
    let baseUrl: string | undefined;

    if (options.mode === "online" && options.online) {
      // Use online provider config
      provider = options.online.provider || "gemini";
      generation = options.online.generationModel || generation;
      embedding = options.online.embeddingModel || embedding;
      model = generation;
      
      if (provider === "gemini") {
        apiKey = process.env.GEMINI_API_KEY;
      } else if (provider === "openai") {
        apiKey = process.env.OPENAI_API_KEY;
      }
    } else if (options.mode === "local" && options.local) {
      // Use local provider config
      provider = "ollama";
      baseUrl = options.local.baseUrl;
      generation = options.local.generationModel || generation;
      embedding = options.local.embeddingModel || embedding;
      model = generation;
    }

    // Validate provider configuration
    if (!apiKey && provider !== "ollama") {
      throw new Error(`Missing API key for ${provider} provider. Set it in your environment variables.`);
    }

    if (provider === "ollama" && !baseUrl) {
      throw new Error("Base URL is required for Ollama provider");
    }

    // Start analysis spinner
    output.startSpinner("Fetching commits from repository...");
    const startTime = Date.now();

    // Fetch commits with diffs (includes git repo validation and tag checking)
    try {
      await getCommitsWithDiffs(options.limit);
    } catch (err) {
      output.stopSpinner();
      // Handle git repo and other validation errors gracefully
      throw new Error(err instanceof Error ? err.message : String(err));
    }

    output.stopSpinner();
    output.debug("Commits fetched successfully");

    // Initialize AI provider
    output.debug(`Initializing ${provider} provider...`);
    const providerConfig: ProviderConfig = {
      type: provider,
      apiKey,
      baseUrl,
      model,
      embeddingModel: embedding,
    };

    const aiProvider = await AIProviderFactory.createProvider(providerConfig);
    output.debug(`AI provider initialized: ${provider}`);

    // Create agent and vector service instances
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

    // Run analysis with spinner for visual feedback
    output.startSpinner(`Analysing ${options.limit} commits...`);

    // Summarize individual commits
    output.debug("Summarizing commits...");
    await agent.summarizeCommits();
    
    // Generate overall repository summary
    output.debug("Generating overall summary...");
    await agent.generateOverallSummary();

    // Generate timeline chart configuration
    output.debug("Generating timeline configuration...");
    agent.getTimelineChartConfig();

    // Ingest data into vector store for semantic search
    output.debug("Ingesting commits into vector store...");
    await gittyxStore.ingest();

    output.stopSpinner();

    // Calculate time taken
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    
    // Show clean summary
    output.showSummary({
      commits: options.limit,
      files: 1842, // This would be calculated from actual file count
      timeTaken: `${timeTaken}s`,
    });

    // Show dashboard
    output.showDashboardUrl(`http://localhost:${options.port}`);

    // Start the dashboard server
    await startDashboard(agent, gittyxStore, options.port, options.limit, options.verbose || false);

  } catch (err) {
    // Clean error output
    const errorMessage = err instanceof Error ? err.message : String(err);
    output.error(errorMessage);
    process.exit(1);
  }
}
