import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  CloudSun,
  ExternalLink,
  FlaskConical,
  Leaf,
  MapPin,
  ShieldCheck,
  Sprout,
  Wheat,
  X,
} from "lucide-react";
import {
  climateEvidence,
  climateAnnual,
  cropProduction,
  landUseComposition,
  observatoryIndicators,
  observatorySources,
  permanentCropAreas,
  pppPriorities,
  varietyExamples,
} from "./observatorioData";

type SourceKind = "official" | "scientific" | "qualitative" | "simulated";
type Metric = {
  id: string;
  title: string;
  value?: number;
  unit: string;
  scope: string;
  period: string;
  sourceIds: readonly string[];
  note: string;
  series?: readonly { year: number; value: number }[];
  dataRows?: readonly { label: string; value: number; unit?: string }[];
};

const sourceById = new Map(observatorySources.map((source) => [source.id, source]));
const kindLabel: Record<SourceKind, string> = {
  official: "Estatística oficial",
  scientific: "Dados científicos",
  qualitative: "Informação qualitativa",
  simulated: "Dados simulados",
};
const num = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("pt-PT", {
  maximumFractionDigits: 1,
  signDisplay: "always",
});

function MetricSources({ ids }: { ids: readonly string[] }) {
  return (
    <span className="obs-source-links">
      {ids.map((id) => {
        const source = sourceById.get(id);
        if (!source?.url) return null;
        return (
          <a
            key={id}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            {source.organization} <ExternalLink size={12} />
          </a>
        );
      })}
    </span>
  );
}

function MetricMeta({
  metric,
  period,
}: {
  metric: Metric;
  period?: string;
}) {
  const sources = metric.sourceIds
    .map((id) => sourceById.get(id))
    .filter((source) => source !== undefined);
  const organizations = [...new Set(sources.map((source) => source.organization))];
  return (
    <>
      <div className="obs-meta-row">
        <span>
          <MapPin size={13} /> {metric.scope}
        </span>
        <span>
          <ChartNoAxesCombined size={13} /> {period || metric.period}
        </span>
        <span>
          <ShieldCheck size={13} /> {organizations.join("  ·  ")}
        </span>
      </div>
      <p className="obs-method">{metric.note}</p>
      <MetricSources ids={metric.sourceIds} />
    </>
  );
}

function ChartCard({
  metric,
  period,
  plotClassName,
  explainer,
  onDetail,
  children,
}: {
  metric: Metric;
  period?: string;
  plotClassName?: string;
  explainer?: string;
  onDetail: (metric: Metric) => void;
  children: ReactNode;
}) {
  const showDetails = () => onDetail({ ...metric, period: period || metric.period });
  return (
    <article className="obs-panel obs-chart-card">
      <header className="obs-chart-heading">
        <div>
          <h3>{metric.title}</h3>
          <span className="obs-unit">Unidade: {metric.unit}</span>
        </div>
        <button
          className="obs-detail-button"
          aria-label={`Abrir detalhes: ${metric.title}`}
          onClick={showDetails}
        >
          <ArrowRight size={17} />
        </button>
      </header>
      {explainer && <p className="obs-chart-explainer">{explainer}</p>}
      <div
        className={`obs-chart-plot${plotClassName ? ` ${plotClassName}` : ""}`}
        role="button"
        tabIndex={0}
        aria-label={`Ver metodologia e fonte de ${metric.title}`}
        onClick={showDetails}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            showDetails();
          }
        }}
      >{children}</div>
      <footer className="obs-chart-footer">
        <MetricMeta metric={metric} period={period} />
      </footer>
    </article>
  );
}

