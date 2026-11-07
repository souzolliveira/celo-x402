"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";

type Row = {
  id: string;
  status: string;
  reserved: string;
  amount: string | null;
  calls: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export function SpendSummary() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch("/api/v1/searches", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("searches");
        return (await response.json()) as { searches?: Row[] };
      })
        .then((payload) => setRows((payload.searches ?? []).filter((row) => row.status !== "cancelled")))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setRows([]);
      });
    return () => controller.abort();
  }, []);

  return (
    <Card className="mt-4">
      <h2 className="font-sans text-lg font-semibold text-foreground">Spends</h2>
      {rows === null ? <p className="mt-2 text-sm text-muted-foreground">Loading spends…</p> : null}
      {rows && rows.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No spends yet. Paid buy calls will show up here.</p> : null}
      {rows && rows.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className="text-sm text-foreground">
              <Link href={`/searches/${row.id}`} className="font-semibold underline">
                {row.amount ? `${row.amount} USDC` : `${row.reserved} USDC reserved`}
              </Link>
              <span className="text-muted-foreground">
                {" "}
                · {row.calls} {row.calls === 1 ? "call" : "calls"} · {when(row)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function when(row: Row): string {
  if (row.status === "pending") return `queued ${new Date(row.createdAt).toLocaleString()}`;
  if (row.status === "running") return `running since ${new Date(row.startedAt ?? row.createdAt).toLocaleString()}`;
  return new Date(row.startedAt ?? row.finishedAt ?? row.createdAt).toLocaleString();
}
