import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CS API Service",
      version: "1.0.0",
      description:
        "A comprehensive API service with AI chat, web search, and database capabilities",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url:
          process.env.NODE_ENV === "production"
            ? "https://your-domain.com"
            : "http://localhost:3000",
        description:
          process.env.NODE_ENV === "production"
            ? "Production server"
            : "Development server",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
        },
        UserIdHeader: {
          type: "apiKey",
          in: "header",
          name: "x-user-id",
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
    tags: [
      {
        name: "Chat",
        description: "AI chat endpoints using various models via OpenRouter",
      },
      {
        name: "Search",
        description: "Web search endpoints using Exa API",
      },
      {
        name: "Analytics",
        description: "API usage analytics and logging",
      },
    ],
  },
  apis: [
    "./src/app/api/**/*.ts", // Path to the API files
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
