export const config = {
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY!,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
  },
  exa: {
    apiKey: process.env.EXA_API_KEY!,
  },
  api: {
    secretKey: process.env.API_SECRET_KEY,
  },
} as const;

export const validateConfig = () => {
  const required = [
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
    "EXA_API_KEY",
    "NEXT_PUBLIC_CONVEX_URL",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};
