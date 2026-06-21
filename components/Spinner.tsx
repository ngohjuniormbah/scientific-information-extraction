export default function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-[spin_0.7s_linear_infinite] rounded-full border-2 border-ink-600 border-t-accent align-[-2px] ${className}`}
      aria-hidden
    />
  );
}
