import dotenv from "dotenv";
import OpenAI from "openai";
import { KALSHI_RESULTS_PER_QUERY } from "./constants";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

function extractText(response: {
  output_text?: string;
  output?: unknown[];
}): string {
  if (response.output_text) {
    return response.output_text;
  }

  const textParts: string[] = [];
  for (const item of response.output ?? []) {
    const content = (item as {
      content?: Array<{ type: string; text?: string }>;
    }).content ?? [];

    for (const block of content) {
      if (block.type === "output_text" && block.text) {
        textParts.push(block.text);
      }
    }
  }
  return textParts.join("");
}

export async function callLLMMini(
  prompt: string,
  system: string = "You are a financial research analyst. Use prior knowledge to answer the question. Only return JSON. Do not return any other text or markdown other than the JSON. Do not include introductory/closing text or any other text before or after the JSON."
): Promise<string> {
  const response = await openai.responses.create({
    model: "gpt-4o",
    instructions: system,
    input: prompt,
    max_output_tokens: 2000,
  });

  return extractText(response).trim();
}

export async function callLLMWithSearch(
  prompt: string,
  system: string = "You are a financial research analyst. Search thoroughly before responding. Only return JSON. Do not return any other text or markdown other than the JSON. Do not include introductory/closing text or any other text before or after the JSON."
): Promise<string> {
  const response = await openai.responses.create({
    model: "gpt-4o",
    instructions: system,
    input: prompt,
    max_output_tokens: 4000,
    tools: [{ type: "web_search_preview" }],
  });

  return extractText(response).trim();
}

export async function searchKalshiMarkets(query: string) {
  const url = new URL("https://api.elections.kalshi.com/v1/search/series");
  url.searchParams.set("query", query);
  url.searchParams.set("embedding_search", "true");
  url.searchParams.set("order_by", "querymatch");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Kalshi search failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data["current_page"].slice(0, KALSHI_RESULTS_PER_QUERY);
}

const main = async () => {
  // Test searchKalshiMarkets
  const responseKalshi = await searchKalshiMarkets("apple");
  console.log(`Number of results: ${responseKalshi.length}`);
  console.log(`Results: ${JSON.stringify(responseKalshi[0], null, 2)}`);
  for (const result of responseKalshi) {
    console.log(`Event title: ${result["event_title"]}`);
  }

  // Test callLLMWithSearch
  const responseWithSearch = await callLLMWithSearch("What is the latest news on Apple?");
  console.log(`Response: ${responseWithSearch}`);

  // Test callLLMMini
  const responseMini = await callLLMMini("What is the history of Apple?");
  console.log(`Response: ${responseMini}`);
}

if (require.main === module) {
  main().catch(console.error);
}