function DetailPanel({ metric, onClose }: { metric: Metric; onClose: () => void }) {
  const sources = metric.sourceIds
    .map((id) => sourceById.get(id))
    .filter((source) => source !== undefined);
  return (
    <div className="obs-detail-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="obs-detail-panel" role="dialog" aria-modal="true" aria-label={`Detalhe: ${metric.title}`}>
        <div className="obs-detail-top">
          <div>
            <span className="obs-kicker">Ficha do indicador</span>
            <h2>{metric.title}</h2>
          </div>
          <button className="icon-button" aria-label="Fechar detalhe" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {metric.value !== undefined && (
          <div className="obs-detail-value">
            <strong>{num.format(metric.value)}</strong>
            <span>{metric.unit}</span>
          </div>
        )}
        {metric.series && (
          <div className="obs-detail-series">
            {metric.series.map((point) => (
              <div key={point.year}>
                <span>{point.year}</span>
                <b>{num.format(point.value)} {metric.unit}</b>
              </div>
            ))}
          </div>
        )}
        {metric.dataRows && metric.dataRows.length > 0 && (
          <div className="obs-detail-data" aria-label="Valores apresentados">
            {metric.dataRows.map((row) => (
              <div key={row.label}><span>{row.label}</span><b>{num.format(row.value)} {row.unit || metric.unit}</b></div>
            ))}
          </div>
        )}
        <dl className="obs-detail-facts">
          <div><dt>Cobertura territorial</dt><dd>{metric.scope}</dd></div>
          <div><dt>Período de referência</dt><dd>{metric.period}</dd></div>
          <div><dt>Nota metodológica</dt><dd>{metric.note}</dd></div>
        </dl>
        <h3>Fontes e publicações</h3>
        {sources.map((source) => (
          <section className="obs-detail-source" key={source.id}>
            <span className={`obs-kind ${source.kind}`}>{kindLabel[source.kind]}</span>
            <b>{source.title}</b>
            <span>{source.organization}{source.publishedAt ? `  ·  ${source.publishedAt}` : ""}</span>
            <p>{source.note}</p>
            {source.url && (
              <a href={source.url} target="_blank" rel="noreferrer">
                Abrir fonte original <ExternalLink size={14} />
              </a>
            )}
          </section>
        ))}
      </aside>
    </div>
  );
}

const metrics = observatoryIndicators as unknown as Record<string, Metric>;
const compositionMetric: Metric = {
  id: "sau-composition-2019-2023",
  title: "Composição da SAU",
  unit: "% da SAU",
  scope: "Região Autónoma da Madeira",
  period: "2019 e 2023",
  sourceIds: ["drem-structure-2023"],
  note: "Percentagens publicadas pela DREM; valores arredondados podem não somar 100%. O gráfico compara composição, não Área absoluta.",
  dataRows: landUseComposition.flatMap((row) => [
    { label: `${row.year}  ·  Terras aráveis`, value: row.arable },
    { label: `${row.year}  ·  Culturas permanentes`, value: row.permanent },
    { label: `${row.year}  ·  Horta familiar`, value: row.garden },
    { label: `${row.year}  ·  Pastagens permanentes`, value: row.pasture },
  ]),
};

const annualTemperatureDetailMetric: Metric = {
  ...metrics.climateAnnualTemperature,
  dataRows: climateAnnual.map((row, index) => {
    const previous = climateAnnual[index - 1];
    const change = previous ? ((row.temperature - previous.temperature) / previous.temperature) * 100 : undefined;
    return { label: `${row.year}${change === undefined ? "" : ` · ${percent.format(change)}% vs ${previous.year}`}`, value: row.temperature };
  }),
};
const annualPrecipitationDetailMetric: Metric = {
  ...metrics.climateAnnualPrecipitation,
  dataRows: climateAnnual.map((row, index) => {
    const previous = climateAnnual[index - 1];
    const change = previous ? ((row.precipitation - previous.precipitation) / previous.precipitation) * 100 : undefined;
    return { label: `${row.year}${change === undefined ? "" : ` · ${percent.format(change)}% vs ${previous.year}`}`, value: row.precipitation };
  }),
};
const cropAreaChartData = [2023, 2024, 2025].map((year) => ({
  year,
  ...Object.fromEntries(permanentCropAreas.map((item) => [item.crop, item[year as 2023 | 2024 | 2025]])),
}));
const cropLineColors = ["#14804a", "#d28b35", "#4d91b6", "#9665a7", "#c45b55", "#7f9c43", "#5369a1", "#bf6f91", "#a57b51", "#168a86", "#7d7d7d", "#bcaa3d", "#655d83", "#689365", "#cd704c", "#557b8c"];

