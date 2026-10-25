import {
  area,
  centroid,
  polygon,
  booleanWithin,
  intersect,
  featureCollection,
  booleanPointInPolygon,
  point,
  kinks,
} from "@turf/turf";
import type { Polygon } from "geojson";
export type Coord = [number, number];
export type Farm = {
  additionalLands?: { landId: string; geometry: Polygon }[];
  landId?: string;
  geometry?: Polygon;
  responsible?: string;
  id: string;
  organizationId: string;
  name: string;
  municipality: string;
  location: Coord;
  description: string;
};
export type Land = {
  organizationId?: string;
  id: string;
  /** Legacy link, retained for older multi-terrain farms. New farms reference landId. */
  farmId?: string;
  municipality?: string;
  name: string;
  geometry: Polygon;
};
export type Parcel = {
  farmId?: string;
  id: string;
  landId: string;
  name: string;
  crop: string;
  variety: string;
  geometry: Polygon;
  notes?: string;
  plantingDate?: string;
};
export type Device = {
  id: string;
  farmId: string;
  landId?: string;
  parcelId?: string;
  name: string;
  type: string;
  location: Coord;
  status: "Online" | "Offline";
  lastSeen: string;
  manufacturer: string;
  model: string;
  frequency: number;
};
export type Data = {
  schemaVersion?: number;
  farms: Farm[];
  lands: Land[];
  parcels: Parcel[];
  devices: Device[];
  tick: number;
};
export const organizations = [
  {
    id: "o1",
    name: "Maria Pereira",
    type: "Agricultor individual",
    municipality: "Câmara de Lobos",
  },
  {
    id: "o2",
    name: "Mel da Madeira",
    type: "Empresa agrícola",
    municipality: "Ribeira Brava",
  },
  {
    id: "o3",
    name: "Cooperativa da Calheta",
    type: "Cooperativa",
    municipality: "Calheta",
  },
];
export const crops = [
  "Vinha",
  "Macieira / Peros",
  "Apicultura",
  "Banana",
  "Hortícolas",
  "Batata",
];
export const colors = [
  "#54c785",
  "#ecb54a",
  "#66b7ea",
  "#ac8de0",
  "#ed906c",
  "#8bc466",
];
export const types = [
  "Humidade do solo",
  "Temperatura do solo",
  "Temperatura do ar",
  "Humidade relativa",
  "Estação meteorológica",
  "Pluviómetro",
  "Controlador de rega",
  "Sensor de colmeia",
  "Balança de colmeia",
];
export const metricSpec: Record<
  string,
  { label: string; unit: string; base: number }[]
> = {
  "Humidade do solo": [{ label: "Humidade do solo", unit: "%", base: 32 }],
  "Temperatura do solo": [
    { label: "Temperatura do solo", unit: "°C", base: 19 },
  ],
  "Temperatura do ar": [{ label: "Temperatura do ar", unit: "°C", base: 21 }],
  "Humidade relativa": [{ label: "Humidade relativa", unit: "%", base: 68 }],
  "Estação meteorológica": [
    { label: "Temperatura do ar", unit: "°C", base: 21 },
    { label: "Humidade relativa", unit: "%", base: 68 },
    { label: "Precipitação", unit: "mm", base: 1.2 },
    { label: "Vento", unit: "km/h", base: 12 },
  ],
  Pluviómetro: [{ label: "Precipitação", unit: "mm", base: 1.2 }],
  "Controlador de rega": [{ label: "Estado de rega", unit: "", base: 0 }],
  "Sensor de colmeia": [
    { label: "Temperatura da colmeia", unit: "°C", base: 35 },
    { label: "Humidade relativa", unit: "%", base: 62 },
  ],
  "Balança de colmeia": [{ label: "Peso da colmeia", unit: "kg", base: 28 }],
};
export const id = () => crypto.randomUUID();
export const geometry = (coords: Coord[]): Polygon => ({
  type: "Polygon",
  coordinates: [[...coords, coords[0]]],
});
export const geometryCenter = (g: Polygon) =>
  centroid(g).geometry.coordinates as Coord;
export const hectares = (g: Polygon) => area(g) / 10000;
export const formatArea = (n: number) =>
  n.toLocaleString("pt-PT", { maximumFractionDigits: 2 });
