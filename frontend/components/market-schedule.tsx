export function MarketSchedule({
  startsAt,
  endsAt,
}: {
  startsAt: string;
  endsAt: string | null;
}) {
  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-ink-soft">
      <div className="flex gap-1.5">
        <dt className="font-bold uppercase text-ink">Exam starts:</dt>
        <dd className="m-0">
          <time dateTime={startsAt}>{formatDateTime(startsAt)}</time>
        </dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="font-bold uppercase text-ink">Exam ends:</dt>
        <dd className="m-0">
          {endsAt ? (
            <time dateTime={endsAt}>{formatDateTime(endsAt)}</time>
          ) : (
            "Not set"
          )}
        </dd>
      </div>
    </dl>
  );
}
