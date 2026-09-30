import { useState, type KeyboardEvent } from "react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  label?: string;
}

export function TagInput({ value, onChange, suggestions = [], label = "Tags" }: TagInputProps) {
  const [draft, setDraft] = useState("");

  const availableSuggestions = suggestions.filter(
    (s) => !value.includes(s) && s.toLowerCase().includes(draft.trim().toLowerCase())
  );

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || value.includes(tag) || value.length >= 10) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  }

  return (
    <div className="field">
      <label htmlFor="tagInput">{label}</label>
      <div className="tag-input">
        {value.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            <button type="button" aria-label={`Remove ${tag}`} onClick={() => removeTag(tag)}>
              &times;
            </button>
          </span>
        ))}
        <input
          id="tagInput"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(draft)}
          placeholder={value.length === 0 ? "e.g. Food, Beverages..." : ""}
        />
      </div>
      {availableSuggestions.length > 0 && (
        <div className="tag-suggestions">
          {availableSuggestions.slice(0, 8).map((s) => (
            <button key={s} type="button" className="tag-suggestion" onClick={() => addTag(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