const sourceGroups: Record<string, string[]> = {
  DREM: ["drem-structure-2023", "drem-agriculture-2025", "drem-agriculture-2024", "drem-annual-2020", "drem-climate-series-2025"],
  IPMA: ["ipma-funchal-normal"],
  "Governo Regional": ["madeira-apiculture-2023"],
  "Observatório do Clima": ["madeira-climate-agriculture"],
  "Co.nTe": ["conte-project-context", "conte-codesign-report"],
  ISOPlexis: ["isoplexis-apple-manual", "isoplexis-survey-aggregates"],
  "Demonstração": ["conte-demo-sensors"],
};

function IndicatorCard({
  metric,
  value,
  unit,
  caption,
  icon,
  onClick,
}: {
  metric: Metric;
  value: string;
  unit?: string;
  caption: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="obs-indicator" onClick={onClick}>
      <span className="obs-indicator-icon">{icon}</span>
      <span className="obs-indicator-copy">
        <span>{metric.title}</span>
        <strong>{value}{unit && <em>{unit}</em>}</strong>
        <small>{caption}</small>
      </span>
      <ArrowRight className="obs-indicator-arrow" size={17} />
    </button>
  );
}

export default function Observatorio() {
  const [detail, setDetail] = useState<Metric>();
  const [municipality, setMunicipality] = useState("Todos");
  const [crop, setCrop] = useState("Todas");
  const [selectedAreaCrops, setSelectedAreaCrops] = useState(["Vinha (vitis vinifera)", "Maçã Regional", "Pera"]);
  const [productionYear, setProductionYear] = useState("Comparar");
  const [sourceFilter, setSourceFilter] = useState("Todas");

  const productionRows = useMemo(
    () => cropProduction.filter((row) => crop === "Todas" || row.crop === crop),
    [crop],
  );
  const visiblePpps = pppPriorities.filter(
    (ppp) => municipality === "Todos" || ppp.municipality === municipality,
  );
  const visibleSources = observatorySources.filter((source) =>
    sourceFilter === "Todas" || sourceGroups[sourceFilter]?.includes(source.id),
  );
  const selectedCropDataRows = productionRows.flatMap((row) =>
    productionYear === "Comparar"
      ? [
          { label: `${row.crop}  ·  2024`, value: row[2024] },
          { label: `${row.crop}  ·  2025`, value: row[2025] },
        ]
      : [{ label: `${row.crop}  ·  ${productionYear}`, value: row[Number(productionYear) as 2024 | 2025] }],
  );
  const productionDetailMetric: Metric = {
    ...metrics.cropProduction,
    note: `Volumes publicados pela DREM, filtrados para ${crop === "Todas" ? "todas as culturas" : crop}. Não há interpolação entre anos.`,
    dataRows: selectedCropDataRows,
  };
  const cropAreaDetailMetric: Metric = {
    ...metrics.permanentCropArea,
    dataRows: selectedAreaCrops.flatMap((cropName) => {
      const cropRow = permanentCropAreas.find((row) => row.crop === cropName);
      if (!cropRow) return [];
      return ([2023, 2024, 2025] as const).map((year, index) => {
        const previousYear = ([2023, 2024, 2025] as const)[index - 1];
        const change = previousYear ? ((cropRow[year] - cropRow[previousYear]) / cropRow[previousYear]) * 100 : undefined;
        return { label: `${cropName} · ${year}${change === undefined ? "" : ` · ${percent.format(change)}% face a ${previousYear}`}`, value: cropRow[year] };
      });
    }),
  };
  const selectedCropAreaValues = permanentCropAreas
    .filter((item) => selectedAreaCrops.includes(item.crop))
    .flatMap((item) => [item[2023], item[2024], item[2025]]);
  const cropAreaDomainMax = Math.max(100, Math.ceil((Math.max(...selectedCropAreaValues, 0) + 1) / 100) * 100);

  const openDetail = (metric: Metric) => setDetail(metric);
  const sectionLinks = [
    ["panorama", "Panorama agrícola"],
    ["clima", "Clima e meteorologia"],
    ["culturas", "Culturas e território"],
    ["diagnostico", "Diagnóstico Co.nTe"],
    ["fontes", "Fontes e metodologia"],
  ];

  return (
    <main className="content-page observatory-page">
      <div className="page-heading obs-page-heading">
        <div>
          <div className="breadcrumb">Co.nTe Agro <ArrowRight size={13} /> Observatório</div>
          <h1>Observatório <span>Agrícola</span></h1>
          <p>Indicadores rastreáveis sobre agricultura, clima e prioridades territoriais da Madeira.</p>
        </div>
        <div className="obs-evidence-legend" aria-label="Categorias de evidência">
          <span className="obs-kind official">Oficial</span>
          <span className="obs-kind scientific">Científica</span>
          <span className="obs-kind qualitative">Qualitativa</span>
        </div>
      </div>

      <nav className="obs-section-nav" aria-label="Secções do Observatório">
        {sectionLinks.map(([id, label]) => (
          <a href={`#obs-${id}`} key={id}>{label}</a>
        ))}
      </nav>

      <section id="obs-panorama" className="obs-section">
        <div className="obs-section-heading">
          <div>
            <span className="obs-kicker">01  ·  Escala regional</span>
            <h2>Panorama agrícola</h2>
          </div>
          <span className="obs-section-note">Estatísticas oficiais  ·  Região Autónoma da Madeira</span>
        </div>
        <div className="obs-indicators">
          <IndicatorCard metric={metrics.holdings} value={num.format(metrics.holdings.value!)} caption="2023 — DREM / INE" icon={<Sprout size={19} />} onClick={() => openDetail(metrics.holdings)} />
          <IndicatorCard metric={metrics.sau} value={num.format(metrics.sau.value!)} unit={metrics.sau.unit} caption="2023 — DREM / INE" icon={<MapPin size={19} />} onClick={() => openDetail(metrics.sau)} />
          <IndicatorCard metric={metrics.holdingsChange} value={`${percent.format(metrics.holdingsChange.value!)}%`} caption="Explorações  ·  2019–2023" icon={<ArrowDownRight size={19} />} onClick={() => openDetail(metrics.holdingsChange)} />
          <IndicatorCard metric={metrics.agricultureOutput} value={`€${num.format(metrics.agricultureOutput.value!)} M`} caption="Produção do ramo  ·  2024 provisório" icon={<ChartNoAxesCombined size={19} />} onClick={() => openDetail(metrics.agricultureOutput)} />
        </div>

        <div className="obs-grid two">
          <ChartCard metric={cropAreaDetailMetric} plotClassName="obs-area-crop-plot" explainer="Área estimada, em hectares, para as culturas permanentes com registo na publicação DREM. Escolhe as culturas a comparar; a percentagem na legenda do detalhe é a variação face ao ano anterior." onDetail={openDetail}>
            <div className="obs-chart-controls obs-area-crop-controls" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              <details className="obs-crop-picker">
                <summary>{selectedAreaCrops.length} de {permanentCropAreas.length} culturas selecionadas</summary>
                <div className="obs-crop-picker-options">
                  {permanentCropAreas.map((item) => (
                    <label key={item.crop}>
                      <input type="checkbox" checked={selectedAreaCrops.includes(item.crop)} onChange={(event) => setSelectedAreaCrops((current) => event.target.checked ? [...current, item.crop] : current.filter((name) => name !== item.crop))} />
                      {item.crop}
                    </label>
                  ))}
                </div>
              </details>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cropAreaChartData} margin={{ top: 12, right: 16, left: 4, bottom: 2 }}>
                <CartesianGrid stroke="#e8eee9" vertical={false} />
                <XAxis dataKey="year" tickLine={false} axisLine={false} />
                <YAxis width={64} tickLine={false} axisLine={false} domain={[0, cropAreaDomainMax]} tickCount={5} tickFormatter={(value) => num.format(Number(value))} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const year = Number(label);
                  return <div className="obs-chart-tooltip"><b>{label}</b>{payload.map((entry) => {
                    const cropName = String(entry.dataKey);
                    const row = permanentCropAreas.find((item) => item.crop === cropName);
                    const previousYear = year - 1;
                    const currentValue = Number(entry.value);
                    const previousValue = year > 2023 ? row?.[previousYear as 2023 | 2024 | 2025] : undefined;
                    const change = previousValue ? ((currentValue - previousValue) / previousValue) * 100 : undefined;
                    return <div key={cropName}><span style={{ color: entry.color }}>{cropName}: {num.format(currentValue)} ha</span><small>{change === undefined ? "sem ano anterior" : `${percent.format(change)}% face a ${previousYear}`}</small></div>;
                  })}</div>;
                }} />
                <Legend />
                {selectedAreaCrops.map((cropName) => {
                  const index = permanentCropAreas.findIndex((item) => item.crop === cropName);
                  return <Line key={cropName} type="linear" dataKey={cropName} name={cropName} stroke={cropLineColors[index % cropLineColors.length]} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls={false} />;
                })}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard metric={compositionMetric} explainer="A SAU é a superfície agrícola utilizada. As barras mostram a percentagem dessa área em cada tipo de utilização, não hectares; comparam 2019 e 2023." onDetail={openDetail}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={landUseComposition} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e8eee9" vertical={false} />
                <XAxis dataKey="year" tickLine={false} axisLine={false} />
                <YAxis width={54} unit="%" tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip formatter={(value) => [`${num.format(Number(value))}%`]} />
                <Legend />
                <Bar dataKey="arable" name="Terras aráveis" stackId="a" fill="#9abf98" radius={[0, 0, 0, 0]} />
                <Bar dataKey="permanent" name="Culturas permanentes" stackId="a" fill="#14804a" />
                <Bar dataKey="garden" name="Horta familiar" stackId="a" fill="#e3ae4e" />
                <Bar dataKey="pasture" name="Pastagens permanentes" stackId="a" fill="#7ca8ba" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <div className="obs-trend-note">
          <span className="obs-trend-mark"><ArrowUpRight size={18} /></span>
          <p><b>A SAU cresceu 2,1% entre 2019 e 2023, apesar de haver menos 9,8% de explorações.</b> A DREM associa a redução sobretudo às explorações com menos de 0,2 ha; o crescimento da área média não significa, por si só, consolidação fundiária.</p>
          <button className="text-button" onClick={() => openDetail(metrics.sauChange)}>Ver fonte <ArrowRight size={14} /></button>
        </div>
      </section>

      <section id="obs-clima" className="obs-section">
        <div className="obs-section-heading">
          <div>
            <span className="obs-kicker">02  ·  Observações anuais</span>
            <h2>Clima e meteorologia</h2>
          </div>
          <span className="obs-section-note">Funchal Observatório  ·  2000–2025  ·  DREM / IPMA</span>
        </div>
        <div className="obs-grid two">
          <ChartCard metric={annualTemperatureDetailMetric} onDetail={openDetail}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={climateAnnual} margin={{ top: 12, right: 14, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e8eee9" vertical={false} />
                <XAxis dataKey="year" tickLine={false} axisLine={false} interval={4} />
                <YAxis width={52} tickLine={false} axisLine={false} domain={[19, 22]} tickFormatter={(value) => `${num.format(Number(value))}°`} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const index = climateAnnual.findIndex((row) => row.year === Number(label));
                  const current = climateAnnual[index];
                  const previous = climateAnnual[index - 1];
                  const change = previous ? ((current.temperature - previous.temperature) / previous.temperature) * 100 : undefined;
                  return <div className="obs-chart-tooltip"><b>{label}</b><span>{num.format(current.temperature)} °C · média anual</span>{change === undefined ? <small>Sem ano anterior na série</small> : <small>{percent.format(change)}% face a {previous.year}</small>}</div>;
                }} />
                <ReferenceLine y={20} stroke="#8c9a8d" strokeDasharray="4 4" label={{ value: "Normal: 20,0 °C", position: "insideTopRight", fill: "#667568", fontSize: 11 }} />
                <Line type="linear" dataKey="temperature" name="Temperatura média" stroke="#dd9952" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard metric={annualPrecipitationDetailMetric} onDetail={openDetail}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={climateAnnual} margin={{ top: 12, right: 14, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e8eee9" vertical={false} />
                <XAxis dataKey="year" tickLine={false} axisLine={false} interval={4} />
                <YAxis width={58} tickLine={false} axisLine={false} tickFormatter={(value) => num.format(Number(value))} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const index = climateAnnual.findIndex((row) => row.year === Number(label));
                  const current = climateAnnual[index];
                  const previous = climateAnnual[index - 1];
                  const change = previous ? ((current.precipitation - previous.precipitation) / previous.precipitation) * 100 : undefined;
                  return <div className="obs-chart-tooltip"><b>{label}</b><span>{num.format(current.precipitation)} mm · total anual</span>{change === undefined ? <small>Sem ano anterior na série</small> : <small>{percent.format(change)}% face a {previous.year}</small>}</div>;
                }} />
                <ReferenceLine y={574.3} stroke="#8c9a8d" strokeDasharray="4 4" label={{ value: "Normal: 574,3 mm", position: "insideTopRight", fill: "#667568", fontSize: 11 }} />
                <Bar dataKey="precipitation" name="Precipitação total" fill="#6198bd" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <p className="obs-territory-note"><MapPin size={14} /> São observações da estação Funchal Observatório, não médias da Madeira nem medições nos municípios das PPP. As linhas tracejadas mostram as normais de Funchal 1991–2020.</p>
        <div className="obs-climate-callout">
          <CloudSun size={21} />
          <div><b>As normais servem de referência, não de série histórica</b><span>Para comparar anos, os gráficos usam observações anuais da DREM. As linhas tracejadas mostram a normal IPMA 1991–2020 de Funchal: 20,0 °C e 574,3 mm.</span></div>
          <button onClick={() => openDetail(metrics.climateAnnualPrecipitation)}>Ver comparação <ArrowRight size={14} /></button>
        </div>
      </section>

      <section id="obs-culturas" className="obs-section">
        <div className="obs-section-heading">
          <div>
            <span className="obs-kicker">03  ·  Produção e parcerias</span>
            <h2>Culturas e território</h2>
          </div>
          <label className="obs-filter"><span>Município</span><select value={municipality} onChange={(e) => setMunicipality(e.target.value)}><option>Todos</option>{pppPriorities.map((ppp) => <option key={ppp.id}>{ppp.municipality}</option>)}</select></label>
        </div>

        <ChartCard metric={productionDetailMetric} period={productionYear === "Comparar" ? "2024–2025" : productionYear} plotClassName="obs-crop-plot" onDetail={openDetail}>
          <div className="obs-chart-controls" onClick={(event) => event.stopPropagation()}>
            <label className="obs-filter"><span>Cultura</span><select value={crop} onChange={(e) => setCrop(e.target.value)}><option>Todas</option>{cropProduction.map((row) => <option key={row.crop}>{row.crop}</option>)}</select></label>
            <label className="obs-filter"><span>Ano</span><select value={productionYear} onChange={(e) => setProductionYear(e.target.value)}><option value="Comparar">Comparar 2024–2025</option><option value="2024">2024</option><option value="2025">2025</option></select></label>
          </div>
          <div className="obs-crop-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productionRows} margin={{ top: 10, right: 18, left: 4, bottom: 12 }}>
                <CartesianGrid stroke="#e8eee9" vertical={false} />
                <XAxis dataKey="crop" height={48} tick={{ fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={false} interval={0} />
                <YAxis width={68} tickLine={false} axisLine={false} tickFormatter={(value) => num.format(Number(value))} />
                <Tooltip formatter={(value) => [`${num.format(Number(value))} t`, "Produção"]} />
                {productionYear === "Comparar" && <Legend wrapperStyle={{ paddingTop: 8, fontWeight: 700 }} />}
                {productionYear !== "2025" && <Bar dataKey="2024" name="2024" fill="#9abf98" radius={[5, 5, 0, 0]} />}
                {productionYear !== "2024" && <Bar dataKey="2025" name="2025" fill="#14804a" radius={[5, 5, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <div className="obs-ppp-heading">
          <div><span className="obs-kicker">Prioridades operacionais do programa</span><h3>Três Parcerias para a Inovação</h3></div>
          <span className="obs-operational-badge">Não são conclusões de inquérito</span>
        </div>
        <div className="obs-ppp-grid">
          {visiblePpps.map((ppp) => (
            <article className={`obs-ppp-card ${ppp.color}`} key={ppp.id}>
              <div className="obs-ppp-top"><span>PPP{ppp.id.replace("ppp", "")}</span><span>{ppp.municipality}</span></div>
              <div className="obs-ppp-title"><span className="obs-ppp-icon">{ppp.id === "ppp1" ? <Sprout /> : ppp.id === "ppp2" ? <FlaskConical /> : <Leaf />}</span><h3>{ppp.activity}</h3></div>
              <p>{ppp.context}</p>
              <div className="obs-ppp-challenge"><b>Desafio e evidência</b><span>{ppp.challenge}</span></div>
              {ppp.id === "ppp3" && (
                <div className="obs-varieties"><small>Variedades tradicionais documentadas na referência regional</small><div>{varietyExamples.map((name) => <span key={name}>{name}</span>)}</div></div>
              )}
              <MetricSources ids={ppp.sources} />
            </article>
          ))}
        </div>
        <p className="obs-territory-note"><MapPin size={14} /> As séries DREM e a normal IPMA apresentadas são regionais ou da estação de Funchal. Não devem ser interpretadas como valores medidos nos três municípios das PPP.</p>
      </section>

      <section id="obs-diagnostico" className="obs-section">
        <div className="obs-section-heading">
          <div>
            <span className="obs-kicker">04  ·  Evidência, limites e próximos passos</span>
            <h2>Diagnóstico Co.nTe</h2>
          </div>
          <span className="obs-section-note">Separação entre contexto público e resultados do projeto</span>
        </div>
        <div className="obs-diagnostic-grid">
          <article className="obs-diagnostic-card scientific">
            <span className="obs-kind scientific">Evidência científica regional</span>
            <h3>Água, rega e adaptação</h3>
            <ul>{climateEvidence.map((item) => <li key={item}>{item}</li>)}</ul>
            <a href={sourceById.get("madeira-climate-agriculture")?.url} target="_blank" rel="noreferrer">Observatório do Clima da Madeira <ExternalLink size={13} /></a>
          </article>
          <article className="obs-diagnostic-card qualitative">
            <span className="obs-kind qualitative">Contexto público do projeto</span>
            <h3>Pressão territorial e inovação</h3>
            <p>O enquadramento público do Co.nTe assinala pressão imobiliária, opções limitadas para agricultura urbana e impactos das alterações climáticas. Entre as oportunidades do projeto estão cenários de uso do solo e um Living Lab de resiliência.</p>
            <a href={sourceById.get("conte-project-context")?.url} target="_blank" rel="noreferrer">Enquadramento Co.nTe <ExternalLink size={13} /></a>
          </article>
          <article className="obs-diagnostic-card qualitative">
            <span className="obs-kind qualitative">Co-design · informação qualitativa</span>
            <h3>Solo, água e capacitação</h3>
            <p>O relatório identifica dificuldades de acesso a informação integrada para planear, coordenação entre entidades e necessidade de formação para adoção tecnológica. Para solos e stress abiótico, destaca água para rega, degradação do solo e exposição a calor, vento e outros extremos. Propõe monitorização ligada a recomendações práticas de rega.</p>
            <span className="obs-gap-status"><BookOpen size={15} /> Relatório local: 13 ago. 2026 · sem resultados estatísticos</span>
          </article>
          <article className="obs-diagnostic-card qualitative">
            <span className="obs-kind qualitative">ISOplexis  ·  agregados reservados</span>
            <h3>Resultados de questionários</h3>
            <p>Área preparada para resultados agregados após validação metodológica e autorização de publicação. Não são apresentados dados individuais nem resultados provisórios.</p>
            <a href={sourceById.get("isoplexis-survey-aggregates")?.url} target="_blank" rel="noreferrer">ISOPlexis <ExternalLink size={13} /></a>
          </article>
        </div>
        <div className="obs-pilot-strip">
          <div className="obs-pilot-icon"><Wheat size={22} /></div>
          <div><b>O que os futuros pilotos podem acrescentar</b><p>Séries locais de meteorologia, humidade do solo, rega e registos de campo podem complementar os dados regionais. As leituras atualmente simuladas no MVP ficam fora deste Observatório e continuam identificadas como demonstração.</p></div>
          <span>Próxima camada: dados de campo validados</span>
        </div>
      </section>

      <section id="obs-fontes" className="obs-section obs-sources-section">
        <div className="obs-section-heading">
          <div>
            <span className="obs-kicker">05  ·  Rastreabilidade</span>
            <h2>Fontes e metodologia</h2>
          </div>
          <label className="obs-filter"><span>Fonte</span><select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}><option value="Todas">Todas as fontes</option>{Object.keys(sourceGroups).map((name) => <option key={name}>{name}</option>)}</select></label>
        </div>
        <div className="obs-method-strip">
          <div><ShieldCheck size={18} /><b>Dados oficiais</b><span>DREM e Governo Regional, com âmbito e período de referência explícitos.</span></div>
          <div><CloudSun size={18} /><b>Dados científicos</b><span>Normais do IPMA e documentação técnico-científica; não são leituras de sensores.</span></div>
          <div><BookOpen size={18} /><b>Qualitativo Co.nTe</b><span>Contexto público separado do relatório de co-design e dos questionários.</span></div>
          <div><FlaskConical size={18} /><b>Simulação</b><span>Leituras fictícias da demonstração não alimentam indicadores históricos.</span></div>
        </div>
        <div className="obs-source-list">
          {visibleSources.map((source) => (
            <article className="obs-source-card" key={source.id}>
              <span className={`obs-kind ${source.kind}`}>{kindLabel[source.kind]}</span>
              <h3>{source.title}</h3>
              <p>{source.organization}{source.publishedAt ? `  ·  Publicação: ${source.publishedAt}` : ""}{source.referencePeriod ? `  ·  Referência: ${source.referencePeriod}` : ""}</p>
              <span className="obs-source-note">{source.note}</span>
              {source.url ? <a href={source.url} target="_blank" rel="noreferrer">Fonte original <ExternalLink size={13} /></a> : <span className="obs-gap-status"><BookOpen size={14} /> Fonte não disponibilizada</span>}
            </article>
          ))}
        </div>
        <div className="obs-method-note"><b>Regras de leitura</b><span>Valores históricos são estáticos e locais em <code>observatorioData.ts</code>. Anos sem observação permanecem ausentes; não há interpolação. Cada indicador identifica fonte, período, unidade, cobertura e nota metodológica. As prioridades das PPP são decisões operacionais fornecidas pelo programa, não resultados estatísticos do ISOplexis.</span></div>
      </section>

      {detail && <DetailPanel metric={detail} onClose={() => setDetail(undefined)} />}
    </main>
  );
}
