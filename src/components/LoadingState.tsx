type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Loading" }: LoadingStateProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-300">
      <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
      <span>{label}</span>
    </div>
  );
}
