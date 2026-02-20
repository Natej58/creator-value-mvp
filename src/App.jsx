import { useState, useEffect } from 'react'
import './App.css'

// ── Constants (DO NOT CHANGE) ──────────────────────────────────────────────
const MONTHLY_LTV = 7.99 * 12
const YEARLY_LTV  = 64.99
const AVG_LTV     = (MONTHLY_LTV + YEARLY_LTV) / 2  // 80.435

const PRESETS = {
  link: {
    profileCTR:     0.025,
    installRate:    0.45,
    paidConversion: 0.12,
  },
  mention: {
    searchRate:     0.0035,
    installRate:    0.40,
    paidConversion: 0.10,
  },
}

const REV_SHARE = 0.15  // Fixed at Normal — not exposed to user

// ── Lead capture ───────────────────────────────────────────────────────────
const WEB3FORMS_KEY = '5a5b49e4-0f55-4dc6-9d07-3be03c9426fa'

// DO NOT CHANGE THIS FORMULA:
function calcFunnel(v, l, c, s, campaignType) {
  const p = PRESETS[campaignType] || PRESETS.link
  const uniqueEngaged = s + c + l * 0.5

  let profileClicks = null
  let installs, paidUsers

  if (campaignType === 'link') {
    profileClicks = v * p.profileCTR
    installs      = profileClicks * p.installRate
    paidUsers     = installs * p.paidConversion * 1.08
  } else {
    installs  = v * p.searchRate * p.installRate
    paidUsers = installs * p.paidConversion
  }

  // Engagement boost — high-engagement creators drive more conversions (capped 1.8x)
  const engagementRate  = v > 0 ? (l + c + s) / v : 0
  const engagementBoost = Math.min(1 + engagementRate * 1.5, 1.8)
  paidUsers = paidUsers * engagementBoost

  const revenue = paidUsers * AVG_LTV
  const payout  = revenue * REV_SHARE
  const cpm     = v > 0 ? payout / (v / 1000) : null

  return { uniqueEngaged, profileClicks, installs, paidUsers, revenue, payout, cpm, engagementRate }
}

