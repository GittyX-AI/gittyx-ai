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

import path from "path";
import fs from "fs";
import { logging } from "../utils/logging";

export const VECTOR_STORE_PATH = path.resolve(process.cwd(), '.git/gittyx_vectors.json');

export type VectorEntry = {
  id: string;
  embedding: number[];
  metadata: {
    text: string;
    hash: string;
    message: string;
    author: string;
    date: string;
    summary?: string;
    chunk: number;
  };
};

export class LocalVectorStore {
  private modelKey: string;
  private vectors: VectorEntry[] = [];

  constructor(embeddingModel: string) {
    this.modelKey = embeddingModel;
    logging(`Using vector store: ${VECTOR_STORE_PATH} (${this.modelKey})`);
    this.load();
  }

  load() {
    if (fs.existsSync(VECTOR_STORE_PATH)) {
      try {
        const raw = fs.readFileSync(VECTOR_STORE_PATH, 'utf-8');
        const allData = JSON.parse(raw);
        this.vectors = allData[this.modelKey] || [];
      } catch {
        this.vectors = [];
      }
    }
  }

  save() {
    let allData = {};
    if (fs.existsSync(VECTOR_STORE_PATH)) {
      try {
        allData = JSON.parse(fs.readFileSync(VECTOR_STORE_PATH, 'utf-8'));
      } catch {
        allData = {};
      }
    }
    allData[this.modelKey] = this.vectors;
    fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(allData, null, 2));
  }

  addVector(id: string, embedding: number[], text: string, metadata: Omit<VectorEntry['metadata'], 'text'>) {
    const entry: VectorEntry = {
      id,
      embedding,
      metadata: {
        text,
        ...metadata,
      }
    };

    const index = this.vectors.findIndex(v => v.id === id);
    if (index !== -1) this.vectors[index] = entry;
    else this.vectors.push(entry);

    this.save();
  }

  getAllIds(): string[] {
    return this.vectors.map(v => v.id);
  }

  cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return magA && magB ? dot / (magA * magB) : 0;
  }

  search(queryEmbedding: number[], topK = 5): VectorEntry[] {
    return this.vectors
      .map(entry => ({
        ...entry,
        similarity: this.cosineSimilarity(entry.embedding, queryEmbedding)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  all(): VectorEntry[] {
    return this.vectors;
  }
}