export function validateGeometry(
  g: Polygon,
  land?: Land,
  others: Parcel[] = [],
  exclude?: string,
) {
  try {
    if (area(g) < 1 || kinks(polygon(g.coordinates)).features.length)
      return "O polígono é inválido. Evite cruzar os limites.";
    if (
      land &&
      !booleanWithin(polygon(g.coordinates), polygon(land.geometry.coordinates))
    )
      return "A parcela deve ficar totalmente dentro do terreno.";
    if (
      others.some(
        (p) =>
          p.id !== exclude &&
          intersect(
            featureCollection([
              polygon(g.coordinates),
              polygon(p.geometry.coordinates),
            ]),
          ),
      )
    )
      return "A parcela sobrepõe-se a outra parcela.";
    return null;
  } catch {
    return "Não foi possível validar o polígono.";
  }
}
export function farmOnLand(farm: Farm, land: Land) {
  return (
    farm.landId === land.id ||
    land.farmId === farm.id ||
    !!farm.additionalLands?.some((a) => a.landId === land.id)
  );
}
export function parcelInFarm(parcel: Parcel, farm: Farm, data: Data) {
  return parcel.farmId
    ? parcel.farmId === farm.id
    : data.lands.some((l) => l.id === parcel.landId && farmOnLand(farm, l));
}
export function farmGeometry(farm: Farm, land: Land) {
  return farm.landId === land.id
    ? (farm.geometry ?? land.geometry)
    : (farm.additionalLands?.find((a) => a.landId === land.id)?.geometry ??
        (land.farmId === farm.id ? land.geometry : undefined));
}
export function setFarmGeometry(
  farm: Farm,
  landId: string,
  geometry: Polygon,
): Farm {
  if (farm.landId === landId)
    return { ...farm, geometry, location: geometryCenter(geometry) };
  return {
    ...farm,
    additionalLands: [
      ...(farm.additionalLands ?? []).filter((a) => a.landId !== landId),
      { landId, geometry },
    ],
  };
}
export function parcelBoundary(
  data: Data,
  parcel: Pick<Parcel, "landId" | "farmId">,
) {
  const land = data.lands.find((l) => l.id === parcel.landId);
  const farm = data.farms.find((f) => f.id === parcel.farmId);
  const g = land && farm && farmGeometry(farm, land);
  return land && g ? { ...land, geometry: g } : land;
}
export function farmArea(data: Data, farm: Farm) {
  return data.lands
    .filter((l) => farmOnLand(farm, l))
    .reduce((n, l) => n + hectares(farmGeometry(farm, l) ?? l.geometry), 0);
}
/** Boundaries that occupied the entire terrain continue to follow its outline. */
export function updateLandGeometry(
  data: Data,
  landId: string,
  geometry: Polygon,
): Data {
  const old = data.lands.find((l) => l.id === landId);
  if (!old) return data;
  return {
    ...data,
    lands: data.lands.map((l) => (l.id === landId ? { ...l, geometry } : l)),
    farms: data.farms.map((f) => {
      const g = farmGeometry(f, old);
      return g &&
        JSON.stringify(g.coordinates) ===
          JSON.stringify(old.geometry.coordinates)
        ? setFarmGeometry(f, landId, geometry)
        : f;
    }),
  };
}
export function migrateData(data: Data): Data {
  const farms = data.farms.map((f) => {
    const land = data.lands.find((l) => l.farmId === f.id);
    return {
      ...f,
      landId: f.landId ?? land?.id,
      geometry: f.geometry ?? land?.geometry,
      responsible:
        f.responsible ??
        organizations.find((o) => o.id === f.organizationId)?.name ??
        "",
    };
  });
  return {
    ...data,
    schemaVersion: 2,
    farms,
    parcels: data.parcels.map((p) => ({
      ...p,
      farmId: p.farmId ?? data.lands.find((l) => l.id === p.landId)?.farmId,
    })),
  };
}
export function validateFarm(data: Data, farm: Farm): string | null {
  const ids = [
    farm.landId,
    ...(farm.additionalLands ?? []).map((a) => a.landId),
  ].filter(Boolean);
  if (ids.some((lid) => !data.lands.some((l) => l.id === lid)))
    return "O terreno da exploração não existe.";
  for (const land of data.lands.filter((l) => farmOnLand(farm, l))) {
    const g = farmGeometry(farm, land);
    if (!g) continue;
    if (validateGeometry(g, land))
      return `O limite deixa a exploração «${farm.name}» fora do terreno. Ajuste primeiro a área dessa exploração.`;
    if (
      data.farms.some((other) => {
        if (other.id === farm.id || !farmOnLand(other, land)) return false;
        const og = farmGeometry(other, land);
        return (
          og &&
          intersect(
            featureCollection([
              polygon(g.coordinates),
              polygon(og.coordinates),
            ]),
          )
        );
      })
    )
      return "Esta exploração sobrepõe-se a outra exploração do terreno.";
    for (const p of data.parcels.filter(
      (p) => p.farmId === farm.id && p.landId === land.id,
    )) {
      if (validateGeometry(p.geometry, { ...land, geometry: g }))
        return `Os novos limites deixam a parcela «${p.name}» fora da exploração. Ajuste primeiro essa parcela.`;
    }
  }
  return null;
}
export function associate(location: Coord, farmId: string, data: Data) {
  const farm = data.farms.find((f) => f.id === farmId);
  if (!farm) return { landId: undefined, parcelId: undefined };
  const land = data.lands.find(
    (l) =>
      farmOnLand(farm, l) && booleanPointInPolygon(point(location), l.geometry),
  );
  const parcel =
    land &&
    data.parcels.find(
      (p) =>
        p.landId === land.id &&
        parcelInFarm(p, farm, data) &&
        booleanPointInPolygon(point(location), p.geometry),
    );
  return { landId: land?.id, parcelId: parcel?.id };
}
export function history(
  device: Device,
  metric: string,
  tick: number,
  days = 7,
) {
  const spec = metricSpec[device.type].find((s) => s.label === metric)!;
  const seed = [...device.id].reduce((s, c) => s + c.charCodeAt(0), 0);
  return Array.from({ length: days * 24 }, (_, i) => {
    const h = 720 - days * 24 + i + (device.status === "Offline" ? -40 : tick);
    const value =
      spec.base === 0
        ? 0
        : Math.max(
            0,
            spec.base +
              Math.sin(h / 3.8 + seed) * spec.base * 0.09 +
              Math.sin(h / 27 + seed) * spec.base * 0.13,
          );
    return {
      timestamp: new Date(
        Date.UTC(2026, 9, 25, 12) + (h - 719) * 3600000,
      ).toISOString(),
      value: +value.toFixed(1),
      source: "Simulado",
    };
  });
}
export const latest = (d: Device, tick: number) =>
  history(d, metricSpec[d.type][0].label, tick, 1).at(-1)!;
