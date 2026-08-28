import { getCommits } from "../utils/insight"
import { LocalVectorStore, VECTOR_STORE_PATH } from "./client"
import { output } from "../utils/output"
import type { AIProvider } from "../providers/ai-provider"
import type { ProviderConfig } from "../providers/provider-factory"

/**
 * Vector service for ingesting and searching commit embeddings
 * Uses semantic search to find relevant commits based on queries
 */
export default class VectorService {
  private aiProvider: AIProvider
  private model_name: string
  private vectorStore: LocalVectorStore
  private limit: number

  constructor(limit: number, providerConfig: ProviderConfig, aiProvider: AIProvider) {
    this.aiProvider = aiProvider
    this.model_name = providerConfig.embeddingModel
    this.limit = limit
    this.vectorStore = new LocalVectorStore(this.model_name)

    output.debug(`Using provider: ${providerConfig.type} with embedding model: ${this.model_name}`)
  }

  /**
   * Get embedding for a single text
   */
  async getEmbedding(text: string): Promise<number[]> {
    return await this.aiProvider.getEmbedding(this.model_name, text)
  }

  /**
   * Get embeddings for multiple texts (batch operation)
   */
  async getEmbeddings(texts: string[]): Promise<number[][]> {
    return await this.aiProvider.getEmbeddings(this.model_name, texts)
  }

  /**
   * Split text into chunks of specified line count
   * Prevents extremely large text inputs to embeddings
   */
  chunkText(text: string, maxLines = 100): string[] {
    const lines = text.split("\n")
    const chunks: string[] = []
    let currentChunk: string[] = []

    for (const line of lines) {
      currentChunk.push(line)
      if (currentChunk.length >= maxLines) {
        chunks.push(currentChunk.join("\n"))
        currentChunk = []
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join("\n"))
    }

    return chunks
  }

  /**
   * Ingest all commits into the vector store
   * Chunks diffs and creates embeddings for semantic search
   */
  async ingest(batchSize = 16) {
    output.debug("Ingesting commits into vector store...")
    const commits = getCommits(this.limit)
    const existingIds = new Set(this.vectorStore.getAllIds())

    let processedCount = 0;
    const totalChunks = commits.reduce((acc, commit) => {
      const chunks = this.chunkText(commit.diff || "");
      return acc + chunks.length;
    }, 0);

    output.debug(`Processing ${commits.length} commits with ${totalChunks} total chunks`);

    for (const commit of commits) {
      const { hash, message, summary, diff, author, date } = commit
      // Create base document with commit metadata
      const baseDoc = `Commit: ${hash}
Author: ${author}
Date: ${date}
Message: ${message}
Summary: ${summary ?? ""}`.trim()

      // Split diff into manageable chunks
      const diffChunks = this.chunkText(diff || "")

      const chunkContents: string[] = []
      const chunkIds: string[] = []
      const chunkMetas: any[] = []

      // Process each chunk of the diff
      for (let i = 0; i < diffChunks.length; i++) {
        const chunkId = `${hash}_chunk_${i}`
        // Skip already-ingested chunks
        if (existingIds.has(chunkId)) {
          processedCount++;
          continue
        }

        // Combine base doc with diff chunk
        const chunkContent = `${baseDoc}\n\nDiff Chunk:\n${diffChunks[i]}`
        chunkContents.push(chunkContent)
        chunkIds.push(chunkId)
        chunkMetas.push({
          hash,
          message,
          summary,
          author,
          date,
          chunk: i,
          text: chunkContent,
        })

        // Check if batch is full or if this is the last chunk
        const isBatchFull = chunkContents.length >= batchSize
        const isLastChunk = i === diffChunks.length - 1

        // Process batch when full or at end
        if (isBatchFull || isLastChunk) {
          try {
            // Generate embeddings for the batch
            const embeddings = await this.getEmbeddings(chunkContents)
            for (let j = 0; j < embeddings.length; j++) {
              this.vectorStore.addVector(chunkIds[j], embeddings[j], chunkContents[j], chunkMetas[j])
              processedCount++;
            }
            output.debug(`Processed ${processedCount}/${totalChunks} chunks`);
          } catch (err) {
            output.warn(`Failed to embed batch for commit ${hash.slice(0, 7)}: ${err}`)
            // Skip failed chunks and continue with next batch
            for (let j = 0; j < chunkContents.length; j++) {
              processedCount++;
            }
          }

          // Reset batch arrays
          chunkContents.length = 0
          chunkIds.length = 0
          chunkMetas.length = 0
        }
      }
    }

    output.debug(`Ingestion complete. Stored in ${VECTOR_STORE_PATH}`)
  }

  /**
   * Query the vector store for semantically similar commits
   * Returns top K results ranked by similarity
   */
  async query(text: string, topK = 5) {
    const embedding = await this.getEmbedding(text)
    const results = this.vectorStore.search(embedding, topK)
    return results
  }
}
