/**
 * RecentPredictions.jsx
 *
 * A simple feed of the most recent bets across all 3 contracts,
 * newest first. Read-only -- just renders what App.jsx fetched.
 */
export default function RecentPredictions({ predictions }) {
  if (predictions.length === 0) {
    return (
      <div style={styles.card}>
        <p style={styles.title}>Recent market activity</p>
        <p style={styles.empty}>No predictions yet -- be the first to place a bet.</p>
      </div>
    )
  }

  return (
    <div style={styles.card}>
      <p style={styles.title}>Recent market activity</p>
      <div style={styles.list}>
        {predictions.map((p) => (
          <div key={p.id} style={styles.row}>
            <div style={styles.rowLeft}>
              <span style={styles.userName}>{p.user_name}</span>
              <span style={{ color: p.position === 'YES' ? 'var(--color-yes)' : 'var(--color-no)' }}>
                {' '}bet {p.position}
              </span>
              <p style={styles.question}>{p.question}</p>
            </div>
            <div style={styles.rowRight}>
              <span style={styles.tokens}>{p.tokens_wagered.toLocaleString()} tokens</span>
              <span style={styles.time}>{formatRelativeTime(p.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Converts an ISO timestamp into a short relative string like
 * "2m ago" or "3h ago" so the activity feed feels live.
 */
function formatRelativeTime(isoTimestamp) {
  const then = new Date(isoTimestamp)
  const now = new Date()
  const diffSeconds = Math.floor((now - then) / 1000)

  if (diffSeconds < 60) return 'just now'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

const styles = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem',
  },
  title: {
    margin: '0 0 0.75rem',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  empty: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--text-tertiary)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '10px 0',
    borderBottom: '1px solid var(--border-subtle)',
    fontSize: '13px',
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontWeight: 500,
  },
  question: {
    margin: '2px 0 0',
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '2px',
    whiteSpace: 'nowrap',
  },
  tokens: {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
  },
  time: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
  },
}
