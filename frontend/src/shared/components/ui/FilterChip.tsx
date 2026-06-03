interface Props {
  label:    string;
  active:   boolean;
  onClick:  () => void;
}

export function FilterChip({ label, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
        active
          ? 'border-primary bg-primary text-white'
          : 'border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary'
      }`}
    >
      {label}
    </button>
  );
}
