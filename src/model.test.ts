import { describe, it, expect } from "vitest";
import {
  demo,
  geometry,
  hectares,
  validateGeometry,
  associate,
  history,
  exportGeo,
  importGeo,
} from "./model";
const box = (x: number, y: number, w = 0.001, h = 0.001) =>
  geometry([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]);
describe("Geometria e relações agrícolas", () => {
  it("calcula áreas geográficas reais", () => {
    expect(hectares(box(-17, 32.7))).toBeGreaterThan(1);
    expect(hectares(box(-17, 32.7))).toBeLessThan(1.1);
  });
  it("aceita três parcelas internas sem sobreposições", () => {
    const land = {
      id: "l",
      farmId: "f",
      name: "Terreno",
      geometry: box(-17, 32.7, 0.004, 0.004),
    };
    const parcels = [0, 1, 2].map((i) => ({
      id: "p" + i,
      landId: "l",
      name: "P" + i,
      crop: "Vinha",
      variety: "",
      geometry: box(-16.9999 + i * 0.0011, 32.7001, 0.0008, 0.003),
    }));
    for (const p of parcels)
      expect(validateGeometry(p.geometry, land, parcels, p.id)).toBeNull();
  });
  it("rejeita parcelas fora do terreno e sobrepostas", () => {
    const land = {
      id: "l",
      farmId: "f",
      name: "Terreno",
      geometry: box(-17, 32.7, 0.004, 0.004),
    };
    expect(validateGeometry(box(-17.001, 32.7), land)).toMatch(
      /dentro|fora do terreno/,
    );
    const p = {
      id: "p",
      landId: "l",
      name: "P",
      crop: "Vinha",
      variety: "",
      geometry: box(-16.9999, 32.7001),
    };
    expect(validateGeometry(box(-16.9998, 32.7002), land, [p])).toMatch(
      /sobrepõe/,
    );
  });
  it("rejeita auto-interseções", () => {
    expect(
      validateGeometry(
        geometry([
          [0, 0],
          [1, 1],
          [1, 0],
          [0, 1],
        ]),
      ),
    ).toBeTruthy();
  });
  it("associa sensores à parcela e mantém sensores fora sem associação", () => {
    const d = demo();
    const sensor = d.devices[0];
    expect(associate(sensor.location, sensor.farmId, d).parcelId).toBe(
      sensor.parcelId,
    );
    expect(associate([-16, 33], sensor.farmId, d)).toEqual({
      landId: undefined,
      parcelId: undefined,
    });
  });
});
describe("Persistência e dados simulados", () => {
  it("exporta e reimporta as entidades e geometrias", () => {
    const d = demo();
    expect(importGeo(JSON.parse(JSON.stringify(exportGeo(d))))).toMatchObject(
      JSON.parse(JSON.stringify(d)),
    );
  });
  it("rejeita ficheiros com associações partidas", () => {
    const d = demo();
    d.lands[0].farmId = "inexistente";
    expect(() => importGeo(exportGeo(d))).toThrow(/Associações/);
  });
  it("gera 30 dias determinísticos e atualiza a leitura", () => {
    const s = demo().devices[0];
    expect(history(s, s.type, 0, 30)).toHaveLength(720);
    expect(history(s, s.type, 0, 30)).toEqual(history(s, s.type, 0, 30));
    expect(history(s, s.type, 1, 1).at(-1)).not.toEqual(
      history(s, s.type, 0, 1).at(-1),
    );
  });
});

