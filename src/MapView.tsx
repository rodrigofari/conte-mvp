import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerUrl);
import type { Data, Coord } from "./model";
import {
  colors,
  crops,
  geometry,
  geometryCenter,
  farmOnLand,
  farmGeometry,
  parcelInFarm,
} from "./model";
import type { Polygon, Point } from "geojson";
import {
  Layers,
  LocateFixed,
  Plus,
  Minus,
  Check,
  Undo2,
  X,
} from "lucide-react";
export type MapMode = "land" | "parcel" | "sensor" | "edit" | null;
type Props = {
  data: Data;
  farmId?: string;
  focusLandId?: string;
  focusLocation?: Coord;
  mode?: MapMode;
  selectedGeometry?: { id: string; geometry: Polygon };
  layers: string[];
  onFarm?: (id: string) => void;
  onParcel?: (id: string) => void;
  onLand?: (id: string) => void;
  onDevice?: (id: string) => void;
  onDraw?: (g: Polygon) => void;
  onPlace?: (p: Coord) => void;
  onGeometry?: (g: Polygon) => void;
  onMove?: (id: string, p: Coord) => void;
  onCancel?: () => void;
};
export default function MapView(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const live = useRef(props);
  live.current = props;
  const [ready, setReady] = useState(false);
  const [satellite, setSatellite] = useState(true);
  const [imageryEnlarged, setImageryEnlarged] = useState(false);
  const [points, setPoints] = useState<Coord[]>([]);

  const [error, setError] = useState("");
  useEffect(() => {
    const m = new maplibregl.Map({
      container: container.current!,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            // The provider returns placeholder images above regional coverage.
            // Overzoom the available tiles instead of requesting missing detail.
            maxzoom: 18,
            tileSize: 256,
            attribution:
              'Imagery © <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank">Esri</a>, Maxar, Earthstar Geographics, GIS User Community',
          },
          streets: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>',
          },
        },
        layers: [
          { id: "satellite", type: "raster", source: "satellite" },
          {
            id: "streets",
            type: "raster",
            source: "streets",
            layout: { visibility: "none" },
          },
        ],
      },
      center: props.data.farms.find((f) => f.id === props.farmId)?.location ??
        props.focusLocation ?? [-17.005, 32.755],
      zoom:
        props.farmId || props.focusLandId || props.focusLocation ? 16 : 10.2,
      maxZoom: 19,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.on("zoomend", () => setImageryEnlarged(m.getZoom() > 17));
    m.addControl(
      new maplibregl.ScaleControl({ unit: "metric" }),
      "bottom-left",
    );
    m.on("load", () => {
      m.addSource("areas", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "areas-fill",
        type: "fill",
        source: "areas",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": [
            "case",
            ["==", ["get", "entity"], "land"],
            0.07,
            0.3,
          ],
        },
      });
      m.addLayer({
        id: "areas-line",
        type: "line",
        source: "areas",
        paint: { "line-color": ["get", "color"], "line-width": 2.5 },
      });
      m.addSource("draft", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "draft-line",
        type: "line",
        source: "draft",
        paint: {
          "line-color": "#d6ffb7",
          "line-width": 3,
          "line-dasharray": [2, 1],
        },
      });
      m.addSource("farms", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 45,
      });
      m.addLayer({
        id: "clusters",
        type: "circle",
        source: "farms",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#14804a",
          "circle-radius": 25,
          "circle-stroke-width": 10,
          "circle-stroke-color": "#14804a",
          "circle-stroke-opacity": 0.25,
        },
      });
      m.on("click", "clusters", async (e) => {
        if (live.current.mode) return;
        const f = e.features?.[0];
        if (!f) return;
        const zoom = await (
          m.getSource("farms") as maplibregl.GeoJSONSource
        ).getClusterExpansionZoom(Number(f.properties.cluster_id));
        m.easeTo({ center: (f.geometry as any).coordinates, zoom });
      });
      m.on("click", (e) => {
        const p: Coord = [e.lngLat.lng, e.lngLat.lat];
        const pr = live.current;
        if (pr.mode === "sensor") {
          pr.onPlace?.(p);
          return;
        }
        if (pr.mode === "land" || pr.mode === "parcel") {
          setPoints((prev) => [...prev, p]);
          return;
        }
        const fs = m.queryRenderedFeatures(e.point, { layers: ["areas-fill"] });
        if (
          pr.mode === "edit" &&
          pr.selectedGeometry &&
          fs.some(
            (f) =>
              f.properties.id === pr.selectedGeometry?.id &&
              f.properties.entity === "land",
          )
        )
          return;
        const parcel = fs.find((f) => f.properties.entity === "parcel");
        if (parcel) pr.onParcel?.(String(parcel.properties.id));
        else if (
          pr.onFarm &&
          fs.some((f) => f.properties.entity === "farm-area")
        )
          pr.onFarm?.(
            String(
              fs.find((f) => f.properties.entity === "farm-area")!.properties
                .id,
            ),
          );
        else {
          const land = fs.find((f) => f.properties.entity === "land");
          if (land) pr.onLand?.(String(land.properties.id));
        }
      });
      setReady(true);
    });
    let failures = 0;
    m.on("error", () => {
      if (++failures > 3)
        setError(
          "Cartografia indisponível. Experimente a vista Mapa ou verifique a ligação.",
        );
    });
    const resize = new ResizeObserver(() => {
      m.resize();
      if (
        !live.current.farmId &&
        !live.current.focusLandId &&
        !live.current.focusLocation
      )
        m.fitBounds(
          [
            [-17.28, 32.61],
            [-16.68, 32.89],
          ],
          {
            padding: {
              top: container.current!.clientWidth < 600 ? 280 : 220,
              bottom: 110,
              left: 35,
              right: 35,
            },
            duration: 0,
          },
        );
    });
    resize.observe(container.current!);
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setLayoutProperty(
      "satellite",
      "visibility",
      satellite ? "visible" : "none",
    );
    map.current.setLayoutProperty(
      "streets",
      "visibility",
      satellite ? "none" : "visible",
    );
    setError("");
  }, [satellite, ready]);
  useEffect(() => {
    setPoints([]);
    if (map.current)
      map.current.getCanvas().style.cursor =
        props.mode === "land" ||
        props.mode === "parcel" ||
        props.mode === "sensor"
          ? "crosshair"
          : "";
  }, [props.mode]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const f = props.data.farms.find((f) => f.id === props.farmId);
    const focusedLand = props.data.lands.find(
      (l) => l.id === props.focusLandId,
    );
    if (focusedLand)
      map.current.flyTo({
        center: geometryCenter(
          (f && farmGeometry(f, focusedLand)) || focusedLand.geometry,
        ),
        zoom: 16,
        duration: 0,
      });
    else if (f)
      map.current.flyTo({ center: f.location, zoom: 16, duration: 900 });
    else if (props.focusLandId || props.focusLocation) {
      const land = props.data.lands.find((l) => l.id === props.focusLandId);
      map.current.flyTo({
        center: land
          ? geometryCenter(land.geometry)
          : (props.focusLocation ?? [-17.065, 32.692]),
        zoom: 16,
        duration: 0,
      });
    } else
      map.current.fitBounds(
        [
          [-17.28, 32.61],
          [-16.68, 32.89],
        ],
        {
          padding: {
            top: container.current!.clientWidth < 600 ? 280 : 220,
            bottom: 110,
            left: 35,
            right: 35,
          },
          duration: 700,
        },
      );
  }, [props.farmId, props.focusLandId, ready]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const lands = props.data.lands.filter(
      (l) =>
        !props.farmId ||
        props.data.farms.some((f) => f.id === props.farmId && farmOnLand(f, l)),
    );
    const markerLocation = (f: Data["farms"][number]): Coord => {
      const l = props.data.lands.find((l) => l.id === props.focusLandId);
      const g = l && farmGeometry(f, l);
      return g ? geometryCenter(g) : f.location;
    };
    const ps = props.data.parcels.filter(
      (p) =>
        lands.some((l) => l.id === p.landId) &&
        (!props.farmId ||
          props.data.farms.some(
            (f) => f.id === props.farmId && parcelInFarm(p, f, props.data),
          )),
    );
    (m.getSource("areas") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [
        ...(props.layers.includes("Terrenos")
          ? lands.map((l) => ({
              type: "Feature" as const,
              geometry: l.geometry,
              properties: { id: l.id, entity: "land", color: "#d4f4ba" },
            }))
          : []),
        ...(props.layers.includes("Explorações")
          ? props.data.farms
              .filter(
                (f) => f.geometry && (!props.farmId || f.id === props.farmId),
              )
              .flatMap((f, i) =>
                lands
                  .filter(
                    (l) =>
                      farmOnLand(f, l) &&
                      (!props.focusLandId || l.id === props.focusLandId),
                  )
                  .map((l) => ({
                    type: "Feature" as const,
                    geometry: farmGeometry(f, l)!,
                    properties: {
                      id: f.id,
                      entity: "farm-area",
                      color: colors[i % colors.length],
                    },
                  })),
              )
          : []),
        ...(props.layers.includes("Parcelas")
          ? ps.map((p) => ({
              type: "Feature" as const,
              geometry: p.geometry,
              properties: {
                id: p.id,
                entity: "parcel",
                color: props.layers.includes("Culturas")
                  ? colors[crops.indexOf(p.crop)] || colors[0]
                  : colors[0],
              },
            }))
          : []),
      ],
    });
    (m.getSource("farms") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features:
        props.layers.includes("Explorações") && !props.farmId
          ? props.data.farms.map((f) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: markerLocation(f) },
              properties: { id: f.id },
            }))
          : [],
    });
    const markers: maplibregl.Marker[] = [];
    function pin(
      location: Coord,
      kind: string,
      label: string,
      click: () => void,
      drag?: (p: Coord) => void,
    ) {
      const el = document.createElement("button");
      el.className = `map-pin ${kind}`;
      el.title = label;
      el.setAttribute("aria-label", label);
      el.innerHTML =
        kind === "farm"
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21V10M12 15C4 15 3 10 3 5c7 0 9 4 9 10ZM12 12c0-7 4-9 9-9 0 6-3 9-9 9Z"/></svg>'
          : kind === "station"
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13 0 5 5 0 0 1 0 10Z"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6a8 8 0 0 0 0 12m8-12a8 8 0 0 1 0 12M5 3a12 12 0 0 0 0 18M19 3a12 12 0 0 1 0 18M12 12v10"/><circle cx="12" cy="9" r="2"/></svg>';
      el.onclick = (e) => {
        e.stopPropagation();
        click();
      };
      const marker = new maplibregl.Marker({
        element: el,
        anchor: "bottom",
        draggable: !!drag,
        offset:
          !props.farmId && kind !== "farm"
            ? kind === "station"
              ? [24, -20]
              : kind === "alert"
                ? [-24, 0]
                : [22, 14]
            : [0, 0],
      })
        .setLngLat(location)
        .addTo(m!);
      if (drag)
        marker.on("dragend", () => {
          const p = marker.getLngLat();
          drag([p.lng, p.lat]);
        });
      markers.push(marker);
    }
    if (props.layers.includes("Explorações") && !props.farmId)
      props.data.farms.forEach((f) =>
        pin(markerLocation(f), "farm", f.name, () => props.onFarm?.(f.id)),
      );
    props.data.devices
      .filter(
        (d) =>
          (!props.farmId || d.farmId === props.farmId) &&
          props.layers.includes(
            d.type === "Estação meteorológica" ? "Estações" : "Sensores",
          ),
      )
      .forEach((d) => {
        const loc: Coord = d.location;
        pin(
          loc,
          d.type === "Estação meteorológica" ? "station" : "sensor",
          d.name,
          () => props.onDevice?.(d.id),
          props.mode === "edit" ? (p) => props.onMove?.(d.id, p) : undefined,
        );
      });
    if (props.layers.includes("Alertas") && !props.farmId)
      props.data.devices
        .filter((d) => d.status === "Offline")
        .forEach((d) =>
          pin(d.location, "alert", `${d.name}: sem comunicação`, () =>
            props.onDevice?.(d.id),
          ),
        );
    if (!props.farmId && !props.focusLandId && !props.focusLocation) {
      [
        ["Porto Moniz", -17.16, 32.865],
        ["São Vicente", -17.04, 32.805],
        ["Santana", -16.879, 32.808],
        ["Funchal", -16.91, 32.645],
        ["Calheta", -17.18, 32.708],
        ["Ribeira Brava", -17.06, 32.654],
        ["Machico", -16.767, 32.714],
        ["Câmara de Lobos", -16.986, 32.634],
      ].forEach(([name, x, y]) => {
        const el = document.createElement("span");
        el.className = "map-label";
        el.textContent = String(name);
        markers.push(
          new maplibregl.Marker({ element: el })
            .setLngLat([Number(x), Number(y)])
            .addTo(m),
        );
      });
    }
    const clusterMarkers = new Map<number, maplibregl.Marker>();
    const updateClusters = () => {
      if (!m.isSourceLoaded("farms")) return;
      const seen = new Set<number>();
      for (const f of m.querySourceFeatures("farms")) {
        if (!f.properties.cluster) continue;
        const cid = Number(f.properties.cluster_id);
        seen.add(cid);
        if (clusterMarkers.has(cid)) continue;
        const el = document.createElement("span");
        el.className = "cluster-count";
        el.textContent = String(f.properties.point_count);
        el.style.pointerEvents = "none";
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat((f.geometry as Point).coordinates as Coord)
          .addTo(m);
        clusterMarkers.set(cid, marker);
      }
      for (const [cid, marker] of clusterMarkers) {
        if (!seen.has(cid)) {
          marker.remove();
          clusterMarkers.delete(cid);
        }
      }
      const unclustered = new Set(
        m
          .querySourceFeatures("farms")
          .filter((f) => !f.properties.cluster)
          .map((f) => String(f.properties.id)),
      );
      markers
        .filter((marker) => marker.getElement().classList.contains("farm"))
        .forEach((marker) => {
          const farm = props.data.farms.find(
            (f) => f.name === marker.getElement().getAttribute("aria-label"),
          );
          if (farm)
            marker.getElement().style.display = unclustered.has(farm.id)
              ? ""
              : "none";
        });
    };
    m.on("render", updateClusters);
    return () => {
      m.off("render", updateClusters);
      markers.forEach((marker) => marker.remove());
      clusterMarkers.forEach((marker) => marker.remove());
    };
  }, [
    props.data,
    props.farmId,
    props.focusLandId,
    props.layers.join(","),
    props.mode,
    ready,
  ]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const m = map.current;
    const markers: maplibregl.Marker[] = [];
    const coords =
      props.mode === "edit"
        ? (props.selectedGeometry?.geometry.coordinates[0].slice(0, -1) as
            Coord[] | undefined)
        : points;
    coords?.forEach((p, i) => {
      const el = document.createElement("div");
      el.className = "vertex";
      el.addEventListener("click", (e) => e.stopPropagation());
      const marker = new maplibregl.Marker({
        element: el,
        draggable: props.mode === "edit",
      })
        .setLngLat(p)
        .addTo(m);
      marker.on("dragend", () => {
        const n = marker.getLngLat();
        const next = coords.map((c, j) =>
          i === j ? ([n.lng, n.lat] as Coord) : c,
        );
        props.onGeometry?.(geometry(next));
      });
      markers.push(marker);
    });
    if (props.mode === "edit" && coords)
      coords.forEach((p, i) => {
        const q = coords[(i + 1) % coords.length];
        const el = document.createElement("div");
        el.className = "vertex-midpoint";
        el.title = "Arraste para adicionar um vértice";
        el.addEventListener("click", (e) => e.stopPropagation());
        const marker = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2])
          .addTo(m);
        marker.on("dragend", () => {
          const pos = marker.getLngLat();
          const next = [...coords];
          next.splice(i + 1, 0, [pos.lng, pos.lat]);
          props.onGeometry?.(geometry(next));
        });
        markers.push(marker);
      });
    (m.getSource("draft") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features:
        points.length > 1
          ? [
              {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates:
                    points.length > 2 ? [...points, points[0]] : points,
                },
                properties: {},
              },
            ]
          : [],
    });
    return () => markers.forEach((m) => m.remove());
  }, [points, props.mode, props.selectedGeometry, ready]);
  return (
    <div
      className="map-wrapper"
      data-ready={ready}
      data-drawing={
        props.mode === "land" ||
        props.mode === "parcel" ||
        props.mode === "sensor"
      }
    >
      <div ref={container} className="map-canvas" />
      {!ready && (
        <div className="map-loading" role="status">
          A carregar mapa…
        </div>
      )}
      {error && <div className="map-error">{error}</div>}
      {satellite && imageryEnlarged && (
        <div className="imagery-note" role="status">
          Imagem de satélite ampliada · resolução máxima disponível
        </div>
      )}
      <div className="map-view-switch">
        <button
          className={satellite ? "active" : ""}
          onClick={() => setSatellite(true)}
        >
          <Layers size={15} /> Satélite
        </button>
        <button
          className={!satellite ? "active" : ""}
          onClick={() => setSatellite(false)}
        >
          Mapa
        </button>
      </div>
      <div className="map-controls">
        <button
          title="Centrar na Madeira"
          onClick={() =>
            map.current?.flyTo({ center: [-17.005, 32.755], zoom: 10.2 })
          }
        >
          <LocateFixed />
        </button>
        <div>
          <button title="Aumentar zoom" onClick={() => map.current?.zoomIn()}>
            <Plus />
          </button>
          <button title="Diminuir zoom" onClick={() => map.current?.zoomOut()}>
            <Minus />
          </button>
        </div>
      </div>
      {(props.mode === "land" || props.mode === "parcel") && (
        <div className="draw-hint">
          <span>
            Toque ou clique para marcar os vértices · {points.length} pontos
          </span>
          <button
            title="Desfazer ponto"
            onClick={() => setPoints(points.slice(0, -1))}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="primary"
            disabled={points.length < 3}
            onClick={() => {
              props.onDraw?.(geometry(points));
              setPoints([]);
            }}
          >
            <Check size={16} /> Concluir
          </button>
          <button title="Cancelar desenho" onClick={props.onCancel}>
            <X size={17} />
          </button>
        </div>
      )}
      {props.mode === "sensor" && (
        <div className="draw-hint">
          Clique no mapa para colocar o sensor{" "}
          <button onClick={props.onCancel}>Cancelar</button>
        </div>
      )}
    </div>
  );
}
