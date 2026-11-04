"use client";

import { FormEvent, useState } from "react";

import { apiFetch } from "@/lib/api-client";

const actionClass =
  "block w-full rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-[#f0edf8] focus-visible:outline-2 focus-visible:outline-violet";

export function AdminBranchMenu({
  branch,
  onChanged,
}: {
  branch: string;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(branch);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/branches/${encodeURIComponent(branch)}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setRenaming(false);
      setOpen(false);
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not rename room");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the ${branch} room? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/branches/${encodeURIComponent(branch)}`, { method: "DELETE" });
      setOpen(false);
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not delete room");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute right-2 top-2 z-10" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button
        aria-expanded={open}
        aria-label={`Manage ${branch} room`}
        className="grid size-9 place-items-center border-2 border-ink bg-white text-lg font-black shadow-[2px_2px_0_#111] hover:bg-acid focus-visible:outline-2 focus-visible:outline-violet"
        onClick={() => { setOpen((value) => !value); setError(null); }}
        type="button"
      >
        ...
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-44 overflow-hidden rounded-lg border-2 border-ink bg-white py-1">
          <button className={actionClass} disabled={busy} onClick={() => setRenaming(true)} type="button">Rename</button>
          <button className={`${actionClass} text-violet`} onClick={() => setError("Room analytics are coming soon.")} type="button">Analytics</button>
          <button className={`${actionClass} text-danger`} disabled={busy} onClick={() => void remove()} type="button">Delete</button>
          {renaming && (
            <form className="grid gap-2 border-t-2 border-ink p-2" onSubmit={rename}>
              <label className="grid gap-1 text-xs font-bold">Room name
                <input autoFocus className="w-full rounded-md border-2 border-ink px-2 py-1.5" maxLength={40} minLength={2} onChange={(event) => setName(event.target.value)} value={name} />
              </label>
              <div className="flex gap-2">
                <button className="flex-1 rounded-md border-2 border-ink bg-acid px-2 py-1 font-bold" disabled={busy}>Save</button>
                <button className="rounded-md border-2 border-ink bg-white px-2 py-1 font-bold" onClick={() => setRenaming(false)} type="button">Cancel</button>
              </div>
            </form>
          )}
          {error && <p className="m-2 rounded-md border border-ink px-2 py-2 text-xs font-bold text-danger" role="status">{error}</p>}
        </div>
      )}
    </div>
  );
}
