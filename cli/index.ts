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
import { analyzeRepo } from "./components/analyze";
import { loadConfig, editConfig } from "./components/config";

const program = new Command();

function parseLimit(value: string ): number {
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
  .option("-l, --limit <number>", "Number of commits", parseLimit, 200)
  .option("-m, --mode <string>", "Mode override: online or local")
  .option("-v, --verbose", "Enable verbose logging with debug information")
  .option("-q, --quiet", "Suppress all output except final dashboard URL")
  .action(async (options) => {
    if (options.limit < 1) {
      console.error("Error: --limit must be a positive number.");
      process.exit(1);
    }

    const config = await loadConfig();

    /**
     * Optional CLI overrides
     */
    if (options.mode) {
      if (options.mode !== "online" && options.mode !== "local") {
        console.error("Error: mode must be 'online' or 'local'");
        process.exit(1);
      }

      config.analyze.defaults.mode = options.mode;
    }

    if (options.limit) {
      config.analyze.defaults.limit = options.limit;
    }

    /**
     * Inject config into analyze options
     */
    await analyzeRepo({
      limit: config.analyze.defaults.limit,
      mode: config.analyze.defaults.mode,
      online: config.analyze.defaults.online,
      local: config.analyze.defaults.local,
      port: config.analyze.defaults.port,
      verbose: options.verbose || false,
      quiet: options.quiet || false
    });
  });

program
  .command("config")
  .description("Configure GittyX")
  .option("--show", "Show resolved config")
  .action(async (options) => {
    const config = await loadConfig();
    if (options.show) {
      console.log(JSON.stringify(config, null, 2));
      return;
    }

    await editConfig();
  });

program.parse();
