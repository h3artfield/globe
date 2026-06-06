"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Cartesian2, Entity, GeoJsonDataSource, ScreenSpaceEventHandler, Viewer } from "cesium";
import type { CountrySummary } from "@/types/country";
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

function styleCountries(
  dataSource: GeoJsonDataSource | null,
  Cesium: CesiumModule | null,
  selectedCodes: Set<string>,
  hoveredCode: string | null,
) {
  if (!dataSource || !Cesium) {
    return;
  }

  for (const entity of dataSource.entities.values) {
    if (!entity.polygon) {
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

    entity.polygon.material = new Cesium.ColorMaterialProperty(fill);
    entity.polygon.outline = new Cesium.ConstantProperty(true);
    entity.polygon.outlineColor = new Cesium.ConstantProperty(
      isSelected ? Cesium.Color.WHITE : Cesium.Color.fromCssColorString("#94a3b8").withAlpha(0.5),
    );
  }
}

export function Globe({ selectedCountries, onToggleCountry, onHoverCountry }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const dataSourceRef = useRef<GeoJsonDataSource | null>(null);
  const cesiumRef = useRef<CesiumModule | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
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

        const dataSource = await Cesium.GeoJsonDataSource.load(geoJson, {
          clampToGround: false,
          fill: Cesium.Color.fromCssColorString("#2563eb").withAlpha(0.35),
          stroke: Cesium.Color.fromCssColorString("#94a3b8").withAlpha(0.5),
          strokeWidth: 1,
        });

        if (!isMounted) {
          return;
        }

        dataSourceRef.current = dataSource;
        await viewer.dataSources.add(dataSource);
        await viewer.zoomTo(dataSource);
        styleCountries(dataSource, Cesium, new Set(), null);

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        handler.setInputAction(
          (movement: { endPosition: Cartesian2 }) => {
            const picked = viewer.scene.pick(movement.endPosition) as { id?: Entity } | undefined;
            const country = getEntityCountry(picked?.id, Cesium);
            setHoveredCode(country?.code ?? null);
            onHoverCountryRef.current(country);
          },
          Cesium.ScreenSpaceEventType.MOUSE_MOVE,
        );

        handler.setInputAction(
          (movement: { position: Cartesian2 }) => {
            const picked = viewer.scene.pick(movement.position) as { id?: Entity } | undefined;
            const country = getEntityCountry(picked?.id, Cesium);

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
        Click countries to toggle selection. Multiple countries can be selected.
      </div>
    </div>
  );
}