const fmt2     = (n) => n.toFixed(2)
const fmtNum   = (n) => Math.round(n).toLocaleString()
const fmtWhole = (n) => '$' + Math.round(n).toLocaleString()

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [views,        setViews]        = useState('')
  const [likes,        setLikes]        = useState('')
  const [comments,     setComments]     = useState('')
  const [shares,       setShares]       = useState('')
  const [campaignType, setCampaignType] = useState('link')
  const [currentOffer, setCurrentOffer] = useState('')
  const [showCalc,     setShowCalc]     = useState(false)
  const [copied,       setCopied]       = useState(false)
  const [email,        setEmail]        = useState('')
  const [emailSent,    setEmailSent]    = useState(false)

  const v = Math.max(0, parseFloat(views)    || 0)
  const l = Math.max(0, parseFloat(likes)    || 0)
  const c = Math.max(0, parseFloat(comments) || 0)
  const s = Math.max(0, parseFloat(shares)   || 0)
  const hasViews = v > 0

  const { uniqueEngaged, profileClicks, installs, paidUsers, revenue, payout, cpm, engagementRate } =
    calcFunnel(v, l, c, s, campaignType)

  // Range ±25%
  const low  = payout * 0.75
  const high = payout * 1.25

  // Shock factor
  const offerAmt    = parseFloat(currentOffer) || null
  const isUnderpaid = offerAmt === null ? true : offerAmt < payout * 0.9
  const shockLabel  = isUnderpaid ? '🔥 You are likely underpaid' : '✓ You are fairly paid'
  const shockMod    = isUnderpaid ? 'underpaid' : 'fairpaid'

  // Engagement badge
  const engagePct = engagementRate * 100
  const engageBadge = engagePct >= 10
    ? { icon: '🔥', label: 'High engagement',     mod: 'high' }
    : engagePct >= 5
    ? { icon: '⚖️', label: 'Average engagement',  mod: 'avg'  }
    : { icon: '⚠️', label: 'Low engagement',      mod: 'low'  }

  // Share text
  const shareText = `I just checked how much I should be making as a creator…\n\nTurns out I should be getting ~${fmtWhole(payout)}/post 👀`

  const handleEmailSubmit = (e) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return

    const existing = JSON.parse(localStorage.getItem('creator_leads') || '[]')
    existing.push({
      email:           trimmed,
      views:           v,
      likes:           l,
      comments:        c,
      shares:          s,
      calculatedValue: `${fmtWhole(low)} – ${fmtWhole(high)}`,
      ts:              Date.now(),
    })
    localStorage.setItem('creator_leads', JSON.stringify(existing))

    setEmail('')
    setEmailSent(true)
  }

  // Auto-hide success message after 4 seconds
  useEffect(() => {
    if (emailSent) {
      const timer = setTimeout(() => setEmailSent(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [emailSent])

  const handleShare = () => {
    navigator.clipboard.writeText(shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  // Breakdown rows — creator-friendly, no LTV/CAC/revenue share language
  const breakdownRows = [
    {
      label: 'Your audience size',
      value: fmtNum(v),
      hint:  'Average views per post',
    },
    {
      label: 'Your engagement strength',
      value: `${engagePct.toFixed(1)}%`,
      hint:  'How often your audience actually reacts',
    },
    {
      label: 'Estimated people interested',
      value: fmtNum(uniqueEngaged),
      hint:  'Viewers who liked, commented, or shared',
    },
    {
      label: 'Estimated people who would download',
      value: fmtNum(installs),
      hint:  campaignType === 'link'
        ? 'Based on profile visits from your post'
        : 'Based on viewers who search after seeing your content',
    },
    {
      label: 'Estimated paying users',
      value: fmtNum(paidUsers),
      hint:  'People who convert to a paid plan',
    },
  ]

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-eyebrow">Creator Earnings Calculator</div>
        <h1>Are You Underpaid?</h1>
        <p>You might be getting underpaid by brands</p>
      </header>

      {/* ── Campaign type ── */}
      <div className="campaign-toggle">
        {[
          { id: 'link',    icon: '🔗', label: 'Link in Bio',  sub: 'Sponsored post'  },
          { id: 'mention', icon: '💬', label: 'Mention Only', sub: 'Organic mention' },
        ].map(({ id, icon, label, sub }) => (
          <button key={id}
            className={`c-btn${campaignType === id ? ' active' : ''}`}
            onClick={() => setCampaignType(id)}>
            <span className="c-icon">{icon}</span>
            <span className="c-label">{label}</span>
            <span className="c-sub">{sub}</span>
          </button>
        ))}
      </div>

      {/* ── Inputs ── */}
      <div className="inputs-card">
        <div className="input-grid">
          {[
            { label: 'Avg Views',    val: views,    set: setViews    },
            { label: 'Avg Likes',    val: likes,    set: setLikes    },
            { label: 'Avg Comments', val: comments, set: setComments },
            { label: 'Avg Shares',   val: shares,   set: setShares   },
          ].map(({ label, val, set }) => (
            <label key={label} className="field">
              <span className="field-label">{label}</span>
              <input type="number" min="0" value={val}
                onChange={e => set(e.target.value)} placeholder="0" />
            </label>
          ))}
        </div>

        <label className="field">
          <span className="field-label">
            What do brands currently offer you per video?
            <span className="opt"> optional</span>
          </span>
          <input type="number" min="0" value={currentOffer}
            onChange={e => setCurrentOffer(e.target.value)} placeholder="$0" />
        </label>
      </div>

      {/* ── Output ── */}
      {hasViews ? (
        <div className="output-section">

          {/* Result card — clean, screenshot-friendly */}
          <div className="result-card">
            <p className="earn-label">You should be earning</p>

            <div className="earn-range">
              {fmtWhole(low)} – {fmtWhole(high)}
              <span className="earn-unit"> per post</span>
            </div>

            <p className="earn-sub">Based on your engagement and audience size</p>

            <div className="badges-row">
              <div className={`engage-badge engage-${engageBadge.mod}`}>
                {engageBadge.icon} {engageBadge.label}
              </div>
              <div className={`shock-badge shock-${shockMod}`}>
                {shockLabel}
              </div>
            </div>

            {offerAmt !== null && offerAmt > 0 && (
              <div className="offer-compare">
                Brands are offering you <strong>{fmtWhole(offerAmt)}</strong>
                {isUnderpaid
                  ? ` — that's ${fmtWhole(payout - offerAmt)} less than you should earn.`
                  : " — that's a fair deal."}
              </div>
            )}
          </div>

          {/* Share row */}
          <div className="share-row">
            <button className="copy-btn" onClick={handleShare}>
              {copied ? '✓ Copied!' : 'Copy result'}
            </button>
            <button className="twitter-btn" onClick={handleTwitter}>
              Post on X
            </button>
          </div>

          {/* ── Email capture ── */}
          <div className="email-capture">
            {emailSent ? (
              <div className="email-submitted">
                <div className="check-circle">
                  <span className="check-icon">✓</span>
                </div>
                <p className="submitted-label">Submitted</p>
              </div>
            ) : (
              <>
                <p className="email-heading">Want brands that actually pay this?</p>
                <form className="email-form" onSubmit={handleEmailSubmit}>
                  <input
                    type="email"
                    className="email-input"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                  <button type="submit" className="email-btn">
                    Get Early Access
                  </button>
                  <p className="email-urgency">
                    Early creators will get priority access to brand deals
                  </p>
                </form>
              </>
            )}
          </div>

          <button className="calc-toggle" onClick={() => setShowCalc(b => !b)}>
            {showCalc ? 'Hide breakdown ▲' : "Why you're worth this ▼"}
          </button>

          {showCalc && (
            <div className="breakdown-panel">
              <div className="breakdown-note">
                Here's what your numbers actually mean for a brand running a campaign with you.
              </div>
              {breakdownRows.map(({ label, value, hint }) => (
                <div key={label} className="b-row">
                  <div className="b-left">
                    <span className="b-label">{label}</span>
                    {hint && <span className="b-hint">{hint}</span>}
                  </div>
                  <span className="b-value">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <p>Enter your average post stats above<br />to see what you should be earning.</p>
        </div>
      )}

      <footer className="app-footer">
        Estimates based on typical app install conversion data.
        Actual results vary by niche, audience, and brand.
      </footer>
    </div>
  )
}
