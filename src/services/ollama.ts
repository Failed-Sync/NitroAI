/* Service for local Ollama instance detection, model discovery, and health checks. */

import type { OllamaStatus, OllamaTagsResponse } from "../types/ollama";
import { getEnginePrefs } from "../lib/prefs";

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const TIMEOUT_MS = 3000;

/**
 * Checks if the local Ollama instance is active and answering on /api/tags.
 * Never throws; returns false on any network failure or timeout.
 */
export async function isOllamaRunning(baseUrl = DEFAULT_OLLAMA_URL): Promise<boolean> {
  try {
    const cleanUrl = baseUrl.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetches the list of all installed/pulled models in Ollama.
 * Returns an array of model names (e.g. ["mistral:latest", "llama2:latest"]).
 * Returns an empty array on error or timeout without throwing.
 */
export async function getAvailableModels(baseUrl = DEFAULT_OLLAMA_URL): Promise<string[]> {
  try {
    const cleanUrl = baseUrl.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];

    const data: OllamaTagsResponse = await res.json();
    if (!data || !Array.isArray(data.models)) return [];

    return data.models.map((m) => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Validates connection to the local Ollama instance.
 * Intended for explicit user-triggered connection testing.
 */
export async function testConnection(baseUrl = DEFAULT_OLLAMA_URL): Promise<boolean> {
  return isOllamaRunning(baseUrl);
}

/**
 * Performs a comprehensive status check on the local Ollama instance.
 * Returns running state, installed models list, any error description, and currently selected model.
 */
export async function getOllamaStatus(baseUrl = DEFAULT_OLLAMA_URL): Promise<OllamaStatus> {
  const cleanUrl = baseUrl.replace(/\/$/, "");
  const selectedModel = getEnginePrefs().localModel || undefined;

  try {
    const res = await fetch(`${cleanUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      return {
        running: false,
        models: [],
        error: `Ollama returned status ${res.status}.`,
        selectedModel,
      };
    }

    const data: OllamaTagsResponse = await res.json();
    const models = Array.isArray(data?.models)
      ? data.models.map((m) => m.name).filter(Boolean)
      : [];

    return {
      running: true,
      models,
      selectedModel,
    };
  } catch (err) {
    const errorMsg =
      err instanceof Error && err.name === "TimeoutError"
        ? "Connection to Ollama timed out."
        : "Ollama not detected. Install from https://ollama.com";

    return {
      running: false,
      models: [],
      error: errorMsg,
      selectedModel,
    };
  }
}