import {
  migrateData,
  validateFarm,
  parcelInFarm,
  parcelBoundary,
  farmArea,
} from "./model";
import type { Data, Farm } from "./model";
function sharedTerrain(): Data {
  const land = {
    id: "shared",
    name: "Terreno partilhado",
    geometry: box(-17, 32.7, 0.006, 0.004),
  };
  const farms: Farm[] = [0, 1].map((i) => ({
    id: "owner" + i,
    landId: land.id,
    name: "Exploração " + i,
    responsible: "Responsável " + i,
    organizationId: "o" + (i + 1),
    municipality: "Calheta",
    location: [-16.999 + i * 0.003, 32.701],
    description: "",
    geometry: box(-16.9998 + i * 0.003, 32.7002, 0.0025, 0.0035),
  }));
  return {
    schemaVersion: 2,
    tick: 0,
    lands: [land],
    farms,
    devices: [],
    parcels: farms.map((f, i) => ({
      id: "parcel" + i,
      farmId: f.id,
      landId: land.id,
      name: "Parcela " + i,
      crop: i ? "Banana" : "Vinha",
      variety: "",
      geometry: box(
        f.geometry!.coordinates[0][0][0] + 0.0001,
        32.7003,
        0.001,
        0.001,
      ),
    })),
  };
}
describe("Explorações independentes num terreno", () => {
  it("migra dados anteriores sem perder sensores, parcelas ou geometria", () => {
    const old = demo();
    delete old.schemaVersion;
    old.farms = old.farms.map(
      ({ landId, geometry, responsible, ...farm }) => farm,
    );
    old.parcels = old.parcels.map(({ farmId, ...parcel }) => parcel);
    const migrated = migrateData(old);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.devices).toEqual(old.devices);
    expect(migrated.farms[0].geometry).toEqual(old.lands[0].geometry);
    expect(migrated.parcels[0].farmId).toBe(old.farms[0].id);
    expect(migrateData(migrated)).toEqual(migrated);
  });
  it("valida duas explorações internas e rejeita sobreposições ou limites exteriores", () => {
    const d = sharedTerrain();
    expect(d.farms.map((f) => validateFarm(d, f))).toEqual([null, null]);
    const overlap = { ...d.farms[1], geometry: d.farms[0].geometry };
    expect(validateFarm(d, overlap)).toMatch(/sobrepõe/);
    expect(
      validateFarm(d, { ...d.farms[0], geometry: box(-17.1, 32.7) }),
    ).toMatch(/dentro|fora do terreno/);
  });
  it("não associa sensores ou parcelas à exploração vizinha", () => {
    const d = sharedTerrain();
    const p = d.parcels[0].geometry.coordinates[0][0] as [number, number];
    expect(associate(p, d.farms[0].id, d).parcelId).toBe("parcel0");
    expect(associate(p, d.farms[1].id, d).parcelId).toBeUndefined();
    expect(parcelInFarm(d.parcels[0], d.farms[1], d)).toBe(false);
    expect(parcelBoundary(d, d.parcels[0])?.geometry).toEqual(
      d.farms[0].geometry,
    );
  });
  it("impede diminuir uma exploração para fora das suas parcelas", () => {
    const d = sharedTerrain();
    expect(
      validateFarm(d, {
        ...d.farms[0],
        geometry: box(-16.9998, 32.7002, 0.0002, 0.0002),
      }),
    ).toMatch(/parcela/);
  });
  it("exporta/importa a hierarquia e calcula a área de cada exploração", () => {
    const d = sharedTerrain();
    const result = importGeo(JSON.parse(JSON.stringify(exportGeo(d))));
    expect(result).toMatchObject(d);
    expect(farmArea(d, d.farms[0])).toBeLessThan(hectares(d.lands[0].geometry));
  });
  it("aceita terrenos ainda sem explorações", () => {
    const d = sharedTerrain();
    d.farms = [];
    d.parcels = [];
    expect(importGeo(exportGeo(d)).lands).toHaveLength(1);
  });
});

import {
  setFarmGeometry,
  updateLandGeometry,
  farmOnLand,
  farmGeometry,
} from "./model";
describe("Uma exploração em vários terrenos", () => {
  it("mantém a mesma identidade e limites separados em dois terrenos", () => {
    const d = demo();
    const extra = {
      id: "extra",
      name: "Segundo terreno",
      geometry: box(-17.1, 32.7, 0.005, 0.005),
    };
    d.lands.push(extra);
    d.farms[0] = setFarmGeometry(
      d.farms[0],
      extra.id,
      box(-17.099, 32.701, 0.002, 0.002),
    );
    expect(farmOnLand(d.farms[0], extra)).toBe(true);
    expect(validateFarm(d, d.farms[0])).toBeNull();
    expect(associate([-17.098, 32.702], d.farms[0].id, d).landId).toBe("extra");
    expect(importGeo(exportGeo(d)).farms[0].additionalLands).toEqual(
      d.farms[0].additionalLands,
    );
  });
  it("acompanha o contorno quando exploração e terreno tinham limites iguais", () => {
    const d = demo();
    const old = d.lands[0];
    const coords = structuredClone(old.geometry);
    coords.coordinates[0][0][0] -= 0.00005;
    coords.coordinates[0][coords.coordinates[0].length - 1] =
      coords.coordinates[0][0];
    const updated = updateLandGeometry(d, old.id, coords);
    expect(farmGeometry(updated.farms[0], updated.lands[0])).toEqual(coords);
    expect(validateFarm(updated, updated.farms[0])).toBeNull();
    expect(updated.parcels).toEqual(d.parcels);
  });
});
