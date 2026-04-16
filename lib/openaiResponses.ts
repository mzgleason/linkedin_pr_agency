type OpenAIResponsesOutputItem = {
  type: string;
  content?: Array<{ type: string; text?: string }>;
};

type OpenAIResponsesResult = {
  output?: OpenAIResponsesOutputItem[];
};

function extractFirstJsonObject(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const sliced = raw.slice(start, end + 1);
  return JSON.parse(sliced);
}

export async function responsesJson<T>(input: {
  system: string;
  user: string;
  model?: string;
  timeoutMs?: number;
}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 25_000);
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: [
          { role: "system", content: [{ type: "text", text: input.system }] },
          { role: "user", content: [{ type: "text", text: input.user }] },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI error (${res.status}): ${body.slice(0, 400)}`);
    }

    const data = (await res.json()) as OpenAIResponsesResult;
    const texts: string[] = [];
    for (const item of data.output ?? []) {
      for (const chunk of item.content ?? []) {
        if (chunk.type === "output_text" && typeof chunk.text === "string") texts.push(chunk.text);
      }
    }
    const joined = texts.join("\n").trim();
    const parsed = extractFirstJsonObject(joined);
    if (parsed === null) {
      throw new Error("OpenAI did not return JSON");
    }
    return parsed as T;
  } finally {
    clearTimeout(timeout);
  }
}
