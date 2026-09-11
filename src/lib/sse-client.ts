/** Minimal SSE consumer for the AI endpoints (client side). */

export async function postSse(
  url: string,
  body: unknown,
  handlers: { onDelta?: (text: string) => void; onEvent?: (event: string, data: unknown) => void },
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `请求失败 (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      handlers.onEvent?.(event, parsed);
      if (event === "delta" && parsed && typeof parsed === "object") {
        const maybeText = (parsed as Record<string, unknown>).text;
        if (typeof maybeText === "string") handlers.onDelta?.(maybeText);
      }
    }
  }
}
