/**
 * api.js
 *
 * Every fetch() call to the Flask backend lives in this one file.
 * Keeping them centralized means:
 *  - If the backend URL changes, you only edit it in one place.
 *  - Components stay focused on rendering, not on fetch boilerplate.
 */

// In production, Flask serves both the API and the built React app
// from the same origin, so a relative path is all that's needed --
// no domain or port to hardcode, and it works no matter what domain
// this ends up deployed to.
//
// In local dev, Vite's dev server (localhost:5173) proxies /api
// requests to Flask (localhost:5000) -- see the proxy config in
// vite.config.js -- so the relative path works in both places.
const API_BASE_URL = '/api'

/**
 * Fetch all contracts with their current totals + probability.
 *
 * Pass the current user's name to also receive a `your_payout` field
 * on any resolved contract they placed bets on -- this is how the
 * resolved-banner in ContractCard gets a personalized payout number
 * through the existing polling loop, without a separate endpoint.
 */
export async function fetchContracts(userName) {
  const url = userName
    ? `${API_BASE_URL}/contracts?user_name=${encodeURIComponent(userName)}`
    : `${API_BASE_URL}/contracts`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch contracts')
  }
  return response.json()
}

/**
 * Fetch the probability history for one contract (for the line chart).
 */
export async function fetchContractHistory(contractId) {
  const response = await fetch(`${API_BASE_URL}/contracts/${contractId}/history`)
  if (!response.ok) {
    throw new Error('Failed to fetch contract history')
  }
  return response.json()
}

/**
 * Fetch the most recent predictions across all contracts.
 */
export async function fetchRecentPredictions() {
  const response = await fetch(`${API_BASE_URL}/predictions/recent`)
  if (!response.ok) {
    throw new Error('Failed to fetch recent predictions')
  }
  return response.json()
}

/**
 * Fetch a user's remaining token balance by name.
 */
export async function fetchUserBalance(userName) {
  const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userName)}`)
  if (!response.ok) {
    throw new Error('Failed to fetch user balance')
  }
  return response.json()
}

/**
 * Submit a new bet.
 * Throws an Error with a readable message if the backend rejects it
 * (e.g. insufficient tokens, or the market is already resolved) so
 * the UI can display it.
 */
export async function placePrediction({ userName, contractId, position, tokensWagered }) {
  const response = await fetch(`${API_BASE_URL}/predictions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_name: userName,
      contract_id: contractId,
      position: position,
      tokens_wagered: tokensWagered,
    }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Failed to place prediction')
  }
  return data
}

/**
 * Instructor-only. Resolve a market to YES or NO and trigger payouts.
 * The backend independently checks that userName is "Instructor" --
 * this isn't just a UI-side gate.
 */
export async function resolveContract(contractId, outcome, userName) {
  const response = await fetch(`${API_BASE_URL}/contracts/${contractId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome, user_name: userName }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Failed to resolve contract')
  }
  return data
}

/**
 * Instructor-only. Reset the entire market: wipes all bets, balances,
 * and contract totals/resolution state back to a clean slate. Used
 * by the "Reset Market" demo button.
 */
export async function resetMarket(userName) {
  const response = await fetch(`${API_BASE_URL}/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_name: userName }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to reset market')
  }
  return response.json()
}

/**
 * Create a new contract at runtime.
 */
export async function createContract(question, userName) {
  const response = await fetch(`${API_BASE_URL}/contracts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, user_name: userName }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Failed to create contract')
  }
  return data
}

/**
 * Instructor-only. Delete a contract and all its associated
 * predictions.
 */
export async function deleteContract(contractId, userName) {
  const response = await fetch(`${API_BASE_URL}/contracts/${contractId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_name: userName }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to delete contract')
  }
  return response.json()
}
