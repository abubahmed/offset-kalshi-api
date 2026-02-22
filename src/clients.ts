import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";
import puppeteer from "puppeteer";


const client = new OpenAI({ apiKey: process.env.OPENAI_KEY });

function getOutputText(response: { output_text?: string; output?: unknown[] }): string {
  if (response.output_text) return response.output_text;
  const parts: string[] = [];
  for (const item of response.output ?? []) {
    const content = (item as { content?: Array<{ type: string; text?: string }> }).content ?? [];
    for (const block of content) {
      if (block.type === "output_text" && block.text) parts.push(block.text);
    }
  }
  return parts.join("");
}

export async function callLLMMini(
  prompt: string,
  system: string = "You are a financial analyst. Return valid JSON only. No markdown, no prose."
): Promise<string> {
  const response = await client.responses.create({
    model: "gpt-4o",
    max_output_tokens: 2000,
    instructions: system,
    input: prompt,
  });
  return getOutputText(response).trim();
}

export async function callLLMWithSearch(
  prompt: string,
  system: string = "You are a financial research analyst. Search thoroughly before responding."
): Promise<string> {
  const response = await client.responses.create({
    model: "gpt-4o",
    max_output_tokens: 4000,
    instructions: system,
    tools: [{ type: "web_search_preview" }],
    input: prompt,
  });
  return getOutputText(response).trim();
}

// export async function searchKalshiMarkets(term: string): Promise<unknown> {
//   const apiKey = process.env.KALSHI_API_KEY;
//   if (!apiKey) throw new Error("KALSHI_API_KEY is not set in environment");

//   const url = `https://api.elections.kalshi.com/trade-api/v2/events`;

//   try {
//     const res = await fetch(url, {
//       headers: {
//         Authorization: `Bearer ${apiKey}`,
//         "Content-Type": "application/json",
//       },
//     });

//     if (!res.ok) {
//       const body = await res.text();
//       throw new Error(`Kalshi API error ${res.status}: ${body}`);
//     }

//     const results = await res.json();
//     const count = results.events.length;
//     return count;
//   } catch (error) {
//     console.error("Error searching Kalshi markets:", error);
//     throw error;
//   }
// }

// export async function scrapeKalshiSearchLinks(term: string): Promise<{ href: string; text: string }[]> {
//   const KALSHI_SEARCH_BASE = "https://kalshi.com/search";
//   const url = `${KALSHI_SEARCH_BASE}?q=${encodeURIComponent(term)}&order_by=querymatch`;

//   const browser = await puppeteer.launch({ headless: true });
//   try {
//     const page = await browser.newPage();
//     await page.goto(url, {
//       waitUntil: "networkidle0",
//       timeout: 60000,
//     });
//     await new Promise((r) => setTimeout(r, 2000));

//     const rawLinks = await page.$$eval("a[href]", (anchors) =>
//       anchors
//         .map((a) => ({
//           href: (a.getAttribute("href") ?? "").trim(),
//           text: (a.querySelector("h2")?.textContent ?? "").trim(),
//         }))
//         .filter((x) => x.href)
//     );

//     const base = "https://kalshi.com";
//     const links = rawLinks
//       .filter((x) => x.href.startsWith("/markets") && x.text)
//       .map((x) => ({
//         href: x.href.startsWith("http") ? x.href : `${base}${x.href.startsWith("/") ? x.href : "/" + x.href}`,
//         text: x.text,
//       }));

//     return links.slice(0, 10);
//   } catch (error) {
//     console.error("Error scraping Kalshi search links:", error);
//     throw error;
//   } finally {
//     await browser.close();
//   }
// }

// export async function runKalshiSearchForTerms(terms: string[]): Promise<any[]> {
//   const results: any[] = [];
//   for (const term of terms) {
//     const links = await scrapeKalshiSearchLinks(term);
//     results.push({ searchTerm: term, links });
//   }
//   return results
// }

const main = async () => {
  const options = { method: 'GET' };

  fetch('https://api.elections.kalshi.com/trade-api/v2/series?limit=100&query=Donald+Trump+wins+the+election', options)
    .then(res => res.json())
    .then(res => console.log(res))
    .catch(err => console.error(err));
}

if (require.main === module) {
  main().catch(console.error);
}