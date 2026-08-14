"use node";

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export async function callOpenRouter(args: {
  apiKey: string;
  model: string;
  messages: OpenRouterMessage[];
  maxTokens: number;
  endpoint?: string;
}): Promise<
  | { success: true; content: string; usage?: OpenRouterUsage }
  | { success: false; error: string }
> {
  try {
    const response = await fetch(args.endpoint ?? "https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${args.apiKey}`,
        "HTTP-Referer": "https://simmonds-platform.vercel.app",
        "X-Title": "Simmonds LMS Quiz Generator",
      },
      body: JSON.stringify({
        model: args.model,
        max_tokens: args.maxTokens,
        messages: args.messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as {
        error?: { message?: string };
      };
      return {
        success: false,
        error: `OpenRouter API error (${response.status}): ${errorData.error?.message || response.statusText}`,
      };
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: OpenRouterUsage;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { success: false, error: "Unexpected response format from OpenRouter: no content" };
    }
    return { success: true, content, usage: data.usage };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown OpenRouter request error",
    };
  }
}
