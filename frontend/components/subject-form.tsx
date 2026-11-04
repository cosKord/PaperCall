"use client";

import { FormEvent, useState } from "react";

import { Plus } from "@/components/icons";
import { apiFetch } from "@/lib/api-client";
import { useBranches } from "@/lib/use-branches";

const inputClass =
  "mt-1.5 min-h-11 w-full border-2 border-ink bg-white px-3 py-2.5 outline-none focus:ring-3 focus:ring-violet/30";

export function SubjectForm({
  defaultBranch,
  onCreated,
}: {
  defaultBranch?: string;
  onCreated: () => Promise<void>;
}) {
  const { branches } = useBranches();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const branches = form.getAll("branches").map(String);
    const starts = new Date(String(form.get("starts_at")));
    const ends = new Date(String(form.get("ends_at")));

    try {
      await apiFetch("/api/admin/markets", {
        method: "POST",
        body: JSON.stringify({
          subject: form.get("subject"),
          exam_type: form.get("exam_type"),
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          home_branches: branches,
          branch_starts: Object.fromEntries(
            branches.map((branch) => [branch, starts.toISOString()]),
          ),
        }),
      });
      setOpen(false);
      await onCreated();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create subject",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        className="mt-8 inline-flex min-h-12 items-center gap-2 border-2 border-ink bg-acid px-4 py-3 font-extrabold text-ink shadow-[4px_4px_0_#111] transition-transform hover:-translate-y-0.5"
        onClick={() => setOpen(true)}
      >
        <Plus /> Add a subject
      </button>
    );
  }

  return (
    <section className="mt-8 border-2 border-ink bg-surface p-[clamp(20px,4vw,36px)] shadow-[6px_6px_0_#111]">
      <div className="mb-7 flex items-start justify-between gap-5">
        <div>
          <h2 className="m-0 text-2xl font-black">Add subject</h2>
          <p className="mb-0 text-ink-soft">
            Create the exam first, then add its prediction markets.
          </p>
        </div>
        <button
          className="border-0 bg-transparent p-1 font-bold text-violet underline underline-offset-4"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>

      <form className="grid gap-5" onSubmit={createSubject}>
        <label className="font-bold">
          Subject name
          <input
            className={inputClass}
            name="subject"
            required
            placeholder="Database Management Systems"
          />
        </label>

        <label className="font-bold">
          Exam type
          <select className={inputClass} name="exam_type" defaultValue="midsem">
            <option value="midsem">Midsem</option>
            <option value="endsem">Endsem</option>
            <option value="other">Other</option>
          </select>
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="font-bold">
            Calls close / exam starts
            <input
              className={inputClass}
              name="starts_at"
              type="datetime-local"
              required
            />
          </label>

          <label className="font-bold">
            Exam ends
            <input
              className={inputClass}
              name="ends_at"
              type="datetime-local"
              required
            />
          </label>
        </div>

        <fieldset className="border-0 p-0">
          <legend className="mb-2 font-bold">Branches</legend>

          <div className="flex flex-wrap gap-2">
            {branches.map((branch) => (
              <label
                className="cursor-pointer border-2 border-ink bg-white px-3 py-2 text-sm font-bold has-[:checked]:bg-acid"
                key={branch}
              >
                <input
                  className="sr-only"
                  type="checkbox"
                  name="branches"
                  value={branch}
                  defaultChecked={
                    defaultBranch ? branch === defaultBranch : true
                  }
                />
                <span>{branch}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p
            className="m-0 border-2 border-ink bg-[#ffe4df] p-3 font-bold text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
        <button
          className="min-h-12 justify-self-start border-2 border-ink bg-acid px-4 py-3 font-extrabold text-ink shadow-[4px_4px_0_#111] disabled:opacity-50"
          disabled={busy}
        >
          {busy ? "Creating." : "Confirm subject"}
        </button>
      </form>
    </section>
  );
}
