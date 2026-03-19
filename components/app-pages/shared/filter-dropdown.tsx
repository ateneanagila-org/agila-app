type FilterDropdownProps = {
  label: string;
  options: string[];
  defaultValue?: string;
  className?: string;
};

export function FilterDropdown({
  label,
  options,
  defaultValue,
  className = "",
}: FilterDropdownProps) {
  const safeOptions = options.length > 0 ? options : ["No options available"];

  return (
    <label className={`flex w-full flex-col gap-1 ${className}`}>
      <span className="text-xs font-semibold text-slate-800">{label}</span>
      <div className="relative rounded-lg bg-white ring-1 ring-slate-300">
        <select
          defaultValue={defaultValue ?? safeOptions[0]}
          className="h-10 w-full appearance-none rounded-lg bg-white px-3 pr-10 text-sm font-medium text-slate-900"
          aria-label={label}
        >
          {safeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-600">
          ▼
        </span>
      </div>
    </label>
  );
}
