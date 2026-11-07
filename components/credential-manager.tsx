"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useEffect, useState } from "react";
import { CopyIcon } from "@/components/icons";
import { Button, Card, TextField } from "@/components/ui";
import { apiFetch } from "@/lib/api";

type Credential = {
  id: string;
  clientId: string;
  secretPrefix: string;
  name: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

export function CredentialManager() {
  const { client } = useSmartWallets();
  const wallet = client?.account?.address ?? "";
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Credential[]>([]);
  const [created, setCreated] = useState<{ clientId: string; secret: string } | null>(null);
  const [copied, setCopied] = useState<"id" | "secret" | null>(null);
  const [error, setError] = useState("");

  function load() {
    if (!wallet) return;
    void apiFetch(`/api/credentials?wallet=${wallet}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("credentials");
        return (await response.json()) as { credentials?: Credential[] };
      })
      .then((payload) => setRows(payload.credentials ?? []))
      .catch(() => setError("Credentials could not be loaded."));
  }

  useEffect(() => {
    load();
  }, [wallet]);

  async function createCredential() {
    setError("");
    setCreated(null);
    const response = await apiFetch("/api/credentials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet, name }),
    });
    const payload = (await response.json()) as { clientId?: string; secret?: string; message?: string };
    if (!response.ok || !payload.clientId || !payload.secret) {
      setError(payload.message ?? "Could not create the credential.");
      return;
    }
    setCreated({ clientId: payload.clientId, secret: payload.secret });
    setCopied(null);
    setName("");
    load();
  }

  function copyValue(kind: "id" | "secret", value: string) {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 2000);
    });
  }

  function maskSecret(secret: string) {
    if (secret.length <= 12) return secret;
    return `${secret.slice(0, 6)}...${secret.slice(-4)}`;
  }

  async function revoke(id: string) {
    await apiFetch(`/api/credentials/${id}?wallet=${wallet}`, { method: "DELETE" });
    load();
  }

  return (
    <Card className="mt-4">
      <h2 className="font-sans text-lg font-semibold text-foreground">API credentials</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        External calls use Authorization Basic with the client id and secret. The secret is shown once.
      </p>
      <div className="mt-4 grid gap-3">
        <TextField id="credential-name" label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        <Button disabled={!wallet || name.trim().length === 0} onClick={() => void createCredential()}>
          Create credential
        </Button>
        {created ? (
          <div className="rounded-2xl bg-muted p-3 text-sm">
            <p className="font-semibold text-foreground">Copy the secret now. It will not be shown again.</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="min-w-0 break-all font-mono text-xs">client id: {created.clientId}</p>
              <Button variant="quiet" className="min-h-9 shrink-0 px-3 text-sm" onClick={() => copyValue("id", created.clientId)}>
                <CopyIcon />
                {copied === "id" ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="min-w-0 font-mono text-xs">secret: {maskSecret(created.secret)}</p>
              <Button variant="quiet" className="min-h-9 shrink-0 px-3 text-sm" onClick={() => copyValue("secret", created.secret)}>
                <CopyIcon />
                {copied === "secret" ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <ul className="mt-4 grid gap-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{row.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {row.clientId} · {row.secretPrefix}
              </p>
            </div>
            {row.revokedAt ? (
              <span className="text-xs text-muted-foreground">Revoked</span>
            ) : (
              <Button variant="quiet" onClick={() => void revoke(row.id)}>
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
