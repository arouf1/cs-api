import Exa from "exa-js";
import { config } from "../core/config";

export const exa = new Exa(config.exa.apiKey);

export interface SearchOptions {
  query: string;
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  startCrawlDate?: string;
  endCrawlDate?: string;
  startPublishedDate?: string;
  endPublishedDate?: string;
  useAutoprompt?: boolean;
  type?: "neural" | "keyword";
}

export interface SearchResult {
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  score?: number;
  text?: string;
  highlights?: string[];
  highlightScores?: number[];
}

export async function searchWeb(
  options: SearchOptions
): Promise<SearchResult[]> {
  try {
    const result = await exa.searchAndContents(options.query, {
      numResults: options.numResults || 10,
      includeDomains: options.includeDomains,
      excludeDomains: options.excludeDomains,
      startCrawlDate: options.startCrawlDate,
      endCrawlDate: options.endCrawlDate,
      startPublishedDate: options.startPublishedDate,
      endPublishedDate: options.endPublishedDate,
      useAutoprompt: options.useAutoprompt || false,
      type: options.type || "neural",
      text: true,
      highlights: true,
    });

    return result.results.map((item: any) => ({
      title: item.title,
      url: item.url,
      publishedDate: item.publishedDate,
      author: item.author,
      score: item.score,
      text: item.text,
      highlights: item.highlights,
      highlightScores: item.highlightScores,
    }));
  } catch (error) {
    console.error("Exa search error:", error);
    throw new Error("Failed to search web");
  }
}
