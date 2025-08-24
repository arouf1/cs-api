import Exa from "exa-js";
import { OpenAI } from "openai";
import { config } from "../core/config";
import { getCurrentDateString } from "../core/utils";
import {
  storeResearchReport,
  findExistingResearch,
  createPendingResearch,
  updateResearchReport,
  markResearchFailed,
  cleanupExpiredEntries,
} from "./research-storage";

const exa = new Exa(config.exa.apiKey);

// OpenAI-compatible client for Exa research model
const exaOpenAI = new OpenAI({
  apiKey: config.exa.apiKey,
  baseURL: "https://api.exa.ai",
});

export interface ResearchParams {
  company: string;
  position: string;
  location: string;
}

export interface ResearchOptions {
  userId?: string;
  storeResult?: boolean;
}

export interface CompanyResearchReport {
  companyOverview: string;
  newsAndPerformance: string;
  employeeInsights: string;
  industryAnalysis: string;
  hiringProcess: string;
  salaryAndBenefits: string;
  financials: string;
}

export interface ResearchResult {
  report: CompanyResearchReport;
}

/**
 * Main research function with duplicate prevention and status management
 */
export async function performResearch(
  params: ResearchParams,
  type: "structured" | "completion" | "streaming",
  options: ResearchOptions = {}
): Promise<{
  report?: ResearchResult | string;
  reportId: string;
  status: "pending" | "complete" | "failed";
  isExisting?: boolean;
}> {
  // Clean up expired entries first
  await cleanupExpiredEntries();

  // Check for existing research
  const existing = await findExistingResearch(params, type);

  if (existing) {
    // Handle existing research based on status
    if (existing.status === "complete") {
      if (existing.isStale) {
        // Research is stale (>7 days old), create new one
        console.log("Found stale research (>7 days old), creating new one");
        // Fall through to create new research
      } else {
        // Return existing complete research
        console.log("Returning existing complete research");
        return {
          report: existing.data,
          reportId: existing._id,
          status: "complete",
          isExisting: true,
        };
      }
    } else if (existing.status === "pending") {
      // Return pending status for polling
      console.log("Research is pending, returning for polling");
      return {
        reportId: existing._id,
        status: "pending",
        isExisting: true,
      };
    } else if (existing.status === "failed") {
      // Previous attempt failed, create new one
      console.log("Previous research failed, creating new one");
      // Fall through to create new research
    }
    // If we reach here, it means we need to create new research
    // (either stale or failed case)
  }

  // Create new pending research entry
  const reportId = await createPendingResearch(params, type, options);
  console.log("Created pending research entry:", reportId);

  // Start research in background (don't await)
  executeResearch(reportId, params, type, options).catch(async (error) => {
    console.error("Research failed:", error);
    await markResearchFailed(reportId, error.message);
  });

  return {
    reportId,
    status: "pending",
  };
}

/**
 * Execute the actual research (called in background)
 */
async function executeResearch(
  reportId: string,
  params: ResearchParams,
  type: "structured" | "completion" | "streaming",
  options: ResearchOptions = {}
): Promise<void> {
  try {
    let result: ResearchResult | string;
    let model: string;
    let responseTime: number;
    let costDollars: number;

    const startTime = Date.now();

    if (type === "structured") {
      const researchResult = await createResearchTaskInternal(params, options);
      result = researchResult;
      model = "exa-answer";
      responseTime = Date.now() - startTime;
      costDollars = researchResult.totalCostDollars || 0;
    } else if (type === "completion") {
      const completionResult = await createResearchCompletionInternal(
        params,
        options
      );
      result = completionResult.text;
      model = completionResult.model;
      responseTime = Date.now() - startTime;
      costDollars = 0; // TODO: Get cost from completion
    } else {
      throw new Error(
        "Streaming research not yet supported in background execution"
      );
    }

    // Update the research entry with results
    await updateResearchReport(reportId, result, type, {
      model,
      responseTime,
      costDollars,
      company: params.company,
      position: params.position,
      location: params.location,
    });

    console.log("Research completed successfully:", reportId);
  } catch (error) {
    console.error("Research execution failed:", error);
    throw error;
  }
}

/**
 * Creates a comprehensive research task using Exa's answer API
 * Returns a structured report with predefined schema - 26x more cost effective!
 */
export async function createResearchTask(
  params: ResearchParams,
  options: ResearchOptions = {}
): Promise<ResearchResult & { reportId?: string }> {
  const result = await createResearchTaskInternal(params, options);

  // Store result if requested
  if (options.storeResult) {
    const reportId = await storeResearchReport(params, result, "structured", {
      userId: options.userId,
      model: "exa-answer",
      responseTime: result.responseTime,
      costDollars: result.totalCostDollars,
    });
    return { ...result, reportId };
  }

  return result;
}

/**
 * Internal function for creating research task (without storage logic)
 */
async function createResearchTaskInternal(
  params: ResearchParams,
  options: ResearchOptions = {}
): Promise<
  ResearchResult & { responseTime: number; totalCostDollars: number }
