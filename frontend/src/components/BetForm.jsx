import { useState } from 'react'

/**
 * BetForm.jsx
 *
 * Lets the user choose YES or NO and enter a token amount, then
 * submits via the onSubmit callback (which calls the API and
 * refreshes data in the parent).
 *
 * This component doesn't know about the API directly -- it just
 * collects input and hands it up. Keeping API calls out of leaf
 * components makes the data flow easier to follow.
 */
export default function BetForm({ contractId, tokensRemaining, onSubmit }) {
  const [position, setPosition] = useState(null)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const tokensWagered = parseInt(amount, 10)

    if (!position) {
      setError('Choose YES or NO first')
      return
    }
    if (!Number.isInteger(tokensWagered) || tokensWagered <= 0) {
      setError('Enter a token amount greater than 0')
      return
    }
    if (tokensWagered > tokensRemaining) {
      setError(`You only have ${tokensRemaining} tokens remaining`)
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({ contractId, position, tokensWagered })
      // Reset the form after a successful bet.
      setPosition(null)
      setAmount('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.positionRow}>
        <button
          type="button"
          onClick={() => setPosition('YES')}
          style={{
            ...styles.positionButton,
            ...(position === 'YES' ? styles.positionButtonActiveYes : {}),
          }}
        >
          Bet YES
        </button>
        <button
          type="button"
          onClick={() => setPosition('NO')}
          style={{
            ...styles.positionButton,
            ...(position === 'NO' ? styles.positionButtonActiveNo : {}),
          }}
        >
          Bet NO
        </button>
      </div>
      <div style={styles.amountRow}>
        <input
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Tokens to wager"
          style={styles.input}
        />
        <button type="submit" disabled={submitting} style={styles.submitButton}>
          {submitting ? 'Placing...' : 'Place bet'}
        </button>
      </div>
      <p style={styles.balanceHint}>{tokensRemaining} tokens remaining</p>
      {error && <p style={styles.error}>{error}</p>}
    </form>
  )
}

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  positionRow: {
    display: 'flex',
    gap: '8px',
  },
  positionButton: {
    flex: 1,
    padding: '10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-card-raised)',
    color: 'var(--text-secondary)',
    fontSize: '14px',
    fontWeight: 500,
  },
  positionButtonActiveYes: {
    background: 'var(--color-yes-bg)',
    borderColor: 'var(--color-yes)',
    color: 'var(--color-yes)',
  },
  positionButtonActiveNo: {
    background: 'var(--color-no-bg)',
    borderColor: 'var(--color-no)',
    color: 'var(--color-no)',
  },
  amountRow: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-card-raised)',
    color: 'var(--text-primary)',
    fontSize: '14px',
  },
  submitButton: {
    padding: '10px 16px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: '#4C8DFF',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  balanceHint: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
  error: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--color-no)',
  },
}
