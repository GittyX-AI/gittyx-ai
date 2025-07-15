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

import path from "path"
import fs from "fs"
import cliProgress from "cli-progress"
import type VectorService from "../vectorstore/service"
import { loadSessionHistory, saveSessionHistory } from "../sessions/manager"
import { logging } from "../utils/logging"
import { tools } from "./tools"
import { AgentRouter } from "./router"
import type { AIProvider, GenerateContentOptions } from "../providers/ai-provider"
import type { ProviderConfig } from "../providers/provider-factory"

export default class AgentGittyx {
  private aiProvider: AIProvider
  private model_name: string
  private cachePath: string = path.resolve(process.cwd(), ".git/gittyx.json")
  private cache = this.loadCache()
  private BATCH_SIZE = 10
  private MAX_DIFF_LINES = 100
  private limit: number
  private router: AgentRouter

constructor(limit: number, providerConfig: ProviderConfig, aiProvider: AIProvider) {
    // Create AI provider based on config
    logging(`Initializing GittyX Agent with limit: ${limit} and provider: ${providerConfig.type}`)
    this.model_name = providerConfig.model
    this.limit = limit
    this.aiProvider = aiProvider
    
    logging(`Setting commit limit to: ${this.limit}`)
    logging(`Using provider: ${providerConfig.type} with model: ${this.model_name}`)

    // Initialize router with the same provider config
    this.router = new AgentRouter(providerConfig, this.aiProvider)
  }

  private isTrivialCommit(message: string): boolean {
    const trivialPatterns = [/typo/i, /readme/i, /bump/i, /version/i, /merge/i]
    return trivialPatterns.some((p) => p.test(message))
  }

  private batchCommits(commits: any[]) {
    const batches: any[][] = []
    for (let i = 0; i < commits.length; i += this.BATCH_SIZE) {
      batches.push(commits.slice(i, i + this.BATCH_SIZE))
    }
    return batches
  }

