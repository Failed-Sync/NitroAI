import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useApp } from "../lib/app";
import {
  DEFAULT_OLLAMA_URL,
  getAvailableModels,
  getOllamaStatus,
  testConnection,
} from "../services/ollama";

interface OllamaSettingsProps {
  onSaved?: (model: string) => void;
}

export default function OllamaSettings({ onSaved }: OllamaSettingsProps) {
  const { prefs, savePrefs } = useApp();

  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [testState, setTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState<string>("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [fallbackWarning, setFallbackWarning] = useState<string | null>(null);

  async function checkOllama(isMount = false) {
    setLoading(true);
    setTestState("idle");
    setTestMessage("");
    setSaveState("idle");
    setSaveMessage("");

    const status = await getOllamaStatus();
    setIsRunning(status.running);

    if (status.running) {
      const available = status.models.length > 0 ? status.models : await getAvailableModels();
      setModels(available);

      if (available.length > 0) {
        const saved = prefs.localModel;
        if (saved && available.includes(saved)) {
          setSelectedModel(saved);
        } else if (saved && !available.includes(saved)) {
          // Model previously chosen is no longer present
          const fallback = available[0];
          setSelectedModel(fallback);
          if (isMount) {
            setFallbackWarning(`Previous model "${saved}" not found. Switched to ${fallback}.`);
          }
        } else {
          // First run: default to first model in list
          setSelectedModel(available[0]);
        }
      } else {
        setSelectedModel("");
      }
    } else {
      setModels([]);
      setSelectedModel("");
    }
    setLoading(false);
  }

  useEffect(() => {
    void checkOllama(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTestConnection() {
    setTestState("testing");
    setTestMessage("");
    setSaveState("idle");
    setSaveMessage("");

    const ok = await testConnection();
    if (ok) {
      setTestState("success");
      setTestMessage("Connected to localhost:11434");
    } else {
      setTestState("error");
      setTestMessage("Ollama unreachable on localhost:11434");
    }
  }

  async function handleSave() {
    if (!selectedModel) return;

    setSaveState("saving");
    setSaveMessage("");
    setTestState("idle");
    setTestMessage("");

    // Automatically run connection test before saving (Decision Q3)
    const reachable = await testConnection();
    if (!reachable) {
      setSaveState("error");
      setSaveMessage("Connection test failed. Make sure Ollama is running before saving.");
      return;
    }

    savePrefs({
      ...prefs,
      mode: "local",
      localModel: selectedModel,
    });

    setSaveState("saved");
    setSaveMessage(`Connected to ${selectedModel} (using locally)`);
    setFallbackWarning(null);
    onSaved?.(selectedModel);

    setTimeout(() => {
      setSaveState("idle");
    }, 4000);
  }

  return (
    <div className="rounded-xl border border-edge bg-panel p-5 shadow-soft">
      <div className="flex items-center justify-between border-b border-edge pb-3.5">
        <div className="flex items-center gap-2">
          <Cpu className="size-5 text-accent" />
          <h3 className="font-display text-base font-bold text-ink">Local Model Selection</h3>
        </div>
        <button
          onClick={() => void checkOllama(false)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-edge bg-card px-2.5 py-1 text-xs font-semibold text-ink-dim shadow-soft hover:text-ink disabled:opacity-50"
          title="Refresh Ollama status"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin text-accent" : ""}`} />
          Refresh
        </button>
      </div>

      {fallbackWarning && (
        <div className="mt-3.5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="font-medium">{fallbackWarning}</span>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {/* Status section */}
        <div>
          <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Status</span>
          <div className="mt-1.5 flex items-center gap-2">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-ink-dim">
                <Loader2 className="size-4 animate-spin text-accent" />
                <span>Checking Ollama on localhost:11434…</span>
              </div>
            ) : isRunning ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-green-600 dark:text-green-500">
                <CheckCircle2 className="size-4.5" />
                <span>Ollama detected ({DEFAULT_OLLAMA_URL.replace(/^http:\/\//, "")})</span>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-danger-ink">
                  <XCircle className="size-4.5" />
                  <span>Ollama not detected</span>
                </div>
                <p className="text-xs text-ink-dim">
                  Ollama is not running on localhost:11434. Install and start Ollama from{" "}
                  <a
                    href="https://ollama.com"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-accent underline hover:text-accent-hover"
                  >
                    ollama.com
                  </a>
                  .
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Model dropdown */}
        {isRunning && (
          <div>
            <label htmlFor="ollama-model-select" className="block text-xs font-semibold text-ink-faint uppercase tracking-wider">
              Model
            </label>
            {models.length > 0 ? (
              <select
                id="ollama-model-select"
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  setSaveState("idle");
                  setSaveMessage("");
                  setTestState("idle");
                  setTestMessage("");
                }}
                className="mt-1.5 w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm font-medium text-ink outline-none focus:border-accent shadow-soft"
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-edge bg-card px-3 py-2.5 text-sm text-ink-faint">
                <AlertCircle className="size-4 text-amber-500" />
                <span>No models found in Ollama. Pull a model (e.g. <code>ollama pull mistral</code>) to begin.</span>
              </div>
            )}
          </div>
        )}

        {/* Buttons & Action Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={loading || testState === "testing" || saveState === "saving"}
            className="flex items-center gap-2 rounded-xl border border-edge bg-card px-4 py-2 text-sm font-semibold text-ink shadow-soft hover:bg-card-hover disabled:opacity-60"
          >
            {testState === "testing" ? (
              <>
                <Loader2 className="size-4 animate-spin text-accent" />
                <span>Testing…</span>
              </>
            ) : (
              <span>Test Connection</span>
            )}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={
              loading ||
              !isRunning ||
              !selectedModel ||
              testState === "testing" ||
              saveState === "saving"
            }
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-sm font-bold text-white shadow-soft hover:bg-accent-hover disabled:opacity-50"
          >
            {saveState === "saving" ? (
              <>
                <Loader2 className="size-4 animate-spin text-white" />
                <span>Validating & Saving…</span>
              </>
            ) : (
              <span>Save</span>
            )}
          </button>

          {/* Test connection inline status */}
          {testState === "success" && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-500">
              <CheckCircle2 className="size-4" />
              {testMessage || "Connection verified"}
            </span>
          )}
          {testState === "error" && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-danger-ink">
              <XCircle className="size-4" />
              {testMessage || "Connection failed"}
            </span>
          )}
        </div>

        {/* Save confirmation or failure message */}
        {saveState === "saved" && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 dark:bg-green-950/30 dark:text-green-300">
            <CheckCircle2 className="size-4" />
            <span>✓ {saveMessage}</span>
          </div>
        )}

        {saveState === "error" && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-danger-ink dark:bg-red-950/30">
            <XCircle className="size-4" />
            <span>{saveMessage}</span>
          </div>
        )}

        {/* Footer info */}
        {isRunning && selectedModel && saveState !== "saved" && (
          <p className="text-xs text-ink-faint">
            Current active model: <span className="font-semibold text-ink">{prefs.localModel || selectedModel}</span>
          </p>
        )}
      </div>
    </div>
  );
}
