import { NextRequest, NextResponse } from "next/server";
import {
  searchResearchReports,
  getResearchReports,
  findSimilarReports,
} from "@/lib/research/research-storage";
import type { ResearchParams } from "@/lib/research/research";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, userId, limit = 10 } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Search research reports using semantic similarity
    const results = await searchResearchReports(query.trim(), {
      userId,
      limit: Math.min(limit, 50), // Cap at 50 results
    });

    return NextResponse.json({
      query: query.trim(),
      results,
      count: results.length,
    });
  } catch (error) {
    console.error("Research search API error:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || undefined;
    const company = searchParams.get("company") || undefined;
    const position = searchParams.get("position") || undefined;
    const location = searchParams.get("location") || undefined;
    const limit = parseInt(searchParams.get("limit") || "10");
    const action = searchParams.get("action") || "list";

    switch (action) {
      case "similar":
        // Find similar reports to given company/position
        if (!company || !position || !location) {
          return NextResponse.json(
            {
              error:
                "Company, position, and location are required for similarity search",
            },
            { status: 400 }
          );
        }

        const similarResults = await findSimilarReports(
          { company, position, location } as ResearchParams,
          { userId, limit: Math.min(limit, 50) }
        );

        return NextResponse.json({
          action: "similar",
          params: { company, position, location },
          results: similarResults,
          count: similarResults.length,
        });

      case "list":
      default:
        // List research reports with optional filters
        const listResults = await getResearchReports({
          userId,
          company,
          position,
          location,
          limit: Math.min(limit, 50),
        });

        return NextResponse.json({
          action: "list",
          filters: { userId, company, position, location },
          results: listResults,
          count: listResults.length,
        });
    }
  } catch (error) {
    console.error("Research search GET API error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
