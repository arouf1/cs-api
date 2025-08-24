import { convex } from "../core/convex";
import { generateEmbedding, prepareTextForEmbedding } from "../core/embeddings";
import type { ResearchParams, ResearchResult } from "./research";

/**
 * Service for storing and retrieving research data with embeddings
 */

export interface StoredResearchReport {
  _id: string;
  company: string;
  position: string;
  location: string;
  type: "structured" | "completion" | "streaming";
  data: any;
  status?: "pending" | "complete" | "failed";
  expiresAt?: number;
  embedding?: number[];
  embeddingText?: string;
  userId?: string;
  model?: string;
  responseTime?: number;
  costDollars?: number;
  createdAt: number;
  updatedAt: number;
  isStale?: boolean; // Added by findExistingResearch
}

/**
 * Create a pending research entry
 */
export async function createPendingResearch(
  params: ResearchParams,
  type: "structured" | "completion" | "streaming",
  options: {
    userId?: string;
  } = {}
): Promise<string> {
  try {
    console.log("Creating pending research with params:", {
      params,
      type,
      options,
    });

    // Use direct function call since API generation seems to have issues
    const reportId = await convex.mutation(
      "functions:createPendingResearch" as any,
      {
        company: params.company,
        position: params.position,
        location: params.location,
        type,
        userId: options.userId,
      }
    );

    console.log("Created pending research with ID:", reportId);
    return reportId;
  } catch (error) {
    console.error("Failed to create pending research:", error);
    console.error("Error details:", error);
    throw new Error("Failed to create pending research");
  }
}

/**
 * Update research report with results
 */
export async function updateResearchReport(
  reportId: string,
  result: ResearchResult | string,
  type: "structured" | "completion" | "streaming",
  options: {
    userId?: string;
    model?: string;
    responseTime?: number;
    costDollars?: number;
  } = {}
): Promise<void> {
  try {
    // Prepare text for embedding based on type
    let embeddingText: string;

    if (type === "structured" && typeof result === "object") {
      // For structured results, combine all sections
      const report = result as ResearchResult;
      embeddingText = [
        `Company Overview: ${report.report.companyOverview}`,
        `News & Performance: ${report.report.newsAndPerformance}`,
        `Employee Insights: ${report.report.employeeInsights}`,
        `Industry Analysis: ${report.report.industryAnalysis}`,
        `Hiring Process: ${report.report.hiringProcess}`,
        `Salary & Benefits: ${report.report.salaryAndBenefits}`,
        `Financials: ${report.report.financials}`,
      ].join(" ");
    } else {
      // For completion and streaming results
      embeddingText = String(result);
    }

    // Generate embedding
    const embedding = await generateEmbedding(embeddingText);

    // Update in Convex
    await convex.mutation("functions:updateResearchReport" as any, {
      id: reportId as any,
      data: result,
      embedding,
      embeddingText: prepareTextForEmbedding(embeddingText),
      status: "complete" as const,
      ...options,
    });
  } catch (error) {
    console.error("Failed to update research report:", error);
    throw new Error("Failed to update research report");
  }
}

/**
 * Mark research report as failed
 */
export async function markResearchFailed(
  reportId: string,
  error?: string
): Promise<void> {
  try {
    await convex.mutation("functions:updateResearchReport" as any, {
      id: reportId as any,
      data: { error: error || "Research failed" },
      status: "failed" as const,
    });
  } catch (err) {
    console.error("Failed to mark research as failed:", err);
    throw new Error("Failed to mark research as failed");
  }
}

/**
 * Store a research report with embeddings in Convex (legacy function for backwards compatibility)
 */
export async function storeResearchReport(
  params: ResearchParams,
  result: ResearchResult | string,
  type: "structured" | "completion" | "streaming",
  options: {
    userId?: string;
    model?: string;
    responseTime?: number;
    tokenCount?: number;
    costDollars?: number;
  } = {}
): Promise<string> {
  try {
    // Prepare text for embedding based on type
    let embeddingText: string;

    if (type === "structured" && typeof result === "object") {
      // For structured results, combine all sections
      const report = result as ResearchResult;
      embeddingText = [
        `Company: ${params.company}`,
        `Position: ${params.position}`,
        `Location: ${params.location}`,
        `Company Overview: ${report.report.companyOverview}`,
        `News & Performance: ${report.report.newsAndPerformance}`,
        `Employee Insights: ${report.report.employeeInsights}`,
        `Industry Analysis: ${report.report.industryAnalysis}`,
        `Hiring Process: ${report.report.hiringProcess}`,
        `Salary & Benefits: ${report.report.salaryAndBenefits}`,
        `Financials: ${report.report.financials}`,
      ].join(" ");
    } else {
      // For completion and streaming results
      embeddingText = `Company: ${params.company} Position: ${params.position} Location: ${params.location} ${result}`;
    }

    // Generate embedding
    const embedding = await generateEmbedding(embeddingText);

    // Store in Convex
    const reportId = await convex.mutation(
      "functions:saveResearchReport" as any,
      {
        company: params.company,
        position: params.position,
        location: params.location,
        type,
        data: result,
        embedding,
        embeddingText: prepareTextForEmbedding(embeddingText),
        ...options,
      }
    );

    return reportId;
  } catch (error) {
    console.error("Failed to store research report:", error);
    throw new Error("Failed to store research report");
  }
}

/**
 * Retrieve a research report by ID
 */
export async function getResearchReport(
  id: string
): Promise<StoredResearchReport | null> {
  try {
    return await convex.query("functions:getResearchReport" as any, {
      id: id as any,
    });
  } catch (error) {
    console.error("Failed to get research report:", error);
    return null;
  }
}

/**
 * Get research reports with optional filters
 */
export async function getResearchReports(
  filters: {
    userId?: string;
    company?: string;
    position?: string;
    location?: string;
    limit?: number;
  } = {}
): Promise<StoredResearchReport[]> {
  try {
    return await convex.query("functions:getResearchReports" as any, filters);
  } catch (error) {
    console.error("Failed to get research reports:", error);
    return [];
  }
}

/**
 * Search research reports using semantic similarity
 */
export async function searchResearchReports(
  query: string,
  options: {
    userId?: string;
    limit?: number;
  } = {}
): Promise<Array<StoredResearchReport & { similarity: number }>> {
  try {
    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);

    // Search using Convex
    return await convex.query("functions:searchResearchReports" as any, {
      queryEmbedding,
      ...options,
    });
  } catch (error) {
    console.error("Failed to search research reports:", error);
    return [];
  }
}

/**
 * Find existing research by parameters
 */
export async function findExistingResearch(
  params: ResearchParams,
  type: "structured" | "completion" | "streaming"
): Promise<StoredResearchReport | null> {
  try {
    return await convex.query("functions:findExistingResearch" as any, {
      company: params.company,
      position: params.position,
      location: params.location,
      type,
    });
  } catch (error) {
    console.error("Failed to find existing research:", error);
    return null;
  }
}

/**
 * Clean up expired pending entries
 */
export async function cleanupExpiredEntries(): Promise<{ updated: number }> {
  try {
    return await convex.mutation("functions:cleanupExpiredEntries" as any, {});
  } catch (error) {
    console.error("Failed to cleanup expired entries:", error);
    return { updated: 0 };
  }
}

/**
 * Find similar research reports to a given company/position
 */
export async function findSimilarReports(
  params: ResearchParams,
  options: {
    userId?: string;
    limit?: number;
  } = {}
): Promise<Array<StoredResearchReport & { similarity: number }>> {
  const searchQuery = `${params.company} ${params.position} ${params.location}`;
  return searchResearchReports(searchQuery, options);
}
