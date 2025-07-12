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

import { GoogleGenAI, Models } from "@google/genai";
import { getCommits } from "../utils/insight";
import { LocalVectorStore, VECTOR_STORE_PATH } from "./client";
import cliProgress from 'cli-progress';
import { logging } from "../utils/logging";

export default class VectorService {
  private ai: Models;
  private model_name: string = "text-embedding-004";

  private vectorStore: LocalVectorStore;

  private limit: number; // Default limit for commits

  constructor(limit: number, apiKey: string, model_name: string) {
    this.ai = new GoogleGenAI({ apiKey }).models;
    this.limit = limit;

    if (model_name) {
      this.model_name = model_name;
      this.vectorStore = new LocalVectorStore(this.model_name);
      logging(`Using embedding model: ${this.model_name}`);
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    const result = await this.ai.embedContent({
      model: this.model_name,
      contents: [text],
    });

    return result.embeddings[0].values;
  }

  async getEmbeddings(texts: string[]): Promise<number[][]> {
    const result = await this.ai.embedContent({
      model: this.model_name,
      contents: texts,
    });

    return result.embeddings.map((embedding) => embedding.values);
  }

  chunkText(text: string, maxLines = 100): string[] {
    const lines = text.split('\n');
    const chunks: string[] = [];
    let currentChunk: string[] = [];

    for (const line of lines) {
      currentChunk.push(line);
      if (currentChunk.length >= maxLines) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }

  async ingest(batchSize = 16) {
    logging("Ingesting commits...");
    const commits = getCommits(this.limit);
    const existingIds = new Set(this.vectorStore.getAllIds());

    const multibar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: '{bar} {percentage}% | {value}/{total} {label}',
      barCompleteChar: '█',
      barIncompleteChar: '░',
    }, cliProgress.Presets.shades_classic);


    const mainBar = multibar.create(commits.length, 0, { label: 'commits' });

    for (const commit of commits) {
      const { hash, message, summary, diff, author, date } = commit;

      const baseDoc = `
Commit: ${hash}
Author: ${author}
Date: ${date}
Message: ${message}
Summary: ${summary ?? ''}
    `.trim();

      const diffChunks = this.chunkText(diff || '');

      const chunkBar = multibar.create(diffChunks.length, 0, { label: `${hash.slice(0, 7)}` });

      const chunkContents: string[] = [];
      const chunkIds: string[] = [];
      const chunkMetas: any[] = [];

      for (let i = 0; i < diffChunks.length; i++) {
        const chunkId = `${hash}_chunk_${i}`;

        if (existingIds.has(chunkId)) {
          chunkBar.increment();
          continue;
        }

        const chunkContent = `${baseDoc}\n\nDiff Chunk:\n${diffChunks[i]}`;
        chunkContents.push(chunkContent);
        chunkIds.push(chunkId);
        chunkMetas.push({
          hash,
          message,
          summary,
          author,
          date,
          chunk: i,
        });

        const isBatchFull = chunkContents.length >= batchSize;
        const isLast = i === diffChunks.length - 1;

        if (isBatchFull || isLast) {
          try {
            const embeddings = await this.getEmbeddings(chunkContents);

            for (let j = 0; j < embeddings.length; j++) {
              this.vectorStore.addVector(chunkIds[j], embeddings[j], chunkContents[j], chunkMetas[j]);
              chunkBar.increment();
            }
          } catch (err) {
            logging(`Failed to embed batch for commit ${hash}: ${err}`, "error");
          }

          chunkContents.length = 0;
          chunkIds.length = 0;
          chunkMetas.length = 0;
        }
      }

      // Remove sub-bar once done
      multibar.remove(chunkBar);
      mainBar.increment();
    }

    mainBar.stop();
    multibar.stop();

    logging(`Ingestion complete. Stored in ${VECTOR_STORE_PATH}`);
  }


  async query(text: string, topK = 5) {
    const embedding = await this.getEmbedding(text);
    const results = this.vectorStore.search(embedding, topK);

    return results;
  }
}
