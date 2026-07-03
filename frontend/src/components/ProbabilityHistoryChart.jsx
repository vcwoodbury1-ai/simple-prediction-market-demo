import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

/**
 * ProbabilityHistoryChart.jsx
 *
 * Plots how the implied YES probability has moved over time for one
 * contract. Data comes from the `probability_snapshots` table via
 * GET /api/contracts/:id/history -- one point per bet placed.
 *
 * Recharts components are just JSX -- no manual chart-instance
 * management like Chart.js requires. When `history` changes (new
 * bet placed), the chart re-renders automatically.
 */
export default function ProbabilityHistoryChart({ history }) {
  // Convert raw probability (0-1) into a percentage for display,
  // and format the timestamp into a short readable label.
  const chartData = history.map((point, index) => ({
    label: index === 0 ? 'Start' : `#${index}`,
    probability: Math.round(point.yes_probability * 100),
  }))

  if (chartData.length <= 1) {
    return (
      <div style={styles.emptyState}>
        No bets placed yet -- the chart will populate once predictions come in.
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: 160 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <XAxis
            dataKey="label"
            stroke="#5C6573"
            tick={{ fontSize: 11, fill: '#8B93A1' }}
            axisLine={{ stroke: '#2A313C' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#5C6573"
            tick={{ fontSize: 11, fill: '#8B93A1' }}
            tickFormatter={(v) => `${v}%`}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, 'YES probability']}
            contentStyle={{
              background: '#1C232D',
              border: '1px solid #2A313C',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#8B93A1' }}
          />
          <Line
            type="monotone"
            dataKey="probability"
            stroke="#2FBF71"
            strokeWidth={2}
            dot={{ r: 3, fill: '#2FBF71' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

const styles = {
  emptyState: {
    height: 160,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    textAlign: 'center',
    padding: '0 1rem',
  },
}
