import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

if (!apiKey || !baseURL) {
  console.warn(
    "[anthropic] Anthropic integration env vars are not set — AI features will fail until configured."
  );
}

export const anthropic = new Anthropic({
  apiKey: apiKey ?? "missing-anthropic-api-key",
  baseURL: baseURL ?? "https://api.anthropic.com",
});
