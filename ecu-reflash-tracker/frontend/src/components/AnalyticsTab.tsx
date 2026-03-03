import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts';

interface BoxKPI {
  box_id: string;
  box_serial: string;
  status: string;
  total_ecus: number;
  success_ecus: number;
  failed_ecus: number;
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
  overall_failure_rate: number;
  boxes: BoxKPI[];
  station_timeline?: Record<string, Array<{ time: string; duration: number; result: string }>>;
}

interface Props { analytics: Analytics | null; }

const PIE_COLORS = ['#22c55e', '#ef4444', '#4f8ef7'];
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
    'Avg Flash (s)': b.avg_flash_time_seconds != null ? Math.round(b.avg_flash_time_seconds) : 0,
  }));

  const pieData = [
    { name: 'Success', value: analytics.success_ecus },
    { name: 'Failed', value: analytics.failed_ecus },
    { name: 'Other', value: Math.max(0, analytics.total_ecus - analytics.success_ecus - analytics.failed_ecus) },
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
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 24 }}>
                  No box data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Station Flash Speed Timeline */}
      {analytics.station_timeline && Object.keys(analytics.station_timeline).length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Velocidad de Flasheo por Estación</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart margin={{ top: 8, right: 16, bottom: 8, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e3348" />
              <XAxis
                dataKey="time"
                type="category"
                allowDuplicatedCategory={false}
                tick={{ fill: '#8892a4', fontSize: 10 }}
                tickFormatter={(v: string) => {
                  try { return new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
                  catch { return v; }
                }}
              />
              <YAxis
                tick={{ fill: '#8892a4', fontSize: 11 }}
                label={{ value: 'seg', angle: -90, position: 'insideLeft', fill: '#8892a4', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={CHART_STYLE}
                labelFormatter={(v: string) => {
                  try { return new Date(v).toLocaleString(); } catch { return v; }
                }}
                formatter={(val: number) => [`${val}s`, 'Duración']}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {Object.entries(analytics.station_timeline).map(([stationName, points], idx) => (
                <Line
                  key={stationName}
                  data={points}
                  type="monotone"
                  dataKey="duration"
                  name={stationName}
                  stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
