"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Cartesian2, CustomDataSource, Entity, ScreenSpaceEventHandler, Viewer } from "cesium";
import type { CountryGeoJsonFeature, CountrySummary } from "@/types/country";
import {
  getCountryFeatureIso3,
  getCountryFeatureName,
} from "@/lib/globe/countryIdMap";
import { loadCountriesGeoJson } from "@/lib/globe/geojsonLoader";

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

type CesiumModule = typeof import("cesium");

type GlobeProps = {
  selectedCountries: CountrySummary[];
  onToggleCountry: (country: CountrySummary) => void;
  onHoverCountry: (country: CountrySummary | null) => void;
};

type CountryHitArea = {
  country: CountrySummary;
  rings: Array<Array<[number, number]>>;
  bbox: {
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
  };
};

function getEntityCountry(
  entity: Entity | undefined,
  Cesium: CesiumModule,
): CountrySummary | null {
  if (!entity) {
    return null;
  }

  const properties = entity.properties?.getValue(Cesium.JulianDate.now()) as
    | Record<string, unknown>
    | undefined;
  const code = getCountryFeatureIso3(properties, entity.id);

  if (!code) {
    return null;
  }

  return {
    code,
    name: getCountryFeatureName(properties, code),
    hasCountryRag: false,
  };
}

function collectCoordinates(coordinates: unknown, points: Array<[number, number]>) {
  if (!Array.isArray(coordinates)) {
    return;
  }

  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    points.push([coordinates[0], coordinates[1]]);
    return;
  }

  for (const child of coordinates) {
    collectCoordinates(child, points);
  }
}

function getFeatureCentroid(feature: CountryGeoJsonFeature): [number, number] | null {
  const points: Array<[number, number]> = [];
  if ("coordinates" in feature.geometry) {
    collectCoordinates(feature.geometry.coordinates, points);
  } else if (feature.geometry.type === "GeometryCollection") {
    for (const geometry of feature.geometry.geometries) {
      if ("coordinates" in geometry) {
        collectCoordinates(geometry.coordinates, points);
      }
    }
  }

  if (points.length === 0) {
    return null;
  }

  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const [lon, lat] of points) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

function isCoordinatePair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

function isLinearRing(value: unknown): value is Array<[number, number]> {
  return Array.isArray(value) && value.length >= 2 && value.every(isCoordinatePair);
}

function collectLinearRings(value: unknown, rings: Array<Array<[number, number]>>) {
  if (isLinearRing(value)) {
    rings.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      collectLinearRings(child, rings);
    }
  }
}

function getFeatureRings(feature: CountryGeoJsonFeature): Array<Array<[number, number]>> {
  const rings: Array<Array<[number, number]>> = [];

  if ("coordinates" in feature.geometry) {
    collectLinearRings(feature.geometry.coordinates, rings);
  } else if (feature.geometry.type === "GeometryCollection") {
    for (const geometry of feature.geometry.geometries) {
      if ("coordinates" in geometry) {
        collectLinearRings(geometry.coordinates, rings);
      }
    }
  }

  return rings;
}

function ringToDegreesArray(ring: Array<[number, number]>): number[] {
  const closedRing = [...ring];
  const first = closedRing[0];
  const last = closedRing[closedRing.length - 1];

  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    closedRing.push(first);
  }

  return closedRing.flatMap(([lon, lat]) => [lon, lat]);
}

function getRingsBoundingBox(rings: Array<Array<[number, number]>>): CountryHitArea["bbox"] {
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }

  return { minLon, maxLon, minLat, maxLat };
}

function pointInRing(lon: number, lat: number, ring: Array<[number, number]>): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function findCountryAtLonLat(
  lon: number,
  lat: number,
  hitAreas: CountryHitArea[],
): CountrySummary | null {
  for (const hitArea of hitAreas) {
    const { bbox } = hitArea;

    if (lon < bbox.minLon || lon > bbox.maxLon || lat < bbox.minLat || lat > bbox.maxLat) {
      continue;
    }

    if (hitArea.rings.some((ring) => pointInRing(lon, lat, ring))) {
      return hitArea.country;
    }
  }

  return null;
}

