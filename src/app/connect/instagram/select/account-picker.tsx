"use client";

import { useState } from "react";

type AccountOption = {
  igUserId: string;
  username: string;
  pageName: string;
};

export function AccountPicker({ accounts }: { accounts: AccountOption[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectAccount(igUserId: string) {
    setError(null);
    setLoadingId(igUserId);
    try {
      const res = await fetch("/api/auth/instagram/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ igUserId }),
        redirect: "manual",
      });

      const location = res.headers.get("Location");
      if (location && [301, 302, 303, 307, 308].includes(res.status)) {
        window.location.assign(location);
        return;
      }

      if (!res.ok) {
        setError("Could not connect that account. Try again from Settings.");
        setLoadingId(null);
        return;
      }

      window.location.assign("/home");
    } catch {
      setError("Network error — try again.");
      setLoadingId(null);
    }
  }

  return (
    <>
      <div className="mt-8 flex flex-col gap-3">
        {accounts.map((account) => (
          <button
            key={account.igUserId}
            type="button"
            disabled={loadingId !== null}
            onClick={() => void selectAccount(account.igUserId)}
            className="rounded-xl border border-card-border bg-card px-5 py-4 text-left transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            <p className="font-black text-foreground">
              @{account.username || "instagram"}
            </p>
            {account.pageName ? (
              <p className="mt-0.5 text-xs text-muted">{account.pageName}</p>
            ) : null}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </>
  );
}
