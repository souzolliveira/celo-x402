"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { completionText, SUMMARY_CAPABILITY } from "@/lib/summary";

type SearchSummary = {
  id: string;
  status: string;
  reserved: string;
  amount: string | null;
  calls: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  cancelledAt: string | null;
};

type SearchCall = {
  capabilityId: string;
  request: unknown;
  response: unknown;
  httpStatus: number;
  amount: string | null;
  summary: string | null;
  at: string;
};

type SearchDetail = {
  id: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  editionHtml: string;
  calls: SearchCall[];
};

export function SearchList() {
  const { client } = useSmartWallets();
  const wallet = client?.account?.address ?? "";
  const [rows, setRows] = useState<SearchSummary[]>([]);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState("");

  const load = useCallback(() => {
    const controller = new AbortController();
    void apiFetch("/api/v1/searches", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("searches");
        return (await response.json()) as { searches?: SearchSummary[] };
      })
      .then((payload) => setRows(payload.searches ?? []))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError("Searches could not be loaded.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    return load();
  }, [load]);

  async function cancel(id: string) {
    if (!wallet) return;
    setCancelling(id);
    setError("");
    try {
      const response = await apiFetch(`/api/v1/searches/${id}?wallet=${wallet}`, { method: "DELETE" });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? "This search could not be cancelled.");
        return;
      }
      load();
    } catch {
      setError("This search could not be cancelled.");
    } finally {
      setCancelling("");
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <Button variant="secondary" onClick={() => load()}>
          Refresh
        </Button>
      </div>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
      <ul className="grid gap-2">
        {rows.length === 0 ? <li className="text-sm text-muted-foreground">No searches yet.</li> : null}
        {rows.map((row) => (
          <li key={row.id} className="flex items-stretch gap-2">
            <Link href={`/searches/${row.id}`} className="block min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-left">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.status}</span>
              <span className="mt-1 block text-sm font-semibold text-foreground">
                {row.calls} {row.calls === 1 ? "call" : "calls"}
                {row.amount ? ` · ${row.amount} USDC` : row.status === "pending" ? ` · ${row.reserved} USDC reserved` : ""}
              </span>
              <span className="mt-2 block text-sm text-muted-foreground">
                Created {new Date(row.createdAt).toLocaleString()}
                {row.finishedAt ? ` · finished ${new Date(row.finishedAt).toLocaleString()}` : ""}
                {row.cancelledAt ? ` · cancelled ${new Date(row.cancelledAt).toLocaleString()}` : ""}
              </span>
            </Link>
            {row.status === "pending" ? (
              <Button variant="quiet" disabled={cancelling === row.id} onClick={() => void cancel(row.id)}>
                {cancelling === row.id ? "Cancelling…" : "Cancel"}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SearchDetailView({ id }: { id: string }) {
  const [detail, setDetail] = useState<SearchDetail | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [view, setView] = useState<"paper" | "raw">("paper");

  const load = useCallback(() => {
    const controller = new AbortController();
    void apiFetch(`/api/v1/searches/${id}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("search");
        return (await response.json()) as SearchDetail;
      })
      .then((payload) => setDetail(payload))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError("This search could not be loaded.");
      });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    return load();
  }, [load]);

  async function copy(call: SearchCall) {
    await navigator.clipboard.writeText(JSON.stringify(call.response, null, 2));
    setCopied(call.capabilityId + call.at);
  }

  return (
    <Card>
      <div className="mb-4">
        <Button variant="secondary" onClick={() => load()}>
          Refresh
        </Button>
      </div>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
      {!error && !detail ? <p className="text-sm text-muted-foreground">Loading search…</p> : null}
      {detail ? (
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            {detail.status} · created {new Date(detail.createdAt).toLocaleString()}
            {detail.startedAt ? ` · started ${new Date(detail.startedAt).toLocaleString()}` : ""}
            {detail.finishedAt ? ` · finished ${new Date(detail.finishedAt).toLocaleString()}` : ""}
          </p>
          {detail.error ? <p className="text-sm font-medium text-destructive">{detail.error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant={view === "paper" ? "primary" : "quiet"} pressed={view === "paper"} onClick={() => setView("paper")}>
              Paper
            </Button>
            <Button variant={view === "raw" ? "primary" : "quiet"} pressed={view === "raw"} onClick={() => setView("raw")}>
              Raw data
            </Button>
          </div>
          {view === "paper" ? <EditionFrame html={detail.editionHtml} /> : null}
          {view === "raw" && detail.calls.length === 0 ? <p className="text-sm text-muted-foreground">No calls yet.</p> : null}
          {view === "raw"
            ? detail.calls.map((call) => (
                <details key={call.capabilityId + call.at} className="rounded-2xl border border-border px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-foreground">
                    {call.capabilityId} · HTTP {call.httpStatus}
                    {call.amount ? ` · ${call.amount} USDC` : ""}
                  </summary>
                  <div className="mt-3 grid gap-3">
                    <CallBrief call={call} />
                    <Button variant="quiet" onClick={() => void copy(call)}>
                      {copied === call.capabilityId + call.at ? "Copied" : "Copy JSON"}
                    </Button>
                    <pre className="overflow-x-auto rounded-2xl bg-muted p-3 text-xs">{JSON.stringify(call.response, null, 2)}</pre>
                  </div>
                </details>
              ))
            : null}
        </div>
      ) : null}
    </Card>
  );
}

function EditionFrame({ html }: { html: string }) {
  const frame = useRef<HTMLIFrameElement>(null);

  function fit() {
    const node = frame.current;
    const doc = node?.contentDocument;
    if (!node || !doc) return;
    node.style.height = "0px";
    node.style.height = `${doc.documentElement.scrollHeight}px`;
  }

  if (!html.trim()) return <p className="text-sm text-muted-foreground">This search has no edition yet.</p>;
  return (
    <iframe
      ref={frame}
      title="Edition"
      sandbox="allow-same-origin"
      srcDoc={html}
      onLoad={fit}
      className="w-full rounded-2xl border border-border bg-[#f4f2ee]"
    />
  );
}

function CallBrief({ call }: { call: SearchCall }) {
  const brief = call.summary ?? (call.capabilityId === SUMMARY_CAPABILITY ? completionText(call.response) : null);
  if (!brief) return null;
  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{brief}</p>;
}
