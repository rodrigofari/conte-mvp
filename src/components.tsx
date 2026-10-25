import type { ReactNode } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  X,
  TrendingUp,
  Leaf,
  Radio,
  CloudSun,
  TriangleAlert,
} from "lucide-react";
import type { Data, Device } from "./model";
import { history, metricSpec } from "./model";
export function Badge({
  children,
  kind = "green",
}: {
  children: ReactNode;
  kind?: string;
}) {
  return <span className={"badge " + kind}>{children}</span>;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="section-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Chart({
  device,
  tick,
  days = 7,
  metric,
}: {
  device?: Device;
  tick: number;
  days?: number;
  metric?: string;
}) {
  if (!device) return <div className="empty">Sem sensor associado</div>;
  const spec =
    metricSpec[device.type].find((m) => m.label === metric) ||
    metricSpec[device.type][0];
  const values = history(device, spec.label, tick, days).filter(
    (_, i) => i % Math.max(1, Math.floor((days * 24) / 60)) === 0,
  );
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={values}
          margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
        >
          <defs>
            <linearGradient id={"fill" + device.id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14804a" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#14804a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 4"
            vertical={false}
            stroke="#e5ece7"
          />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(v) =>
              new Date(v).toLocaleDateString("pt-PT", {
                day: "2-digit",
                month: "short",
              })
            }
            minTickGap={45}
            axisLine={false}
            tickLine={false}
            fontSize={10}
            stroke="#87948c"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            fontSize={10}
            stroke="#87948c"
          />
          <Tooltip
            labelFormatter={(v) => new Date(String(v)).toLocaleString("pt-PT")}
            formatter={(v) => [`${v} ${spec.unit}`, spec.label]}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #e1e8e2",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#14804a"
            strokeWidth={2}
            fill={`url(#fill${device.id})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Stats({ data, alerts }: { data: Data; alerts: number }) {
  const online = data.devices.filter((d) => d.status === "Online").length;
  return (
    <div className="stats">
      {[
        {
          label: "Explorações ativas",
          value: data.farms.length,
          sub: "explorações monitorizadas",
          Icon: Leaf,
          color: "green",
          extra: "Madeira",
        },
        {
          label: "Sensores online",
          value: online,
          sub: `de ${data.devices.length} dispositivos`,
          Icon: Radio,
          color: "orange",
          extra: `${Math.round((online / (data.devices.length || 1)) * 100)}%`,
        },
        {
          label: "Alertas ativos",
          value: alerts,
          sub: "requerem a sua atenção",
          Icon: TriangleAlert,
          color: "red",
          extra: "DEMO",
        },
        {
          label: "Estações meteorológicas",
          value: data.devices.filter((d) => d.type === "Estação meteorológica")
            .length,
          sub: "na rede Co.nTe",
          Icon: CloudSun,
          color: "blue",
          extra: "Simulado",
        },
      ].map((s) => (
        <article className="stat-card" key={s.label}>
          <div className={"stat-icon " + s.color}>
            <s.Icon size={25} />
          </div>
          <div>
            <span className="stat-label">{s.label}</span>
            <div className="stat-number">
              {s.value}
              <span className={"stat-extra " + s.color}>
                {s.color === "green" && <TrendingUp size={13} />} {s.extra}
              </span>
            </div>
            <span className="muted small">{s.sub}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
