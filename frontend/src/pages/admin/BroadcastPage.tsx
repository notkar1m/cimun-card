import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { isApiError } from "../../auth/AuthContext";
import { Alert, Button, TextInput } from "../../components/ui";

export function BroadcastPage() {
  const { data } = useQuery({
    queryKey: ["admin", "broadcast"],
    queryFn: () => api.get<{ recipientCount: number }>("/admin/broadcast"),
  });

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const recipientCount = data?.recipientCount ?? null;

  async function handleSend() {
    if (
      !confirm(
        `Send this email to all ${recipientCount ?? ""} delegates? This can't be undone once sent.`
      )
    ) {
      return;
    }
    setError(null);
    setSuccess(null);
    setSending(true);
    try {
      const res = await api.post<{ recipientCount: number }>("/admin/broadcast", {
        subject,
        message,
      });
      setSuccess(`Sending to ${res.recipientCount} delegates now.`);
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page-narrow" style={{ padding: "8px 16px" }}>
      <h1>Email all delegates</h1>
      <p className="muted" style={{ marginTop: -12 }}>
        {recipientCount === null ? "Loading recipient count..." : `Sends to ${recipientCount} delegates.`}
      </p>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <div className="card">
        <TextInput
          id="broadcastSubject"
          label="Subject"
          required
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <div className="field">
          <label htmlFor="broadcastMessage">Message</label>
          <textarea
            id="broadcastMessage"
            required
            rows={8}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write the message delegates will receive..."
          />
        </div>
        <Button
          type="button"
          onClick={handleSend}
          disabled={sending || !subject || !message || !recipientCount}
        >
          {sending ? "Sending..." : "Send to all delegates"}
        </Button>
      </div>
    </div>
  );
}
