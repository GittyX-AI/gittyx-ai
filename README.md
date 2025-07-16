# GittyX AI

## Overview

**Name:** `gittyx-ai`

**Type:** CLI tool + Local web dashboard

**Website:** https://gittyx-ai.com

![npm version](https://img.shields.io/npm/v/gittyx-ai) ![license](https://img.shields.io/github/license/GittyX-AI/gittyx-ai.svg) ![stars](https://img.shields.io/github/stars/GittyX-AI/gittyx-ai?style=flat) [![GitHub release](https://img.shields.io/github/v/release/GittyX-AI/gittyx-ai?sort=date&display_name=release&color=orange
)](https://github.com/GittyX-AI/gittyx-ai/releases)
 

## Description

**`gittyx-ai`** is an AI-powered CLI tool that analyzes a Git repository’s history and launches a local web dashboard to visualize, explore, and query the codebase’s evolution.

- CLI: Analyzes commits, diffs, and generates semantic summaries
- Web: Dashboard served locally at `http://localhost:49251` with interactive timeline and AI-powered Q&A
- **Private by design:** All data stays on the developer’s machine when using `local mode`.

## Key Features

### AI-Powered Code Analysis
Analyze commits, generate semantic summaries, and ask natural language questions about your repo:
- “When did we migrate from Oracle to SQL Server? and why?”
- “Why was Redis removed?”

### CLI Tool + Web Dashboard
- Analyze Git repositories using the CLI
- Launch an interactive dashboard at `http://localhost:49251`
- Commit timeline, semantic summaries, Q&A interface

### Local Mode & Private
All processing happens locally if you choose `local mode`. Your code never leaves your machine.

## Quick Start

```bash
# Install GittyX globally
npm install -g gittyx-ai

# Navigate to your Git project
cd your-project

# Analyze your repository
gittyx analyze
```

> Requires Node.js 18+ and a Git repository  
> For online mode, set your `AI provider` api key:
> - For Gemini `GEMINI_API_KEY` in `.env` 
> - For OpenAI `OPENAI_API_KEY` in `.env`
>
> For local mode, you will need to:
> 1. Download and install [Ollama](https://ollama.com/download)
> 2. Run: `ollama serve`
> 3. Run: `gittyx analyze --mode local`, write the name of model you want to use, check the list of [available models](https://ollama.com/search)

## CLI Options
```bash
gittyx analyze -h
```
```bash
Usage: gittyx analyze [options] 

Analyze repository and start dashboard 

Options: 
-l, --limit <number>  The number of the most recent commits to analyze (default: 200)  
-m, --mode <string>   GittyX mode: online (gemini or openai) or local (ollama) (default: "online") 
-h, --help            display help for command
```

## Coming Soon

| Feature                          | Soon | Future | Future+ |
|----------------------------------|:----:|:------:|:-------:|
| VSCode Extension              | x |  |  |
| GitHub Integration           |  | x |  |
| Timeline Diff Comparison     |  | x |  |
| Team Dashboards *(online only)* |  |  | x |


## 🤝 Contributing

We welcome contributions! Check out our [Contribution Guide](https://github.com/GittyX-AI/gittyx-ai/blob/main/CONTRIBUTING.md) and help improve GittyX.


## License

Licensed under the [Apache-2.0 License](https://github.com/GittyX-AI/gittyx-ai/blob/main/LICENSE)

> Developed by [Mohammed TATI](https://github.com/tatimohammed)\
> Made for developers, by a developer
