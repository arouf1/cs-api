import { NextRequest, NextResponse } from "next/server";
import { getResearchReport } from "@/lib/research/research-storage";

/**
 * GET /api/research/status/[reportId]
 *
 * Poll the status of a research report
 * Returns the current status and data if complete
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    // Get the research report
    const report = await getResearchReport(reportId);

    if (!report) {
      return NextResponse.json(
        { error: "Research report not found" },
        { status: 404 }
      );
    }

    // Check if report has expired (pending > 5 minutes)
    const now = Date.now();
    if (
      report.status === "pending" &&
      report.expiresAt &&
      report.expiresAt < now
    ) {
      return NextResponse.json({
        reportId,
        status: "failed",
        error: "Research request timed out",
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      });
    }

    // Return status and data based on current state
    const response: any = {
      reportId,
      status: report.status || "complete", // Default to complete for legacy records
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };

    // Include additional fields based on status
    if (report.status === "complete" || !report.status) {
      response.data = report.data;
      response.model = report.model;
      response.responseTime = report.responseTime;
      response.costDollars = report.costDollars;
    } else if (report.status === "pending") {
      response.expiresAt = report.expiresAt;
      // Estimate progress (this is just for UX, not accurate)
      const elapsed = now - report.createdAt;
      const estimatedTotal = 60000; // 60 seconds estimated
      response.estimatedProgress = Math.min(elapsed / estimatedTotal, 0.9); // Cap at 90%
    } else if (report.status === "failed") {
      response.error = report.data?.error || "Research failed";
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get research status:", error);
    return NextResponse.json(
      { error: "Failed to get research status" },
      { status: 500 }
    );
  }
}