  private loadCache(): any[] {
    if (!fs.existsSync(this.cachePath)) return []
    const raw = fs.readFileSync(this.cachePath, "utf-8")
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      logging(`Could not parse cache file: ${e}`, "warn")
      return []
    }
  }

  private createBatchPrompt(batch: any[]): string {
    return (
      `You are an AI agent analyzing Git commits.\n` +
      `Summarize the intent of each commit below.\n` +
      `Respond ONLY in the following JSON format:\n\n` +
      `{\n  "commit_hash": "summary",\n  ...\n}\n\n` +
      `Commits:\n\n` +
      batch.map((c) => `Commit ${c.hash}:\nMessage: ${c.message}\nDiff:\n${this.truncateDiff(c.diff)}`).join("\n\n")
    )
  }

  private truncateDiff(diff: string): string {
    const lines = diff.split("\n")
    return lines.length > this.MAX_DIFF_LINES
      ? lines.slice(0, this.MAX_DIFF_LINES).join("\n") + "\n[...diff truncated]"
      : diff
  }

  async summarizeCommits() {
    this.cache = this.loadCache()
    const toSummarize = this.cache.filter((c) => !c.summary && !this.isTrivialCommit(c.message))

    if (toSummarize.length === 0) {
      logging("All commits already summarized.")
      return
    }

    const batches = this.batchCommits(toSummarize)

    // Create progress bar
    const bar = new cliProgress.SingleBar({
      format: "Summarizing [{bar}] {percentage}% | {value}/{total} batches",
      barCompleteChar: "█",
      barIncompleteChar: "░",
      hideCursor: true,
    })
    bar.start(batches.length, 0)

    for (const batch of batches) {
      const prompt = this.createBatchPrompt(batch)

      try {
        const options: GenerateContentOptions = {
          model: this.model_name,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }

        const response = await this.aiProvider.generateContent(options)
        const rawText = response.text || ""

        const clean = rawText
          .trim()
          .replace(/^```json\s*/i, "")
          .replace(/```$/, "")
          .trim()

        const parsed: Record<string, string> = JSON.parse(clean)

        for (const [hash, summary] of Object.entries(parsed)) {
          const entry = this.cache.find((c) => c.hash === hash)
          if (entry) entry.summary = summary
        }
      } catch (err) {
        logging(`Failed to summarize a batch: ${err}`, "warn")
      }

      bar.increment()
    }

    bar.stop()
    fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2))
    logging(`Summarization complete. Updated ${this.cachePath}`)
  }

  async generateOverallSummary() {
    logging("Generating overall summary...")
    this.cache = this.loadCache()
    let nonOverallCommits = this.cache.filter((c) => c.hash !== "__overall__" && c.hash !== "__chart__" && c.summary)

    // sort by date descending
    // if limit is specified, return only the latest commits
    if (this.limit && this.limit > 0) {
      const sortedCommits = nonOverallCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      nonOverallCommits = sortedCommits.slice(0, this.limit)
    }

    if (nonOverallCommits.length === 0) {
      logging("No summaries to generate an overall summary from.")
      return
    }

    // Get most recent commit date
    const latestCommitDate = new Date(Math.max(...nonOverallCommits.map((c) => new Date(c.date).getTime())))

    // Check for existing __overall__ summary and compare date with latest commit number
    const overall = this.cache.find((c) => c.hash === "__overall__")
    if (
      overall &&
      new Date(overall.date).getTime() >= latestCommitDate.getTime() &&
      overall.numberOfCommits === this.limit
    ) {
      logging("Skipping summary: no new commits since last summary.")
      return
    }

    const summaries = nonOverallCommits.map((c) => `- ${c.summary}`).join("\n")
    const prompt = `You are an AI assistant. Given the following commit summaries, generate a high-level project evolution summary **keep it comprehensive and concise**:\n\n${summaries}`

    try {
      const options: GenerateContentOptions = {
        model: this.model_name,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }

      const response = await this.aiProvider.generateContent(options)
      const text = response.text || ""

      const clean = text
        .trim()
        .replace(/^```(?:markdown)?\s*/i, "")
        .replace(/```$/, "")
        .trim()

      const now = new Date().toISOString()
      if (overall) {
        overall.summary = clean
        overall.date = now
        overall.numberOfCommits = this.limit
      } else {
        this.cache.push({
          hash: "__overall__",
          message: "High-level project summary",
          summary: clean,
          author: "Gittyx Agent",
          date: now,
          numberOfCommits: nonOverallCommits.length,
        })
      }

      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2))
      logging("Overall summary updated.")
    } catch (err) {
      logging(`Failed to generate overall summary: ${err}`, "error")
    }
  }

  getTimelineChartConfig(): any {
    this.cache = this.loadCache()
    // Filter relevant commits (exclude __overall__ and __chart__)
    let filtered = this.cache.filter((c) => c.hash !== "__overall__" && c.hash !== "__chart__" && c.date)

    // sort commits by date descending
    // if limit is specified, return only the latest commits
    if (this.limit && this.limit > 0) {
      const sortedCommits = filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      filtered = sortedCommits.slice(0, this.limit)
    }

    // Group commits by date (formatted as yyyy-mm-dd for consistency)
    const commitsByDate: Record<string, any[]> = {}
    filtered.forEach((c) => {
      const dateKey = new Date(c.date).toISOString().split("T")[0] // e.g., "2025-06-29"
      if (!commitsByDate[dateKey]) commitsByDate[dateKey] = []
      commitsByDate[dateKey].push(c)
    })

    // Sort dates ascending
    const sortedDates = Object.keys(commitsByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

    // Prepare labels and data (number of commits per day)
    const labels = sortedDates.map((date) => new Date(date).toLocaleDateString())
    const commitsCount = sortedDates.map((date) => commitsByDate[date].length)

    // Optional: Prepare summaries for tooltips (show commits messages on that day)
    const summaries = sortedDates.map((date) => {
      return commitsByDate[date].map((c) => c.summary || c.message || "").join("\n\n") // Join multiple commits summaries per day
    })

    const chartConfig = {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Commits per Day",
            data: commitsCount,
            fill: false,
            borderColor: "rgb(106, 75, 192)",
            tension: 0.2,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: "rgb(75, 77, 192)",
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const index = context.dataIndex
                return summaries[index]
              },
            },
          },
          title: {
            display: true,
            text: "Project Evolution Timeline",
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Date",
            },
          },
          y: {
            title: {
              display: true,
              text: "Commits",
            },
            ticks: {
              stepSize: 1,
              precision: 0,
            },
          },
        },
      },
    }

    // Save chart config to cache under special hash (same as before)
    const now = new Date().toISOString()
    const chartEntry = {
      hash: "__chart__",
      message: "Chart.js timeline config",
      summary: "Chart configuration for project timeline",
      config: chartConfig,
      author: "Gittyx Agent",
      date: now,
    }

    const existing = this.cache.find((c) => c.hash === "__chart__")
    if (existing) {
      Object.assign(existing, chartEntry)
    } else {
      this.cache.push(chartEntry)
    }

    fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2))
    logging("Chart config saved to cache.")
    return chartConfig
  }

  async *streamChatResponse(query: string, sessionId: string, gittyxStore: VectorService): AsyncGenerator<string> {
    if (!query) return

    const route = await this.router.classifyQuery(query)
    let context = ""

    if (route.type === "tool" && route.toolName && tools[route.toolName]) {
      if (route.toolName === "summarizeFileEvolution") {
        context = await tools[route.toolName].run({ ...route.args, limit: this.limit })
      } else {
        context = await tools[route.toolName].run(route.args || {})
      }
    } else if (route.type === "vector") {
      const results = await gittyxStore.query(query)
      context = results
        .map(
          (r, i) =>
            `--- Chunk ${i + 1} ---\nCommit: ${r.metadata.hash}\nMessage: ${r.metadata.message}\nSummary: ${r.metadata.summary}\nAuthor: ${r.metadata.author}\nDate: ${r.metadata.date}\n\n${r.metadata.text}`,
        )
        .join("\n\n")
    } else {
      context = ""
    }

    const prompt = `# Role
You are Gittyx, an expert Git AI analyst. An AI-powered CLI tool that analyzes a Git repository's history and launches a local web dashboard to visualize, explore, and query the codebase's evolution.

# Instructions
- Given the following Git commit history context and a user question, respond with insights grounded in the commits.
- If no context is provided, just answer the question and explain to the user how Gittyx works.
- DON'T make up answers, just use the context to answer the question.
- If no context is provided, DON'T ask user to provide his git logs, instead ask the user to ask about his repository.

## Context (if any):
${context}

## Question:
${query}

## Answer:`

    const chatHistory = loadSessionHistory(sessionId)
    chatHistory.push({ role: "user", text: prompt })

    const contents = chatHistory.map((entry) => ({
      role: entry.role,
      parts: [{ text: entry.text }],
    }))

    const options: GenerateContentOptions = {
      model: this.model_name,
      contents: contents,
    }

    let responseText = ""

    for await (const chunk of this.aiProvider.generateContentStream(options)) {
      if (chunk.text) {
        responseText += chunk.text
        yield chunk.text
      }
    }

    chatHistory.push({ role: "model", text: responseText })
    saveSessionHistory(sessionId, chatHistory)
  }
}
