import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

interface BoxKPI {
  box_id: string;
  box_serial: string;
  status: string;
  total_ecus: number;
  success_ecus: number;
  failed_ecus: number;
  scratch_ecus: number;
  failure_rate: number;
  avg_flash_time_seconds: number | null;
}

interface Analytics {
  total_boxes: number;
  completed_boxes: number;
  blocked_boxes: number;
  in_progress_boxes: number;
  total_ecus: number;
  success_ecus: number;
  failed_ecus: number;
  scratch_ecus: number;
  overall_failure_rate: number;
  boxes: BoxKPI[];
  station_timeline?: Record<string, Array<{ hour: string; count: number }>>;
}

interface Props { analytics: Analytics | null; }

const PIE_COLORS = ['#22c55e', '#ef4444', '#6b7280', '#4f8ef7'];
const LINE_COLORS = ['#4f8ef7', '#22c55e', '#f59e0b', '#a855f7', '#f97316', '#06b6d4', '#ec4899'];
const CHART_STYLE = { background: '#1a1d27', border: '1px solid #2e3348', color: '#e4e8f0' };

export default function AnalyticsTab({ analytics }: Props) {
  if (!analytics) {
    return (
      <div style={{ color: 'var(--text-dim)', padding: 60, textAlign: 'center' }}>
        Loading analytics…
      </div>
    );
  }

  const kpiCards = [
    { label: 'Total Boxes', value: analytics.total_boxes },
    { label: 'Completed', value: analytics.completed_boxes, color: 'var(--success)' },
    { label: 'Blocked', value: analytics.blocked_boxes, color: 'var(--error)' },
    { label: 'In Progress', value: analytics.in_progress_boxes, color: 'var(--primary)' },
    { label: 'Total ECUs', value: analytics.total_ecus },
    { label: 'Success ECUs', value: analytics.success_ecus, color: 'var(--success)' },
    { label: 'Failed ECUs', value: analytics.failed_ecus, color: analytics.failed_ecus > 0 ? 'var(--error)' : undefined },
    { label: 'Scratch ECUs', value: analytics.scratch_ecus, color: analytics.scratch_ecus > 0 ? '#6b7280' : undefined },
    {
      label: 'Failure Rate',
      value: `${(analytics.overall_failure_rate * 100).toFixed(1)}%`,
      color: analytics.overall_failure_rate > 0.05 ? 'var(--error)' : 'var(--success)',
    },
  ];

  const barData = analytics.boxes.map(b => ({
    name: b.box_serial,
    Success: b.success_ecus,
    Failed: b.failed_ecus,
    Scratch: b.scratch_ecus ?? 0,
    'Avg Flash (s)': b.avg_flash_time_seconds != null ? Math.round(b.avg_flash_time_seconds) : 0,
  }));

  const pieData = [
    { name: 'Success', value: analytics.success_ecus },
    { name: 'Failed', value: analytics.failed_ecus },
    { name: 'Scratch', value: analytics.scratch_ecus ?? 0 },
    { name: 'Other', value: Math.max(0, analytics.total_ecus - analytics.success_ecus - analytics.failed_ecus - (analytics.scratch_ecus ?? 0)) },
  ].filter(d => d.value > 0);

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
        {kpiCards.map(k => (
          <div key={k.label} className="card" style={{ minWidth: 110, textAlign: 'center', padding: '16px 18px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color ?? 'var(--text)' }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 28 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>ECU Results by Box</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e3348" />
              <XAxis dataKey="name" tick={{ fill: '#8892a4', fontSize: 11 }} />
              <YAxis tick={{ fill: '#8892a4', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={CHART_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Success" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Scratch" fill="#6b7280" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Overall ECU Status</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 60, fontSize: 13 }}>
              No ECU data yet
            </div>
          )}
        </div>
      </div>

      {/* Per-box KPI table */}
      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>Box KPIs</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Box</th>
              <th>Status</th>
              <th>Total ECUs</th>
              <th>Success</th>
              <th>Failed</th>
              <th>Scratch</th>
              <th>Failure Rate</th>
              <th>Avg Flash Time</th>
            </tr>
          </thead>
          <tbody>
            {analytics.boxes.map(b => (
              <tr key={b.box_id}>
                <td><code style={{ fontSize: 13 }}>{b.box_serial}</code></td>
                <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                <td>{b.total_ecus}</td>
                <td style={{ color: b.success_ecus > 0 ? 'var(--success)' : 'var(--text-dim)' }}>{b.success_ecus}</td>
                <td style={{ color: b.failed_ecus > 0 ? 'var(--error)' : 'var(--text-dim)' }}>{b.failed_ecus}</td>
                <td style={{ color: (b.scratch_ecus ?? 0) > 0 ? '#6b7280' : 'var(--text-dim)' }}>{b.scratch_ecus ?? 0}</td>
                <td style={{ color: b.failure_rate > 0.05 ? 'var(--error)' : 'var(--text-dim)' }}>
                  {(b.failure_rate * 100).toFixed(1)}%
                </td>
                <td style={{ color: 'var(--text-dim)' }}>
                  {b.avg_flash_time_seconds != null ? `${Math.round(b.avg_flash_time_seconds)}s` : '—'}
                </td>
              </tr>
            ))}
            {analytics.boxes.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 24 }}>
                  No box data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Station ECUs/h chart */}
      {analytics.station_timeline && Object.keys(analytics.station_timeline).length > 0 && (() => {
        const allHours = Array.from(
          new Set(
            Object.values(analytics.station_timeline!).flatMap((pts: any[]) => pts.map((p: any) => p.hour))
          )
        ).sort();

        const stationNames = Object.keys(analytics.station_timeline!);
        const chartData = allHours.map(h => {
          const row: Record<string, any> = {
            hour: h,
            label: (() => {
              try { return new Date(h).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
              catch { return h; }
            })(),
          };
          stationNames.forEach(sname => {
            const pt = (analytics.station_timeline![sname] as any[]).find((p: any) => p.hour === h);
            row[sname] = pt ? pt.count : 0;
          });
          return row;
        });

        return (
          <div className="card" style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>ECUs per Hour by Station</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 40, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e3348" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#8892a4', fontSize: 10 }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#8892a4', fontSize: 11 }}
                  label={{ value: 'ECUs/h', angle: -90, position: 'insideLeft', fill: '#8892a4', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={CHART_STYLE}
                  formatter={(val: number, name: string) => [`${val} ECUs`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {stationNames.map((sname, idx) => (
                  <Bar key={sname} dataKey={sname} fill={LINE_COLORS[idx % LINE_COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })()}
    </div>
  );
}
