import { NextRequest, NextResponse } from "next/server";
import {
  performResearch,
  createResearchTask,
  createStreamingResearch,
  createResearchCompletion,
  validateResearchParams,
  type ResearchParams,
} from "@/lib/research";

export async function POST(request: NextRequest) {
  try {
    console.log("Research API called");
    const body = await request.json();
    console.log("Request body:", body);

    const {
      company,
      position,
      location,
      type = "completion",
      userId,
      storeResult = false,
    } = body;

    console.log("Parsed params:", { company, position, location, type });

    // Validate required parameters
    const params: ResearchParams = { company, position, location };
    validateResearchParams(params);

    const options = { userId, storeResult };

    // Handle different research types
    switch (type) {
      case "structured":
      case "completion":
        console.log(`Calling performResearch for ${type}...`);
        const result = await performResearch(params, type, options);
        console.log("Research request processed:", result.status);

        return NextResponse.json({
          ...result,
          type,
        });

      case "streaming":
        // For streaming, we'll return a ReadableStream
        // Note: Streaming doesn't support duplicate prevention yet
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of createStreamingResearch(params)) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`)
                );
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });

      default:
        return NextResponse.json(
          { error: `Unsupported research type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Research API error:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Research API endpoint with duplicate prevention",
    methods: ["POST", "GET"],
    endpoints: {
      "POST /api/research": "Create or retrieve research",
      "GET /api/research/status/[reportId]": "Poll research status",
    },
    parameters: {
      company: "string (required) - Company name to research",
      position: "string (required) - Position title",
      location: "string (required) - Location",
      type: "string (optional) - 'completion' | 'structured' | 'streaming' (default: 'completion')",
      userId: "string (optional) - User identifier",
      storeResult:
        "boolean (optional) - Whether to store the result (default: true for new flow)",
    },
    workflow: {
      "1": "POST request creates pending entry or returns existing",
      "2": "If pending, poll GET /api/research/status/[reportId] until complete",
      "3": "Research is cached for 7 days to prevent duplicates",
      "4": "Pending requests timeout after 5 minutes",
    },
    responses: {
      pending: {
        reportId: "string",
        status: "pending",
      },
      complete: {
        reportId: "string",
        status: "complete",
        report: "object | string",
        isExisting: "boolean (optional)",
      },
      failed: {
        reportId: "string",
        status: "failed",
        error: "string",
      },
    },
    examples: {
      structured: {
        company: "Google",
        position: "Product Manager",
        location: "Dublin",
        type: "structured",
      },
      completion: {
        company: "OpenAI",
        position: "Software Engineer",
        location: "London",
        type: "completion",
      },
    },
  });
}
