import { useEffect, useState, useCallback } from 'react'
import NameGate from './components/NameGate'
import ContractCard from './components/ContractCard'
import RecentPredictions from './components/RecentPredictions'
import ResetMarketButton from './components/ResetMarketButton'
import CreateMarketForm from './components/CreateMarketForm'
import { fetchContracts, fetchRecentPredictions, fetchUserBalance, placePrediction, resolveContract, resetMarket, createContract, deleteContract } from './api'

// The one privileged display name for this demo. Kept as a plain
// exact-string constant, matching the app's existing "no accounts,
// name is identity" model -- no new auth system, just a comparison.
const INSTRUCTOR_NAME = 'Instructor'

/**
 * App.jsx
 *
 * Top-level component. Holds the shared state that multiple parts
 * of the UI need:
 *  - userName: set once via NameGate, then used on every bet
 *  - contracts: the markets with current totals/probability/resolution
 *  - tokensRemaining: this user's current balance
 *  - recentPredictions: the activity feed
 *
 * Data flows down as props; write actions (placing a bet, resolving
 * a market, creating/deleting a market, resetting) flow up via
 * callbacks that call the API and then re-fetch everything so all
 * cards/feeds reflect the change.
 *
 * isInstructor is derived once from userName and threaded down as a
 * prop -- it's the only new piece of shared state this feature adds.
 */
export default function App() {
  const [userName, setUserName] = useState(null)
  const [contracts, setContracts] = useState([])
  const [tokensRemaining, setTokensRemaining] = useState(1000)
  const [recentPredictions, setRecentPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const isInstructor = userName === INSTRUCTOR_NAME

  const loadAllData = useCallback(async () => {
    try {
      // Folding the balance fetch into the same poll as contracts and
      // predictions is what makes balance changes -- from a reset, a
      // resolution payout, or anything else -- reach every user's
      // screen automatically, not just whoever triggered the action.
      const requests = [fetchContracts(userName), fetchRecentPredictions()]
      if (userName) {
        requests.push(fetchUserBalance(userName))
      }

      const [contractsData, recentData, balanceData] = await Promise.all(requests)
      setContracts(contractsData)
      setRecentPredictions(recentData)
      if (balanceData) {
        setTokensRemaining(balanceData.tokens_remaining)
      }
      setLoadError(null)
    } catch (err) {
      setLoadError(
        'Could not reach the server. Please check your connection and try again.'
      )
    }
  }, [userName])

  // Load contracts + recent activity once on mount, and again any
  // time the user's name changes (so a fresh balance loads too, and
  // so contracts get re-fetched with this user's own name attached
  // for personalized payout data).
  useEffect(() => {
    setLoading(true)
    loadAllData().finally(() => setLoading(false))
  }, [loadAllData])

  // Poll for fresh data every 6 seconds so other users' bets, new
  // markets, deletions, resets, and market resolutions show up
  // without a manual refresh. Runs silently in the background -- no
  // loading spinner, so it doesn't interrupt anyone mid-bet.
  //
  // This unchanged polling loop is also what propagates a market
  // resolution to every user's screen: once the Instructor resolves
  // a contract, everyone's next poll (within 6s) picks up the new
  // resolved/outcome/your_payout fields, plus their updated token
  // balance, via loadAllData(), same as any other contract update.
  useEffect(() => {
    const intervalId = setInterval(() => {
      loadAllData()
    }, 6000)

    // Cleanup: stop polling if App unmounts (e.g. hot reload in dev).
    return () => clearInterval(intervalId)
  }, [loadAllData])

  useEffect(() => {
    if (!userName) return
    fetchUserBalance(userName).then((data) => setTokensRemaining(data.tokens_remaining))
  }, [userName])

  async function handlePlaceBet({ contractId, position, tokensWagered }) {
    const result = await placePrediction({
      userName,
      contractId,
      position,
      tokensWagered,
    })
    // Update balance immediately from the response, then refresh
    // contracts + activity feed so every card reflects the new totals.
    setTokensRemaining(result.user_balance_remaining)
    await loadAllData()
  }

  async function handleResolveContract(contractId, outcome) {
    await resolveContract(contractId, outcome, userName)
    // The backend applies each winner's payout to users.tokens_remaining
    // as part of resolving. loadAllData() now refreshes balance as part
    // of its normal poll, so this one call picks up both the resolved
    // contract state and this user's own updated balance.
    await loadAllData()
  }

  async function handleResetMarket() {
    await resetMarket(userName)
    setTokensRemaining(1000)
    await loadAllData()
  }

  async function handleCreateMarket(question) {
    await createContract(question, userName)
    await loadAllData()
  }

  async function handleDeleteContract(contractId) {
    const confirmed = window.confirm('Delete this market? All its predictions will be permanently removed.')
    if (!confirmed) return

    await deleteContract(contractId, userName)
    await loadAllData()
  }

  if (!userName) {
    return <NameGate onSubmit={setUserName} />
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Prediction market demo</p>
          <h1 style={styles.title}>Welcome, {userName}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={styles.balanceBadge}>
            <p style={styles.balanceLabel}>Your balance</p>
            <p style={styles.balanceValue}>{tokensRemaining.toLocaleString()} tokens</p>
          </div>
          {isInstructor && <ResetMarketButton onReset={handleResetMarket} />}
        </div>
      </header>
    {isInstructor && (
      <div style={{ marginBottom: '2rem' }}>
        <CreateMarketForm onCreate={handleCreateMarket} />
      </div>
    )}

      {loadError && <div style={styles.errorBanner}>{loadError}</div>}

      {loading ? (
        <p style={styles.loading}>Loading markets...</p>
      ) : (
        <>
          <div style={styles.grid}>
            {contracts.map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                tokensRemaining={tokensRemaining}
                isInstructor={isInstructor}
                onPlaceBet={handlePlaceBet}
                onDeleteContract={handleDeleteContract}
                onResolveContract={handleResolveContract}
              />
            ))}
          </div>

          <div style={styles.activitySection}>
            <RecentPredictions predictions={recentPredictions} />
          </div>
        </>
      )}
    </div>
  )
}

const styles = {
  page: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem 1.5rem 4rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  eyebrow: {
    margin: '0 0 4px',
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 500,
  },
  balanceBadge: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 16px',
    textAlign: 'right',
  },
  balanceLabel: {
    margin: '0 0 2px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  balanceValue: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 500,
    fontFamily: 'var(--font-mono)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1.25rem',
    marginBottom: '2rem',
  },
  activitySection: {
    maxWidth: '700px',
  },
  loading: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  errorBanner: {
    background: 'rgba(229, 72, 77, 0.1)',
    border: '1px solid var(--color-no)',
    color: 'var(--color-no)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 16px',
    fontSize: '14px',
    marginBottom: '1.5rem',
  },
}