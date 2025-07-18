#!/usr/bin/env node

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

import { Command } from "commander";
import inquirer from 'inquirer';
import { analyzeRepo } from "./components/analyze";

const program = new Command();

// function parsePort(value) {
//   const port = parseInt(value, 10);
//   if (isNaN(port)) {
//     throw new Error("Invalid port number. Must be an integer.");
//   }
//   return port;
// }

function parseLimit(value) {
  const limit = parseInt(value, 10);
  if (isNaN(limit)) {
    throw new Error("Invalid limit number. Must be an integer.");
  }
  return limit;
}

program
  .name("gittyx")
  .description("AI-powered CLI tool that analyzes a Git repository's history and launches a local web dashboard to visualize, explore, and query the codebase's evolution.")
  .version("1.4.3");

program
  .command("analyze")
  .description("Analyze repository and start dashboard")
  .option("-l, --limit <number>", "The number of the most recent commits to analyze", parseLimit, 200)
  // .option("-d, --date <date>", "The date to start analyzing commits from (YYYY-MM-DD)")
  .option("-m, --mode <string>", "GittyX mode: online (gemini or openai) or local (ollama)", "online")
  .action(async (options) => {
    if (options.limit && options.date) {
      console.error("Error: You cannot use both --limit and --date at the same time. Please use only one.");
      process.exit(1);
    }

    if (options.mode !== "online" && options.mode !== "local") {
      console.error("Error: Invalid mode. Please use 'online' or 'local'.");
      process.exit(1);
    }

    if (options.limit && options.limit < 1) {
      console.error("Error: --limit must be a positive number.");
      process.exit(1);
    }

    if (options.date && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
      console.error("Error: Invalid date format. Please use YYYY-MM-DD.");
      process.exit(1);
    }

    if (options.mode === "online") {
      // Show a selector for gemini or openai
      const { provider } = await inquirer.prompt({
        type: "list",
        name: "provider",
        message: "Choose your AI provider:",
        choices: [
          { name: "gemini", value: "gemini" },
          { name: "openai", value: "openai" }
        ]
      });

      const { model } = await inquirer.prompt({
        type: "list",
        name: "model",
        message: "Choose your Generation model:",
        choices: provider === "gemini"
          ? ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash", "gemini-1.5-pro"] : ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"]
      })

      const { embedding } = await inquirer.prompt({
        type: "list",
        name: "embedding",
        message: "Choose your Embedding model:",
        choices: provider === "gemini"
          ? ["text-embedding-004", "embedding-001"] : ["text-embedding-ada-002", "text-embedding-3-large", "text-embedding-3-small"]
      })

      options.provider = provider;
      options.embedding = embedding;
      options.model = model;
    } else if (options.mode === "local") {
      // Show a selector for ollama or huggingface
      const { provider } = await inquirer.prompt({
        type: "list",
        name: "provider",
        message: "Choose your AI provider:",
        choices: [
          { name: "ollama", value: "ollama" },
          { name: "huggingface", value: "huggingface", disabled: "(coming soon...)" }
        ]
      });

      const { baseUrl } = await inquirer.prompt({
        type: "input",
        name: "baseUrl",
        message: `Enter the base URL for ${provider}:`,
        default: provider === "ollama" ? "http://localhost:11434" : ""
      });

      const { model } = await inquirer.prompt({
        type: "input",
        name: "model",
        message: `Enter the model name for ${provider}:`,
        default: provider === "ollama" ? "deepseek-r1:8b" : ""
      });

      const { embedding } = await inquirer.prompt({
        type: "input",
        name: "embedding",
        message: `Enter the embedding model name for ${provider}:`,
        default: provider === "ollama" ? "nomic-embed-text:v1.5" : ""
      });

      if (!baseUrl || !model || !embedding) {
        console.error("Error: Base URL, model, and embedding model are required for local mode.");
        process.exit(1);
      }
      options.provider = provider;
      options.embedding = embedding;
      options.baseUrl = baseUrl;
      options.model = model;
    }

    
    options.port = 49251;
    await analyzeRepo(options);
  });

program.parse();
