/**
 * AssetDigitalTwinPage — TWIN ATLAS (Screen 16)
 *
 * TopBar, StatusStrip, NavRail and Sidebar are provided by the global
 * app shell in App.tsx. This page renders only its own content area.
 *
 * Reuses from shared components:
 *   WaswaDrawer  — floating AI co-pilot chat
 *
 * Local sub-components (components/):
 *   KpiGrid, AssetsTable, AssetTwinBlade, CreateAssetModal,
 *   MaintenancePanel, PaymentsSection
 */
import React, { useMemo, useState } from 'react';
import { WaswaDrawer } from '../../components/waswa';

import type { Asset, PayoutProvider } from './components/types';
import { COLORS, btn, btnPrimary, btnBlue } from './components/types';
import { KpiGrid }          from './components/KpiGrid';
import { AssetsTable }      from './components/AssetsTable';
import { AssetTwinBlade }   from './components/AssetTwinBlade';
import { CreateAssetModal } from './components/CreateAssetModal';
import { MaintenancePanel } from './components/MaintenancePanel';
import { PaymentsSection }  from './components/PaymentsSection';

// ── Sample data ───────────────────────────────────────────────────────────────
const ASSETS: Asset[] = [
  { id: 'KLA-DOZER-D6-019',  displayName: 'KLA-DOZER-D6-019',  assetClass: 'VEH', linked: 'IMEI 8619…', sim: 'ICCID 8932…', lastSeen: '2m ago',  status: 'Online', safety: '92', tokensAB: '12.8k / 1.2k', veba: 'Listed', wallet: 'MTN ✓',     country: 'UG', risk: 'Low',  ownerOrg: '3D Services • TEPU'       },
  { id: 'NBO-BODA-PIKI-044', displayName: 'NBO-BODA-PIKI-044', assetClass: 'VEH', linked: 'IMEI 7740…', sim: 'ICCID 8991…', lastSeen: '8m ago',  status: 'Online', safety: '78', tokensAB: '3.1k / 220',   veba: 'Off',    wallet: 'M‑Pesa ✓',  country: 'KE', risk: 'Med',  ownerOrg: 'VEBA Partner • Nairobi'  },
  { id: 'GIT-COLDCHAIN-007', displayName: 'GIT-COLDCHAIN-007', assetClass: 'GDS', linked: 'IMEI 5112…', sim: 'ICCID 8901…', lastSeen: '34m ago', status: 'Warn',   safety: '—',  tokensAB: '9.2k / 0',     veba: 'N/A',    wallet: '—',          country: 'UG', risk: 'Low',  ownerOrg: 'ColdChain • GIT'          },
  { id: 'KLA-GUARD-OPS-11',  displayName: 'KLA-GUARD-OPS-11',  assetClass: 'PPL', linked: 'APP User',   sim: '—',           lastSeen: 'Live',    status: 'Online', safety: '—',  tokensAB: '1.1k / 0',     veba: 'Off',    wallet: 'Airtel ✓',   country: 'UG', risk: 'Low',  ownerOrg: 'Security Unit'            },
  { id: 'MSA-VAN-POOL-003',  displayName: 'MSA-VAN-POOL-003',  assetClass: 'VEH', linked: 'IMEI 2239…', sim: 'ICCID 8922…', lastSeen: '3h ago',  status: 'Alarm',  safety: '65', tokensAB: '0.9k / 40',    veba: 'Listed', wallet: 'M‑Pesa ⚠',  country: 'KE', risk: 'High', ownerOrg: 'VEBA Partner • Coast'    },
  { id: 'JIN-TANKER-021',    displayName: 'JIN-TANKER-021',    assetClass: 'VEH', linked: 'IMEI 9811…', sim: 'ICCID 8930…', lastSeen: '1d ago',  status: 'Crit',   safety: '49', tokensAB: '0 / 0',        veba: 'Listed', wallet: 'MTN ✕',     country: 'UG', risk: 'High', ownerOrg: 'Logistics • JIN'          },
];

// ── API stub (replace with real endpoints) ────────────────────────────────────
function apiStub() {
  return {
    openTwin:      (assetId: string)  => console.log('GET /api/assets/', assetId),
    createAsset:   (payload: unknown) => console.log('POST /api/assets', payload),
    initiateTopUp: (assetId: string, amount: number, provider: PayoutProvider) =>
      console.log('POST /api/payments/topup', { assetId, amount, provider }),
  };
}

