/**
 * ProbabilityBar.jsx
 *
 * A simple two-segment horizontal bar showing the YES/NO split.
 * No charting library needed for this one -- it's just two divs
 * sized by percentage.
 */
export default function ProbabilityBar({ yesProbability }) {
  const yesPercent = Math.round(yesProbability * 100)
  const noPercent = 100 - yesPercent

  return (
    <div>
      <div style={styles.track} role="img" aria-label={`${yesPercent}% YES, ${noPercent}% NO`}>
        <div style={{ ...styles.segment, width: `${yesPercent}%`, background: 'var(--color-yes)' }} />
        <div style={{ ...styles.segment, width: `${noPercent}%`, background: 'var(--color-no)' }} />
      </div>
    </div>
  )
}

const styles = {
  track: {
    display: 'flex',
    height: '8px',
    borderRadius: '999px',
    overflow: 'hidden',
    background: 'var(--bg-card-raised)',
  },
  segment: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
}
