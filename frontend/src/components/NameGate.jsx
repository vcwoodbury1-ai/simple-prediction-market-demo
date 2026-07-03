import { useState } from 'react'

/**
 * NameGate.jsx
 *
 * Shown once at the start. There are no accounts -- this just
 * captures a display name that gets attached to every bet the
 * person places, and is used to look up / enforce their token
 * balance on the backend.
 */
export default function NameGate({ onSubmit }) {
  const [name, setName] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length === 0) return
    onSubmit(trimmed)
  }

  return (
    <div style={styles.wrapper}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <p style={styles.eyebrow}>Prediction market demo</p>
        <h1 style={styles.title}>What's your name?</h1>
        <p style={styles.subtitle}>
          No account needed. You'll start with 1,000 tokens to predict with.
        </p>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          style={styles.input}
        />
        <button type="submit" style={styles.button} disabled={name.trim().length === 0}>
          Enter market
        </button>
      </form>
    </div>
  )
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
  },
  card: {
    width: '100%',
    maxWidth: '380px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  eyebrow: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  title: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 500,
  },
  subtitle: {
    margin: '0 0 0.5rem',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg-card-raised)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '15px',
  },
  button: {
    marginTop: '0.5rem',
    padding: '10px 16px',
    background: '#4C8DFF',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: 500,
  },
}
