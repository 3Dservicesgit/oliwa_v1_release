/**
 * Right-side detail panel for a selected asset.
 */
import React from 'react';
import type { Asset, PayoutProvider } from './types';
import { COLORS, btn, btnPrimary, btnBlue } from './types';
import { Pill, SectionTitle } from './MetricCard';

const s = {
  blade: {
    position: 'fixed' as const, right: 0, top: 106,
    height: 'calc(100vh - 106px)', width: 440,
    background: '#fff', borderLeft: `1px solid ${COLORS.border}`,
    boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
    display: 'flex', flexDirection: 'column' as const, zIndex: 50,
  },
  header: {
    padding: 14, background: '#F8F9FA', borderBottom: `1px solid ${COLORS.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  body:    { padding: 14, overflowY: 'auto' as const, flex: 1 },
  card:    { background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, marginTop: 12 },
  grid:    { display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, marginTop: 10, fontSize: 12 },
  label:   { color: COLORS.muted },
  value:   { fontWeight: 900 },
  actions: { display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' as const },
};

interface AssetTwinBladeProps {
  asset:   Asset;
  onClose: () => void;
  onTopUp: (assetId: string, amount: number, provider: PayoutProvider) => void;
}

export function AssetTwinBlade({ asset, onClose, onTopUp }: AssetTwinBladeProps) {
  return (
    <div style={s.blade}>
      <div style={s.header}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 14 }}>Asset Twin • {asset.id}</div>
          <div style={{ fontSize: 12, color: COLORS.muted }}>{asset.ownerOrg} • {asset.country}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Pill bg="#E8F5F3" fg={COLORS.tealDark}>{asset.status}</Pill>
          <button style={btn} onClick={onClose}>Close</button>
        </div>
      </div>

      <div style={s.body}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Overview', 'Telematics', 'VEBA', 'Payments', 'Audit'].map((t, i) => (
            <Pill key={t} bg={i === 0 ? '#E8F5F3' : '#fff'} fg={i === 0 ? COLORS.tealDark : COLORS.muted}>{t}</Pill>
          ))}
        </div>

        {/* Identity */}
        <div style={s.card}>
          <SectionTitle title="Identity" subtitle="Canonical digital twin record" />
          <div style={s.grid}>
            <div style={s.label}>Class</div>  <div style={s.value}>{asset.assetClass}</div>
            <div style={s.label}>Owner</div>  <div style={s.value}>{asset.ownerOrg}</div>
            <div style={s.label}>Risk</div>   <div style={s.value}>{asset.risk}</div>
          </div>
        </div>

        {/* Linking */}
        <div style={s.card}>
          <SectionTitle title="Linking (Device / SIM)" subtitle="Hard rule: no cross-tenant linking" />
          <div style={s.grid}>
            <div style={s.label}>IMEI</div>      <div style={s.value}>{asset.linked}</div>
            <div style={s.label}>ICCID</div>     <div style={s.value}>{asset.sim}</div>
            <div style={s.label}>Last Seen</div> <div style={s.value}>{asset.lastSeen}</div>
          </div>
          <div style={s.actions}>
            <button style={btn}>Re-link</button>
            <button style={{ ...btn, ...btnBlue }}>Ping</button>
          </div>
        </div>

        {/* Token & Billing */}
        <div style={s.card}>
          <SectionTitle title="Token & Billing (FIFO)" subtitle="Plan + burn + safeguards" />
          <div style={s.grid}>
            <div style={s.label}>Plan</div>        <div style={s.value}>OLIWA-PLUS • Type-A</div>
            <div style={s.label}>Burn</div>        <div style={s.value}>0.021 Tokens/sec</div>
            <div style={s.label}>Run-out ETA</div> <div style={s.value}>3d 7h</div>
            <div style={s.label}>Safeguard</div>   <div><Pill bg="#E6F4FE" fg="#0B4F6C">80% Soft-Cap</Pill></div>
          </div>
          <div style={s.actions}>
            <button style={{ ...btn, ...btnPrimary }} onClick={() => onTopUp(asset.id, 200000, 'MTN MoMo')}>Top-up</button>
            <button style={btn}>View Ledger</button>
          </div>
        </div>

        {/* VEBA */}
        <div style={s.card}>
          <SectionTitle title="VEBA Listing" subtitle="Escrow + leakage monitor" />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <Pill bg={asset.veba === 'Listed' ? '#E8F5F3' : '#F8F9FA'} fg={asset.veba === 'Listed' ? COLORS.tealDark : COLORS.muted}>{asset.veba}</Pill>
            <Pill bg="#E8F5F3" fg={COLORS.tealDark}>Leakage: Low</Pill>
            <Pill bg="#fff"    fg={COLORS.muted}>Next Booking: 14:00</Pill>
          </div>
          <div style={s.actions}>
            <button style={{ ...btn, ...btnBlue }}>Open Booking Ops</button>
            <button style={btn}>Pricing</button>
          </div>
        </div>

        {/* Wallet */}
        <div style={s.card}>
          <SectionTitle title="Payments / Payout Wallet" subtitle="Mobile money + escrow" />
          <div style={s.grid}>
            <div style={s.label}>Provider</div> <div style={s.value}>MTN MoMo</div>
            <div style={s.label}>Wallet</div>   <div style={s.value}>+256 77••• 902</div>
            <div style={s.label}>KYC</div>      <div><Pill bg="#E8F5F3" fg={COLORS.tealDark}>Verified ✓</Pill></div>
            <div style={s.label}>Escrow</div>   <div style={s.value}>UGX 1,240,000</div>
          </div>
          <div style={s.actions}>
            <button style={{ ...btn, background: COLORS.warning, color: '#fff', borderColor: COLORS.warning }}>Release Escrow (HITL)</button>
          </div>
        </div>

        {/* High-Risk */}
        <div style={{ ...s.card, background: '#FFF5F5', borderColor: '#FFD6D6' }}>
          <SectionTitle title="High-Risk Actions (HIC)" subtitle="Requires approval + audit trail" />
          <div style={s.actions}>
            <button style={{ ...btn, background: COLORS.danger, borderColor: COLORS.danger, color: '#fff' }}>Immobilize</button>
            <button style={{ ...btn, background: '#F97316',      borderColor: '#F97316',      color: '#fff' }}>Suspend Listing</button>
            <button style={{ ...btn, background: '#6B7280',      borderColor: '#6B7280',      color: '#fff' }}>Bulk Export</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: COLORS.muted }}>Last approval: SA • 09:14 • hash 9f3c…</div>
        </div>
      </div>
    </div>
  );
}
