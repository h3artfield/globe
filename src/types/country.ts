export type IsoAlpha3Code = string;

export type CountryFeatureProperties = {
  iso3: IsoAlpha3Code;
  name: string;
};

export type CountrySummary = {
  code: IsoAlpha3Code;
  name: string;
  hasCountryRag: boolean;
};

export type SelectedCountry = CountrySummary & {
  relationshipStatuses: RelationshipStatusSummary[];
};

export type RelationshipStatusSummary = {
  relationshipId: string;
  countries: [IsoAlpha3Code, IsoAlpha3Code];
  exists: boolean;
};

export type CountryGeoJsonFeature = GeoJSON.Feature<
  GeoJSON.Geometry,
  Record<string, unknown>
>;

export type CountryGeoJson = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  Record<string, unknown>
>;
