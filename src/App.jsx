import { useState, useEffect } from 'react'
import './App.css'

// ── Constants ──────────────────────────────────────────────────────────────
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

const PKG = {
  single: { label: 'Single Video',    n: 1 },
  pack3:  { label: '3 Video Package', n: 3 },
  pack5:  { label: '5 Video Package', n: 5 },
}

function aggLabel(pct) {
  if (pct <= 12) return 'Conservative'
  if (pct <= 18) return 'Normal'
  return 'Growth mode'
}

const fmt2     = (n) => n.toFixed(2)
const fmtNum   = (n) => Math.round(n).toLocaleString()
const fmtWhole = (n) => '$' + Math.round(Math.abs(n)).toLocaleString()

const STORAGE_KEY = 'cvc-creators-v2'
const loadCreators = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

// ── Core funnel calculation (reused for cards and calculator) ──────────────
function calcFunnel(v, l, c, s, campaignType, revSharePct) {
  const p = PRESETS[campaignType] || PRESETS.link
  // DO NOT CHANGE THIS FORMULA:
  const uniqueEngaged = s + c + l * 0.5

  let profileClicks = null
  let installs, paidUsers

  if (campaignType === 'link') {
    profileClicks = v * p.profileCTR
    installs      = profileClicks * p.installRate
    paidUsers     = installs * p.paidConversion * 1.08  // +8% bio attribution lift
  } else {
    installs  = v * p.searchRate * p.installRate
    paidUsers = installs * p.paidConversion
  }

  const revenue = paidUsers * AVG_LTV
  const payout  = revenue * (revSharePct / 100)
  const cpm     = v > 0 ? payout / (v / 1000) : null
  const cac     = paidUsers > 0 ? payout / paidUsers : null

  return { uniqueEngaged, profileClicks, installs, paidUsers, revenue, payout, cpm, cac }
}