// ── Context strip (tenant selector, RBAC, token balances, system health) ──────
const stripStyle: React.CSSProperties = {
  height: 52, background: COLORS.card, borderBottom: `1px solid ${COLORS.border}`,
  display: 'flex', alignItems: 'center', padding: '0 16px', gap: 14,
  justifyContent: 'space-between', flexShrink: 0,
};
const chipStyle: React.CSSProperties = {
  borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 800,
  display: 'inline-flex', alignItems: 'center', gap: 8,
};
const selectStyle: React.CSSProperties = {
  height: 30, borderRadius: 10, border: `1px solid ${COLORS.border}`,
  background: '#F8F9FA', padding: '0 10px', fontWeight: 800, fontSize: 12, color: COLORS.text,
};

function Dot({ color }: { color: string }) {
  return <span style={{ width: 8, height: 8, borderRadius: 99, background: color, display: 'inline-block' }} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AssetDigitalTwinPage() {
  const [tenant,          setTenant]          = useState('3D Services • TOP');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [createOpen,      setCreateOpen]      = useState(false);
  const [waswaOpen,       setWaswaOpen]       = useState(false);

  const selected = useMemo(() => ASSETS.find((a) => a.id === selectedAssetId) ?? null, [selectedAssetId]);
  const api = apiStub();

  const handleSelectAsset = (id: string) => { setSelectedAssetId(id); api.openTwin(id); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* Context strip */}
      <div style={stripStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>Tenant</div>
            <select value={tenant} onChange={(e) => setTenant(e.target.value)} style={selectStyle}>
              <option>3D Services • TOP</option>
              <option>VEBA Partner • Nairobi</option>
              <option>Logistics • JIN</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>RBAC</div>
            <span style={{ ...chipStyle, background: COLORS.teal, color: '#fff' }}>SYSTEM_ADMIN</span>
          </div>

          <div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>Tokens</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...chipStyle, background: '#E8F5F3', color: COLORS.tealDark }}>Type‑A 1,284,330</span>
              <span style={{ ...chipStyle, background: '#E6F4FE', color: '#0B4F6C' }}>Type‑B 84,120</span>
            </div>
          </div>

          <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Dot color={COLORS.green}   /> Kafka lag 0.8s</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Dot color={COLORS.green}   /> MoMo OK</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Dot color={COLORS.warning} /> Docs exp 23</span>
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 900, color: COLORS.muted }}>
          SCREEN 16 — TWIN ATLAS — ASSETS DIGITAL TWIN
        </div>
      </div>

      {/* Scrollable page body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, minHeight: 0 }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 1000, letterSpacing: 0.2 }}>TWIN ATLAS</h1>
            <p style={{ margin: '6px 0 0 0', fontSize: 13, color: COLORS.muted }}>
              Assets • Vehicles / People / Goods (Digital Twin)
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button style={btn} onClick={() => console.log('export')}>Export</button>
            <button style={btn} onClick={() => console.log('link device')}>Link Device</button>
            <button style={{ ...btn, ...btnBlue }}    onClick={() => console.log('enable veba')}>Enable VEBA</button>
            <button style={{ ...btn, ...btnPrimary }} onClick={() => setCreateOpen(true)}>+ New</button>
          </div>
        </div>

        <KpiGrid />
        <AssetsTable assets={ASSETS} onSelectAsset={handleSelectAsset} onCreateAsset={() => setCreateOpen(true)} />
        <MaintenancePanel />
        <PaymentsSection />
      </div>

      {selected && (
        <AssetTwinBlade asset={selected} onClose={() => setSelectedAssetId(null)} onTopUp={api.initiateTopUp} />
      )}

      <CreateAssetModal
        open={createOpen} tenant={tenant}
        onClose={() => setCreateOpen(false)}
        onCreate={(payload) => { api.createAsset(payload); setCreateOpen(false); }}
      />

      {/* Shared WaswaDrawer — slides in from the right */}
      <WaswaDrawer open={waswaOpen} onClose={() => setWaswaOpen(false)} />

      {/* Floating trigger */}
      <button
        onClick={() => setWaswaOpen((v) => !v)}
        title="Waswa AI"
        style={{
          position: 'fixed', right: 18, bottom: 18,
          width: 56, height: 56, borderRadius: 999,
          background: COLORS.green, border: `1px solid ${COLORS.green}`,
          boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
          display: 'grid', placeItems: 'center',
          color: COLORS.tealDark, fontWeight: 1000, cursor: 'pointer', zIndex: 60, fontSize: 12,
        }}
      >
        AI
      </button>
    </div>
  );
}
