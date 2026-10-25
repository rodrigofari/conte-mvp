import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Pentagon,
  MousePointer2,
  Save,
  Trash2,
  Pencil,
  Sprout,
  MapPin,
  Users,
  Radio,
} from "lucide-react";
import type { Polygon } from "geojson";
import type { Data, Land, Farm } from "./model";
import {
  id,
  organizations,
  geometryCenter,
  hectares,
  formatArea,
  validateGeometry,
  validateFarm,
  farmOnLand,
  farmGeometry,
  setFarmGeometry,
  updateLandGeometry,
  parcelInFarm,
  migrateData,
} from "./model";
import MapView from "./MapView";
import type { MapMode } from "./MapView";
import { Badge, Field, Modal } from "./components";

type Props = {
  data: Data;
  canEdit: boolean;
  showAll?: boolean;
  organizationId?: string;
  visibleFarmIds: string[];
  onSave: (data: Data) => void;
  onFarm: (id: string) => void;
  notify: (message: string) => void;
  onDirty: (dirty: boolean) => void;
};
export default function Terrains({
  data,
  canEdit,
  showAll = false,
  organizationId,
  visibleFarmIds,
  onSave,
  onFarm,
  notify,
  onDirty,
}: Props) {
  const [draft, setDraft] = useState<Data>();
  const [landId, setLandId] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [mode, setMode] = useState<MapMode>("edit");
  const [pending, setPending] = useState<Polygon>();
  const [formFarm, setFormFarm] = useState<Farm>();
  const [formOpen, setFormOpen] = useState(false);
  const [attachId, setAttachId] = useState("");
  const source = draft ?? data;
  const land = source.lands.find((l) => l.id === landId);
  const farms = land
    ? source.farms.filter(
        (f) =>
          (farmOnLand(f, land) && visibleFarmIds.includes(f.id)) ||
          (draft && f.landId === land.id),
      )
    : [];
  const visibleLands = source.lands.filter(
    (l) =>
      showAll ||
      (organizationId && l.organizationId === organizationId) ||
      source.farms.some(
        (f) => visibleFarmIds.includes(f.id) && farmOnLand(f, l),
      ),
  );
  const canManage = (l: Land) =>
    canEdit &&
    source.farms
      .filter((f) => farmOnLand(f, l))
      .every((f) => visibleFarmIds.includes(f.id));
  function begin(l?: Land) {
    if (l && !canManage(l)) {
      notify(
        "Este terreno inclui explorações de outras organizações. Use o perfil Administrador para editar o perímetro partilhado.",
      );
      return;
    }
    const next = migrateData(structuredClone(data));
    let target = l;
    if (!target) {
      target = {
        id: id(),
        name: "Novo terreno",
        organizationId,
        municipality: "Ribeira Brava",
        geometry: { type: "Polygon", coordinates: [] },
      };
      next.lands.push(target);
    }
    setDraft(next);
    setLandId(target.id);
    setSelected(undefined);
    setMode(l ? "edit" : "land");
    onDirty(true);
  }
  function close() {
    if (
      draft &&
      !confirm("Descartar as alterações não guardadas neste terreno?")
    )
      return;
    setDraft(undefined);
    setLandId(undefined);
    setSelected(undefined);
    onDirty(false);
  }
  function save() {
    if (!draft || !land) return;
    if (!land.name.trim() || !land.geometry.coordinates.length) {
      notify("Dê um nome ao terreno e desenhe os seus limites.");
      return;
    }
    const error =
      validateGeometry(land.geometry) ||
      draft.farms.map((f) => validateFarm(draft, f)).find(Boolean);
    if (error) {
      notify(error);
      return;
    }
    onSave(migrateData(draft));
    setDraft(undefined);
    onDirty(false);
    notify("Terreno e explorações guardados.");
  }
  function draw(g: Polygon) {
    if (!draft || !land) return;
    if (mode === "land") {
      const next = updateLandGeometry(draft, land.id, g);
      const error =
        validateGeometry(g) ||
        next.farms
          .filter((f) => farmOnLand(f, land))
          .map((f) => validateFarm(next, f))
          .find(Boolean);
      if (error) {
        notify(error);
        return;
      }
      setDraft(next);
      setSelected(undefined);
      setMode("edit");
      return;
    }
    const error = validateGeometry(g, land);
    if (error) {
      notify("A exploração deve ficar totalmente dentro do terreno.");
      return;
    }
    const f: Farm = {
      id: id(),
      landId: land.id,
      geometry: g,
      location: geometryCenter(g),
      name: "",
      organizationId: organizations[0].id,
      responsible: "",
      municipality: land.municipality || "Ribeira Brava",
      description: "",
    };
    const check = validateFarm({ ...draft, farms: [...draft.farms, f] }, f);
    if (check) {
      notify(check);
      return;
    }
    setPending(g);
    setAttachId("");
    setFormFarm(undefined);
    setFormOpen(true);
    setMode("edit");
  }
  function move(g: Polygon) {
    if (!draft || !land) return;
    const f = farms.find((f) => f.id === selected);
    const next = f
      ? {
          ...draft,
          farms: draft.farms.map((x) =>
            x.id === f.id ? setFarmGeometry(x, land.id, g) : x,
          ),
        }
      : updateLandGeometry(draft, land.id, g);
    const error =
      validateGeometry(g) ||
      next.farms
        .filter((x) =>
          farmOnLand(
            x,
            next.lands.find((l) => l.id === land.id)!,
          ),
        )
        .map((x) => validateFarm(next, x))
        .find(Boolean);
    if (error) {
      notify(error);
      setDraft({ ...draft });
      return;
    }
    setDraft(next);
  }
  function deleteFarm(f: Farm) {
    if (!draft || !land) return;
    const remaining = draft.lands.filter(
      (l) => l.id !== land.id && farmOnLand(f, l),
    );
    if (
      !confirm(
        remaining.length
          ? `Retirar «${f.name}» deste terreno e eliminar apenas as parcelas e sensores aqui associados? Os outros terrenos serão mantidos.`
          : `Eliminar «${f.name}», as suas parcelas e sensores?`,
      )
    )
      return;
    const updated = remaining.length
      ? {
          ...f,
          landId: remaining[0].id,
          geometry: farmGeometry(f, remaining[0]),
          location: geometryCenter(farmGeometry(f, remaining[0])!),
          additionalLands: remaining
            .slice(1)
            .map((l) => ({ landId: l.id, geometry: farmGeometry(f, l)! })),
        }
      : undefined;
    setDraft({
      ...draft,
      farms: draft.farms.flatMap((x) =>
        x.id === f.id ? (updated ? [updated] : []) : [x],
      ),
      lands: draft.lands.map((l) =>
        l.id === land.id && l.farmId === f.id ? { ...l, farmId: undefined } : l,
      ),
      parcels: draft.parcels.filter(
        (p) => !(p.farmId === f.id && (!updated || p.landId === land.id)),
      ),
      devices: draft.devices.filter(
        (d) => !(d.farmId === f.id && (!updated || d.landId === land.id)),
      ),
    });
    setSelected(undefined);
  }
  const chosen = farms.find((f) => f.id === selected);
  const chosenGeometry =
    chosen && land ? farmGeometry(chosen, land) : undefined;
  const shape = chosenGeometry
    ? { id: chosen!.id, geometry: chosenGeometry }
    : land?.geometry.coordinates.length
      ? land
      : undefined;
  const mapData: Data = land
    ? {
        ...source,
        lands: land.geometry.coordinates.length ? [land] : [],
        farms,
        parcels: [],
        devices: [],
      }
    : source;
  return (
    <main className="content-page terrain-page">
      <div className="page-heading">
        <div>
          <div className="breadcrumb">
            Co.nTe Agro <span>›</span> Terrenos {land && <> › {land.name}</>}
          </div>
          <h1>{land ? land.name : "Terrenos e explorações"}</h1>
          <p>
            {land
              ? "Um terreno, várias explorações independentes. Selecione os limites para editar."
              : "Organize cada terreno e as explorações agrícolas que nele trabalham."}
          </p>
        </div>
        <div className="heading-actions">
          {land ? (
            <>
              <button onClick={close}>
                <ArrowLeft size={16} /> Voltar aos terrenos
              </button>
              {draft && (
                <button className="primary" onClick={save}>
                  <Save size={16} /> Guardar terreno
                </button>
              )}
              {!draft && canManage(land) && (
                <button className="primary" onClick={() => begin(land)}>
                  <Pencil size={16} /> Editar terreno
                </button>
              )}
            </>
          ) : (
            canEdit && (
              <button className="primary" onClick={() => begin()}>
                <Plus size={16} /> Novo terreno
              </button>
            )
          )}
        </div>
      </div>
      {!land ? (
        <>
          <div className="info-banner">
            <Pentagon size={20} />
            <span>
              <b>Terreno → Explorações → Parcelas → Sensores</b>
              <br />
              Cada exploração tem uma área, um responsável e dados próprios. O
              terreno pode incluir áreas ainda não atribuídas.
            </span>
          </div>
          <div className="farm-cards">
            {visibleLands.map((l) => {
              const fs = data.farms.filter(
                (f) => farmOnLand(f, l) && visibleFarmIds.includes(f.id),
              );
              return (
                <section className="card terrain-card" key={l.id}>
                  <div className="section-heading">
                    <span className="soft-icon green">
                      <Pentagon />
                    </span>
                    <Badge>{formatArea(hectares(l.geometry))} ha</Badge>
                  </div>
                  <h2>{l.name}</h2>
                  <p className="muted small">
                    <MapPin size={12} />{" "}
                    {l.municipality || fs[0]?.municipality || "Madeira"}
                  </p>
                  <div className="terrain-farm-list">
                    {fs.map((f) => (
                      <div className="data-row" key={f.id}>
                        <span>
                          <Sprout size={14} />
                          {f.name}
                        </span>
                        <small>{f.responsible}</small>
                      </div>
                    ))}
                  </div>
                  <p className="muted small">
                    {fs.length} explorações independentes
                  </p>
                  <button
                    className="secondary full"
                    onClick={() => {
                      setLandId(l.id);
                      setSelected(undefined);
                    }}
                  >
                    Ver terreno <ArrowRight size={16} />
                  </button>
                  {canManage(l) && (
                    <button className="primary full" onClick={() => begin(l)}>
                      <MousePointer2 size={16} /> Ajustar limites
                    </button>
                  )}
                </section>
              );
            })}
          </div>
          {!visibleLands.length && (
            <div className="empty">Ainda não existem terrenos disponíveis.</div>
          )}
        </>
      ) : (
        <div className="editor-layout">
          <div className="editor-main">
            <div className="steps">
              <div className="current">
                <b>1</b>
                <span>
                  Terreno<small>Limites da área principal</small>
                </span>
              </div>
              <div className={farms.length ? "current" : ""}>
                <b>2</b>
                <span>
                  Explorações independentes
                  <small>Nome, responsável e organização</small>
                </span>
              </div>
              <div>
                <b>3</b>
                <span>
                  Culturas e sensores
                  <small>Geridos dentro de cada exploração</small>
                </span>
              </div>
            </div>
            <div className="editor-map">
              <MapView
                data={mapData}
                focusLandId={land.id}
                focusLocation={[-17.065, 32.692]}
                layers={["Terrenos", "Explorações"]}
                mode={draft ? mode : null}
                selectedGeometry={draft ? shape : undefined}
                onDraw={draw}
                onGeometry={move}
                onFarm={(fid) => {
                  setSelected(fid);
                  if (draft) setMode("edit");
                }}
                onLand={() => {
                  setSelected(undefined);
                  if (draft) setMode("edit");
                }}
                onCancel={() => setMode("edit")}
              />
              {draft && (
                <div className="editor-toolbar">
                  <button
                    onClick={() => {
                      setSelected(undefined);
                      setMode(
                        land.geometry.coordinates.length ? "edit" : "land",
                      );
                    }}
                    className={!selected && mode === "edit" ? "active" : ""}
                  >
                    <MousePointer2 size={16} />
                    {land.geometry.coordinates.length
                      ? "Editar terreno"
                      : "Desenhar terreno"}
                  </button>
                  <button
                    disabled={!land.geometry.coordinates.length}
                    className={mode === "parcel" ? "active" : ""}
                    onClick={() => {
                      setSelected(undefined);
                      setMode("parcel");
                    }}
                  >
                    <Plus size={16} /> Desenhar exploração
                  </button>
                  <button
                    onClick={() => {
                      setSelected(undefined);
                      setMode("land");
                    }}
                  >
                    <Pencil size={15} /> Redesenhar terreno
                  </button>
                  <button className="primary" onClick={save}>
                    <Save size={16} /> Guardar
                  </button>
                </div>
              )}
              <div className="map-legend">
                <b>Estrutura do terreno</b>
                <button
                  onClick={() => {
                    setSelected(undefined);
                    setMode("edit");
                  }}
                >
                  <Pentagon size={14} /> {land.name}
                </button>
                {farms.map((f) => (
                  <button
                    key={f.id}
                    className={selected === f.id ? "selected" : ""}
                    onClick={() => {
                      setSelected(f.id);
                      setMode("edit");
                    }}
                  >
                    <Sprout size={13} />
                    {f.name}
                  </button>
                ))}
                {draft && (
                  <small>
                    A editar: {chosen?.name || land.name}
                    <br />
                    Arraste os círculos. Os pontos menores criam novos vértices.
                  </small>
                )}
              </div>
            </div>
          </div>
          <aside className="editor-panel">
            <h3>
              <Pentagon size={17} /> Terreno principal
            </h3>
            {draft ? (
              <>
                <Field label="Nome do terreno">
                  <input
                    value={land.name}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        lands: draft.lands.map((l) =>
                          l.id === land.id ? { ...l, name: e.target.value } : l,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="Município do terreno">
                  <input
                    value={land.municipality || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        lands: draft.lands.map((l) =>
                          l.id === land.id
                            ? { ...l, municipality: e.target.value }
                            : l,
                        ),
                      })
                    }
                  />
                </Field>
              </>
            ) : (
              <p>{land.name}</p>
            )}
            <div className="area-summary">
              <span>Área total do terreno</span>
              <strong>
                {land.geometry.coordinates.length
                  ? formatArea(hectares(land.geometry))
                  : "0"}{" "}
                <small>ha</small>
              </strong>
            </div>
            <h3>
              <Sprout size={17} /> Explorações ({farms.length})
            </h3>
            {!farms.length && (
              <div className="info-note">
                Desenhe os limites do terreno e use «Desenhar exploração» para
                adicionar a primeira exploração independente.
              </div>
            )}
            {farms.map((f) => (
              <section
                className={
                  "terrain-farm " + (selected === f.id ? "selected" : "")
                }
                key={f.id}
              >
                <button
                  className="terrain-farm-title"
                  onClick={() => {
                    setSelected(f.id);
                    setMode("edit");
                  }}
                >
                  <Sprout size={16} />
                  <b>{f.name}</b>
                  <small>
                    {farmGeometry(f, land)
                      ? formatArea(hectares(farmGeometry(f, land)!))
                      : "—"}{" "}
                    ha
                  </small>
                </button>
                <p>
                  <Users size={13} />{" "}
                  {f.responsible || "Sem responsável indicado"}
                  <br />
                  {organizations.find((o) => o.id === f.organizationId)?.name}
                </p>
                <div className="crop-tags">
                  {[
                    ...new Set(
                      source.parcels
                        .filter((p) => parcelInFarm(p, f, source))
                        .map((p) => p.crop),
                    ),
                  ].map((c) => (
                    <Badge key={c}>{c}</Badge>
                  ))}
                </div>
                <p className="muted small">
                  <Radio size={12} />{" "}
                  {source.devices.filter((d) => d.farmId === f.id).length}{" "}
                  sensores próprios ·{" "}
                  {
                    source.parcels.filter((p) => parcelInFarm(p, f, source))
                      .length
                  }{" "}
                  parcelas
                </p>
                {draft ? (
                  <div className="terrain-farm-actions">
                    <button
                      onClick={() => {
                        setAttachId("");
                        setFormFarm(f);
                        setPending(undefined);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil size={13} /> Editar dados
                    </button>
                    <button
                      title={"Eliminar exploração " + f.name}
                      onClick={() => deleteFarm(f)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="secondary full"
                    onClick={() => onFarm(f.id)}
                  >
                    Culturas e sensores <ArrowRight size={14} />
                  </button>
                )}
              </section>
            ))}
            {draft && (
              <div className="info-note">
                Guarde o terreno para abrir cada exploração e gerir as suas
                parcelas e sensores.
              </div>
            )}
            {!draft && canManage(land) && (
              <button className="primary full" onClick={() => begin(land)}>
                <Plus size={15} /> Adicionar exploração
              </button>
            )}
          </aside>
        </div>
      )}
      {formOpen && land && draft && (
        <Modal
          title={
            formFarm
              ? "Editar exploração independente"
              : "Nova exploração independente"
          }
          onClose={() => {
            setFormOpen(false);
            setPending(undefined);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (attachId && pending) {
                const existing = draft.farms.find((f) => f.id === attachId)!;
                const f = setFarmGeometry(existing, land.id, pending);
                const next = {
                  ...draft,
                  farms: draft.farms.map((x) => (x.id === f.id ? f : x)),
                };
                const error = validateFarm(next, f);
                if (error) {
                  notify(error);
                  return;
                }
                setDraft(next);
                setSelected(f.id);
                setFormOpen(false);
                setPending(undefined);
                return;
              }
              const values = new FormData(e.currentTarget);
              const name = String(values.get("name")).trim(),
                responsible = String(values.get("responsible")).trim();
              if (!name || !responsible) return;
              const geometry = formFarm
                ? farmGeometry(formFarm, land)!
                : pending!;
              const f: Farm = {
                ...formFarm,
                id: formFarm?.id ?? id(),
                landId: formFarm?.landId ?? land.id,
                geometry: formFarm?.geometry ?? geometry,
                location: formFarm?.location ?? geometryCenter(geometry),
                name,
                responsible,
                organizationId: String(values.get("organization")),
                municipality: land.municipality || "Madeira",
                description: String(values.get("description")),
              };
              const next = {
                ...draft,
                farms: formFarm
                  ? draft.farms.map((x) => (x.id === f.id ? f : x))
                  : [...draft.farms, f],
              };
              const error = validateFarm(next, f);
              if (error) {
                notify(error);
                return;
              }
              setDraft(next);
              setSelected(f.id);
              setFormOpen(false);
              setPending(undefined);
            }}
          >
            {!formFarm && (
              <Field label="Criar ou associar exploração">
                <select
                  value={attachId}
                  onChange={(e) => setAttachId(e.target.value)}
                >
                  <option value="">Criar nova exploração</option>
                  {draft.farms
                    .filter(
                      (f) =>
                        visibleFarmIds.includes(f.id) && !farmOnLand(f, land),
                    )
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        Associar: {f.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            {attachId ? (
              <div className="info-note">
                Esta área será um novo terreno da mesma exploração. O
                responsável, as culturas e os sensores existentes serão
                preservados.
              </div>
            ) : (
              <>
                <Field label="Nome da exploração *">
                  <input
                    name="name"
                    required
                    defaultValue={formFarm?.name}
                    autoFocus
                    placeholder="Ex.: Exploração de António"
                  />
                </Field>
                <Field label="Responsável *">
                  <input
                    name="responsible"
                    required
                    defaultValue={formFarm?.responsible}
                    placeholder="Nome do responsável"
                  />
                </Field>
                <Field label="Organização da exploração">
                  <select
                    name="organization"
                    defaultValue={formFarm?.organizationId}
                  >
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Descrição">
                  <textarea
                    name="description"
                    defaultValue={formFarm?.description}
                  />
                </Field>
              </>
            )}
            <div className="info-note">
              Esta exploração terá parcelas, sensores e métricas próprios,
              associados exclusivamente ao seu identificador.
            </div>
            <button className="primary full" type="submit">
              <CheckIcon /> Guardar exploração independente
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}
function CheckIcon() {
  return <Save size={16} />;
}
