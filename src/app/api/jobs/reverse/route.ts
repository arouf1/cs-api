import { NextRequest, NextResponse } from "next/server";
import { reverseJobSearch, type ReverseJobSearchParams } from "@/lib/jobs";

/**
 * POST /api/jobs/reverse
 * Reverse job search - scrape a job URL and store it in the same format as SERP API jobs
 *
 * Body:
 * - url: string (required) - Job posting URL to scrape
 * - userId?: string (optional) - User ID for tracking
 *
 * Returns:
 * - { success: true, job: StructuredJob, message: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, userId } = body;

    // Validate required parameters
    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "URL is required and must be a non-empty string",
        },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid URL format",
        },
        { status: 400 }
      );
    }

    const params: ReverseJobSearchParams = {
      url: url.trim(),
    };

    console.log("Performing reverse job search:", params);

    const result = await reverseJobSearch(params, {
      userId,
    });

    return NextResponse.json({
      success: true,
      job: result.job,
      jobId: result.jobId,
      message: `Successfully scraped and processed job: ${result.job.title} at ${result.job.company}`,
      responseTime: result.responseTime,
    });
  } catch (error) {
    console.error("Reverse job search API error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
