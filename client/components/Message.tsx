export default function Message({
  title,
  children,
  tone = 'neutral',
}: {
  title: string;
  children?: React.ReactNode;
  tone?: 'neutral' | 'problem';
}) {
  return (
    <div className="px-5 py-10 text-center">
      <p className={`text-sm font-medium ${tone === 'problem' ? 'text-[#9a3b2e]' : 'text-ink'}`}>{title}</p>
      {children ? <div className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-muted">{children}</div> : null}
    </div>
  );
}
