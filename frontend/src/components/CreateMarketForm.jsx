import { useState } from 'react'

/**
 * CreateMarketForm.jsx
 *
 * Lets you add a new YES/NO contract at runtime during a demo.
 */
export default function CreateMarketForm({ onCreate }) {
  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const trimmed = question.trim()
    if (!trimmed) {
      setError('Enter a question first')
      return
    }

    setSubmitting(true)
    try {
      await onCreate(trimmed)
      setQuestion('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Enter a new market question..."
        style={styles.input}
      />
      <button type="submit" disabled={submitting} style={styles.button}>
        {submitting ? 'Creating...' : 'Create Market'}
      </button>
      {error && <p style={styles.error}>{error}</p>}
    </form>
  )
}

const styles = {
  form: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
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
  button: {
    padding: '10px 16px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: '#4C8DFF',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  error: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--color-no)',
  },
}