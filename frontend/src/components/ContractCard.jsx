import { useEffect, useState } from 'react'
import ProbabilityBar from './ProbabilityBar'
import ProbabilityHistoryChart from './ProbabilityHistoryChart'
import BetForm from './BetForm'
import { fetchContractHistory } from '../api'

/**
 * ContractCard.jsx
 *
 * Renders one full prediction market: question, current probability,
 * probability bar, history chart, token totals, and either the bet
 * form (open markets) or the resolution outcome (resolved markets).
 *
 * History is fetched per-card (rather than all at once in App.jsx)
 * since each contract's chart is independent and this keeps the
 * component self-contained.
 *
 * Resolution behavior:
 *  - contract.resolved / contract.outcome / contract.your_payout come
 *    from the backend via the existing polling loop in App.jsx -- no
 *    separate fetch here. Every user sees the same resolved banner,
 *    not just the Instructor.
 *  - isInstructor gates the resolve buttons and the delete button.
 *    Regular users never see either.
 *  - Once resolved, the bet form stops rendering entirely for
 *    everyone (mirrors the backend's own guard against new bets on
 *    a resolved contract).
 */
export default function ContractCard({
  contract,
  tokensRemaining,
  isInstructor,
  onPlaceBet,
  onDeleteContract,
  onResolveContract,
}) {
  const [history, setHistory] = useState([])
  const [resolving, setResolving] = useState(false)

  async function loadHistory() {
    try {
      const data = await fetchContractHistory(contract.id)
      setHistory(data)
    } catch (err) {
      console.error('Failed to load history for contract', contract.id, err)
    }
  }

  useEffect(() => {
    loadHistory()
    // Re-fetch history whenever the contract's totals change (i.e.
    // after a new bet is placed anywhere in the app), so the chart
    // for this card stays current too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract.yes_total, contract.no_total])

  const yesPercent = Math.round(contract.yes_probability * 100)
  const noPercent = Math.round(contract.no_probability * 100)

  async function handleResolve(outcome) {
    const confirmed = window.confirm(
      `Resolve "${contract.question}" as ${outcome}? This cannot be undone and will close betting immediately.`
    )
    if (!confirmed) return

    setResolving(true)
    try {
      await onResolveContract(contract.id, outcome)
    } catch (err) {
      window.alert(err.message || 'Failed to resolve market')
    } finally {
      setResolving(false)
    }
  }

  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <p style={styles.question}>{contract.question}</p>
        {isInstructor && (
          <button
            onClick={() => onDeleteContract(contract.id)}
            style={styles.deleteButton}
            aria-label="Delete this market"
          >
            Delete
          </button>
        )}
      </div>

      {contract.resolved && (
        <div
          style={{
            ...styles.resolvedBanner,
            ...(contract.outcome === 'YES' ? styles.resolvedBannerYes : styles.resolvedBannerNo),
          }}
        >
          <span style={styles.resolvedBannerOutcome}>Resolved: {contract.outcome}</span>
          {typeof contract.your_payout === 'number' && (
            <span style={styles.resolvedBannerPayout}>
              {contract.your_payout >= 0
                ? `Payout: +${contract.your_payout} tokens`
                : `Payout: ${contract.your_payout} tokens`}
            </span>
          )}
        </div>
      )}

      <div style={styles.probRow}>
        <div>
          <p style={styles.probLabel}>YES</p>
          <p style={{ ...styles.probValue, color: 'var(--color-yes)' }}>{yesPercent}%</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={styles.probLabel}>NO</p>
          <p style={{ ...styles.probValue, color: 'var(--color-no)' }}>{noPercent}%</p>
        </div>
      </div>

      <ProbabilityBar yesProbability={contract.yes_probability} />

      <div style={styles.sectionLabel}>Probability history</div>
      <ProbabilityHistoryChart history={history} />

      <div style={styles.sectionLabel}>Market depth</div>
      <div style={styles.depthRow}>
        <div style={styles.depthItem}>
          <p style={styles.depthLabel}>YES tokens</p>
          <p style={styles.depthValue}>{contract.yes_total.toLocaleString()}</p>
        </div>
        <div style={styles.depthItem}>
          <p style={styles.depthLabel}>NO tokens</p>
          <p style={styles.depthValue}>{contract.no_total.toLocaleString()}</p>
        </div>
      </div>

      {!contract.resolved && (
        <>
          <div style={styles.sectionLabel}>Place a prediction</div>
          <BetForm
            contractId={contract.id}
            tokensRemaining={tokensRemaining}
            onSubmit={onPlaceBet}
          />
        </>
      )}

      {isInstructor && !contract.resolved && (
        <>
          <div style={styles.sectionLabel}>Instructor: resolve this market</div>
          <div style={styles.resolveRow}>
            <button
              onClick={() => handleResolve('YES')}
              disabled={resolving}
              style={{ ...styles.resolveButton, ...styles.resolveButtonYes }}
            >
              Resolve YES
            </button>
            <button
              onClick={() => handleResolve('NO')}
              disabled={resolving}
              style={{ ...styles.resolveButton, ...styles.resolveButtonNo }}
            >
              Resolve NO
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const styles = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  question: {
    margin: '0 0 0.5rem',
    fontSize: '15px',
    fontWeight: 500,
    lineHeight: 1.4,
    minHeight: '42px',
  },
  deleteButton: {
    padding: '4px 10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    background: 'transparent',
    color: 'var(--text-tertiary)',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  resolvedBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '4px 12px',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
    marginBottom: '4px',
    fontSize: '13px',
    fontWeight: 500,
  },
  resolvedBannerYes: {
    background: 'var(--color-yes-bg)',
    color: 'var(--color-yes)',
  },
  resolvedBannerNo: {
    background: 'var(--color-no-bg)',
    color: 'var(--color-no)',
  },
  resolvedBannerOutcome: {
    fontFamily: 'var(--font-mono)',
  },
  resolvedBannerPayout: {
    fontFamily: 'var(--font-mono)',
  },
  probRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '4px',
  },
  probLabel: {
    margin: '0 0 2px',
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  probValue: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 500,
    fontFamily: 'var(--font-mono)',
  },
  sectionLabel: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginTop: '1rem',
    marginBottom: '4px',
  },
  depthRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  depthItem: {
    background: 'var(--bg-card-raised)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
  },
  depthLabel: {
    margin: '0 0 2px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  depthValue: {
    margin: 0,
    fontSize: '17px',
    fontWeight: 500,
    fontFamily: 'var(--font-mono)',
  },
  resolveRow: {
    display: 'flex',
    gap: '8px',
  },
  resolveButton: {
    flex: 1,
    padding: '10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    fontSize: '14px',
    fontWeight: 500,
  },
  resolveButtonYes: {
    background: 'var(--color-yes-bg)',
    borderColor: 'var(--color-yes)',
    color: 'var(--color-yes)',
  },
  resolveButtonNo: {
    background: 'var(--color-no-bg)',
    borderColor: 'var(--color-no)',
    color: 'var(--color-no)',
  },
}
