import type { CountrySummary } from "@/types/country";

type CountryInfoPanelProps = {
  hoveredCountry: CountrySummary | null;
};

export function CountryInfoPanel({ hoveredCountry }: CountryInfoPanelProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 shadow-xl backdrop-blur">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Hover</p>
      {hoveredCountry ? (
        <div className="mt-2">
          <p className="text-lg font-semibold text-white">{hoveredCountry.name}</p>
          <p className="text-sm text-cyan-300">{hoveredCountry.code}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-400">Move over a country to inspect it.</p>
      )}
    </div>
  );
}