> {
  const { company, position, location } = params;
  const currentDate = getCurrentDateString();

  // Define comprehensive research questions for each section
  const questions = [
    {
      key: "companyOverview",
      question: `Provide a comprehensive and detailed company overview of ${company}. Be thorough and include: mission statement, core values, founding history and story, key milestones, current leadership team with names and roles, organisational culture and work environment, company size (number of employees), headquarters locations, core business model and revenue streams, key products/services, and company structure. Include specific details, numbers, dates, and names wherever possible. Today's date is ${currentDate} for context.`,
      description:
        "Comprehensive mission, values, history, leadership, and organisational culture analysis",
    },
    {
      key: "newsAndPerformance",
      question: `Provide comprehensive and detailed analysis of ${company}'s recent news and performance from the past 12-18 months. Be thorough and include: latest news and press releases, major product launches and updates, strategic partnerships and collaborations, acquisitions and mergers, market performance metrics, stock performance (if public company), strategic initiatives and business pivots, workforce changes including layoffs or expansions, regulatory developments, and competitive moves. Include specific dates, numbers, financial figures, and concrete details. Today's date is ${currentDate} for reference.`,
      description:
        "Comprehensive recent news, press releases, product launches, partnerships, and performance analysis",
    },
    {
      key: "employeeInsights",
      question: `Provide comprehensive and detailed analysis of employee insights and workplace culture at ${company}. Be thorough and include: employee reviews from multiple platforms (Glassdoor, Indeed, Blind, etc.), overall workplace culture assessment, diversity and inclusion initiatives and statistics, growth opportunities and career development programs, work-life balance policies and employee satisfaction, management quality and leadership effectiveness, compensation satisfaction, common challenges and concerns raised by employees, employee retention rates, and workplace benefits satisfaction. Include specific ratings, percentages, and concrete examples wherever possible.`,
      description:
        "Comprehensive employee reviews, workplace culture, growth opportunities, and challenges analysis",
    },
    {
      key: "industryAnalysis",
      question: `Provide comprehensive and detailed industry analysis for ${company}. Be thorough and include: complete competitive landscape with key competitors and their market positions, ${company}'s market positioning and competitive advantages, industry trends and emerging technologies, total addressable market size and growth projections, regulatory environment and compliance requirements, market share data and rankings, industry challenges and opportunities, technological disruptions affecting the sector, and future outlook for the industry. Include specific market data, percentages, financial figures, and concrete examples wherever possible.`,
      description:
        "Comprehensive competitors, industry positioning, and market trends analysis",
    },
    {
      key: "hiringProcess",
      question: `Provide comprehensive and detailed analysis of the hiring process for a ${position} position at ${company} in ${location}. Be thorough and include: complete interview process stages and timeline, specific assessment methods and evaluation criteria, key decision makers and interview panel composition, common interview questions for this role, technical assessments and coding challenges, behavioural interview components, background check and reference processes, offer negotiation process, onboarding procedures, and specific tips for success. Include typical timelines, success rates, and concrete examples of questions and assessments wherever possible.`,
      description:
        "Comprehensive hiring process analysis including stages, assessments, criteria, questions, and success tips",
    },
    {
      key: "salaryAndBenefits",
      question: `Provide comprehensive and detailed analysis of compensation and benefits for a ${position} position at ${company} in ${location}. Be thorough and include: salary ranges by experience level (entry, mid, senior), total compensation packages breakdown, equity/stock options and vesting schedules, annual bonuses and performance incentives, health benefits (medical, dental, vision), retirement plans and 401k matching, vacation policies and PTO, parental leave policies, unique perks and benefits, remote work policies, professional development budgets, and cost of living adjustments. Include specific salary figures, percentages, and concrete benefit details wherever possible.`,
      description:
        "Comprehensive salary ranges, compensation packages, and benefits analysis",
    },
    {
      key: "financials",
      question: `Provide comprehensive and detailed financial analysis of ${company}. Be thorough and include: current revenue and growth trajectory, profitability metrics and margins, funding history and investment rounds, current valuation and market cap (if public), cash flow and burn rate, debt levels and financial stability, key financial ratios and metrics, revenue diversification and business segments, financial performance compared to competitors, future financial outlook and projections, and any financial risks or challenges. Include specific financial figures, percentages, growth rates, and concrete data wherever possible.`,
      description:
        "Comprehensive revenue, profitability, funding, and growth trajectory analysis",
    },
  ];

  try {
    const startTime = Date.now();

    console.log("Starting research task with params:", {
      company,
      position,
      location,
    });
    console.log("Using Exa answer API (26x more cost effective!)");

    // Execute all questions in parallel for better performance
    const answerPromises = questions.map(
      async ({ key, question, description }) => {
        const result = await (exa as any).answer(question, {
          outputSchema: {
            type: "object",
            required: ["answer"],
            additionalProperties: false,
            properties: {
              answer: {
                type: "string",
                description,
              },
            },
          },
        });
        return {
          key,
          answer: result.answer,
          costDollars: result.costDollars?.total || 0,
        };
      }
    );

    const answers = await Promise.all(answerPromises);
    const responseTime = Date.now() - startTime;

    // Calculate total cost from all answer calls
    const totalCostDollars = answers.reduce(
      (sum, { costDollars }) => sum + costDollars,
      0
    );

    // Combine answers into structured report
    const report: CompanyResearchReport = {} as CompanyResearchReport;
    answers.forEach(({ key, answer }) => {
      (report as any)[key] = answer;
    });

    const result: ResearchResult = { report };

    console.log("Research task completed successfully");
    console.log(
      "Generated structured report with",
      Object.keys(report).length,
      "sections"
    );
    console.log("Total cost:", `$${totalCostDollars.toFixed(6)}`);

    return { ...result, responseTime, totalCostDollars };
  } catch (error) {
    console.error("Research task creation failed:", error);
    throw new Error("Failed to create research task");
  }
}

