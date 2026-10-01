import { useRef, useState } from "react";
import { api } from "../api/client";
import { isApiError } from "../auth/AuthContext";
import { Alert } from "./ui";

export interface BranchDraft {
  label: string;
  input: string;
  lat: number | null;
  lng: number | null;
}

interface BranchCsvResolveResult {
  resolved: { row: number; label: string; lat: number; lng: number }[];
  errors: { row: number; message: string }[];
}

function BranchRow({
  branch,
  onChange,
  onRemove,
  onResolvingChange,
}: {
  branch: BranchDraft;
  onChange: (branch: BranchDraft) => void;
  onRemove: () => void;
  onResolvingChange: (resolving: boolean) => void;
}) {
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(input: string) {
    onChange({ ...branch, input, lat: null, lng: null });
    setError(null);
    const trimmed = input.trim();
    if (!trimmed) return;

    setResolving(true);
    onResolvingChange(true);
    try {
      const coords = await api.post<{ lat: number; lng: number }>("/admin/offers/maps/resolve", {
        input: trimmed,
      });
      onChange({ ...branch, input, lat: coords.lat, lng: coords.lng });
    } catch (err) {
      setError(
        isApiError(err)
          ? err.message
          : "That link doesn't include exact coordinates. Try right-clicking the spot on Google Maps and copying the coordinates instead."
      );
    } finally {
      setResolving(false);
      onResolvingChange(false);
    }
  }

  return (
    <div className="branch-row">
      <div className="branch-row-fields">
        <input
          className="branch-row-label"
          placeholder="Branch label (e.g. Zamalek)"
          value={branch.label}
          onChange={(e) => onChange({ ...branch, label: e.target.value })}
        />
        <input
          placeholder="Paste a Google Maps link (or lat, lng)"
          value={branch.input}
          onChange={(e) => onChange({ ...branch, input: e.target.value, lat: null, lng: null })}
          onBlur={(e) => resolve(e.target.value)}
        />
        {resolving && <span className="branch-row-status">Locating...</span>}
        {!resolving && branch.lat != null && branch.lng != null && (
          <span className="branch-row-status branch-row-status-ok">
            Pinned at {branch.lat.toFixed(4)}, {branch.lng.toFixed(4)}
          </span>
        )}
        {!resolving && error && <span className="branch-row-status branch-row-status-error">{error}</span>}
      </div>
      <button type="button" className="branch-row-remove" onClick={onRemove} aria-label="Remove branch">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

export function BranchEditor({
  value,
  onChange,
  onResolvingChange,
}: {
  value: BranchDraft[];
  onChange: (value: BranchDraft[]) => void;
  // Lets the form know a branch's location lookup is still in flight, so it
  // can hold off on submitting rather than reading a stale lat/lng that's
  // about to be filled in a moment later.
  onResolvingChange?: (resolving: boolean) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resolvingCountRef = useRef(0);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvSummary, setCsvSummary] = useState<{ added: number; skippedRows: number[] } | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  function handleRowResolvingChange(isResolving: boolean) {
    resolvingCountRef.current += isResolving ? 1 : -1;
    onResolvingChange?.(resolvingCountRef.current > 0);
  }

  function updateBranch(index: number, branch: BranchDraft) {
    onChange(value.map((b, i) => (i === index ? branch : b)));
  }

  function addBranch() {
    onChange([...value, { label: "", input: "", lat: null, lng: null }]);
  }

  function removeBranch(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  async function handleCsvFile(file: File) {
    setCsvError(null);
    setCsvSummary(null);
    setCsvUploading(true);
    try {
      const csv = await file.text();
      const result = await api.post<BranchCsvResolveResult>("/admin/offers/maps/resolve-csv", { csv });
      const newRows: BranchDraft[] = result.resolved.map(({ label, lat, lng }) => ({
        label,
        input: `${lat}, ${lng}`,
        lat,
        lng,
      }));
      if (newRows.length > 0) {
        onChange([...value, ...newRows]);
      }
      setCsvSummary({ added: newRows.length, skippedRows: result.errors.map((e) => e.row) });
    } catch (err) {
      setCsvError(isApiError(err) ? err.message : "Couldn't read that file. Make sure it's a CSV.");
    } finally {
      setCsvUploading(false);
    }
  }

  function handleCsvInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleCsvFile(file);
    e.target.value = "";
  }

  return (
    <div className="field">
      <label>Branch locations (optional)</label>
      {value.length > 0 && (
        <div className="branch-list">
          {value.map((branch, i) => (
            <BranchRow
              key={i}
              branch={branch}
              onChange={(b) => updateBranch(i, b)}
              onRemove={() => removeBranch(i)}
              onResolvingChange={handleRowResolvingChange}
            />
          ))}
        </div>
      )}
      <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
        <button type="button" className="link-btn" onClick={addBranch}>
          + Add branch location
        </button>
        <button type="button" className="link-btn" onClick={() => fileInputRef.current?.click()} disabled={csvUploading}>
          {csvUploading ? "Uploading..." : "↑ Upload branches from CSV"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleCsvInputChange}
          style={{ display: "none" }}
        />
      </div>

      {csvError && (
        <div style={{ marginTop: 10 }}>
          <Alert type="error">{csvError}</Alert>
        </div>
      )}
      {csvSummary && (
        <div style={{ marginTop: 10 }}>
          <Alert type={csvSummary.skippedRows.length === 0 ? "success" : "error"}>
            {csvSummary.added} branch{csvSummary.added === 1 ? "" : "es"} added from the file
            {csvSummary.skippedRows.length > 0
              ? `, ${csvSummary.skippedRows.length} row${csvSummary.skippedRows.length === 1 ? "" : "s"} skipped (row${csvSummary.skippedRows.length === 1 ? "" : "s"} ${csvSummary.skippedRows.join(", ")} didn't resolve to a location).`
              : "."}
          </Alert>
        </div>
      )}

      <p className="muted" style={{ marginTop: 6 }}>
        The short link from "Share &rarr; Copy link" can't be resolved automatically &mdash; it doesn't
        carry coordinates, only a place name Google looks up. Instead, on Google Maps: right-click the
        exact spot and paste the coordinates shown at the top of the menu (most reliable), or open the
        place and copy the full URL from the address bar once it contains "@" followed by numbers.
        Each CSV row should be a label followed by its location: <code>label, lat, long</code> (or{" "}
        <code>label, Google Maps link</code>), with an optional header row.
      </p>
    </div>
  );
}