function box(x: number, y: number, w: number, h: number) {
  return geometry([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]);
}
export function demo(): Data {
  const farms: Farm[] = [
    {
      id: "f1",
      organizationId: "o1",
      name: "Quinta das Vinhas",
      municipality: "Câmara de Lobos",
      location: [-16.987, 32.671],
      description:
        "Viticultura em socalcos. Duas parcelas dedicadas às castas tradicionais da Madeira.",
    },
    {
      id: "f2",
      organizationId: "o2",
      name: "Apiários da Ribeira",
      municipality: "Ribeira Brava",
      location: [-17.065, 32.692],
      description:
        "Apicultura nas encostas da Ribeira Brava, com dois apiários monitorizados.",
    },
    {
      id: "f3",
      organizationId: "o3",
      name: "Quinta dos Peros",
      municipality: "Calheta",
      location: [-17.166, 32.737],
      description:
        "Pomares de macieiras e peros regionais, entre a serra e o mar.",
    },
  ];
  const lands = farms.map((f, i) => ({
    id: "l" + i,
    farmId: f.id,
    name: "Terreno principal",
    geometry: box(f.location[0] - 0.0015, f.location[1] - 0.001, 0.003, 0.002),
  }));
  const parcels: Parcel[] = [];
  [0, 2].forEach((i) => {
    for (let j = 0; j < (i === 0 ? 2 : 3); j++)
      parcels.push({
        id: `p${i}${j}`,
        landId: "l" + i,
        name: `Parcela ${j + 1}`,
        crop: i === 0 ? "Vinha" : "Macieira / Peros",
        variety:
          i === 0
            ? ["Sercial", "Verdelho"][j]
            : ["Pero regional", "Reineta", "Gala"][j],
        geometry: box(
          farms[i].location[0] - 0.0014 + j * 0.0009,
          farms[i].location[1] - 0.0009,
          0.0008,
          0.0018,
        ),
      });
  });
  const devices: Device[] = [];
  farms.forEach((f, i) => {
    const ps = parcels.filter((p) => p.landId === "l" + i);
    const ts =
      i === 1
        ? [
            "Sensor de colmeia",
            "Balança de colmeia",
            "Sensor de colmeia",
            "Balança de colmeia",
          ]
        : [
            "Humidade do solo",
            "Temperatura do solo",
            "Humidade do solo",
            "Estação meteorológica",
          ];
    ts.forEach((type, j) => {
      const p = ps[j % ps.length];
      devices.push({
        id: `s${i}${j}`,
        farmId: f.id,
        landId: "l" + i,
        parcelId: p?.id,
        name:
          i === 1
            ? `${type} · Apiário ${Math.floor(j / 2) + 1}`
            : `${type} ${j + 1}`,
        type,
        location: p
          ? [
              p.geometry.coordinates[0][0][0] + 0.0004,
              p.geometry.coordinates[0][0][1] + 0.0004 + j * 0.0002,
            ]
          : [
              f.location[0] + (j % 2) * 0.0005,
              f.location[1] + Math.floor(j / 2) * 0.0005,
            ],
        status: i === 1 && j === 3 ? "Offline" : "Online",
        lastSeen: "2026-10-25T12:00:00Z",
        manufacturer: "Co.nTe Demo",
        model: "Virtual S1",
        frequency: 60,
      });
    });
  });
  return migrateData({ farms, lands, parcels, devices, tick: 0 });
}
export const storage = {
  load(): Data {
    try {
      const d = JSON.parse(localStorage.getItem("conte-agro-v1") || "null");
      if (
        d &&
        !d.schemaVersion &&
        !localStorage.getItem("conte-agro-v1-backup")
      )
        localStorage.setItem("conte-agro-v1-backup", JSON.stringify(d));
      return d &&
        Array.isArray(d.farms) &&
        Array.isArray(d.lands) &&
        Array.isArray(d.parcels) &&
        Array.isArray(d.devices)
        ? migrateData(d)
        : demo();
    } catch {
      return demo();
    }
  },
  save(data: Data) {
    localStorage.setItem("conte-agro-v1", JSON.stringify(data));
  },
};
export function exportGeo(data: Data) {
  return {
    type: "FeatureCollection",
    features: [
      ...data.farms.map((f) => ({
        type: "Feature",
        geometry: f.geometry ?? { type: "Point", coordinates: f.location },
        properties: { ...f, entity: "farm" },
      })),
      ...data.lands.map((l) => ({
        type: "Feature",
        geometry: l.geometry,
        properties: { ...l, geometry: undefined, entity: "land" },
      })),
      ...data.parcels.map((p) => ({
        type: "Feature",
        geometry: p.geometry,
        properties: { ...p, geometry: undefined, entity: "parcel" },
      })),
      ...data.devices.map((d) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: d.location },
        properties: { ...d, entity: "device" },
      })),
    ],
  };
}
export function importGeo(raw: unknown): Data {
  const r = raw as {
    type: string;
    features: { geometry: any; properties: any }[];
  };
  if (r.type !== "FeatureCollection" || !Array.isArray(r.features))
    throw Error("Ficheiro GeoJSON inválido.");
  const result: Data = {
    farms: [],
    lands: [],
    parcels: [],
    devices: [],
    tick: 0,
  };
  for (const f of r.features) {
    const p = f.properties;
    if (!p?.id || !p.name)
      throw Error("Faltam propriedades Co.nTe: id, name e entity.");
    if (p.entity === "farm" && ["Point", "Polygon"].includes(f.geometry.type))
      result.farms.push({
        ...p,
        location:
          f.geometry.type === "Polygon"
            ? (p.location ?? geometryCenter(f.geometry))
            : f.geometry.coordinates,
        geometry: f.geometry.type === "Polygon" ? f.geometry : p.geometry,
      });
    else if (
      ["land", "parcel"].includes(p.entity) &&
      f.geometry.type === "Polygon"
    ) {
      if (validateGeometry(f.geometry)) throw Error("Geometria inválida.");
      if (p.entity === "land")
        result.lands.push({ ...p, geometry: f.geometry });
      else result.parcels.push({ ...p, geometry: f.geometry });
    } else if (
      p.entity === "device" &&
      f.geometry.type === "Point" &&
      metricSpec[p.type]
    )
      result.devices.push({ ...p, location: f.geometry.coordinates });
    else throw Error("Entidade ou geometria não suportada.");
  }
  if (
    (!result.farms.length && !result.lands.length) ||
    result.lands.some(
      (l) => l.farmId && !result.farms.some((f) => f.id === l.farmId),
    ) ||
    result.parcels.some((p) => !result.lands.some((l) => l.id === p.landId)) ||
    result.devices.some((d) => !result.farms.some((f) => f.id === d.farmId))
  )
    throw Error("Associações geográficas inválidas.");
  const migrated = migrateData(result);
  if (
    migrated.parcels.some(
      (p) =>
        !migrated.farms.some(
          (f) =>
            f.id === p.farmId &&
            migrated.lands.some((l) => l.id === p.landId && farmOnLand(f, l)),
        ),
    )
  )
    throw Error("Associações geográficas inválidas.");
  for (const farm of migrated.farms) {
    const error = validateFarm(migrated, farm);
    if (error) throw Error(error);
  }
  for (const p of migrated.parcels) {
    const error = validateGeometry(
      p.geometry,
      parcelBoundary(migrated, p),
      result.parcels.filter((q) => q.landId === p.landId),
      p.id,
    );
    if (error) throw Error(error);
  }
  return migrated;
}