/**
 * Creates a streaming research response using Exa's OpenAI-compatible interface
 * Returns an async generator for streaming responses
 */
export async function* createStreamingResearch(
  params: ResearchParams
): AsyncGenerator<string, void, unknown> {
  const { company, position, location } = params;
  const currentDate = getCurrentDateString();

  const content = `You are an assistant helping a prospective employee research everything they need to know about a company and a position they are interested in. 

IMPORTANT CONTEXT: Today's date is ${currentDate}. When referring to "recent" events, "latest news", or "past 12-18 months", please use this date as your reference point.

You will carry out research on a comprehensive company overview including mission, values, history, leadership, and organisational culture; the latest company news, press releases, product launches, partnerships, and financial performance; employee reviews and insights on workplace culture, growth opportunities, and challenges; analysis of industry positioning, competitors, and market trends relevant to the company; detailed information about the specific position such as responsibilities, required qualifications, skills, and career progression; salary ranges, compensation packages, and benefits for the position; and company financials including revenue, profitability, funding, and growth trajectory.

The company is: ${company}
The position is: ${position}
The location is: ${location}`;

  try {
    const stream = await exaOpenAI.chat.completions.create({
      model: "exa-research",
      messages: [
        {
          role: "user",
          content,
        },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (error) {
    console.error("Streaming research failed:", error);
    throw new Error("Failed to create streaming research");
  }
}

/**
 * Creates a non-streaming research response using Exa's OpenAI-compatible interface
 * Returns the complete research report as a string
 */
export async function createResearchCompletion(
  params: ResearchParams,
  options: ResearchOptions = {}
): Promise<{ result: string; reportId?: string }> {
  const result = await createResearchCompletionInternal(params, options);

  // Store result if requested
  if (options.storeResult) {
    const reportId = await storeResearchReport(
      params,
      result.text,
      "completion",
      {
        userId: options.userId,
        model: result.model,
        responseTime: result.responseTime,
      }
    );
    return { result: result.text, reportId };
  }

  return { result: result.text };
}

/**
 * Internal function for creating research completion (without storage logic)
 */
async function createResearchCompletionInternal(
  params: ResearchParams,
  options: ResearchOptions = {}
): Promise<{ text: string; model: string; responseTime: number }> {
  const { company, position, location } = params;
  const currentDate = getCurrentDateString();

  const content = `You are an assistant helping a prospective employee research everything they need to know about a company and a position they are interested in. 

IMPORTANT CONTEXT: Today's date is ${currentDate}. When referring to "recent" events, "latest news", or "past 12-18 months", please use this date as your reference point.

You will carry out research on a comprehensive company overview including mission, values, history, leadership, and organisational culture; the latest company news, press releases, product launches, partnerships, and financial performance; employee reviews and insights on workplace culture, growth opportunities, and challenges; analysis of industry positioning, competitors, and market trends relevant to the company; detailed information about the specific position such as responsibilities, required qualifications, skills, and career progression; salary ranges, compensation packages, and benefits for the position; and company financials including revenue, profitability, funding, and growth trajectory.

The company is: ${company}
The position is: ${position}
The location is: ${location}`;

  try {
    const startTime = Date.now();

    const completion = await exaOpenAI.chat.completions.create({
      model: "exa-research",
      messages: [
        {
          role: "user",
          content,
        },
      ],
      stream: false,
    });

    const text = completion.choices[0]?.message?.content || "";
    const responseTime = Date.now() - startTime;

    return { text, model: "exa-research", responseTime };
  } catch (error) {
    console.error("Research completion failed:", error);
    throw new Error("Failed to create research completion");
  }
}

/**
 * Validates research parameters
 */
export function validateResearchParams(params: ResearchParams): void {
  const { company, position, location } = params;

  if (!company || typeof company !== "string" || company.trim().length === 0) {
    throw new Error("Company name is required and must be a non-empty string");
  }

  if (
    !position ||
    typeof position !== "string" ||
    position.trim().length === 0
  ) {
    throw new Error("Position is required and must be a non-empty string");
  }

  if (
    !location ||
    typeof location !== "string" ||
    location.trim().length === 0
  ) {
    throw new Error("Location is required and must be a non-empty string");
  }
}