function styleCountries(
  dataSource: CustomDataSource | null,
  Cesium: CesiumModule | null,
  selectedCodes: Set<string>,
  hoveredCode: string | null,
) {
  if (!dataSource || !Cesium) {
    return;
  }

  for (const entity of dataSource.entities.values) {
    if (!entity.point && !entity.polyline) {
      continue;
    }

    const country = getEntityCountry(entity, Cesium);
    const isSelected = country ? selectedCodes.has(country.code) : false;
    const isHovered = country ? hoveredCode === country.code : false;
    const fill = isSelected
      ? Cesium.Color.fromCssColorString("#22d3ee").withAlpha(0.65)
      : isHovered
        ? Cesium.Color.fromCssColorString("#f59e0b").withAlpha(0.55)
        : Cesium.Color.fromCssColorString("#2563eb").withAlpha(0.35);

    if (entity.point) {
      entity.point.color = new Cesium.ConstantProperty(fill);
      entity.point.pixelSize = new Cesium.ConstantProperty(isSelected ? 8 : isHovered ? 7 : 4);
      entity.point.outlineColor = new Cesium.ConstantProperty(
        isSelected ? Cesium.Color.WHITE : Cesium.Color.fromCssColorString("#0f172a"),
      );
      entity.point.outlineWidth = new Cesium.ConstantProperty(isSelected || isHovered ? 2 : 1);
    }
    if (entity.polyline) {
      entity.polyline.material = new Cesium.ColorMaterialProperty(
        isSelected
          ? Cesium.Color.fromCssColorString("#22d3ee").withAlpha(0.95)
          : isHovered
            ? Cesium.Color.fromCssColorString("#f59e0b").withAlpha(0.95)
            : Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.65),
      );
      entity.polyline.width = new Cesium.ConstantProperty(isSelected ? 3 : isHovered ? 2.5 : 1.25);
    }
    if (entity.label) {
      entity.label.show = new Cesium.ConstantProperty(isSelected || isHovered);
    }
  }
}

