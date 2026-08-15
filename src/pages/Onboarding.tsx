import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Cloud, Cpu, KeyRound, PenLine } from "lucide-react";
import { detectProvider, saveApiKey } from "../lib/engine/keys";
import { getEnginePrefs } from "../lib/prefs";
import { getAvailableModels, getOllamaStatus } from "../services/ollama";
import { useApp } from "../lib/app";
import type { EngineMode } from "../lib/types";

export default function Onboarding() {
  const navigate = useNavigate();
  const { savePrefs } = useApp();
  /* No default — the user must make an explicit choice. */
  const [mode, setMode] = useState<EngineMode | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provider = detectProvider(apiKey.trim());
  const ready = mode === "local" || (mode === "cloud" && provider !== null);

  function enter(nextMode: EngineMode, chatModel?: string) {
    const prefs = getEnginePrefs();
    savePrefs({
      ...prefs,
      mode: nextMode,
      onboarded: true,
      localModel: chatModel ?? prefs.localModel,
    });
    navigate("/", { replace: true });
  }

  async function finish() {
    if (!mode || busy) return;
    setBusy(true);
    setError(null);

    if (mode === "cloud") {
      await saveApiKey(apiKey.trim());
      enter("cloud");
      setBusy(false);
      return;
    }

    // Local mode: detect local Ollama instance without forcing downloads
    const status = await getOllamaStatus();
    if (!status.running) {
      setError(status.error || "Ollama not detected. Install and start Ollama from https://ollama.com");
      setBusy(false);
      return;
    }

    const available = status.models.length > 0 ? status.models : await getAvailableModels();
    const prefs = getEnginePrefs();
    let chosenModel = prefs.localModel;

    if (available.length > 0) {
      if (!chosenModel || !available.includes(chosenModel)) {
        chosenModel = available[0];
      }
    }

    enter("local", chosenModel || undefined);
    setBusy(false);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-bg px-6">
      <div className="flex items-center gap-2">
        <PenLine className="size-7 text-accent" />
        <span className="font-display text-2xl font-bold tracking-tight">nitro ai</span>
      </div>
      <h1 className="mt-6 text-center font-display text-4xl font-bold">
        How do you want your AI to run?
      </h1>
      <p className="mt-2 max-w-lg text-center text-ink-dim">
        Pick the engine that fits you. There's no wrong answer — you can switch
        anytime in Settings.
      </p>

      <div className="mt-10 grid w-full max-w-3xl gap-4 md:grid-cols-2">
        <ModeCard
          active={mode === "local"}
          onClick={() => {
            setMode("local");
            setError(null);
          }}
          icon={Cpu}
          title="Fully local"
          body="Everything runs on this device via your local Ollama instance — private, offline, zero cost. Connects directly to Ollama running on your machine."
        />
        <ModeCard
          active={mode === "cloud"}
          onClick={() => {
            setMode("cloud");
            setError(null);
          }}
          icon={Cloud}
          title="Bring your own key"
          body="Use your OpenAI or Anthropic key for the highest-quality notes, quizzes, chat, and voices. You pay your provider directly — no NitroAI subscription, ever."
        />
      </div>

      {mode === "cloud" && (
        <div className="mt-6 w-full max-w-3xl">
          <div className="flex items-center gap-2 rounded-xl border border-edge bg-card px-4 py-3 shadow-soft">
            <KeyRound className="size-4 text-ink-faint" />
            <input
              autoFocus
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... or sk-ant-..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
            />
            {provider && (
              <span className="shrink-0 rounded-full bg-accent-softer px-3 py-1 text-xs font-bold text-accent">
                {provider === "anthropic" ? "Anthropic" : "OpenAI"}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            Stored in your system keychain. One key powers every feature.
          </p>
        </div>
      )}

      {error && mode === "local" && (
        <div className="mt-6 flex w-full max-w-3xl items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-soft dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          <AlertCircle className="size-5 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-semibold">{error}</p>
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">
              Make sure Ollama is installed and running on <code>localhost:11434</code>, then click <strong>Get started</strong> again.
            </p>
          </div>
        </div>
      )}

      <button
        onClick={finish}
        disabled={!ready || busy}
        className={`mt-10 w-full max-w-3xl rounded-xl py-3.5 font-display font-bold transition ${
          ready && !busy
            ? "bg-accent text-white hover:bg-accent-hover"
            : "cursor-not-allowed bg-accent-softer text-ink-faint"
        }`}
      >
        {busy ? "Connecting…" : "Get started"}
      </button>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Cpu;
  title: string;
  body: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-card border-2 p-6 text-left shadow-soft transition ${
        active ? "border-accent bg-accent-softer" : "border-edge bg-card hover:bg-card-hover"
      }`}
    >
      <Icon className={`size-7 ${active ? "text-accent" : "text-ink-dim"}`} />
      <h2 className="mt-3 font-display text-xl font-bold">{title}</h2>
      <p className="mt-1.5 text-sm text-ink-dim">{body}</p>
    </button>
  );
}
