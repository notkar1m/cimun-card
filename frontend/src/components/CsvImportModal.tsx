import { useRef, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { isApiError } from "../auth/AuthContext";
import { Alert, Button, Modal } from "./ui";

interface BulkImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

export interface CsvColumn {
  name: string;
  note: string;
}

interface CsvImportModalProps<T extends BulkImportResult> {
  title: string;
  endpoint: string;
  columns: CsvColumn[];
  resultNoun: string;
  onClose: () => void;
  onImported: () => void;
  // Extra content rendered below the summary — e.g. a table of per-row
  // detail the API returned that a plain "X created" count can't show.
  renderExtra?: (result: T) => ReactNode;
}

export function CsvImportModal<T extends BulkImportResult = BulkImportResult>({
  title,
  endpoint,
  columns,
  resultNoun,
  onClose,
  onImported,
  renderExtra,
}: CsvImportModalProps<T>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    setError(null);
    setResult(null);
    setUploading(true);
    try {
      const csv = await file.text();
      const res = await api.post<T>(endpoint, { csv });
      setResult(res);
      if (res.created > 0) {
        onImported();
      }
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted" style={{ marginTop: -4 }}>
        The file's first row should be a header, and columns must appear in this order:
      </p>
      <ol className="csv-columns">
        {columns.map((col, i) => (
          <li key={col.name}>
            <span className="csv-col-index">{i + 1}.</span>
            <code>{col.name}</code>
            <span className="csv-col-note">— {col.note}</span>
          </li>
        ))}
      </ol>

      {error && <Alert type="error">{error}</Alert>}

      {result && (
        <Alert type={result.errors.length === 0 ? "success" : "error"}>
          {result.created} {resultNoun}
          {result.created === 1 ? "" : "s"} created
          {result.errors.length > 0 ? `, ${result.errors.length} row${result.errors.length === 1 ? "" : "s"} had a problem (see below).` : "."}
        </Alert>
      )}

      {result && renderExtra?.(result)}

      {result && result.errors.length > 0 && (
        <ul className="csv-import-errors">
          {result.errors.map((e) => (
            <li key={e.row}>
              Row {e.row}: {e.message}
            </li>
          ))}
        </ul>
      )}

      <div
        className="csv-dropzone"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{ marginTop: 16 }}
      >
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleInputChange} />
        <p style={{ margin: 0, fontWeight: 600 }}>
          {uploading ? "Uploading..." : fileName ?? "Click to choose a CSV file, or drop it here"}
        </p>
      </div>

      <div className="row" style={{ marginTop: 18, justifyContent: "flex-end" }}>
        <Button type="button" variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