// ── Blank modal state ──────────────────────────────────────────────────────
const BLANK = {
  name: '', tiktok: '', instagram: '', youtube: '', email: '',
  views: '', likes: '', comments: '', shares: '',
  campaignType: 'link', paymentStructure: 'single', revSharePct: 15,
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('main')

  // Calculator inputs
  const [views,    setViews]    = useState('')
  const [likes,    setLikes]    = useState('')
  const [comments, setComments] = useState('')
  const [shares,   setShares]   = useState('')

  const [campaignType,     setCampaignType]     = useState('link')
  const [paymentStructure, setPaymentStructure] = useState('single')
  const [revSharePct,      setRevSharePct]      = useState(15)
  const [showAdvanced,     setShowAdvanced]     = useState(false)
  const [showTooltip,      setShowTooltip]      = useState(false)
  const [showBreakdown,    setShowBreakdown]    = useState(true)
  const [showQuickOffer,   setShowQuickOffer]   = useState(false)
  const [quickCopied,      setQuickCopied]      = useState(false)

  // Creator CRM
  const [creators,    setCreators]   = useState(loadCreators)
  const [modalOpen,   setModalOpen]  = useState(false)
  const [modalData,   setModalData]  = useState(BLANK)
  const [editingId,   setEditingId]  = useState(null)
  const [offerTarget, setOfferTarget] = useState(null)  // creator for offer modal
  const [offerCopied, setOfferCopied] = useState(false)

  // Reverse calculator
  const [proposedCPM, setProposedCPM] = useState('')

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creators))
  }, [creators])

  // ── Main calculator ────────────────────────────────────────────────────
  const v = Math.max(0, parseFloat(views)    || 0)
  const l = Math.max(0, parseFloat(likes)    || 0)
  const c = Math.max(0, parseFloat(comments) || 0)
  const s = Math.max(0, parseFloat(shares)   || 0)
  const hasInputs = v > 0 || l > 0 || c > 0 || s > 0

  const { uniqueEngaged, profileClicks, installs, paidUsers, revenue, payout, cpm, cac } =
    calcFunnel(v, l, c, s, campaignType, revSharePct)

  const numVideos  = PKG[paymentStructure]?.n ?? 1
  const totalOffer = payout * numVideos

  const isOverpriced   = revenue > 0 && payout > revenue * 0.35
  const currentAggLabel = aggLabel(revSharePct)

  // ── Breakdown rows ─────────────────────────────────────────────────────
  const breakdownRows = [
    {
      label: 'People who interacted',
      value: hasInputs ? fmtNum(uniqueEngaged) : '—',
      hint:  'Likes, comments, and shares weighted by intent',
    },
    ...(campaignType === 'link' ? [{
      label: 'Estimated visitors',
      value: v > 0 ? fmtNum(profileClicks) : '—',
      hint:  "Viewers who clicked through to the creator's profile",
    }] : []),
    {
      label: 'Expected installs',
      value: v > 0 ? fmtNum(installs) : '—',
      hint:  campaignType === 'link'
        ? 'Profile visitors who installed the app'
        : 'Viewers who later searched and installed',
    },
    {
      label: 'Expected customers',
      value: v > 0 ? fmtNum(paidUsers) : '—',
      hint:  'Installs that converted to paid subscriptions',
    },
    {
      label: 'Revenue generated',
      value: v > 0 ? fmtWhole(revenue) : '—',
      hint:  `Based on $${fmt2(AVG_LTV)} average customer lifetime value`,
    },
    ...(campaignType === 'link' ? [{
      label:  'Bio Attribution Lift (+8%)',
      value:  '+8%',
      hint:   'Conversion boost from trackable bio link traffic',
      accent: true,
    }] : []),
    {
      label: 'Safe payout',
      value: v > 0 ? fmtWhole(payout) : '—',
      hint:  `${currentAggLabel} · ${revSharePct}% revenue share`,
    },
    ...(cac !== null ? [{
      label: 'Cost per customer',
      value: `$${fmt2(cac)}`,
      hint:  'Acquisition cost per paying subscriber',
      warn:  cac > AVG_LTV * 0.4,
    }] : []),
  ]

  // ── Offer message builder ──────────────────────────────────────────────
  function buildOffer(cr) {
    const cv = cr.views || 0
    const { payout: cp, cpm: ccpm } = calcFunnel(
      cv, cr.likes || 0, cr.comments || 0, cr.shares || 0,
      cr.campaignType || 'link', cr.revSharePct || 15,
    )
    const n       = PKG[cr.paymentStructure]?.n ?? 1
    const total   = cp * n
    const pkgLbl  = PKG[cr.paymentStructure]?.label?.toLowerCase() ?? 'single video'
    const cpmStr  = cv > 0 && ccpm !== null ? `$${fmt2(ccpm)} CPM` : 'N/A CPM'

    return (
      `Hey! Based on your typical performance (~${fmtNum(cv)} views per post), ` +
      `we can offer ${fmtWhole(cp)} per video (~${cpmStr}).\n\n` +
      `For a ${pkgLbl} collaboration that would come to ${fmtWhole(total)}.\n\n` +
      `Let me know if that works and we can schedule the posts.`
    )
  }

  // Quick offer message (from current calculator state)
  const quickOfferText = (() => {
    const pkgLbl = PKG[paymentStructure]?.label?.toLowerCase() ?? 'single video'
    const cpmStr = v > 0 && cpm !== null ? `$${fmt2(cpm)} CPM` : 'N/A CPM'
    return (
      `Hey! Based on your typical performance (~${fmtNum(v)} views per post), ` +
      `we can offer ${fmtWhole(payout)} per video (~${cpmStr}).\n\n` +
      `For a ${pkgLbl} collaboration that would come to ${fmtWhole(totalOffer)}.\n\n` +
      `Let me know if that works and we can schedule the posts.`
    )
  })()

  // ── Modal helpers ──────────────────────────────────────────────────────
  const setMd = (key) => (val) => setModalData(p => ({ ...p, [key]: val }))

  const openSave = () => {
    setModalData({
      ...BLANK,
      views: views, likes: likes, comments: comments, shares: shares,
      campaignType: campaignType, paymentStructure: paymentStructure,
      revSharePct: revSharePct,
    })
    setEditingId(null)
    setModalOpen(true)
  }

  const openEdit = (cr) => {
    setModalData({
      name:             cr.name || '',
      tiktok:           cr.tiktok || '',
      instagram:        cr.instagram || '',
      youtube:          cr.youtube || '',
      email:            cr.email || '',
      views:            String(cr.views || ''),
      likes:            String(cr.likes || ''),
      comments:         String(cr.comments || ''),
      shares:           String(cr.shares || ''),
      campaignType:     cr.campaignType || 'link',
      paymentStructure: cr.paymentStructure || 'single',
      revSharePct:      cr.revSharePct || 15,
    })
    setEditingId(cr.id)
    setModalOpen(true)
  }

  const handleModalSave = () => {
    if (!modalData.name.trim()) return
    const entry = {
      id:               editingId || Date.now(),
      name:             modalData.name.trim(),
      tiktok:           modalData.tiktok.trim(),
      instagram:        modalData.instagram.trim(),
      youtube:          modalData.youtube.trim(),
      email:            modalData.email.trim(),
      views:            Math.max(0, parseFloat(modalData.views)    || 0),
      likes:            Math.max(0, parseFloat(modalData.likes)    || 0),
      comments:         Math.max(0, parseFloat(modalData.comments) || 0),
      shares:           Math.max(0, parseFloat(modalData.shares)   || 0),
      campaignType:     modalData.campaignType,
      paymentStructure: modalData.paymentStructure,
      revSharePct:      modalData.revSharePct,
    }
    setCreators(prev =>
      editingId ? prev.map(cr => cr.id === editingId ? entry : cr) : [...prev, entry]
    )
    setModalOpen(false)
  }

  const loadIntoCalc = (cr) => {
    setViews(String(cr.views || ''))
    setLikes(String(cr.likes || ''))
    setComments(String(cr.comments || ''))
    setShares(String(cr.shares || ''))
    setCampaignType(cr.campaignType || 'link')
    setPaymentStructure(cr.paymentStructure || 'single')
    setRevSharePct(cr.revSharePct || 15)
    setActiveTab('main')
  }

  // ── Reverse calculator ────────────────────────────────────────────────
  const rCPM          = Math.max(0, parseFloat(proposedCPM) || 0)
  const impliedPayout = v > 0 ? rCPM * (v / 1000) : null
  const revProfit     = impliedPayout !== null ? revenue - impliedPayout : null
  const roas          = impliedPayout !== null && impliedPayout > 0 ? revenue / impliedPayout : null
  const revProfitPct  = impliedPayout !== null && revenue > 0
    ? ((revenue - impliedPayout) / revenue) * 100 : null

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* ══════════ SAVE / EDIT MODAL ══════════ */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>

            <div className="modal-header">
              <h2>{editingId ? 'Edit Creator' : 'Save Creator'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Creator info */}
              <div className="modal-section">
                <p className="modal-sect-title">Creator Info</p>
                <label className="field">
                  <span className="field-label">Creator Name *</span>
                  <input type="text" value={modalData.name}
                    onChange={e => setMd('name')(e.target.value)} placeholder="e.g. @username" />
                </label>
                <label className="field">
                  <span className="field-label">Email</span>
                  <input type="text" value={modalData.email}
                    onChange={e => setMd('email')(e.target.value)} placeholder="creator@email.com" />
                </label>
                <div className="modal-row-3">
                  <label className="field">
                    <span className="field-label">TikTok URL</span>
                    <input type="text" value={modalData.tiktok}
                      onChange={e => setMd('tiktok')(e.target.value)} placeholder="https://tiktok.com/@…" />
                  </label>
                  <label className="field">
                    <span className="field-label">Instagram URL</span>
                    <input type="text" value={modalData.instagram}
                      onChange={e => setMd('instagram')(e.target.value)} placeholder="https://instagram.com/…" />
                  </label>
                  <label className="field">
                    <span className="field-label">YouTube URL</span>
                    <input type="text" value={modalData.youtube}
                      onChange={e => setMd('youtube')(e.target.value)} placeholder="https://youtube.com/@…" />
                  </label>
                </div>
              </div>

              {/* Average performance */}
              <div className="modal-section">
                <p className="modal-sect-title">Average Performance</p>
                <div className="modal-row-4">
                  {[
                    { label: 'Views',    key: 'views'    },
                    { label: 'Likes',    key: 'likes'    },
                    { label: 'Comments', key: 'comments' },
                    { label: 'Shares',   key: 'shares'   },
                  ].map(({ label, key }) => (
                    <label key={key} className="field">
                      <span className="field-label">{label}</span>
                      <input type="number" min="0" value={modalData[key]}
                        onChange={e => setMd(key)(e.target.value)} placeholder="0" />
                    </label>
                  ))}
                </div>
              </div>

              {/* Campaign settings */}
              <div className="modal-section">
                <p className="modal-sect-title">Campaign Settings</p>
                <p className="field-label" style={{ marginBottom: '0.5rem' }}>Campaign Type</p>
                <div className="campaign-toggle" style={{ marginBottom: '1rem' }}>
                  {[
                    { id: 'link',    icon: '🔗', label: 'With Link in Bio', sub: 'Sponsored' },
                    { id: 'mention', icon: '💬', label: 'Mention Only',     sub: 'Organic'   },
                  ].map(({ id, icon, label, sub }) => (
                    <button key={id}
                      className={`campaign-btn${modalData.campaignType === id ? ' active' : ''}`}
                      onClick={() => setMd('campaignType')(id)}>
                      <span className="c-icon">{icon}</span>
                      <span className="c-label">{label}</span>
                      <span className="c-sub">{sub}</span>
                    </button>
                  ))}
                </div>

                <p className="field-label" style={{ marginBottom: '0.5rem' }}>Payment Structure</p>
                <div className="pkg-toggle" style={{ marginBottom: '1rem' }}>
                  {Object.entries(PKG).map(([id, { label }]) => (
                    <button key={id}
                      className={`pkg-btn${modalData.paymentStructure === id ? ' active' : ''}`}
                      onClick={() => setMd('paymentStructure')(id)}>
                      {label}
                    </button>
                  ))}
                </div>

                <p className="field-label" style={{ marginBottom: '0.4rem' }}>Deal Aggressiveness</p>
                <div className="agg-track-labels">
                  <span>Conservative</span><span>Normal</span><span>Growth mode</span>
                </div>
                <input type="range" min="10" max="30" value={modalData.revSharePct}
                  onChange={e => setMd('revSharePct')(+e.target.value)} />
                <div className="agg-footer">
                  <span className="agg-name">{aggLabel(modalData.revSharePct)}</span>
                  <span className="slider-val">{modalData.revSharePct}%</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleModalSave}
                disabled={!modalData.name.trim()}>
                {editingId ? 'Save Changes' : 'Save Creator'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ OFFER MESSAGE MODAL ══════════ */}
      {offerTarget && (
        <div className="modal-overlay" onClick={() => { setOfferTarget(null); setOfferCopied(false) }}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Offer · {offerTarget.name}</h2>
              <button className="modal-close" onClick={() => { setOfferTarget(null); setOfferCopied(false) }}>✕</button>
            </div>
            <div className="modal-body">
              <pre className="offer-pre">{buildOffer(offerTarget)}</pre>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => { setOfferTarget(null); setOfferCopied(false) }}>
                Close
              </button>
              <button className="btn-primary" onClick={() => {
                navigator.clipboard.writeText(buildOffer(offerTarget))
                setOfferCopied(true)
                setTimeout(() => setOfferCopied(false), 2000)
              }}>
                {offerCopied ? '✓ Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ HEADER ══════════ */}
      <header className="app-header">
        <h1>Creator Value Calculator</h1>
        <p>Evaluate a creator, set a deal, send an offer — all in one place</p>
      </header>

      {/* ══════════ TABS ══════════ */}
      <nav className="tabs">
        {[
          { id: 'main',     label: 'Calculator' },
          { id: 'reverse',  label: 'Reverse Calculator' },
          { id: 'creators', label: `Creators${creators.length ? ` (${creators.length})` : ''}` },
        ].map(({ id, label }) => (
          <button key={id}
            className={`tab${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {/* ════════════════════════════════════════
          MAIN CALCULATOR
      ════════════════════════════════════════ */}
      {activeTab === 'main' && (
        <div className="main-grid">
          <div className="left-col">

            {/* Content metrics */}
            <div className="card">
              <h2 className="card-title">Content Metrics</h2>
              <div className="input-grid">
                {[
                  { label: 'Average Views',    val: views,    set: setViews    },
                  { label: 'Average Likes',    val: likes,    set: setLikes    },
                  { label: 'Average Comments', val: comments, set: setComments },
                  { label: 'Average Shares',   val: shares,   set: setShares   },
                ].map(({ label, val, set }) => (
                  <label key={label} className="field">
                    <span className="field-label">{label}</span>
                    <input type="number" min="0" value={val}
                      onChange={e => set(e.target.value)} placeholder="0" />
                  </label>
                ))}
              </div>
            </div>

            {/* Campaign type */}
            <div className="card">
              <div className="section-head">
                <h2 className="card-title" style={{ margin: 0 }}>Campaign Type</h2>
                <div className="tooltip-wrap"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}>
                  <span className="info-icon">i</span>
                  {showTooltip && (
                    <div className="tooltip-box">
                      Sponsored posts drive immediate traffic through the creator's bio.
                      Mentions create delayed conversions from viewers who search the app
                      later. The calculator automatically adjusts conversion behavior.
                    </div>
                  )}
                </div>
              </div>

              <div className="campaign-toggle">
                {[
                  { id: 'link',    icon: '🔗', label: 'With Link in Bio', sub: 'Sponsored post'  },
                  { id: 'mention', icon: '💬', label: 'Mention Only',     sub: 'Organic mention' },
                ].map(({ id, icon, label, sub }) => (
                  <button key={id}
                    className={`campaign-btn${campaignType === id ? ' active' : ''}`}
                    onClick={() => setCampaignType(id)}>
                    <span className="c-icon">{icon}</span>
                    <span className="c-label">{label}</span>
                    <span className="c-sub">{sub}</span>
                  </button>
                ))}
              </div>

              <button className="adv-toggle" onClick={() => setShowAdvanced(a => !a)}>
                {showAdvanced ? '▲' : '▼'} Advanced assumptions
              </button>
              {showAdvanced && (
                <div className="adv-box">
                  {campaignType === 'link' ? <>
                    <div className="adv-row"><span>Profile click-through rate</span><span>2.5%</span></div>
                    <div className="adv-row"><span>Install rate from profile</span><span>45%</span></div>
                    <div className="adv-row"><span>Paid conversion rate</span><span>12%</span></div>
                    <div className="adv-row adv-accent"><span>Bio attribution lift</span><span>+8%</span></div>
                  </> : <>
                    <div className="adv-row"><span>Search conversion rate</span><span>0.35%</span></div>
                    <div className="adv-row"><span>Install rate</span><span>40%</span></div>
                    <div className="adv-row"><span>Paid conversion rate</span><span>10%</span></div>
                  </>}
                </div>
              )}
            </div>

            {/* Payment structure */}
            <div className="card">
              <h2 className="card-title">Payment Structure</h2>
              <div className="pkg-toggle">
                {Object.entries(PKG).map(([id, { label }]) => (
                  <button key={id}
                    className={`pkg-btn${paymentStructure === id ? ' active' : ''}`}
                    onClick={() => setPaymentStructure(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Aggressiveness */}
            <div className="card">
              <h2 className="card-title">How aggressive should we be?</h2>
              <div className="agg-track-labels">
                <span>Conservative</span><span>Normal</span><span>Growth mode</span>
              </div>
              <input type="range" min="10" max="30" value={revSharePct}
                onChange={e => setRevSharePct(+e.target.value)} />
              <div className="agg-footer">
                <span className="agg-name">{currentAggLabel}</span>
                <span className="slider-val">{revSharePct}%</span>
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="right-col">

            {isOverpriced && (
              <div className="warn-banner">
                ⚠ This deal is likely overpriced. Payout exceeds 35% of expected revenue.
              </div>
            )}

            {/* Output hero */}
            <div className={`output-hero${numVideos > 1 ? ' hero-three' : ''}`}>
              <div className="hero-stat">
                <div className="hero-label">
                  CPM Offer<span className="hero-sub"> (per 1,000 views)</span>
                </div>
                <div className="hero-val cpm-grad">
                  {cpm !== null && v > 0 ? `$${fmt2(cpm)}` : '—'}
                </div>
              </div>

              <div className="hero-divider" />

              <div className="hero-stat">
                <div className="hero-label">Per Video Offer</div>
                <div className="hero-val payout-grad">
                  {v > 0 ? fmtWhole(payout) : '—'}
                </div>
              </div>

              {numVideos > 1 && <>
                <div className="hero-divider" />
                <div className="hero-stat">
                  <div className="hero-label">Total Campaign Offer</div>
                  <div className="hero-val total-grad">
                    {v > 0 ? fmtWhole(totalOffer) : '—'}
                  </div>
                  <div className="hero-pkg-note">{PKG[paymentStructure].label}</div>
                </div>
              </>}
            </div>

            {/* Performance Estimate */}
            <div className="card">
              <button className="breakdown-toggle" onClick={() => setShowBreakdown(b => !b)}>
                <h2 className="card-title" style={{ margin: 0 }}>Performance Estimate</h2>
                <span className="chevron">{showBreakdown ? '▲' : '▼'}</span>
              </button>
              {showBreakdown && (
                <div className="breakdown">
                  {breakdownRows.map(({ label, value, hint, accent, warn }) => (
                    <div key={label}
                      className={`b-row${accent ? ' b-accent' : ''}${warn ? ' b-warn' : ''}`}>
                      <div className="b-left">
                        <span className="b-label">{label}</span>
                        {hint && <span className="b-hint">{hint}</span>}
                      </div>
                      <span className={`b-value${accent ? ' accent-val' : ''}${warn ? ' neg' : ''}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="card action-card">
              <button className="btn-primary full" onClick={openSave}>
                Save Creator
              </button>
              <button className="btn-ghost full" onClick={() => setShowQuickOffer(o => !o)}>
                {showQuickOffer ? 'Hide Offer Message' : 'Generate Offer Message'}
              </button>
              {showQuickOffer && (
                <div className="offer-box">
                  <pre className="offer-pre">{quickOfferText}</pre>
                  <button className="btn-ghost" onClick={() => {
                    navigator.clipboard.writeText(quickOfferText)
                    setQuickCopied(true)
                    setTimeout(() => setQuickCopied(false), 2000)
                  }}>
                    {quickCopied ? '✓ Copied!' : 'Copy to Clipboard'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          REVERSE CALCULATOR
      ════════════════════════════════════════ */}
      {activeTab === 'reverse' && (
        <div className="single-col">
          <div className="card">
            <h2 className="card-title">Reverse Calculator</h2>
            <p className="muted-text">
              Enter a proposed CPM to see the implied financials, based on the
              view count set in the Calculator tab.
            </p>
            <label className="field" style={{ maxWidth: 320, marginBottom: '1.5rem' }}>
              <span className="field-label">Proposed CPM ($)</span>
              <input type="number" min="0" step="0.01" value={proposedCPM}
                onChange={e => setProposedCPM(e.target.value)} placeholder="e.g. 25.00" />
            </label>
            {rCPM > 0 && v === 0 && (
              <p className="warn-text">
                ⚠ Enter average views in the Calculator tab first.
              </p>
            )}
            {rCPM > 0 && v > 0 && (
              <div className="breakdown">
                {[
                  {
                    label: 'Implied Payout',
                    value: fmtWhole(impliedPayout),
                    cls:   '',
                  },
                  {
                    label: 'Profit per Video',
                    value: revProfit !== null ? (revProfit < 0 ? '-' : '') + fmtWhole(Math.abs(revProfit)) : '—',
                    cls:   revProfit !== null ? (revProfit >= 0 ? 'pos' : 'neg') : '',
                  },
                  {
                    label: 'ROAS',
                    value: roas !== null ? `${roas.toFixed(2)}×` : '—',
                    cls:   '',
                  },
                  {
                    label: 'Expected Profit %',
                    value: revProfitPct !== null ? `${revProfitPct.toFixed(1)}%` : '—',
                    cls:   revProfitPct !== null ? (revProfitPct >= 0 ? 'pos' : 'neg') : '',
                  },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="b-row">
                    <span className="b-label">{label}</span>
                    <span className={`b-value${cls ? ' ' + cls : ''}`}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          CREATORS CRM
      ════════════════════════════════════════ */}
      {activeTab === 'creators' && (
        <div>
          <div className="crm-topbar">
            <h2 className="crm-heading">Saved Creators</h2>
            <button className="btn-primary" onClick={() => {
              setModalData(BLANK); setEditingId(null); setModalOpen(true)
            }}>
              + Add Creator
            </button>
          </div>

          {creators.length === 0 ? (
            <div className="crm-empty">
              <p>No creators saved yet.</p>
              <p>Go to the Calculator tab, fill in metrics, and click "Save Creator".</p>
            </div>
          ) : (
            <div className="creator-grid">
              {creators.map(cr => {
                const cv = cr.views || 0
                const { revenue: cRev, payout: cPay, cpm: cCpm } = calcFunnel(
                  cv, cr.likes || 0, cr.comments || 0, cr.shares || 0,
                  cr.campaignType || 'link', cr.revSharePct || 15,
                )
                const cn      = PKG[cr.paymentStructure]?.n ?? 1
                const cTotal  = cPay * cn
                const overp   = cRev > 0 && cPay > cRev * 0.35
                const platforms = [
                  { url: cr.tiktok,    icon: 'TikTok',    sym: '𝕋' },
                  { url: cr.instagram, icon: 'Instagram',  sym: '◎' },
                  { url: cr.youtube,   icon: 'YouTube',    sym: '▶' },
                ].filter(p => p.url)

                return (
                  <div key={cr.id} className="creator-card"
                    onClick={() => loadIntoCalc(cr)}
                    title="Click to load into calculator">

                    <div className="cc-top">
                      <div className="cc-namerow">
                        <span className="cc-name">{cr.name}</span>
                        <span className={`cc-badge ${overp ? 'cc-overpriced' : 'cc-profitable'}`}>
                          {overp ? 'Overpriced' : 'Profitable'}
                        </span>
                      </div>

                      <div className="cc-meta">
                        {platforms.length > 0 && (
                          <div className="cc-platforms">
                            {platforms.map(({ url, icon, sym }) => (
                              <a key={icon} href={url} target="_blank" rel="noopener noreferrer"
                                className="cc-plt-link" title={icon}
                                onClick={e => e.stopPropagation()}>
                                {sym}
                              </a>
                            ))}
                          </div>
                        )}
                        {cr.email && (
                          <a href={`mailto:${cr.email}`} className="cc-email-link"
                            onClick={e => e.stopPropagation()}>
                            {cr.email}
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="cc-stats">
                      <div className="cc-stat">
                        <span className="cc-stat-val">{fmtNum(cv)}</span>
                        <span className="cc-stat-lbl">Avg Views</span>
                      </div>
                      <div className="cc-stat">
                        <span className="cc-stat-val">
                          {cv > 0 && cCpm !== null ? `$${fmt2(cCpm)}` : '—'}
                        </span>
                        <span className="cc-stat-lbl">CPM</span>
                      </div>
                      <div className="cc-stat">
                        <span className="cc-stat-val">{cv > 0 ? fmtWhole(cPay) : '—'}</span>
                        <span className="cc-stat-lbl">Per Video</span>
                      </div>
                      {cn > 1 && (
                        <div className="cc-stat">
                          <span className="cc-stat-val">{cv > 0 ? fmtWhole(cTotal) : '—'}</span>
                          <span className="cc-stat-lbl">{PKG[cr.paymentStructure].label}</span>
                        </div>
                      )}
                    </div>

                    <div className="cc-tags">
                      <span className="cc-tag">
                        {cr.campaignType === 'link' ? '🔗 Bio Link' : '💬 Mention'}
                      </span>
                      <span className="cc-tag">
                        {PKG[cr.paymentStructure]?.label ?? 'Single Video'}
                      </span>
                      <span className="cc-tag">{aggLabel(cr.revSharePct || 15)} · {cr.revSharePct || 15}%</span>
                    </div>

                    <div className="cc-actions" onClick={e => e.stopPropagation()}>
                      <button className="cc-btn cc-offer"
                        onClick={() => { setOfferTarget(cr); setOfferCopied(false) }}>
                        Generate Offer
                      </button>
                      <button className="cc-btn cc-edit" onClick={() => openEdit(cr)}>
                        Edit
                      </button>
                      <button className="cc-btn cc-delete"
                        onClick={() => setCreators(prev => prev.filter(x => x.id !== cr.id))}>
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
