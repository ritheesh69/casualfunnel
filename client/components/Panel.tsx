export default function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-md border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {note ? <p className="text-[13px] text-muted">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}
