import { embed, embedMany, cosineSimilarity } from "ai";
import { openai } from "@ai-sdk/openai";

// Re-export the AI SDK's cosineSimilarity function for convenience
export { cosineSimilarity };

/**
 * Embeddings service for generating and managing text embeddings
 * Note: OpenRouter doesn't support embeddings, so we use OpenAI directly
 */

const EMBEDDING_MODEL = "text-embedding-3-small"; // Cost-efficient embedding model

/**
 * Generate embeddings for a given text
 * @param text The text to generate embeddings for
 * @returns Promise<number[]> The embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Prepare text for embedding
    const cleanedText = prepareTextForEmbedding(text);

    const { embedding } = await embed({
      model: openai.textEmbeddingModel(EMBEDDING_MODEL),
      value: cleanedText,
    });

    return embedding;
  } catch (error) {
    console.error("Failed to generate embedding:", error);
    throw new Error("Failed to generate embedding");
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts Array of texts to generate embeddings for
 * @returns Promise<number[][]> Array of embedding vectors
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    // Prepare texts for embedding
    const cleanedTexts = texts.map((text) => prepareTextForEmbedding(text));

    const { embeddings } = await embedMany({
      model: openai.textEmbeddingModel(EMBEDDING_MODEL),
      values: cleanedTexts,
    });

    return embeddings;
  } catch (error) {
    console.error("Failed to generate batch embeddings:", error);
    throw new Error("Failed to generate batch embeddings");
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 * Note: The AI SDK also exports a cosineSimilarity function that can be used directly
 * @param a First embedding vector
 * @param b Second embedding vector
 * @returns number Similarity score between -1 and 1
 */
export function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Find the most similar embeddings to a query embedding
 * @param queryEmbedding The query embedding vector
 * @param candidateEmbeddings Array of candidate embedding vectors with metadata
 * @param topK Number of top results to return
 * @returns Array of results sorted by similarity score
 */
export function findSimilarEmbeddings<T>(
  queryEmbedding: number[],
  candidateEmbeddings: Array<{ embedding: number[]; data: T }>,
  topK: number = 5
): Array<{ similarity: number; data: T }> {
  const similarities = candidateEmbeddings.map((candidate) => ({
    similarity: cosineSimilarity(queryEmbedding, candidate.embedding),
    data: candidate.data,
  }));

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * Prepare text for embedding by cleaning and truncating
 * @param text The text to prepare
 * @param maxLength Maximum length of text (default: 8000 characters)
 * @returns Cleaned and truncated text
 */
export function prepareTextForEmbedding(
  text: string,
  maxLength: number = 8000
): string {
  // Clean the text
  let cleanedText = text
    .replace(/\s+/g, " ") // Replace multiple whitespace with single space
    .replace(/\n+/g, " ") // Replace newlines with spaces
    .trim();

  // Truncate if too long
  if (cleanedText.length > maxLength) {
    cleanedText = cleanedText.substring(0, maxLength) + "...";
  }

  return cleanedText;
}
