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
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <select
        defaultValue={defaultValue ?? options[0]}
        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}