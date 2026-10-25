import { useEffect, useMemo, useState, useRef } from "react";
import {
  Map as MapIcon,
  Sprout,
  Radio,
  CloudSun,
  Bell,
  ChartNoAxesCombined,
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Plus,
  SlidersHorizontal,
  RotateCcw,
  Leaf,
  MapPin,
  X,
  Layers,
  Download,
  Upload,
  Pentagon as PolygonIcon,
  MousePointer2,
  Save,
  Trash2,
  Pencil,
  Check,
  RefreshCw,
  Wind,
  Droplets,
  Thermometer,
  HelpCircle,
  Menu,
  Mountain,
  Building2,
  Wifi,
  Clock,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import type { Polygon } from "geojson";
import MapView from "./MapView";
import type { MapMode } from "./MapView";
import { Badge, Field, Modal, Chart, Stats } from "./components";
import {
  storage,
  farmOnLand,
  updateLandGeometry,
  parcelInFarm,
  parcelBoundary,
  validateFarm,
  farmArea,
  migrateData,
  demo,
  organizations,
  crops,
  types,
  colors,
  metricSpec,
  id,
  hectares,
  geometryCenter,
  formatArea,
  validateGeometry,
  associate,
  latest,
  exportGeo,
  importGeo,
} from "./model";
import type { Data, Farm, Parcel, Device, Coord } from "./model";
import Terrains from "./Terrains";
import { openMeteo } from "./services";
import type { Weather } from "./services";
const tabs = [
  { name: "Mapa", icon: MapIcon },
  { name: "Terrenos", icon: PolygonIcon },
  { name: "Explorações", icon: Sprout },
  { name: "Sensores", icon: Radio },
  { name: "Estações", icon: CloudSun },
  { name: "Alertas", icon: Bell },
  { name: "Analytics", icon: ChartNoAxesCombined },
  { name: "Parceiros", icon: Users },
];
const layerNames = [
  "Explorações",
  "Terrenos",
  "Parcelas",
  "Culturas",
  "Sensores",
  "Estações",
  "Alertas",
];
const initialFilters = {
  farmId: "",
  query: "",
  municipality: "",
  crop: "",
  organization: "",
  type: "",
  status: "",
};
export default function App() {
  const [data, setData] = useState<Data>(storage.load);
  const [page, setPage] = useState("Mapa");
  const [profile, setProfile] = useState("Administrador");
  const [filters, setFilters] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [layers, setLayers] = useState(layerNames);
  const [sidebar, setSidebar] = useState(false);
  const [selectedFarm, setSelectedFarm] = useState<string>();
  const [selectedDevice, setSelectedDevice] = useState<string>();
  const [selectedParcel, setSelectedParcel] = useState<string>();
  const [detail, setDetail] = useState(false);
  const [editing, setEditing] = useState(false);
  const [terrainDirty, setTerrainDirty] = useState(false);
  const [draft, setDraft] = useState<Data>();
  const [mode, setMode] = useState<MapMode>(null);
  const [selectedShape, setSelectedShape] = useState<string>();
  const [modal, setModal] = useState<string>();
  const [toast, setToast] = useState("");
  const [days, setDays] = useState(7);
  const [automatic, setAutomatic] = useState(false);
  const [threshold, setThreshold] = useState(30);
  const [heat, setHeat] = useState(30);
  const [rain, setRain] = useState(10);
  const [sensorType, setSensorType] = useState(types[0]);
  const [sensorName, setSensorName] = useState("");
  const [parcelName, setParcelName] = useState("");
  const [parcelCrop, setParcelCrop] = useState(crops[0]);
  const [parcelVariety, setParcelVariety] = useState("");
  const [pendingGeometry, setPendingGeometry] = useState<Polygon>();
  const [editParcel, setEditParcel] = useState<string>();
  const [landId, setLandId] = useState("");
  const [weather, setWeather] = useState<Weather>();
  const [weatherError, setWeatherError] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [fileInput] = [useRef<HTMLInputElement>(null)];
  const notify = (s: string) => setToast(s);
  useEffect(() => {
    try {
      storage.save(data);
    } catch {
      setToast(
        "Não foi possível guardar: o armazenamento local está cheio ou bloqueado. Exporte os dados.",
      );
    }
  }, [data]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (!automatic) return;
    const t = setInterval(
      () => setData((d) => ({ ...d, tick: d.tick + 1 })),
      30000,
    );
    return () => clearInterval(t);
  }, [automatic]);
  const accessible = data.farms.filter((f) =>
    profile === "Agricultor"
      ? f.organizationId === "o1"
      : profile === "Empresa agrícola"
        ? f.organizationId === "o2"
        : profile === "Município"
          ? f.municipality === "Calheta"
          : true,
  );
  const visibleFarms = accessible.filter(
    (f) =>
      (!applied.farmId || f.id === applied.farmId) &&
      (!applied.municipality || f.municipality === applied.municipality) &&
      (!applied.organization || f.organizationId === applied.organization) &&
      (!applied.query ||
        [f.name, f.municipality]
          .join(" ")
          .toLowerCase()
          .includes(applied.query.toLowerCase())) &&
      (!applied.crop ||
        data.parcels.some(
          (p) => p.crop === applied.crop && parcelInFarm(p, f, data),
        ) ||
        (applied.crop === "Apicultura" &&
          data.devices.some(
            (d) => d.farmId === f.id && d.type.includes("colmeia"),
          ))),
  );
  const scoped: Data = {
    ...data,
    farms: visibleFarms,
    lands: data.lands
      .filter((l) => visibleFarms.some((f) => farmOnLand(f, l)))
      .map((l) => ({
        ...l,
        farmId: visibleFarms.some((f) => f.id === l.farmId)
          ? l.farmId
          : undefined,
      })),
    parcels: data.parcels.filter((p) =>
      visibleFarms.some((f) => parcelInFarm(p, f, data)),
    ),
    devices: data.devices.filter(
      (d) =>
        visibleFarms.some((f) => f.id === d.farmId) &&
        (!applied.type || d.type === applied.type) &&
        (!applied.status || d.status === applied.status),
    ),
  };
  const active = editing && draft ? draft : scoped;
  const farm = active.farms.find((f) => f.id === selectedFarm);
  const farmLands = active.lands.filter((l) => farm && farmOnLand(farm, l));
  const farmParcels = active.parcels.filter((p) =>
    farm ? parcelInFarm(p, farm, active) : false,
  );
  const farmDevices = active.devices.filter((d) => d.farmId === selectedFarm);
  const parcel = farmParcels.find((p) => p.id === selectedParcel);
  const device = active.devices.find((d) => d.id === selectedDevice);
  const metricsDevices = selectedParcel
    ? farmDevices.filter((d) => d.parcelId === selectedParcel)
    : farmDevices;
  const alerts = useMemo(
    () =>
      scoped.devices.flatMap((d) => {
        if (d.status === "Offline")
          return [
            {
              id: d.id + "offline",
              device: d,
              title: "Sensor sem comunicação",
              description: "Última comunicação fora do intervalo esperado.",
              level: "Alta",
            },
          ];
        const value = latest(d, data.tick).value;
        return d.type === "Humidade do solo" && value < threshold
          ? [
              {
                id: d.id + "dry",
                device: d,
                title: "Humidade do solo baixa",
                description: `${value}% · Limite demonstrativo: ${threshold}%`,
                level: "Média",
              },
            ]
          : d.type.includes("Temperatura") && value > heat
            ? [
                {
                  id: d.id + "heat",
                  device: d,
                  title: "Temperatura elevada",
                  description: `${value} °C · Limite: ${heat} °C`,
                  level: "Alta",
                },
              ]
            : ["Pluviómetro", "Estação meteorológica"].includes(d.type) &&
                metricSpec[d.type].some((m) => m.label === "Precipitação") &&
                history(d, "Precipitação", data.tick, 1).at(-1)!.value > rain
              ? [
                  {
                    id: d.id + "rain",
                    device: d,
                    title: "Precipitação elevada",
                    description: `${history(d, "Precipitação", data.tick, 1).at(-1)!.value} mm · Limite: ${rain} mm`,
                    level: "Média",
                  },
                ]
              : [];
      }),
    [scoped.devices, data.tick, threshold, heat, rain],
  );
  function navigate(p: string) {
    if (p === "Terrenos" && page === "Terrenos") return;
    if (
      (editing || terrainDirty) &&
      !confirm("Sair do editor e descartar as alterações não guardadas?")
    )
      return;
    setPage(p);
    setTerrainDirty(false);
    setEditing(false);
    setDraft(undefined);
    setSelectedFarm(undefined);
    setSelectedParcel(undefined);
    setDetail(false);
    setMode(null);
    setSidebar(false);
  }
  function openFarm(fid: string, full = false) {
    setSelectedFarm(fid);
    setSelectedParcel(undefined);
    setDetail(full);
    if (full) setPage("Explorações");
    setWeather(undefined);
    setWeatherError("");
  }
  function startEditor(fid: string) {
    setDraft(migrateData(structuredClone(data)));
    setSelectedFarm(fid);
    setSelectedParcel(undefined);
    setSelectedShape(
      data.lands.find((l) => {
        const f = data.farms.find((f) => f.id === fid);
        return f && farmOnLand(f, l);
      })?.id,
    );
    setEditing(true);
    setDetail(false);
    setPage("Mapa");
    setMode("edit");
    setLandId(
      data.lands.find((l) => {
        const f = data.farms.find((f) => f.id === fid);
        return f && farmOnLand(f, l);
      })?.id || "",
    );
  }
  function save() {
    if (!draft || !farm) return;
    if (!farm.name.trim()) {
      notify("Indique o nome da exploração.");
      return;
    }
    if (!farmLands.length) {
      notify("Desenhe pelo menos um terreno antes de guardar.");
      return;
    }
    const error = draft.parcels
      .map((p) =>
        validateGeometry(
          p.geometry,
          parcelBoundary(draft, p),
          draft.parcels.filter((q) => q.landId === p.landId),
          p.id,
        ),
      )
      .find(Boolean);
    if (error) {
      notify(error);
      return;
    }
    const farmError = draft.farms
      .map((f) => validateFarm(draft, f))
      .find(Boolean);
    if (farmError) {
      notify(farmError);
      return;
    }
    setData(
      migrateData({
        ...draft,
        devices: draft.devices.map((d) => ({
          ...d,
          ...associate(d.location, d.farmId, draft),
        })),
      }),
    );
    setEditing(false);
    setDraft(undefined);
    setMode(null);
    setDetail(true);
    notify("Exploração guardada com sucesso.");
  }
  function draw(g: Polygon) {
    if (!draft || !farm) return;
    const land = draft.lands.find((l) => l.id === landId);
    if (mode === "parcel" && !land) {
      notify("Selecione ou desenhe um terreno primeiro.");
      return;
    }
    const error = validateGeometry(
      g,
      mode === "parcel"
        ? parcelBoundary(draft, { landId, farmId: farm.id })
        : undefined,
      mode === "parcel" ? farmParcels.filter((p) => p.landId === landId) : [],
    );
    if (error) {
      notify(error);
      return;
    }
    if (mode === "land") {
      const lid = id();
      setDraft({
        ...draft,
        farms: draft.farms.map((f) =>
          f.id === farm.id && !farmLands.length
            ? { ...f, location: geometryCenter(g), landId: lid, geometry: g }
            : f,
        ),
        lands: [
          ...draft.lands,
          {
            id: lid,
            farmId: farm.id,
            name: `Terreno ${farmLands.length + 1}`,
            geometry: g,
          },
        ],
      });
      setLandId(lid);
      setSelectedShape(lid);
      setMode(null);
      notify("Terreno desenhado. Pode agora adicionar parcelas.");
    } else {
      setPendingGeometry(g);
      setParcelName(`Parcela ${farmParcels.length + 1}`);
      setEditParcel(undefined);
      setModal("parcel");
      setMode(null);
    }
  }
  function moveGeometry(g: Polygon) {
    if (!draft) return;
    const p = draft.parcels.find((p) => p.id === selectedShape);
    let error = validateGeometry(
      g,
      p ? parcelBoundary(draft, p) : undefined,
      p ? draft.parcels.filter((q) => q.landId === p.landId) : [],
      p?.id,
    );
    if (!p) {
      const l = draft.lands.find((l) => l.id === selectedShape);
      if (l)
        error =
          draft.parcels
            .filter((p) => p.landId === l.id)
            .map((p) => validateGeometry(p.geometry, { ...l, geometry: g }))
            .find(Boolean) || error;
    }
    if (error) {
      notify(error);
      setDraft({ ...draft });
      return;
    }
    const next = {
      ...draft,
      parcels: draft.parcels.map((p) =>
        p.id === selectedShape ? { ...p, geometry: g } : p,
      ),
      ...(!p ? updateLandGeometry(draft, selectedShape!, g) : {}),
    };
    const farmError = next.farms
      .map((f) => validateFarm(next, f))
      .find(Boolean);
    if (farmError) {
      notify(farmError);
      setDraft({ ...draft });
      return;
    }
    next.devices = next.devices.map((d) => ({
      ...d,
      ...associate(d.location, d.farmId, next),
    }));
    setDraft(next);
  }
  function place(location: Coord) {
    if (!draft || !farm) return;
    const newDevice: Device = {
      id: id(),
      farmId: farm.id,
      ...associate(location, farm.id, draft),
      name: sensorName || `${sensorType} ${farmDevices.length + 1}`,
      type: sensorType,
      location,
      status: "Online",
      lastSeen: new Date().toISOString(),
      manufacturer: "Co.nTe Demo",
      model: "Virtual S1",
      frequency: 60,
    };
    setDraft({ ...draft, devices: [...draft.devices, newDevice] });
    setMode(null);
    notify("Sensor colocado e associado à localização.");
  }
  function download() {
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(exportGeo(scoped), null, 2)], {
        type: "application/geo+json",
      }),
    );
    a.href = url;
    a.download = "conte-agro.geojson";
    a.click();
    URL.revokeObjectURL(url);
    notify("Dados GeoJSON exportados.");
  }
  async function fetchWeather() {
    if (!farm) return;
    setWeatherLoading(true);
    setWeatherError("");
    try {
      setWeather(await openMeteo.fetch(farm.location));
    } catch (e) {
      setWeatherError(e instanceof Error ? e.message : "Serviço indisponível.");
    } finally {
      setWeatherLoading(false);
    }
  }
  const shape =
    active.parcels.find((p) => p.id === selectedShape) ||
    active.lands.find((l) => l.id === selectedShape);
  function farmForm(f: Farm) {
    return (
      <>
        <Field label="Nome da exploração *">
          <input
            value={f.name}
            onChange={(e) =>
              setDraft(
                (d) =>
                  d && {
                    ...d,
                    farms: d.farms.map((x) =>
                      x.id === f.id ? { ...x, name: e.target.value } : x,
                    ),
                  },
              )
            }
          />
        </Field>
        <Field label="Responsável da exploração">
          <input
            value={f.responsible || ""}
            onChange={(e) =>
              setDraft(
                (d) =>
                  d && {
                    ...d,
                    farms: d.farms.map((x) =>
                      x.id === f.id ? { ...x, responsible: e.target.value } : x,
                    ),
                  },
              )
            }
          />
        </Field>
        <Field label="Organização">
          <select
            value={f.organizationId}
            onChange={(e) =>
              setDraft(
                (d) =>
                  d && {
                    ...d,
                    farms: d.farms.map((x) =>
                      x.id === f.id
                        ? { ...x, organizationId: e.target.value }
                        : x,
                    ),
                  },
              )
            }
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Município">
          <select
            value={f.municipality}
            onChange={(e) =>
              setDraft(
                (d) =>
                  d && {
                    ...d,
                    farms: d.farms.map((x) =>
                      x.id === f.id
                        ? { ...x, municipality: e.target.value }
                        : x,
                    ),
                  },
              )
            }
          >
            {[
              "Câmara de Lobos",
              "Ribeira Brava",
              "Calheta",
              "Funchal",
              "Santana",
              "São Vicente",
              "Machico",
              "Ponta do Sol",
              "Porto Moniz",
              "Santa Cruz",
              "Porto Santo",
            ].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Descrição (opcional)">
          <textarea
            value={f.description}
            onChange={(e) =>
              setDraft(
                (d) =>
                  d && {
                    ...d,
                    farms: d.farms.map((x) =>
                      x.id === f.id ? { ...x, description: e.target.value } : x,
                    ),
                  },
              )
            }
          />
        </Field>
      </>
    );
  }
  function sensorsTable(devices: Device[]) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sensor / dispositivo</th>
              <th>Exploração</th>
              <th>Parcela</th>
              <th>Última leitura</th>
              <th>Atualização</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr
                key={d.id}
                onClick={() => setSelectedDevice(d.id)}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setSelectedDevice(d.id)}
              >
                <td>
                  <div className="table-name">
                    <span className="soft-icon blue">
                      <Radio size={18} />
                    </span>
                    <span>
                      <b>{d.name}</b>
                      <small>{d.type}</small>
                    </span>
                  </div>
                </td>
                <td>{data.farms.find((f) => f.id === d.farmId)?.name}</td>
                <td>
                  {data.parcels.find((p) => p.id === d.parcelId)?.name ||
                    "Ao nível do terreno"}
                </td>
                <td>
                  <strong>
                    {latest(d, data.tick).value} {metricSpec[d.type][0].unit}
                  </strong>
                  <small>Simulado</small>
                </td>
                <td>
                  {d.status === "Offline"
                    ? "Sem comunicação"
                    : new Date(
                        latest(d, data.tick).timestamp,
                      ).toLocaleTimeString("pt-PT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                </td>
                <td>
                  <Badge kind={d.status === "Online" ? "green" : "red"}>
                    ● {d.status}
                  </Badge>
                </td>
                <td>
                  <ChevronRight size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!devices.length && (
          <div className="empty">
            Não foram encontrados sensores para estes filtros.
          </div>
        )}
      </div>
    );
  }
  function period() {
    return (
      <select
        className="period"
        aria-label="Período"
        value={days}
        onChange={(e) => setDays(+e.target.value)}
      >
        <option value={1}>Últimas 24 horas</option>
        <option value={7}>Últimos 7 dias</option>
        <option value={30}>Últimos 30 dias</option>
      </select>
    );
  }
  function metricCards() {
    return (
      <div className="metric-grid">
        {[
          "Humidade do solo",
          "Temperatura do ar",
          "Humidade relativa",
          "Precipitação",
        ].map((label, i) => {
          const d = metricsDevices.find((d) =>
            metricSpec[d.type].some((m) => m.label === label),
          );
          const spec = d && metricSpec[d.type].find((m) => m.label === label);
          return (
            <div className="metric-card" key={label}>
              <span className={"soft-icon " + (i === 1 ? "orange" : "blue")}>
                {i === 1 ? <Thermometer size={20} /> : <Droplets size={20} />}
              </span>
              <small>{label}</small>
              <strong>
                {d && spec ? (
                  <MetricValue d={d} metric={label} tick={data.tick} />
                ) : (
                  <span className="no-sensor">Sem sensor associado</span>
                )}
              </strong>
              <span className="muted small">
                {d
                  ? d.status === "Offline"
                    ? "Última leitura · Offline"
                    : "Simulado · DEMO"
                  : "Adicione um sensor"}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="app">
      <header className="topbar">
        <button
          className="mobile-menu icon-button"
          aria-label="Abrir filtros"
          onClick={() => setSidebar(!sidebar)}
        >
          <Menu />
        </button>
        <button className="brand" onClick={() => navigate("Mapa")}>
          <span className="brand-leaf">
            <Leaf size={37} strokeWidth={1.6} />
          </span>
          <span>
            <strong>
              Co.nTe <em>Agro</em>
            </strong>
            <small>AGRICULTURA INTELIGENTE · MADEIRA</small>
          </span>
        </button>
        <nav>
          {tabs.map((t) => (
            <button
              key={t.name}
              className={page === t.name ? "selected" : ""}
              onClick={() => navigate(t.name)}
            >
              <t.icon size={19} />
              <span>{t.name}</span>
              {t.name === "Alertas" && alerts.length > 0 && (
                <i>{alerts.length}</i>
              )}
            </button>
          ))}
        </nav>
        <div className="account">
          <button
            className="icon-button help"
            title="Sobre a demonstração"
            onClick={() => setModal("help")}
          >
            <HelpCircle size={20} />
          </button>
          <span className="avatar">MP</span>
          <label>
            <b>Maria Pereira</b>
            <select
              aria-label="Perfil demonstrativo"
              value={profile}
              onChange={(e) => {
                setProfile(e.target.value);
                setSelectedFarm(undefined);
                setEditing(false);
                setDetail(false);
                setApplied(initialFilters);
                setFilters(initialFilters);
                notify("Perfil demonstrativo atualizado.");
              }}
            >
              {[
                "Administrador",
                "Agricultor",
                "Empresa agrícola",
                "Município",
                "Investigador",
              ].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <div className="workspace">
        {page === "Mapa" && !editing && !detail && (
          <aside className={"filter-sidebar " + (sidebar ? "mobile-open" : "")}>
            <div className="section-heading">
              <h2>Filtros do mapa</h2>
              <SlidersHorizontal size={18} />
            </div>
            <p className="muted small">O seu território, numa só visão.</p>
            <Field label="Pesquisar localização">
              <div className="input-icon">
                <Search size={17} />
                <input
                  placeholder="Concelho, exploração..."
                  value={filters.query}
                  onChange={(e) =>
                    setFilters({ ...filters, query: e.target.value })
                  }
                />
              </div>
            </Field>
            <Field label="Município">
              <select
                value={filters.municipality}
                onChange={(e) =>
                  setFilters({ ...filters, municipality: e.target.value })
                }
              >
                <option value="">Todos os municípios</option>
                {[...new Set(data.farms.map((f) => f.municipality))].map(
                  (m) => (
                    <option key={m}>{m}</option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Cultura principal">
              <select
                value={filters.crop}
                onChange={(e) =>
                  setFilters({ ...filters, crop: e.target.value })
                }
              >
                <option value="">Todas as culturas</option>
                {crops.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Organização">
              <select
                value={filters.organization}
                onChange={(e) =>
                  setFilters({ ...filters, organization: e.target.value })
                }
              >
                <option value="">Todas as organizações</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo de sensor">
              <select
                value={filters.type}
                onChange={(e) =>
                  setFilters({ ...filters, type: e.target.value })
                }
              >
                <option value="">Todos os sensores</option>
                {types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Estado dos dispositivos">
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
              >
                <option value="">Todos os estados</option>
                <option>Online</option>
                <option>Offline</option>
              </select>
            </Field>
            <div className="filter-divider" />
            <h3 className="layer-heading">
              <Layers size={16} /> Camadas do mapa
            </h3>
            <div className="layer-list">
              {layerNames.map((l, i) => (
                <label key={l}>
                  <input
                    type="checkbox"
                    checked={layers.includes(l)}
                    onChange={() =>
                      setLayers(
                        layers.includes(l)
                          ? layers.filter((x) => x !== l)
                          : [...layers, l],
                      )
                    }
                  />
                  <span className={"layer-dot dot-" + i} />
                  <span>{l}</span>
                  <small>
                    {
                      [
                        scoped.farms.length,
                        scoped.lands.length,
                        scoped.parcels.length,
                        new Set(scoped.parcels.map((p) => p.crop)).size,
                        scoped.devices.length,
                        scoped.devices.filter(
                          (d) => d.type === "Estação meteorológica",
                        ).length,
                        alerts.length,
                      ][i]
                    }
                  </small>
                </label>
              ))}
            </div>
            <button
              className="primary full"
              onClick={() => {
                setApplied(filters);
                setSidebar(false);
                setSelectedFarm(undefined);
                notify("Filtros aplicados.");
              }}
            >
              <SlidersHorizontal size={16} /> Aplicar filtros
            </button>
            <button
              className="text-button full"
              onClick={() => {
                setFilters(initialFilters);
                setApplied(initialFilters);
              }}
            >
              <RotateCcw size={14} /> Limpar filtros
            </button>
            <div className="sustainability">
              <span className="eyebrow">CULTIVAR O FUTURO</span>
              <h3>
                Uma Madeira
                <br />
                mais sustentável.
              </h3>
              <p>
                Inovação que aproxima
                <br />a terra e as pessoas.
              </p>
              <button
                aria-label="Conhecer parceiros"
                onClick={() => navigate("Parceiros")}
              >
                <ArrowUpRight size={20} />
              </button>
              <Mountain className="mountain-art" size={125} strokeWidth={0.6} />
            </div>
            <div className="sidebar-footer">
              <span className="status-dot" /> Rede Co.nTe operacional{" "}
              <Badge kind="neutral">DEMO</Badge>
            </div>
          </aside>
        )}
        {page === "Terrenos" ? (
          <Terrains
            key={profile}
            data={data}
            canEdit={profile !== "Investigador" && profile !== "Município"}
            showAll={profile === "Administrador"}
            organizationId={
              profile === "Agricultor"
                ? "o1"
                : profile === "Empresa agrícola"
                  ? "o2"
                  : undefined
            }
            visibleFarmIds={accessible.map((f) => f.id)}
            onSave={setData}
            notify={notify}
            onDirty={setTerrainDirty}
            onFarm={(fid) => {
              setTerrainDirty(false);
              openFarm(fid, true);
            }}
          />
        ) : editing && farm ? (
          <main className="editor-page">
            <div className="page-heading">
              <div>
                <div className="breadcrumb">
                  Mapa <ChevronRight size={13} /> Editor geográfico
                </div>
                <h1>
                  Desenhar <span>exploração</span>
                </h1>
                <p>
                  Defina os limites da sua exploração e coloque os sensores nos
                  locais exatos.
                </p>
              </div>
              <Badge>DEMO · Alterações por guardar</Badge>
            </div>
            <div className="editor-layout">
              <div className="editor-main">
                <div className="steps">
                  {[
                    "Desenhar terreno",
                    "Criar parcelas",
                    "Adicionar sensores",
                  ].map((s, i) => (
                    <div
                      key={s}
                      className={
                        (i === 0 && !farmLands.length) ||
                        (i === 1 && farmLands.length && !farmParcels.length) ||
                        (i === 2 && farmParcels.length)
                          ? "current"
                          : ""
                      }
                    >
                      <b>{i + 1}</b>
                      <span>
                        {s}
                        <small>
                          {
                            [
                              "Defina os limites no mapa",
                              "Atribua culturas e variedades",
                              "Monitorize a sua exploração",
                            ][i]
                          }
                        </small>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="editor-map">
                  <MapView
                    data={active}
                    farmId={farm.id}
                    focusLandId={landId || undefined}
                    layers={layerNames}
                    mode={mode}
                    selectedGeometry={shape}
                    onDraw={draw}
                    onGeometry={moveGeometry}
                    onPlace={place}
                    onCancel={() => setMode(null)}
                    onLand={(lid) => {
                      setSelectedShape(lid);
                      setLandId(lid);
                      setSelectedParcel(undefined);
                      setMode("edit");
                    }}
                    onParcel={(pid) => {
                      setSelectedShape(pid);
                      setSelectedParcel(pid);
                      const selected = active.parcels.find((p) => p.id === pid);
                      if (selected) setLandId(selected.landId);
                      setMode("edit");
                    }}
                    onDevice={setSelectedDevice}
                    onMove={(did, location) =>
                      setDraft(
                        (d) =>
                          d && {
                            ...d,
                            devices: d.devices.map((s) =>
                              s.id === did
                                ? {
                                    ...s,
                                    location,
                                    ...associate(location, s.farmId, d),
                                  }
                                : s,
                            ),
                          },
                      )
                    }
                  />
                  <div className="editor-toolbar">
                    <button
                      className={mode === "land" ? "active" : ""}
                      onClick={() => setMode("land")}
                    >
                      <PolygonIcon size={18} /> Terreno
                    </button>
                    <button
                      disabled={!farmLands.length}
                      className={mode === "parcel" ? "active" : ""}
                      onClick={() => setMode("parcel")}
                    >
                      <Plus size={18} /> Parcela
                    </button>
                    <button
                      className={mode === "edit" ? "active" : ""}
                      onClick={() => {
                        setSelectedShape(selectedShape || farmLands[0]?.id);
                        setMode("edit");
                      }}
                    >
                      <MousePointer2 size={17} /> Editar limites
                    </button>
                    <button
                      className={mode === "sensor" ? "active" : ""}
                      onClick={() => setModal("sensor-create")}
                    >
                      <Radio size={18} /> Sensor
                    </button>
                    <button className="primary" onClick={save}>
                      <Save size={17} /> Guardar
                    </button>
                  </div>
                  <div className="map-legend">
                    <b>
                      <Layers size={15} /> Legenda
                    </b>
                    {farmLands.map((land) => (
                      <button
                        key={land.id}
                        onClick={() => {
                          setSelectedShape(land.id);
                          setLandId(land.id);
                          setSelectedParcel(undefined);
                          setMode("edit");
                        }}
                      >
                        <i style={{ background: "#d4f4ba" }} />
                        {land.name}
                      </button>
                    ))}
                    {farmParcels.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedShape(p.id);
                          setMode("edit");
                        }}
                      >
                        <i
                          style={{ background: colors[crops.indexOf(p.crop)] }}
                        />
                        {p.name} · {p.crop}
                      </button>
                    ))}
                    {mode === "edit" && (
                      <small>
                        Selecione um limite e arraste os vértices.
                        <br />
                        Os sensores também podem ser arrastados.
                      </small>
                    )}
                  </div>
                </div>
              </div>
              <aside className="editor-panel">
                <h3>
                  <Sprout size={18} /> Informação da exploração
                </h3>
                {farmForm(farm)}
                <div className="area-summary">
                  <span>Área total</span>
                  <strong>
                    {formatArea(farmArea(active, farm))} <small>ha</small>
                  </strong>
                </div>
                <h3>
                  <PolygonIcon size={17} /> Terrenos e parcelas
                </h3>
                {farmLands.length > 0 && (
                  <Field label="Terreno selecionado">
                    <select
                      value={landId}
                      onChange={(e) => {
                        setLandId(e.target.value);
                        setSelectedShape(e.target.value);
                      }}
                    >
                      {farmLands.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {farmLands.map((l) => (
                  <div className="entity-row" key={l.id}>
                    <button
                      onClick={() => {
                        setSelectedShape(l.id);
                        setMode("edit");
                        setLandId(l.id);
                      }}
                    >
                      <PolygonIcon size={14} />
                      {l.name}
                      <small>{formatArea(hectares(l.geometry))} ha</small>
                    </button>
                    <button
                      title="Eliminar terreno"
                      disabled={active.farms.some(
                        (f) => f.id !== farm.id && farmOnLand(f, l),
                      )}
                      onClick={() => {
                        if (
                          confirm(
                            "Eliminar este terreno, as parcelas e as associações dos sensores?",
                          )
                        )
                          setDraft(
                            (d) =>
                              d && {
                                ...d,
                                lands: d.lands.filter((x) => x.id !== l.id),
                                parcels: d.parcels.filter(
                                  (p) => p.landId !== l.id,
                                ),
                                devices: d.devices.map((s) =>
                                  s.landId === l.id
                                    ? {
                                        ...s,
                                        landId: undefined,
                                        parcelId: undefined,
                                      }
                                    : s,
                                ),
                              },
                          );
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {farmParcels.map((p) => (
                  <div className="entity-row" key={p.id}>
                    <button
                      onClick={() => {
                        setSelectedShape(p.id);
                        setMode("edit");
                      }}
                    >
                      <span
                        className="color-dot"
                        style={{ background: colors[crops.indexOf(p.crop)] }}
                      />
                      {p.name}
                      <small>{formatArea(hectares(p.geometry))} ha</small>
                    </button>
                    <button
                      title="Editar parcela"
                      onClick={() => {
                        setEditParcel(p.id);
                        setParcelName(p.name);
                        setParcelCrop(p.crop);
                        setParcelVariety(p.variety);
                        setModal("parcel");
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      title="Eliminar parcela"
                      onClick={() => {
                        if (
                          confirm(
                            "Eliminar esta parcela? Os sensores serão mantidos no terreno.",
                          )
                        )
                          setDraft(
                            (d) =>
                              d && {
                                ...d,
                                parcels: d.parcels.filter((x) => x.id !== p.id),
                                devices: d.devices.map((s) =>
                                  s.parcelId === p.id
                                    ? { ...s, parcelId: undefined }
                                    : s,
                                ),
                              },
                          );
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <h3>
                  <Radio size={17} /> Sensores na exploração (
                  {farmDevices.length})
                </h3>
                {farmDevices.map((d) => (
                  <div className="entity-row" key={d.id}>
                    <button onClick={() => setSelectedDevice(d.id)}>
                      <Radio size={14} />
                      {d.name}
                    </button>
                    <button
                      title="Eliminar sensor"
                      onClick={() => {
                        if (confirm("Eliminar este sensor?"))
                          setDraft(
                            (s) =>
                              s && {
                                ...s,
                                devices: s.devices.filter((x) => x.id !== d.id),
                              },
                          );
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <button className="primary full" onClick={save}>
                  <Save size={16} /> Guardar exploração
                </button>
                <button
                  className="text-button full"
                  onClick={() => {
                    if (confirm("Descartar as alterações não guardadas?")) {
                      setEditing(false);
                      setDraft(undefined);
                      setMode(null);
                    }
                  }}
                >
                  Cancelar
                </button>
              </aside>
            </div>
          </main>
        ) : page === "Mapa" && !detail ? (
          <main className="map-page">
            <MapView
              data={scoped}
              layers={layers}
              onFarm={(fid) => openFarm(fid)}
              onDevice={setSelectedDevice}
            />
            <div className="map-overview">
              <div className="map-title">
                <div>
                  <span className="eyebrow">
                    INTELIGÊNCIA AGRÍCOLA, NO TERRENO
                  </span>
                  <h1>Uma nova perspetiva sobre a sua terra.</h1>
                </div>
                <Badge kind="glass">
                  <span className="status-dot" /> Dados demonstrativos
                </Badge>
              </div>
              <Stats data={scoped} alerts={alerts.length} />
            </div>
            <div className="map-action-bar">
              <span className="region-label">
                <MapPin size={16} /> Região Autónoma da Madeira
              </span>
              <button className="primary" onClick={() => setModal("farm")}>
                <Plus size={17} /> Nova exploração
              </button>
            </div>
            <div className="map-bottom">
              <div className="map-key">
                <span>
                  <i className="green" /> Explorações
                </span>
                <span>
                  <i className="orange" /> Sensores
                </span>
                <span>
                  <i className="blue" /> Estações
                </span>
              </div>
              <span className="map-coordinates">32°45′ N &nbsp; 17°00′ W</span>
            </div>
            {!selectedFarm && (
              <div className="map-welcome">
                <span className="soft-icon green">
                  <MousePointer2 size={21} />
                </span>
                <div>
                  <b>Explore a sua Madeira</b>
                  <p>
                    Selecione uma exploração no mapa
                    <br />
                    para conhecer o que está a crescer.
                  </p>
                </div>
                <ChevronRight size={18} />
              </div>
            )}
            {!scoped.farms.length && (
              <div className="map-empty">
                Nenhuma exploração corresponde aos filtros.
              </div>
            )}
            {farm && (
              <aside className="farm-drawer">
                <div className="section-heading">
                  <Badge>● Exploração monitorizada</Badge>
                  <button
                    className="icon-button"
                    aria-label="Fechar detalhe"
                    onClick={() => setSelectedFarm(undefined)}
                  >
                    <X size={19} />
                  </button>
                </div>
                <div className="drawer-title">
                  <span className="soft-icon green">
                    <Sprout size={25} />
                  </span>
                  <h2>
                    {farm.name}
                    <small>
                      <MapPin size={13} />
                      {farm.municipality}, Madeira
                    </small>
                  </h2>
                </div>
                <div className="farm-cover">
                  <Mountain size={60} strokeWidth={0.8} />
                  <span>{farm.description}</span>
                  <Badge kind="glass">DEMO</Badge>
                </div>
                <div className="drawer-facts">
                  <div>
                    <small>Organização</small>
                    <b>
                      {
                        organizations.find((o) => o.id === farm.organizationId)
                          ?.name
                      }
                    </b>
                  </div>
                  <div>
                    <small>Área monitorizada</small>
                    <b>{formatArea(farmArea(active, farm))} ha</b>
                  </div>
                  <div>
                    <small>Terrenos / parcelas</small>
                    <b>
                      {farmLands.length} / {farmParcels.length}
                    </b>
                  </div>
                  <div>
                    <small>Sensores online</small>
                    <b>
                      {farmDevices.filter((d) => d.status === "Online").length}{" "}
                      de {farmDevices.length}
                    </b>
                  </div>
                </div>
                <div className="crop-tags">
                  {[...new Set(farmParcels.map((p) => p.crop))].map((c) => (
                    <Badge key={c}>{c}</Badge>
                  ))}
                  {farmDevices.some((d) => d.type.includes("colmeia")) && (
                    <Badge>Apicultura</Badge>
                  )}
                </div>
                {metricCards()}
                <div className="section-heading">
                  <h3>Evolução das leituras</h3>
                  <Badge kind="neutral">7 dias · DEMO</Badge>
                </div>
                <Chart device={farmDevices[0]} tick={data.tick} />
                <button
                  className="primary full"
                  onClick={() => setDetail(true)}
                >
                  <MapIcon size={16} /> Ver exploração <ArrowRight size={16} />
                </button>
                <button
                  className="secondary full"
                  onClick={() => startEditor(farm.id)}
                >
                  <Pencil size={15} /> Editar no mapa
                </button>
              </aside>
            )}
          </main>
        ) : (
          <main className="content-page">
            <div className="page-heading">
              <div>
                <div className="breadcrumb">
                  Co.nTe Agro <ChevronRight size={13} />{" "}
                  {detail ? "Explorações" : page}
                </div>
                <h1>
                  {detail && farm
                    ? farm.name
                    : page === "Explorações"
                      ? "As suas explorações"
                      : page === "Sensores"
                        ? "Sensores e dispositivos"
                        : page === "Estações"
                          ? "Rede meteorológica"
                          : page === "Alertas"
                            ? "Centro de alertas"
                            : page === "Analytics"
                              ? "Da terra aos dados"
                              : "Uma rede que cultiva o futuro"}
                </h1>
                <p>
                  {detail && farm
                    ? farm.description
                    : page === "Explorações"
                      ? "Acompanhe cada terreno, cada cultura e cada novo crescimento."
                      : page === "Sensores"
                        ? "Todas as leituras, ligadas ao que realmente importa."
                        : page === "Estações"
                          ? "Uma visão das condições meteorológicas em cada exploração."
                          : page === "Alertas"
                            ? "Mantenha-se próximo do que precisa de atenção."
                            : page === "Analytics"
                              ? "Transforme as leituras da sua exploração em perspetivas."
                              : "Conhecimento partilhado para uma Madeira mais sustentável."}
                </p>
              </div>
              <div className="heading-actions">
                {period()}
                <Badge kind="neutral">DEMO</Badge>
                {page === "Explorações" && !detail && (
                  <button className="primary" onClick={() => setModal("farm")}>
                    <Plus size={17} /> Nova exploração
                  </button>
                )}
                {detail && farm && (
                  <button
                    className="primary"
                    onClick={() => startEditor(farm.id)}
                  >
                    <Pencil size={16} /> Editar no mapa
                  </button>
                )}
              </div>
            </div>
            {detail && farm ? (
              <>
                <div className="farm-summary">
                  <div>
                    <MapPin />
                    <span>
                      Município<strong>{farm.municipality}</strong>
                    </span>
                  </div>
                  <div>
                    <Sprout />
                    <span>
                      Culturas
                      <strong>
                        {new Set(farmParcels.map((p) => p.crop)).size ||
                          "Apicultura"}
                      </strong>
                    </span>
                  </div>
                  <div>
                    <PolygonIcon />
                    <span>
                      Área total
                      <strong>
                        {formatArea(
                          farmLands.reduce(
                            (n, l) => n + hectares(l.geometry),
                            0,
                          ),
                        )}{" "}
                        ha
                      </strong>
                    </span>
                  </div>
                  <div>
                    <Radio />
                    <span>
                      Dispositivos<strong>{farmDevices.length} sensores</strong>
                    </span>
                  </div>
                  <div>
                    <Wifi />
                    <span>
                      Conectividade
                      <strong>
                        {
                          farmDevices.filter((d) => d.status === "Online")
                            .length
                        }{" "}
                        online
                      </strong>
                    </span>
                  </div>
                </div>
                <div className="detail-grid">
                  <section className="card detail-map">
                    <div className="section-heading">
                      <h3>
                        <MapIcon size={18} /> Mapa da exploração
                      </h3>
                      <select
                        aria-label="Selecionar parcela"
                        value={selectedParcel || ""}
                        onChange={(e) =>
                          setSelectedParcel(e.target.value || undefined)
                        }
                      >
                        <option value="">Todas as parcelas</option>
                        {farmParcels.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {p.crop}
                          </option>
                        ))}
                      </select>
                    </div>
                    <MapView
                      data={scoped}
                      farmId={farm.id}
                      layers={layerNames}
                      onParcel={setSelectedParcel}
                      onDevice={setSelectedDevice}
                    />
                  </section>
                  <section className="card">
                    <div className="section-heading">
                      <h3>
                        <Radio size={18} />{" "}
                        {parcel
                          ? parcel.name + " · " + parcel.crop
                          : "Leituras dos sensores"}
                      </h3>
                      <Badge>Simulado</Badge>
                    </div>
                    {metricCards()}
                    <div className="info-note">
                      <Leaf size={18} />
                      <span>
                        {parcel
                          ? `${formatArea(hectares(parcel.geometry))} ha · ${parcel.variety || "Sem variedade indicada"}`
                          : "Selecione uma parcela no mapa para ver apenas os sensores associados."}
                      </span>
                    </div>
                  </section>
                  <section className="card">
                    <div className="section-heading">
                      <h3>
                        <CloudSun size={19} /> Meteorologia externa
                      </h3>
                    </div>
                    <p className="muted small">
                      Coordenadas consultadas: {farm.location[1].toFixed(5)},{" "}
                      {farm.location[0].toFixed(5)}
                      <br />
                      Atualização manual · Dados de modelo meteorológico
                    </p>
                    {weather ? (
                      <>
                        <div className="weather-value">
                          <CloudSun size={48} />
                          {weather.temperature}°
                          <small>
                            {weather.humidity}% HR · {weather.wind} km/h
                            <br />
                            {weather.rain} mm precipitação
                          </small>
                        </div>
                        <p className="muted small">
                          <a
                            href="https://open-meteo.com/"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {weather.source}
                          </a>
                          <br />
                          {weather.time.replace("T", " ")} · Atlantic/Madeira
                        </p>
                      </>
                    ) : (
                      <div className="weather-placeholder">
                        <CloudSun size={48} />
                        <p>O tempo, mais perto da sua terra.</p>
                        <small>
                          Consulte a previsão pública para esta localização.
                        </small>
                      </div>
                    )}
                    {weatherError && (
                      <p className="error-text">{weatherError}</p>
                    )}
                    <button
                      className="secondary full"
                      disabled={weatherLoading}
                      onClick={fetchWeather}
                    >
                      <RefreshCw size={15} />
                      {weatherLoading
                        ? "A consultar..."
                        : "Consultar Open-Meteo"}
                    </button>
                  </section>
                </div>
                <div className="two-columns">
                  <section className="card">
                    <div className="section-heading">
                      <h3>
                        Evolução · {metricsDevices[0]?.type || "Sem sensor"}
                      </h3>
                      {period()}
                    </div>
                    <Chart
                      device={metricsDevices[0]}
                      tick={data.tick}
                      days={days}
                    />
                    <span className="muted small">
                      Série demonstrativa determinística ·{" "}
                      {days === 1 ? "24 horas" : days + " dias"}
                    </span>
                  </section>
                  <section className="card">
                    <div className="section-heading">
                      <h3>Parcelas e culturas</h3>
                      <Badge>{farmParcels.length} parcelas</Badge>
                    </div>
                    {farmParcels.map((p) => (
                      <button
                        key={p.id}
                        className={
                          "parcel-list-row " +
                          (selectedParcel === p.id ? "selected" : "")
                        }
                        onClick={() => setSelectedParcel(p.id)}
                      >
                        <span
                          className="color-dot"
                          style={{ background: colors[crops.indexOf(p.crop)] }}
                        />
                        <span>
                          <b>{p.name}</b>
                          <small>
                            {p.crop} · {p.variety}
                          </small>
                        </span>
                        <strong>{formatArea(hectares(p.geometry))} ha</strong>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                    {!farmParcels.length && (
                      <div className="info-note">
                        Apiários georreferenciados através dos sensores. Sem
                        áreas de cultivo atribuídas.
                      </div>
                    )}
                  </section>
                </div>
                <section className="card">
                  <div className="section-heading">
                    <h3>
                      Sensores {parcel ? "da parcela" : "na exploração"} (
                      {metricsDevices.length})
                    </h3>
                    <button className="text-button" onClick={download}>
                      <Download size={15} /> Exportar GeoJSON
                    </button>
                  </div>
                  {sensorsTable(metricsDevices)}
                </section>
              </>
            ) : (
              <>
                {["Explorações", "Sensores", "Estações", "Analytics"].includes(
                  page,
                ) && (
                  <div className="list-filters">
                    <div className="input-icon">
                      <Search size={17} />
                      <input
                        aria-label="Pesquisar"
                        placeholder={
                          page === "Sensores"
                            ? "Pesquisar sensor..."
                            : "Pesquisar exploração..."
                        }
                        value={filters.query}
                        onChange={(e) => {
                          setFilters({ ...filters, query: e.target.value });
                          if (page !== "Sensores")
                            setApplied({ ...applied, query: e.target.value });
                        }}
                      />
                    </div>
                    <select
                      aria-label="Filtrar exploração"
                      value={applied.farmId}
                      onChange={(e) =>
                        setApplied({ ...applied, farmId: e.target.value })
                      }
                    >
                      <option value="">Todas as explorações</option>
                      {accessible.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Filtrar município"
                      value={applied.municipality}
                      onChange={(e) =>
                        setApplied({ ...applied, municipality: e.target.value })
                      }
                    >
                      <option value="">Todos os municípios</option>
                      {[...new Set(data.farms.map((f) => f.municipality))].map(
                        (m) => (
                          <option key={m}>{m}</option>
                        ),
                      )}
                    </select>
                    <select
                      aria-label="Filtrar cultura"
                      value={applied.crop}
                      onChange={(e) =>
                        setApplied({ ...applied, crop: e.target.value })
                      }
                    >
                      <option value="">Todas as culturas</option>
                      {crops.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    {page === "Sensores" && (
                      <select
                        aria-label="Filtrar tipo"
                        value={applied.type}
                        onChange={(e) =>
                          setApplied({ ...applied, type: e.target.value })
                        }
                      >
                        <option value="">Todos os tipos</option>
                        {types.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    )}
                    <button
                      className="text-button"
                      onClick={() => {
                        setApplied(initialFilters);
                        setFilters(initialFilters);
                      }}
                    >
                      <RotateCcw size={14} /> Limpar
                    </button>
                    <span className="filter-count">
                      {scoped.farms.length} explorações
                    </span>
                  </div>
                )}
                {page === "Explorações" && (
                  <>
                    <div className="farm-cards">
                      {scoped.farms.map((f, i) => {
                        const ls = scoped.lands.filter((l) => farmOnLand(f, l));
                        const ps = scoped.parcels.filter((p) =>
                          parcelInFarm(p, f, scoped),
                        );
                        const ds = scoped.devices.filter(
                          (d) => d.farmId === f.id,
                        );
                        return (
                          <article className="farm-card" key={f.id}>
                            <div className={"farm-card-image landscape-" + i}>
                              <Badge kind="glass">
                                <span className="status-dot" /> Monitorizada
                              </Badge>
                              <div className="landscape-lines" />
                              <Mountain size={100} strokeWidth={0.6} />
                              <span>{f.municipality}</span>
                            </div>
                            <div className="farm-card-body">
                              <div className="section-heading">
                                <span className="eyebrow">
                                  {ps[0]?.crop || "Apicultura"}
                                </span>
                                <Badge kind="neutral">DEMO</Badge>
                              </div>
                              <h2>{f.name}</h2>
                              <p>
                                <MapPin size={13} />
                                {f.municipality}, Madeira
                              </p>
                              <div className="farm-card-numbers">
                                <span>
                                  <b>
                                    {formatArea(
                                      ls.reduce(
                                        (s, l) => s + hectares(l.geometry),
                                        0,
                                      ),
                                    )}{" "}
                                    <small>ha</small>
                                  </b>
                                  Área monitorizada
                                </span>
                                <span>
                                  <b>{ps.length}</b>Parcelas
                                </span>
                                <span>
                                  <b>{ds.length}</b>Sensores
                                </span>
                              </div>
                              <button
                                className="secondary full"
                                onClick={() => openFarm(f.id, true)}
                              >
                                Ver exploração <ArrowRight size={16} />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                      <button
                        className="new-farm-card"
                        onClick={() => setModal("farm")}
                      >
                        <span>
                          <Plus size={28} />
                        </span>
                        <h3>Mais terra, mais possibilidades.</h3>
                        <p>
                          Adicione uma exploração e comece
                          <br />a conhecer melhor as suas culturas.
                        </p>
                        <b>
                          Criar exploração <ArrowRight size={16} />
                        </b>
                      </button>
                    </div>
                    <div className="data-actions">
                      <span>
                        <ShieldCheck size={18} /> Os dados desta demonstração
                        são guardados apenas neste navegador.
                      </span>
                      <button onClick={download}>
                        <Download size={15} /> Exportar GeoJSON
                      </button>
                      <button onClick={() => fileInput.current?.click()}>
                        <Upload size={15} /> Importar GeoJSON
                      </button>
                    </div>
                  </>
                )}
                {page === "Sensores" && (
                  <section className="card">
                    <div className="section-heading">
                      <h3>
                        Dispositivos da rede{" "}
                        <Badge kind="neutral">{scoped.devices.length}</Badge>
                      </h3>
                      <button
                        className="text-button"
                        onClick={() => {
                          setData((d) => ({ ...d, tick: d.tick + 1 }));
                          notify("Novas leituras simuladas disponíveis.");
                        }}
                      >
                        <RefreshCw size={14} /> Simular atualização
                      </button>
                    </div>
                    {sensorsTable(
                      scoped.devices.filter((d) =>
                        d.name
                          .toLowerCase()
                          .includes(filters.query.toLowerCase()),
                      ),
                    )}
                  </section>
                )}
                {page === "Estações" && (
                  <>
                    <div className="info-banner">
                      <CloudSun size={19} />
                      <span>
                        Rede demonstrativa Co.nTe. Todas as estações abaixo são
                        simuladas; a meteorologia externa pode ser consultada no
                        detalhe da exploração.
                      </span>
                      <Badge kind="blue">SIMULADO</Badge>
                    </div>
                    <div className="station-cards">
                      {scoped.devices
                        .filter((d) => d.type === "Estação meteorológica")
                        .map((d) => (
                          <section className="card" key={d.id}>
                            <div className="section-heading">
                              <span className="soft-icon blue">
                                <CloudSun size={25} />
                              </span>
                              <Badge>● {d.status}</Badge>
                            </div>
                            <h2>
                              {data.farms.find((f) => f.id === d.farmId)?.name}
                            </h2>
                            <p className="muted">
                              Rede Co.nTe · Estação simulada
                            </p>
                            <div className="weather-value">
                              {latest(d, data.tick).value}°
                              <CloudSun size={40} />
                            </div>
                            <Chart device={d} tick={data.tick} days={days} />
                            <button
                              className="secondary full"
                              onClick={() => setSelectedDevice(d.id)}
                            >
                              Ver leituras e localização{" "}
                              <ArrowRight size={15} />
                            </button>
                          </section>
                        ))}
                    </div>
                    <section className="card">
                      <h3>
                        Comparação entre estações ·{" "}
                        {days === 1 ? "24 horas" : days + " dias"}
                      </h3>
                      {sensorsTable(
                        scoped.devices.filter(
                          (d) => d.type === "Estação meteorológica",
                        ),
                      )}
                      <p className="muted small">
                        Preparado para adaptadores de estações oficiais. Sem
                        ligação ativa ao IPMA nesta demonstração.
                      </p>
                    </section>
                  </>
                )}
                {page === "Alertas" && (
                  <>
                    <div className="info-banner">
                      <ShieldCheck size={20} />
                      <span>
                        Regras demonstrativas, calculadas sobre dados simulados.
                        Não são recomendações agronómicas validadas e não
                        comandam dispositivos.
                      </span>
                      <Badge kind="orange">DEMO</Badge>
                    </div>
                    <div className="two-columns alerts-layout">
                      <section className="card">
                        <div className="section-heading">
                          <h3>Precisam da sua atenção</h3>
                          <Badge kind="orange">{alerts.length} alertas</Badge>
                        </div>
                        {alerts.map((a) => (
                          <button
                            className="alert-row"
                            key={a.id}
                            onClick={() => setSelectedDevice(a.device.id)}
                          >
                            <span
                              className={
                                "soft-icon " +
                                (a.level === "Alta" ? "red" : "orange")
                              }
                            >
                              <Bell size={20} />
                            </span>
                            <span>
                              <b>{a.title}</b>
                              <small>{a.device.name}</small>
                              <p>{a.description}</p>
                            </span>
                            <Badge kind={a.level === "Alta" ? "red" : "orange"}>
                              {a.level}
                            </Badge>
                            <ChevronRight size={15} />
                          </button>
                        ))}
                        {!alerts.length && (
                          <div className="empty">
                            <Check /> Sem alertas para os limites atuais.
                          </div>
                        )}
                      </section>
                      <section className="card">
                        <h3>Configurar regras demonstrativas</h3>
                        <Field
                          label={`Humidade do solo abaixo de ${threshold}%`}
                        >
                          <input
                            aria-label="Limite humidade"
                            type="range"
                            min="10"
                            max="60"
                            value={threshold}
                            onChange={(e) => setThreshold(+e.target.value)}
                          />
                        </Field>
                        <Field label={`Temperatura acima de ${heat} °C`}>
                          <input
                            aria-label="Limite temperatura"
                            type="range"
                            min="15"
                            max="45"
                            value={heat}
                            onChange={(e) => setHeat(+e.target.value)}
                          />
                        </Field>
                        <Field label={`Precipitação acima de ${rain} mm`}>
                          <input
                            aria-label="Limite precipitação"
                            type="range"
                            min="1"
                            max="40"
                            value={rain}
                            onChange={(e) => setRain(+e.target.value)}
                          />
                        </Field>
                        <div className="info-note">
                          <Clock size={18} /> Os sensores offline geram um
                          alerta de comunicação.
                        </div>
                      </section>
                    </div>
                  </>
                )}
                {page === "Analytics" && (
                  <>
                    <Stats data={scoped} alerts={alerts.length} />
                    <div className="analytics-grid">
                      <section className="card">
                        <div className="section-heading">
                          <h3>Área agrícola monitorizada</h3>
                          <PolygonIcon size={18} />
                        </div>
                        <div className="big-number">
                          {formatArea(
                            scoped.lands.reduce(
                              (n, l) => n + hectares(l.geometry),
                              0,
                            ),
                          )}
                          <span> hectares</span>
                        </div>
                        <p className="muted">
                          {scoped.lands.length} terrenos ·{" "}
                          {scoped.parcels.length} parcelas
                        </p>
                        <div className="stacked-bar">
                          {crops.map((c, i) => (
                            <div
                              key={c}
                              title={c}
                              style={{
                                background: colors[i],
                                flex: scoped.parcels
                                  .filter((p) => p.crop === c)
                                  .reduce(
                                    (n, p) => n + hectares(p.geometry),
                                    0,
                                  ),
                              }}
                            />
                          ))}
                        </div>
                        {crops
                          .filter((c) =>
                            scoped.parcels.some((p) => p.crop === c),
                          )
                          .map((c) => (
                            <div className="data-row" key={c}>
                              <span>
                                <i
                                  className="color-dot"
                                  style={{
                                    background: colors[crops.indexOf(c)],
                                  }}
                                />
                                {c}
                              </span>
                              <b>
                                {
                                  scoped.parcels.filter((p) => p.crop === c)
                                    .length
                                }{" "}
                                parcelas
                              </b>
                            </div>
                          ))}
                      </section>
                      <section className="card">
                        <div className="section-heading">
                          <h3>Evolução das métricas</h3>
                          {period()}
                        </div>
                        <Chart
                          device={scoped.devices[0]}
                          tick={data.tick}
                          days={days}
                        />
                        <p className="muted small">
                          {scoped.devices[0]?.name || "Sem sensor associado"} ·
                          Simulado
                        </p>
                      </section>
                      <section className="card">
                        <h3>Sensores por tipo</h3>
                        {types
                          .filter((t) =>
                            scoped.devices.some((d) => d.type === t),
                          )
                          .map((t) => (
                            <div className="data-row" key={t}>
                              <span>{t}</span>
                              <b>
                                {
                                  scoped.devices.filter((d) => d.type === t)
                                    .length
                                }
                              </b>
                            </div>
                          ))}
                      </section>
                    </div>
                    <section className="card">
                      <h3>Comparação entre explorações</h3>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Exploração</th>
                              <th>Município</th>
                              <th>Área</th>
                              <th>Sensores</th>
                              <th>Disponibilidade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scoped.farms.map((f) => {
                              const ds = scoped.devices.filter(
                                (d) => d.farmId === f.id,
                              );
                              return (
                                <tr
                                  key={f.id}
                                  onClick={() => openFarm(f.id, true)}
                                >
                                  <td>
                                    <b>{f.name}</b>
                                  </td>
                                  <td>{f.municipality}</td>
                                  <td>{formatArea(farmArea(scoped, f))} ha</td>
                                  <td>{ds.length}</td>
                                  <td>
                                    <Badge>
                                      {ds.length
                                        ? Math.round(
                                            (ds.filter(
                                              (d) => d.status === "Online",
                                            ).length /
                                              ds.length) *
                                              100,
                                          )
                                        : 0}
                                      % online
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </>
                )}
                {page === "Parceiros" && (
                  <>
                    <div className="partner-hero">
                      <span className="eyebrow">
                        CO.NTE · AGRICULTURAL INTELLIGENCE PLATFORM
                      </span>
                      <h2>
                        O futuro da agricultura
                        <br />
                        cresce em conjunto.
                      </h2>
                      <p>
                        Uma plataforma que liga agricultores, organizações e
                        conhecimento.
                        <br />
                        Da Madeira, para uma agricultura mais próxima e
                        informada.
                      </p>
                      <Sprout size={150} strokeWidth={0.7} />
                    </div>
                    <div className="station-cards">
                      {organizations.map((o) => (
                        <section className="card" key={o.id}>
                          <span className="soft-icon green">
                            <Building2 size={24} />
                          </span>
                          <h2>{o.name}</h2>
                          <Badge kind="neutral">{o.type}</Badge>
                          <p className="muted">
                            <MapPin size={14} /> {o.municipality}
                          </p>
                          <p>
                            {
                              data.farms.filter(
                                (f) => f.organizationId === o.id,
                              ).length
                            }{" "}
                            exploração na demonstração
                          </p>
                          <button
                            className="secondary full"
                            onClick={() => {
                              navigate("Explorações");
                              setApplied({
                                ...initialFilters,
                                organization: o.id,
                              });
                            }}
                          >
                            Ver explorações <ArrowRight size={15} />
                          </button>
                        </section>
                      ))}
                    </div>
                    <section className="card">
                      <h3>Perfis e partilha de dados</h3>
                      <p className="muted">
                        Perfil atual: <b>{profile}</b>. Altere o perfil no canto
                        superior direito para explorar diferentes visões.
                      </p>
                      <div className="profile-grid">
                        {[
                          ["Agricultor", "Explorações de Maria Pereira"],
                          ["Empresa agrícola", "Explorações da Mel da Madeira"],
                          ["Município", "Visão territorial da Calheta"],
                          ["Investigador", "Dados demonstrativos para análise"],
                          ["Administrador", "Visão geral e configuração"],
                        ].map(([p, desc]) => (
                          <button
                            key={p}
                            className={profile === p ? "selected" : ""}
                            onClick={() => {
                              setProfile(p);
                              setApplied(initialFilters);
                              notify("Perfil demonstrativo atualizado.");
                            }}
                          >
                            <Users size={18} />
                            <b>{p}</b>
                            <small>{desc}</small>
                          </button>
                        ))}
                      </div>
                      <p className="muted small">
                        Simulação de visibilidade, sem autenticação. Todos os
                        dados são fictícios; esta demonstração não implementa
                        controlos de acesso para dados pessoais reais.
                      </p>
                      <button
                        className="text-button danger"
                        onClick={() => setModal("reset")}
                      >
                        <RotateCcw size={15} /> Repor dados de demonstração
                      </button>
                    </section>
                  </>
                )}
              </>
            )}
            <footer className="content-footer">
              <span>
                <Leaf size={14} /> Co.nTe Agro · Cultivar conhecimento. Colher
                futuro.
              </span>
              <span>
                Madeira, Portugal <Badge kind="neutral">DEMO v1.0</Badge>
              </span>
            </footer>
          </main>
        )}
      </div>
      <div className="simulation-bar">
        <span>
          <span className="status-dot" /> Ambiente de demonstração{" "}
          <span className="muted">· Dados fictícios</span>
        </span>
        <div>
          <label>
            <input
              type="checkbox"
              checked={automatic}
              onChange={(e) => setAutomatic(e.target.checked)}
            />{" "}
            Atualização automática
          </label>
          <button
            onClick={() => {
              setData((d) => ({ ...d, tick: d.tick + 1 }));
              notify("Leituras simuladas atualizadas.");
            }}
          >
            <RefreshCw size={13} /> Simular atualização
          </button>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button aria-label="Fechar mensagem" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
      <input
        type="file"
        accept=".json,.geojson,application/geo+json"
        ref={fileInput}
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const imported = importGeo(JSON.parse(await f.text()));
            if (
              confirm(
                `Substituir os dados locais por ${imported.farms.length} explorações importadas?`,
              )
            ) {
              setData(imported);
              setApplied(initialFilters);
              notify("Dados geográficos importados.");
            }
          } catch (err) {
            setFileError(
              err instanceof Error ? err.message : "Erro ao importar.",
            );
            setModal("import-error");
          }
          e.target.value = "";
        }}
      />
      {modal === "farm" && (
        <Modal title="Nova exploração" onClose={() => setModal(undefined)}>
          <p className="muted">
            Crie uma exploração num novo terreno, ou escolha um terreno
            existente.
          </p>
          <button
            className="secondary full"
            onClick={() => {
              setModal(undefined);
              navigate("Terrenos");
            }}
          >
            <PolygonIcon size={16} /> Escolher terreno existente
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const fid = id();
              const municipality = String(form.get("municipality"));
              const f: Farm = {
                id: fid,
                name: String(form.get("name")).trim(),
                organizationId: String(form.get("organization")),
                municipality,
                description: String(form.get("description")),
                location:
                  municipality === "Calheta"
                    ? [-17.166, 32.737]
                    : municipality === "Ribeira Brava"
                      ? [-17.065, 32.692]
                      : [-16.987, 32.671],
              };
              if (!f.name) return;
              setDraft({ ...structuredClone(data), farms: [...data.farms, f] });
              setSelectedFarm(fid);
              setEditing(true);
              setDetail(false);
              setPage("Mapa");
              setLandId("");
              setMode("land");
              setModal(undefined);
            }}
          >
            <Field label="Nome da exploração *">
              <input
                name="name"
                required
                placeholder="Ex.: Quinta do Sol"
                autoFocus
              />
            </Field>
            <Field label="Organização">
              <select name="organization">
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Município">
              <select name="municipality">
                {["Câmara de Lobos", "Ribeira Brava", "Calheta"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Descrição (opcional)">
              <textarea
                name="description"
                placeholder="Conte-nos um pouco sobre a sua exploração..."
              />
            </Field>
            <div className="modal-actions">
              <button type="button" onClick={() => setModal(undefined)}>
                Cancelar
              </button>
              <button className="primary" type="submit">
                Continuar para o mapa <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "parcel" && (
        <Modal
          title={editParcel ? "Editar parcela" : "Nova parcela agrícola"}
          onClose={() => {
            setModal(undefined);
            setPendingGeometry(undefined);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft) return;
              if (editParcel)
                setDraft({
                  ...draft,
                  parcels: draft.parcels.map((p) =>
                    p.id === editParcel
                      ? {
                          ...p,
                          name: parcelName,
                          crop: parcelCrop,
                          variety: parcelVariety,
                        }
                      : p,
                  ),
                });
              else if (pendingGeometry)
                setDraft({
                  ...draft,
                  parcels: [
                    ...draft.parcels,
                    {
                      id: id(),
                      landId,
                      farmId: farm?.id,
                      name: parcelName,
                      crop: parcelCrop,
                      variety: parcelVariety,
                      geometry: pendingGeometry,
                    },
                  ],
                });
              setModal(undefined);
              setPendingGeometry(undefined);
              notify("Parcela atualizada no editor.");
            }}
          >
            <Field label="Nome da parcela *">
              <input
                required
                value={parcelName}
                onChange={(e) => setParcelName(e.target.value)}
              />
            </Field>
            <Field label="Cultura">
              <select
                value={parcelCrop}
                onChange={(e) => setParcelCrop(e.target.value)}
              >
                {crops.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Variedade (opcional)">
              <input
                value={parcelVariety}
                onChange={(e) => setParcelVariety(e.target.value)}
              />
            </Field>
            {pendingGeometry && (
              <div className="info-note">
                Área calculada: {formatArea(hectares(pendingGeometry))} ha ·{" "}
                {formatArea(hectares(pendingGeometry) * 10000)} m²
              </div>
            )}
            <button className="primary full" type="submit">
              <Check size={16} /> Guardar parcela
            </button>
          </form>
        </Modal>
      )}
      {modal === "sensor-create" && (
        <Modal title="Adicionar sensor" onClose={() => setModal(undefined)}>
          <p className="muted">
            Escolha o equipamento e clique na localização pretendida no mapa.
          </p>
          <Field label="Nome">
            <input
              value={sensorName}
              onChange={(e) => setSensorName(e.target.value)}
              placeholder="Nome do sensor"
            />
          </Field>
          <Field label="Tipo de equipamento">
            <select
              value={sensorType}
              onChange={(e) => setSensorType(e.target.value)}
            >
              {types.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <div className="info-note">
            Métricas: {metricSpec[sensorType].map((m) => m.label).join(", ")}.
            Atualização simulada: 60 min.
          </div>
          <button
            className="primary full"
            onClick={() => {
              setModal(undefined);
              setMode("sensor");
            }}
          >
            <MapPin size={16} /> Colocar no mapa
          </button>
        </Modal>
      )}
      {device && (
        <Modal title={device.name} onClose={() => setSelectedDevice(undefined)}>
          <div className="section-heading">
            <Badge kind={device.status === "Online" ? "green" : "red"}>
              ● {device.status}
            </Badge>
            <Badge kind="neutral">DEMO · Simulado</Badge>
          </div>
          <div className="device-info">
            <span>
              {device.type}
              <small>ID: {device.id}</small>
            </span>
            <span>
              {active.parcels.find((p) => p.id === device.parcelId)?.name ||
                "Sem parcela associada"}
              <small>
                {device.location[1].toFixed(6)}, {device.location[0].toFixed(6)}
              </small>
            </span>
          </div>
          {metricSpec[device.type].map((m) => (
            <section key={m.label}>
              <div className="section-heading">
                <h3>{m.label}</h3>
                <strong>
                  <MetricValue d={device} metric={m.label} tick={data.tick} />
                </strong>
              </div>
              <Chart
                device={device}
                metric={m.label}
                tick={data.tick}
                days={days}
              />
            </section>
          ))}
          <div className="section-heading">
            <span className="muted small">
              {device.manufacturer} · {device.model}
              <br />
              Última leitura:{" "}
              {new Date(latest(device, data.tick).timestamp).toLocaleString(
                "pt-PT",
              )}
            </span>
            {period()}
          </div>
          {editing && (
            <>
              <Field label="Nome do dispositivo">
                <input
                  value={device.name}
                  onChange={(e) =>
                    setDraft(
                      (d) =>
                        d && {
                          ...d,
                          devices: d.devices.map((s) =>
                            s.id === device.id
                              ? { ...s, name: e.target.value }
                              : s,
                          ),
                        },
                    )
                  }
                />
              </Field>
              <Field label="Estado demonstrativo">
                <select
                  value={device.status}
                  onChange={(e) =>
                    setDraft(
                      (d) =>
                        d && {
                          ...d,
                          devices: d.devices.map((s) =>
                            s.id === device.id
                              ? {
                                  ...s,
                                  status: e.target.value as
                                    "Online" | "Offline",
                                }
                              : s,
                          ),
                        },
                    )
                  }
                >
                  <option>Online</option>
                  <option>Offline</option>
                </select>
              </Field>
            </>
          )}
          <button
            className="secondary full"
            onClick={() => {
              openFarm(device.farmId, true);
              setSelectedDevice(undefined);
              if (editing) {
                setMode("edit");
              } else setPage("Explorações");
            }}
          >
            <MapPin size={16} />{" "}
            {editing
              ? "Mover no mapa (arrastar marcador)"
              : "Ver exploração e localização"}
          </button>
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="Bem-vindo à Co.nTe Agro"
          onClose={() => setModal(undefined)}
        >
          <p>
            Conheça a sua terra através de mapas, sensores e dados agrícolas.
          </p>
          <ol className="help-steps">
            <li>Explore a Madeira e selecione uma exploração.</li>
            <li>Crie uma exploração e desenhe os limites do terreno.</li>
            <li>Desenhe parcelas, atribua culturas e coloque sensores.</li>
            <li>Guarde e acompanhe as leituras demonstrativas.</li>
          </ol>
          <div className="info-note">
            Os dados são fictícios e ficam neste navegador. Exporte-os em
            GeoJSON na página Explorações para guardar uma cópia.
          </div>
          <button className="primary full" onClick={() => setModal(undefined)}>
            Vamos explorar <ArrowRight size={16} />
          </button>
        </Modal>
      )}
      {modal === "reset" && (
        <Modal
          title="Repor a demonstração?"
          onClose={() => setModal(undefined)}
        >
          <p>
            As explorações criadas e as alterações locais serão substituídas
            pelos dados iniciais.
          </p>
          <div className="modal-actions">
            <button onClick={() => setModal(undefined)}>Cancelar</button>
            <button
              className="primary"
              onClick={() => {
                setData(demo());
                setModal(undefined);
                setApplied(initialFilters);
                notify("Dados de demonstração repostos.");
              }}
            >
              Repor dados
            </button>
          </div>
        </Modal>
      )}
      {modal === "import-error" && (
        <Modal
          title="Não foi possível importar"
          onClose={() => setModal(undefined)}
        >
          <p className="error-text">{fileError}</p>
          <p>
            Use um GeoJSON exportado pela Co.nTe Agro, com as propriedades de
            associação entre explorações, terrenos, parcelas e sensores.
          </p>
        </Modal>
      )}
    </div>
  );
}
import { history } from "./model";
function MetricValue({
  d,
  metric,
  tick,
}: {
  d: Device;
  metric: string;
  tick: number;
}) {
  const spec = metricSpec[d.type].find((m) => m.label === metric)!;
  return (
    <>
      {history(d, metric, tick, 1).at(-1)!.value.toLocaleString("pt-PT")}{" "}
      {spec.unit}
    </>
  );
}