export function Globe({ selectedCountries, onToggleCountry, onHoverCountry }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const dataSourceRef = useRef<CustomDataSource | null>(null);
  const cesiumRef = useRef<CesiumModule | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const hitAreasRef = useRef<CountryHitArea[]>([]);
  const hoveredCountryRef = useRef<CountrySummary | null>(null);
  const onHoverCountryRef = useRef(onHoverCountry);
  const onToggleCountryRef = useRef(onToggleCountry);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const selectedCodes = useMemo(
    () => new Set(selectedCountries.map((country) => country.code)),
    [selectedCountries],
  );

  useEffect(() => {
    onHoverCountryRef.current = onHoverCountry;
    onToggleCountryRef.current = onToggleCountry;
  }, [onHoverCountry, onToggleCountry]);

  useEffect(() => {
    let isMounted = true;

    async function initializeGlobe() {
      if (!containerRef.current) {
        return;
      }

      try {
        window.CESIUM_BASE_URL = "/cesium";
        const Cesium = await import("cesium");
        const geoJson = await loadCountriesGeoJson();

        if (!isMounted || !containerRef.current) {
          return;
        }

        cesiumRef.current = Cesium;
        const viewer = new Cesium.Viewer(containerRef.current, {
          animation: false,
          baseLayer: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          navigationHelpButton: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
        });

        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#020617");
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.show = true;
        }
        viewerRef.current = viewer;

        const dataSource = new Cesium.CustomDataSource("country-boundaries");
        const hitAreas: CountryHitArea[] = [];

        for (const feature of geoJson.features) {
          const code = getCountryFeatureIso3(feature.properties, feature.id);
          const centroid = getFeatureCentroid(feature);

          if (!code) {
            continue;
          }

          const name = getCountryFeatureName(feature.properties, code);
          const rings = getFeatureRings(feature);

          if (rings.length > 0) {
            hitAreas.push({
              country: {
                code,
                name,
                hasCountryRag: false,
              },
              rings,
              bbox: getRingsBoundingBox(rings),
            });
          }

          rings.forEach((ring, index) => {
            const degrees = ringToDegreesArray(ring);
            if (degrees.length < 4) {
              return;
            }

            dataSource.entities.add({
              id: `${code}-boundary-${index}`,
              name,
              properties: new Cesium.PropertyBag({
                iso3: code,
                name,
              }),
              polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(degrees),
                width: 1.25,
                material: Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.65),
                clampToGround: false,
              },
            });
          });

          if (!centroid) {
            continue;
          }

          dataSource.entities.add({
            id: code,
            name,
            position: Cesium.Cartesian3.fromDegrees(centroid[0], centroid[1]),
            properties: new Cesium.PropertyBag({
              iso3: code,
              name,
            }),
            point: {
              pixelSize: 4,
              color: Cesium.Color.fromCssColorString("#2563eb").withAlpha(0.8),
              outlineColor: Cesium.Color.fromCssColorString("#0f172a"),
              outlineWidth: 1,
              heightReference: Cesium.HeightReference.NONE,
            },
            label: {
              text: code,
              font: "12px sans-serif",
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, -18),
              show: false,
            },
          });
        }

        if (!isMounted) {
          return;
        }

        hitAreasRef.current = hitAreas;
        dataSourceRef.current = dataSource;
        await viewer.dataSources.add(dataSource);
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(15, 20, 22000000),
        });
        styleCountries(dataSource, Cesium, new Set(), null);

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        handler.setInputAction(
          (movement: { endPosition: Cartesian2 }) => {
            const cartesian = viewer.camera.pickEllipsoid(
              movement.endPosition,
              viewer.scene.globe.ellipsoid,
            );
            const cartographic = cartesian ? Cesium.Cartographic.fromCartesian(cartesian) : null;
            const country = cartographic
              ? findCountryAtLonLat(
                  Cesium.Math.toDegrees(cartographic.longitude),
                  Cesium.Math.toDegrees(cartographic.latitude),
                  hitAreasRef.current,
                )
              : null;
            hoveredCountryRef.current = country;
            setHoveredCode(country?.code ?? null);
            onHoverCountryRef.current(country);
          },
          Cesium.ScreenSpaceEventType.MOUSE_MOVE,
        );

        handler.setInputAction(
          (movement: { position: Cartesian2 }) => {
            const cartesian = viewer.camera.pickEllipsoid(
              movement.position,
              viewer.scene.globe.ellipsoid,
            );
            const cartographic = cartesian ? Cesium.Cartographic.fromCartesian(cartesian) : null;
            const country = cartographic
              ? findCountryAtLonLat(
                  Cesium.Math.toDegrees(cartographic.longitude),
                  Cesium.Math.toDegrees(cartographic.latitude),
                  hitAreasRef.current,
                )
              : hoveredCountryRef.current;

            if (country) {
              onToggleCountryRef.current(country);
            }
          },
          Cesium.ScreenSpaceEventType.LEFT_CLICK,
        );

        handlerRef.current = handler;
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Failed to initialize globe.");
      }
    }

    initializeGlobe();

    return () => {
      isMounted = false;
      handlerRef.current?.destroy();
      handlerRef.current = null;
      viewerRef.current?.destroy();
      viewerRef.current = null;
      dataSourceRef.current = null;
      cesiumRef.current = null;
    };
  }, []);

  useEffect(() => {
    styleCountries(dataSourceRef.current, cesiumRef.current, selectedCodes, hoveredCode);
  }, [selectedCodes, hoveredCode]);

  return (
    <div className="relative h-full min-h-[520px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
      <div ref={containerRef} className="h-full min-h-[520px] w-full" />
      {loadError ? (
        <div className="absolute inset-x-4 top-4 rounded-lg border border-red-500/50 bg-red-950/90 p-3 text-sm text-red-100">
          {loadError}
        </div>
      ) : null}
      <div className="absolute bottom-4 left-4 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-300 backdrop-blur">
        Click country outlines or markers to toggle selection. Multiple countries can be selected.
      </div>
    </div>
  );
}
