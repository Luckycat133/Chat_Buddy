import React, { useState, useEffect } from "react";
import {
  X,
  Server,
  Key,
  Cpu,
  Thermometer,
  Zap,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import {
  getConfig,
  saveConfig,
  clearConfig,
  validateConfig,
  getProfiles,
  saveProfile,
  deleteProfile,
  loadProfile,
} from "../config/apiConfig";
import { resetAIClient } from "../services/api/aiClient";
import { cn } from "../utils/cn";
import { useFocusTrap } from "../hooks/useFocusTrap";

// Common model suggestions for the datalist
const COMMON_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
  "gemini-2.0-flash",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "deepseek-chat",
  "deepseek-reasoner",
  "qwen-max",
  "qwen-turbo",
  "glm-4",
  "moonshot-v1-8k",
  "nvidia/nemotron-3.5-lightning:free",
];

// Quick-fill provider presets
const PROVIDER_PRESETS = [
  { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "nvidia/nemotron-3.5-lightning:free" },
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
  { label: "Anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-3-5-sonnet-20241022" },
  { label: "Google", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash" },
  { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { label: "本地/Ollama", baseUrl: "http://localhost:11434/v1", model: "llama3" },
];

export default function ApiConfigPanel({ onClose }) {
  const { t } = useLanguage();
  const [config, setConfig] = useState(getConfig);
  const [profiles, setProfiles] = useState(getProfiles);
  const [testStatus, setTestStatus] = useState(null); // null | 'testing' | {valid,error,latency}
  const [saved, setSaved] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [showProfileInput, setShowProfileInput] = useState(false);
  const panelRef = useFocusTrap(true, onClose);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, panelRef]);

  const updateField = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
    setTestStatus(null);
  };

  const handleSave = () => {
    saveConfig(config);
    resetAIClient();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    clearConfig();
    resetAIClient();
    setConfig(getConfig());
    setTestStatus(null);
  };

  const handleTest = async () => {
    if (!config.baseUrl || !config.apiKey || !config.model) {
      setTestStatus({ valid: false, error: t("missing_fields") });
      return;
    }
    setTestStatus("testing");
    const result = await validateConfig(config);
    setTestStatus(result);
  };

  const handleSaveProfile = () => {
    if (!profileName.trim()) return;
    const updated = saveProfile(profileName.trim(), {
      baseUrl: config.baseUrl,
      model: config.model,
      temperature: config.temperature,
    });
    setProfiles(updated);
    setProfileName("");
    setShowProfileInput(false);
  };

  const handleLoadProfile = (name) => {
    loadProfile(name);
    resetAIClient();
    setConfig(getConfig());
    setTestStatus(null);
  };

  const handleDeleteProfile = (name) => {
    setProfiles(deleteProfile(name));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label={t("close") || "Close"}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-config-title"
        className="relative z-10 bg-[var(--color-bg-white)] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl animate-scale-in"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--color-bg-white)] flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div>
            <h2 id="api-config-title" className="text-lg font-bold text-[var(--color-text-main)]">
              {t("api_config")}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              {t("api_config_desc")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("close") || "Close"}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <X size={20} className="text-[var(--color-text-muted)]" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Base URL */}
          <FieldGroup
            icon={<Server size={16} />}
            label={t("api_base_url")}
            required
          >
            <input
              type="url"
              value={config.baseUrl}
              onChange={(e) => updateField("baseUrl", e.target.value)}
              placeholder={t("api_base_url_placeholder")}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-main)] text-sm outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-light)]"
            />
          </FieldGroup>

          {/* API Key */}
          <FieldGroup icon={<Key size={16} />} label={t("api_key")} required>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => updateField("apiKey", e.target.value)}
              placeholder={t("api_key_placeholder")}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-main)] text-sm outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-light)]"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
              {t("api_key_session_notice")}
            </p>
          </FieldGroup>

          {/* Model */}
          <FieldGroup icon={<Cpu size={16} />} label={t("model_name")} required>
            <div className="relative">
              <input
                type="text"
                list="model-suggestions"
                value={config.model}
                onChange={(e) => updateField("model", e.target.value)}
                placeholder={t("model_name_placeholder") || "e.g. gpt-4o"}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-main)] text-sm outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-light)] pr-8"
              />
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-light)] pointer-events-none" />
              <datalist id="model-suggestions">
                {COMMON_MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </FieldGroup>

          {/* Quick-fill Provider Presets */}
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">
              {t("quick_fill_provider") || "一键填入 / Quick Fill Provider"}
            </p>
            <div className="flex flex-wrap gap-2">
              {PROVIDER_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setConfig((prev) => ({ ...prev, baseUrl: p.baseUrl, model: p.model }));
                    setSaved(false);
                    setTestStatus(null);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <FieldGroup
            icon={<Thermometer size={16} />}
            label={`${t("temperature")}: ${config.temperature}`}
          >
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={config.temperature}
              onChange={(e) =>
                updateField("temperature", parseFloat(e.target.value))
              }
              className="w-full accent-[var(--color-primary)]"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {t("temperature_desc")}
            </p>
          </FieldGroup>

          {/* Test Connection */}
          <div className="flex gap-3">
            <button
              onClick={handleTest}
              disabled={testStatus === "testing"}
              className={cn(
                "flex-1 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all",
                testStatus === "testing"
                  ? "bg-[var(--color-bg-app)] text-[var(--color-text-muted)] cursor-wait"
                  : "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]",
              )}
            >
              {testStatus === "testing" ? (
                <>
                  <Loader2 size={16} className="animate-spin" />{" "}
                  {t("testing_connection")}
                </>
              ) : (
                <>
                  <Zap size={16} /> {t("test_connection")}
                </>
              )}
            </button>
          </div>

          {/* Test Result */}
          {testStatus && testStatus !== "testing" && (
            <div
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl text-sm",
                testStatus.valid
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200",
              )}
            >
              {testStatus.valid ? (
                <Check size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              {testStatus.valid
                ? t("connection_success", { latency: testStatus.latency })
                : t("connection_failed", { error: testStatus.error })}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2"
            >
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? t("config_saved") : t("save_config")}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl font-medium text-sm bg-[var(--color-bg-app)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-all flex items-center gap-2"
            >
              <RotateCcw size={16} /> {t("reset_config")}
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--color-border)]" />

          {/* Provider Profiles */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[var(--color-text-main)]">
                {t("provider_profiles")}
              </h3>
              <button
                onClick={() => setShowProfileInput(!showProfileInput)}
                className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <Plus size={16} className="text-[var(--color-primary)]" />
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              {t("provider_profiles_security_notice")}
            </p>

            {showProfileInput && (
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder={t("profile_name_placeholder")}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-main)] text-sm outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-light)] flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()}
                />
                <button
                  onClick={handleSaveProfile}
                  className="px-3 py-2 rounded-lg bg-[var(--color-primary)] text-[var(--color-on-primary)] text-sm font-medium"
                >
                  {t("save")}
                </button>
              </div>
            )}

            {profiles.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-4">
                {t("no_profiles")}
              </p>
            ) : (
              <div className="space-y-2">
                {profiles.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--color-bg-app)] border border-[var(--color-border-light)]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-main)] truncate">
                        {p.name}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">
                        {p.config.model}
                      </p>
                    </div>
                    <button
                      onClick={() => handleLoadProfile(p.name)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-medium hover:bg-[var(--color-primary)]/20"
                    >
                      {t("load_profile")}
                    </button>
                    <button
                      onClick={() => handleDeleteProfile(p.name)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Reusable form field wrapper */
function FieldGroup({ icon, label, required, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-main)] mb-1.5">
        {icon}
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}
