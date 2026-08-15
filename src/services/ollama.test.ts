import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAvailableModels,
  getOllamaStatus,
  isOllamaRunning,
  testConnection,
} from "./ollama";
import { sendOllamaChat } from "./api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return vi.fn(impl);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("src/services/ollama.ts", () => {
  describe("isOllamaRunning()", () => {
    it("returns true when /api/tags responds with HTTP 200", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch(async () => jsonResponse({ models: [{ name: "mistral:latest" }] })),
      );

      const running = await isOllamaRunning();
      expect(running).toBe(true);
    });

    it("returns false when /api/tags responds with non-200 status", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch(async () => jsonResponse({ error: "server error" }, 500)),
      );

      const running = await isOllamaRunning();
      expect(running).toBe(false);
    });

    it("returns false on network fetch rejection without throwing", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch(async () => {
          throw new TypeError("Failed to fetch");
        }),
      );

      const running = await isOllamaRunning();
      expect(running).toBe(false);
    });
  });

  describe("getAvailableModels()", () => {
    it("returns all model names extracted from /api/tags", async () => {
      const mockTags = {
        models: [
          { name: "mistral:latest", size: 4109028352 },
          { name: "llama2:latest", size: 3826160640 },
          { name: "neural-chat:latest", size: 4109028352 },
        ],
      };
      vi.stubGlobal("fetch", mockFetch(async () => jsonResponse(mockTags)));

      const models = await getAvailableModels();
      expect(models).toEqual(["mistral:latest", "llama2:latest", "neural-chat:latest"]);
    });

    it("returns empty array on error without throwing", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch(async () => {
          throw new Error("Network offline");
        }),
      );

      const models = await getAvailableModels();
      expect(models).toEqual([]);
    });

    it("returns empty array when models response is invalid/empty", async () => {
      vi.stubGlobal("fetch", mockFetch(async () => jsonResponse({})));

      const models = await getAvailableModels();
      expect(models).toEqual([]);
    });
  });

  describe("testConnection()", () => {
    it("returns true when connection succeeds", async () => {
      vi.stubGlobal("fetch", mockFetch(async () => jsonResponse({ models: [] })));
      const ok = await testConnection();
      expect(ok).toBe(true);
    });

    it("returns false when connection fails", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch(async () => {
          throw new Error("Connection refused");
        }),
      );
      const ok = await testConnection();
      expect(ok).toBe(false);
    });
  });

  describe("getOllamaStatus()", () => {
    it("returns running: true and models list when Ollama is reachable", async () => {
      const mockTags = {
        models: [{ name: "mistral:latest" }, { name: "qwen2.5:3b" }],
      };
      vi.stubGlobal("fetch", mockFetch(async () => jsonResponse(mockTags)));

      const status = await getOllamaStatus();
      expect(status.running).toBe(true);
      expect(status.models).toEqual(["mistral:latest", "qwen2.5:3b"]);
      expect(status.error).toBeUndefined();
    });

    it("returns running: false and helpful error message when Ollama is unreachable", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch(async () => {
          throw new TypeError("Failed to fetch");
        }),
      );

      const status = await getOllamaStatus();
      expect(status.running).toBe(false);
      expect(status.models).toEqual([]);
      expect(status.error).toContain("Ollama not detected. Install from https://ollama.com");
    });
  });
});

describe("src/services/api.ts", () => {
  it("sendOllamaChat sends POST request to /api/chat with model and messages", async () => {
    const fetchMock = mockFetch(async () =>
      jsonResponse({
        model: "mistral:latest",
        message: { role: "assistant", content: "Hello there!" },
        done: true,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendOllamaChat({
      model: "mistral:latest",
      messages: [{ role: "user", content: "Hi" }],
      stream: false,
    });

    expect(result).toBe("Hello there!");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:11434/api/chat");
    const body = JSON.parse(init?.body as string);
    expect(body.model).toBe("mistral:latest");
    expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
  });
});
