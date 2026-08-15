/* API service for routing and executing requests to local Ollama endpoints. */

import type {
  OllamaChatMessage,
  OllamaChatRequest,
  OllamaChatResponse,
} from "../types/ollama";
import { DEFAULT_OLLAMA_URL } from "./ollama";

export interface SendChatOptions {
  model: string;
  messages: OllamaChatMessage[];
  baseUrl?: string;
  stream?: boolean;
  format?: "json" | Record<string, unknown>;
  options?: Record<string, unknown>;
  signal?: AbortSignal;
  onToken?: (delta: string) => void;
}

/**
 * Sends a chat request to the local Ollama instance (/api/chat).
 * Supports streaming and token delta callbacks as well as non-streaming responses.
 */
export async function sendOllamaChat(opts: SendChatOptions): Promise<string> {
  const baseUrl = (opts.baseUrl ?? DEFAULT_OLLAMA_URL).replace(/\/$/, "");
  const payload: OllamaChatRequest = {
    model: opts.model,
    messages: opts.messages,
    stream: opts.stream ?? Boolean(opts.onToken),
    format: opts.format,
    options: opts.options,
  };

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: opts.signal,
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed with HTTP ${res.status}: ${res.statusText}`);
  }

  if (payload.stream && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const json: OllamaChatResponse = JSON.parse(trimmed);
          const delta = json.message?.content;
          if (delta) {
            full += delta;
            opts.onToken?.(delta);
          }
        } catch {
          /* skip malformed lines in stream */
        }
      }
    }
    return full;
  }

  const json: OllamaChatResponse = await res.json();
  return json.message?.content ?? "";
}
