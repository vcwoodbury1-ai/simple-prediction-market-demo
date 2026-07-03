import { useState } from 'react'

/**
 * ResetMarketButton.jsx
 *
 * Demo-only control. Wipes all bets and balances back to a clean
 * slate, with a confirmation prompt to avoid accidental resets
 * mid-presentation.
 */
export default function ResetMarketButton({ onReset }) {
  const [resetting, setResetting] = useState(false)

  async function handleClick() {
    const confirmed = window.confirm(
      'Reset the entire market? This will delete all predictions and balances. This cannot be undone.'
    )
    if (!confirmed) return

    setResetting(true)
    try {
      await onReset()
    } finally {
      setResetting(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={resetting} style={styles.button}>
      {resetting ? 'Resetting...' : 'Reset Market'}
    </button>
  )
}

const styles = {
  button: {
    padding: '8px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-no)',
    background: 'transparent',
    color: 'var(--color-no)',
    fontSize: '13px',
    fontWeight: 500,
  },
}