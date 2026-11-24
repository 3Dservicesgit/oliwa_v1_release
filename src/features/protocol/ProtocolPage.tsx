/**
 * ProtocolPage — Screen 13: PROTOCOL PORT — Device Integrations
 *
 * Matches v26 mockups (7 screenshots):
 *   TOP:    Header + 4 KPIs → Protocol Health Matrix (6 rows) → Replay & Backfill Queue (3 rows)
 *   MID:    Decoder & Field Failures (5 bars) → Firmware Compatibility Matrix (4×5 grid)
 *   BOTTOM: Integration Test Suite → 2-col Partner/OEM | ePayment hooks → Metrics & Limits
 *   BLADE:  Protocol Detail (4 tabs: Overview, Fields, Tests, Billing, Audit)
 *   MODAL:  New Protocol Mapping wizard (5 steps)
 */
import React, { useState, useEffect } from "react";

// ─── Status colors ───────────────────────────────────────────────────────────
const sBadge: Record<string, string> = {
  OK:    "bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30",
  WARN:  "bg-[#F97316]/15 text-[#F97316] border border-[#F97316]/30",
  ALARM: "bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30",
  OFF:   "bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30",
};
const jobBadge: Record<string, string> = {
  Running:"border-[var(--brand)] text-[var(--brand)]",
  Queued: "border-[#F97316] text-[#F97316]",
  Paused: "border-[#667781] text-[#667781]",
};

// ─── Mock Data ───────────────────────────────────────────────────────────────
const PROTOCOLS = [
  { name:"Teltonika",     ver:"2.8", ingest:"4,820", err:"0.8%",  unk:"0.10%", ack:"99%", status:"OK"    },
  { name:"Concox GT06",   ver:"1.9", ingest:"2,140", err:"1.9%",  unk:"0.55%", ack:"97%", status:"WARN"  },
  { name:"Queclink",      ver:"3.1", ingest:"1,620", err:"0.4%",  unk:"0.08%", ack:"99%", status:"OK"    },
  { name:"Jimi",          ver:"2.2", ingest:"980",   err:"0.9%",  unk:"0.12%", ack:"98%", status:"OK"    },
  { name:"Ruptela",       ver:"1.4", ingest:"640",   err:"3.8%",  unk:"1.22%", ack:"95%", status:"ALARM" },
  { name:"OEM Partner X", ver:"0.9", ingest:"220",   err:"0.2%",  unk:"0.02%", ack:"99%", status:"OK"    },
];

const BACKFILL = [
  { job:"BF-9021", type:"Backfill", topic:"navas.teltonika", eta:"12m", state:"Running" },
  { job:"RP-1140", type:"Replay",   topic:"navas.gt06",      eta:"3m",  state:"Queued"  },
  { job:"BF-8870", type:"Backfill", topic:"navas.queclink",  eta:"—",   state:"Paused"  },
];

const FIELD_FAILURES = [
  { field:"gt06.acc",          pct:62, color:"bg-[#EF4444]" },
  { field:"teltonika.io_239",  pct:48, color:"bg-[#F97316]" },
  { field:"ruptela.temp_2",    pct:39, color:"bg-[#F97316]" },
  { field:"jimi.can_rpm",      pct:27, color:"bg-[#FBBF24]" },
  { field:"unknown.field_91",  pct:18, color:"bg-[#34B7F1]" },
];

const FW_VERSIONS = ["v1.9","v2.1","v2.4","v2.8","v3.1"];
const FW_MATRIX: Record<string, string[]> = {
  Teltonika: ["OK","WARN","OK","ALARM","OK"],
  GT06:      ["OK","OK","WARN","OK","ALARM"],
  Queclink:  ["ALARM","OK","OK","WARN","OK"],
  Jimi:      ["OK","ALARM","OK","OK","WARN"],
};

const PARTNERS = [
  { name:"OEM Partner X", dot:"bg-[#25D366]", badge:"OK"   },
  { name:"OEM Partner Y", dot:"bg-[#F97316]", badge:"WARN" },
  { name:"OEM Partner Z", dot:"bg-[#25D366]", badge:"OK"   },
];

const EPAYMENTS = [
  { name:"M-Pesa callbacks", dot:"bg-[#F97316]", badge:"Queue 21", badgeTone:"border-[#F97316] text-[#F97316]" },
  { name:"MTN MoMo",         dot:"bg-[#25D366]", badge:"OK",       badgeTone:"border-[#25D366] text-[#25D366]" },
  { name:"Airtel Money",     dot:"bg-[#25D366]", badge:"OK",       badgeTone:"border-[#25D366] text-[#25D366]" },
  { name:"Card gateway",     dot:"bg-[#25D366]", badge:"OK",       badgeTone:"border-[#25D366] text-[#25D366]" },
];

const METRICS = [
  { k:"Parser errors",      v:"Warn >0.5% • Alarm >2% • Critical >5%" },
  { k:"Unknown messages",   v:"Alarm if sudden spike >2× baseline" },
  { k:"Decoder latency p95",v:"Warn >200ms • Alarm >500ms • Critical >1s" },
  { k:"Backfill jobs",      v:"Critical if backlog age >24h" },
  { k:"Pricing changes",    v:"Critical if parser deploy bypasses HITL" },
];

const BLADE_AUDIT = [
  { time:"02:11", action:"Parser deployed",    actor:"SYS_ADMIN" },
  { time:"02:12", action:"HITL approval",      actor:"PLATFORM_OWNER" },
  { time:"02:14", action:"Regression tests",   actor:"WASWA_AI" },
  { time:"02:18", action:"Rollback window set",actor:"SRE" },
  { time:"02:25", action:"Evidence pack",       actor:"AUDIT" },
];

const SCHEMA_ROWS = [
  { raw:"io_239",   canonical:"fuel_level",      billing:"Fuel Tokens", mask:"OFF" },
  { raw:"gps_spd",  canonical:"speed",           billing:"GPS Time",    mask:"OFF" },
  { raw:"ai_event", canonical:"driver_fatigue",  billing:"AI Tokens",   mask:"ON"  },
];

// ─── Page ────────────────────────────────────────────────────────────────────
export function ProtocolPage() {
  const [bladeOpen, setBladeOpen] = useState(false);
  const [bladeTab, setBladeTab] = useState("Overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [portData, setPortData] = useState<any>(null);
  const [loadingPorts, setLoadingPorts] = useState(true);
  const [selectedPort, setSelectedPort] = useState<string | null>(null);

  // Port name mapping
  const portNames: Record<string, string> = {
    "3140": "Teltonika",
    "3160": "BCE Xirgo",
    "3170": "ET01",
    "3139": "Wetrack2_GT06",
  };

  useEffect(() => {
    const fetchPortActivity = async () => {
      try {
        setLoadingPorts(true);
        const { getRaw } = await import("../../api/client");
        const { ENDPOINTS } = await import("../../api/endpoints");
        const data = await getRaw<{ ports: any[] }>(ENDPOINTS.PORTS.ACTIVITY);
        setPortData(data.ports);
      } catch (error) {
        console.error("Failed to fetch port activity:", error);
      } finally {
        setLoadingPorts(false);
      }
    };

    fetchPortActivity();
    const interval = setInterval(fetchPortActivity, 600000); // Refresh every 10 minutes
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative">
      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

          {/* Header */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <span className="font-black text-[18px] text-[#111B21] tracking-wide">PROTOCOL PORT</span>
                <span className="text-[13px] text-[#667781]">— Device Integrations</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <Pill color="green" onClick={() => setModalOpen(true)}>+ New</Pill>
                <Pill>Import</Pill>
              </div>
            </div>
          </div>

          {/* ════════════════════ TOP SCROLL ════════════════════════════ */}

          {/* 4 KPIs */}
          <div className="grid grid-cols-4 gap-3">
            {loadingPorts ? (
              <>
                <KpiSkeleton />
                <KpiSkeleton />
                <KpiSkeleton />
                <KpiSkeleton />
              </>
            ) : portData ? (
              <>
                <KpiCard label="Active Protocols" value={String(Object.values(portData).filter((p: any) => p.active).length)} badge="OK" />
                <KpiCard label="Dormant Protocols" value={String(Object.values(portData).filter((p: any) => !p.active).length)} badge="OFF" />
                <KpiCard label="Total Protocols" value={String(Object.keys(portData).length)} badge="OK" />
                <KpiCard label="TT.Active Threads" value={String(Object.values(portData).reduce((sum: number, p: any) => sum + (p.tcp_threads || 0), 0))} badge="OK" />
              </>
            ) : null}
          </div>

          {/* Protocol Health Matrix */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E9EDEF]">
              <div className="font-black text-[13px] text-[#111B21]">Protocol Health Matrix</div>
              <div className="text-[11px] text-[#667781] mt-0.5">Throughput • schema drift • threading • Connections</div>
            </div>
            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full text-[12px] min-w-[800px]">
              <thead><tr className="border-b border-[#E9EDEF] bg-[#F8FAFC]">
                {["Protocol","TCP Threads","Ingest Conns","Egress Conns","Data Ingress","Data Egress","Status"].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-black text-[#667781]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loadingPorts ? (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                ) : portData ? (
                  Object.entries(portData).map(([port, data]: [string, any]) => {
                    const status = data.active ? "OK" : "OFF";
                    return (
                      <tr key={port} onClick={() => { setSelectedPort(port); setBladeOpen(true); setBladeTab("Overview"); }} className="border-b border-[#E9EDEF] last:border-0 hover:bg-[#F8FAFC] cursor-pointer">
                        <td className="px-3 py-2.5 font-black text-[#111B21]">{portNames[port] || port}</td>
                        <td className="px-3 py-2.5 text-[#667781]">{data.tcp_threads}</td>
                        <td className="px-3 py-2.5 text-[#111B21]">{data.connections}</td>
                        <td className="px-3 py-2.5 text-[#667781]">{data.outgoing_connections}</td>
                        <td className="px-3 py-2.5 text-[#667781]">{data.bytes_recv_hr}</td>
                        <td className="px-3 py-2.5 text-[#667781]">{data.bytes_sent_hr}</td>
                        <td className="px-3 py-2.5"><span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${sBadge[status]}`}>{status}</span></td>
                      </tr>
                    );
                  })
                ) : null}
              </tbody>
            </table>
            </div>
          </div>

          {/* ════════════════════ MID SCROLL ════════════════════════════ */}

          {/* Decoder & Field Failures */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
            <div className="font-black text-[13px] text-[#111B21]">TCP Thread Metrics</div>
            <div className="text-[11px] text-[#667781] mt-0.5 mb-3">Protocal TCP Threading Handling. Port Level</div>
            <div className="flex flex-col gap-3">
              {loadingPorts ? (
                <>
                  <SkeletonMetricBar />
                  <SkeletonMetricBar />
                  <SkeletonMetricBar />
                  <SkeletonMetricBar />
                </>
              ) : (
                portData && Object.entries(portData).map(([port, data]: [string, any]) => (
                  <div key={port} className="flex items-center gap-3 text-[12px]">
                    <span className="w-[140px] shrink-0 text-[#111B21] font-mono">{portNames[port] || port}</span>
                    <div className="flex-1 h-5 bg-[#F0F2F5] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[var(--brand)] rounded-full" 
                        style={{ width: `${Math.min((data.tcp_threads / 100) * 100, 100)}%` }} 
                      />
                    </div>
                    <span className="w-[40px] text-right font-black text-[#111B21]">{data.tcp_threads}</span>
                  </div>
                ))
              )}
            </div>
          </div>



          {/* Tcp Connections */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
            <div className="font-black text-[13px] text-[#111B21]">TCP Active Connection Metrics</div>
            <div className="text-[11px] text-[#667781] mt-0.5 mb-3">Protocal TCP Connections Handling. Port Level</div>
            <div className="flex flex-col gap-3">
              {loadingPorts ? (
                <>
                  <SkeletonMetricBar />
                  <SkeletonMetricBar />
                  <SkeletonMetricBar />
                  <SkeletonMetricBar />
                </>
              ) : (
                portData && Object.entries(portData).map(([port, data]: [string, any]) => {
                  const maxConnections = 600; // Scale reference
                  const connPct = Math.min((data.connections / maxConnections) * 100, 100);
                  const color = data.connections === 0 ? "bg-[#E9EDEF]" : data.connections > 300 ? "bg-[#EF4444]" : data.connections > 100 ? "bg-[#F97316]" : "bg-[#25D366]";
                  return (
                    <div key={port} className="flex items-center gap-3 text-[12px]">
                      <span className="w-[140px] shrink-0 text-[#111B21] font-mono">{portNames[port] || port}</span>
                      <div className="flex-1 h-5 bg-[#F0F2F5] rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${connPct}%` }} />
                      </div>
                      <span className="w-[40px] text-right font-black text-[#111B21]">{data.connections}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>


          {/* InGress Vs Egress Connections */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
            <div className="font-black text-[13px] text-[#111B21]">TCP Egress Vs Ingress Metrics</div>
            <div className="text-[11px] text-[#667781] mt-0.5 mb-3">Protocal TCP Egress, Ingress. Port Level</div>
            <div className="flex flex-col gap-3">
              {loadingPorts ? (
                <>
                  <SkeletonMetricBar />
                  <SkeletonMetricBar />
                  <SkeletonMetricBar />
                  <SkeletonMetricBar />
                </>
              ) : (
                portData && Object.entries(portData).map(([port, data]: [string, any]) => {
                  const ingressCount = data.connections || 0;
                  const egressCount = data.outgoing_connections || 0;
                  const totalConns = ingressCount + egressCount || 1;
                  const ingressPct = (ingressCount / totalConns) * 100;
                  const egressPct = (egressCount / totalConns) * 100;
                  
                  return (
                    <div key={port} className="flex items-center gap-3 text-[12px]">
                      <span className="w-[140px] shrink-0 text-[#111B21] font-mono">{portNames[port] || port}</span>
                      <div className="flex-1 h-5 bg-[#F0F2F5] rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-[#34B7F1]" 
                          style={{ width: `${ingressPct}%` }} 
                          title={`Ingress: ${ingressCount}`}
                        />
                        <div 
                          className="h-full bg-[#F97316]" 
                          style={{ width: `${egressPct}%` }} 
                          title={`Egress: ${egressCount}`}
                        />
                      </div>
                      <span className="w-[50px] text-right font-black text-[#111B21] text-[11px]">
                        {ingressCount}|{egressCount}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex gap-4 mt-3 text-[10px] text-[#667781]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#34B7F1]"></div>
                <span>Ingress</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#F97316]"></div>
                <span>Egress</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* ── Right: Waswa AI sidebar OR Blade ──────────────────────── */}
      <aside className={`${bladeOpen ? "w-[440px]" : "w-[380px]"} shrink-0 bg-white border-l border-[#E9EDEF] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-col`}>
        {bladeOpen ? (
          /* ── Blade: Protocol Detail ──────────────────────────────── */
          <>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#E9EDEF] shrink-0">
              <div>
                <span className="text-[10px] font-black bg-[var(--brand)] text-white px-2 py-0.5 rounded">BLADE</span>
                <span className="font-black text-[14px] text-[#111B21] ml-2">{selectedPort ? portNames[selectedPort] || selectedPort : "Protocol"}</span>
                <div className="text-[10px] text-[#667781] mt-0.5">Live data • {selectedPort && portData && portData[selectedPort]?.active ? "Active" : "Inactive"}</div>
              </div>
              <button onClick={() => setBladeOpen(false)} className="w-7 h-7 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] font-black text-[13px] cursor-pointer grid place-items-center">✕</button>
            </div>
            {/* Tabs */}
            <div className="flex gap-1.5 px-4 py-2 border-b border-[#E9EDEF] shrink-0">
              {["Overview","Connections","Traffic","Technical"].map(t => (
                <button key={t} onClick={() => setBladeTab(t)} className={`h-7 px-3 rounded-lg text-[11px] font-black cursor-pointer border ${bladeTab === t ? "bg-[var(--brand)]/10 border-[var(--brand)]/30 text-[var(--brand)]" : "bg-white border-[#E9EDEF] text-[#667781]"}`}>{t}</button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-5 py-4">
              {bladeTab === "Overview" && selectedPort && portData && portData[selectedPort] && <>
                <BSection title="Status & Activity">
                  <div className="p-4 text-[12px] text-[#111B21] leading-relaxed">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black">Status:</span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${sBadge[portData[selectedPort].active ? "OK" : "OFF"]}`}>
                        {portData[selectedPort].active ? "ACTIVE" : "OFFLINE"}
                      </span>
                    </div>
                    <div>Script: <span className="font-mono text-[#667781]">{portData[selectedPort].script}</span></div>
                    <div>Port: <span className="font-mono text-[#667781]">{selectedPort}</span></div>
                  </div>
                </BSection>
                <BSection title="Thread Information">
                  <div className="p-4 text-[12px] text-[#111B21] leading-relaxed">
                    <div>TCP Threads: <span className="font-black text-[var(--brand)]">{portData[selectedPort].tcp_threads}</span></div>
                    <div className="mt-2 h-3 bg-[#F0F2F5] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--brand)]" style={{ width: `${Math.min((portData[selectedPort].tcp_threads / 100) * 100, 100)}%` }}></div>
                    </div>
                  </div>
                </BSection>
              </>}
              {bladeTab === "Connections" && selectedPort && portData && portData[selectedPort] && <>
                <BSection title="Connection Statistics">
                  <div className="p-4 text-[12px] text-[#111B21] leading-relaxed">
                    <div className="flex items-center justify-between mb-3">
                      <span>Total Connections:</span>
                      <span className="font-black text-[18px]">{portData[selectedPort].connections}</span>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span>Ingest (Incoming):</span>
                      <span className="font-black text-[18px] text-[#34B7F1]">{(portData[selectedPort].connections || 0) - (portData[selectedPort].outgoing_connections || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Egress (Outgoing):</span>
                      <span className="font-black text-[18px] text-[#F97316]">{portData[selectedPort].outgoing_connections}</span>
                    </div>
                  </div>
                </BSection>
                <BSection title="Remote Endpoints">
                  <div className="p-4">
                    {portData[selectedPort].remote_endpoints && portData[selectedPort].remote_endpoints.length > 0 ? (
                      <div className="text-[11px] space-y-1 max-h-[600px] overflow-y-auto">
                        {portData[selectedPort].remote_endpoints.map((ep: any, i: number) => (
                          <div key={i} className="font-mono text-[#667781] p-1 bg-[#F8FAFC] rounded">
                            {ep.remote_ip}:{ep.remote_port}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[12px] text-[#667781]">No remote endpoints</div>
                    )}
                  </div>
                </BSection>
              </>}
              {bladeTab === "Traffic" && selectedPort && portData && portData[selectedPort] && <>
                <BSection title="Data Transfer">
                  <div className="p-4 text-[12px] text-[#111B21] leading-relaxed">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span>Bytes Received (Ingress):</span>
                        <span className="font-black text-[#34B7F1]">{portData[selectedPort].bytes_recv_hr}</span>
                      </div>
                      <div className="text-[11px] text-[#667781]">{portData[selectedPort].bytes_recv.toLocaleString()} bytes</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span>Bytes Sent (Egress):</span>
                        <span className="font-black text-[#F97316]">{portData[selectedPort].bytes_sent_hr}</span>
                      </div>
                      <div className="text-[11px] text-[#667781]">{portData[selectedPort].bytes_sent.toLocaleString()} bytes</div>
                    </div>
                  </div>
                </BSection>
              </>}
              {bladeTab === "Technical" && selectedPort && portData && portData[selectedPort] && <>
                <BSection title="Raw API Response">
                  <div className="p-4">
                    <pre className="text-[10px] font-mono bg-[#F8FAFC] p-3 rounded overflow-x-auto max-h-[400px] overflow-y-auto text-[#111B21]">
                      {JSON.stringify(portData[selectedPort], null, 2)}
                    </pre>
                  </div>
                </BSection>
              </>}
            </div>
          </>
        ) : (
          /* ── Waswa AI Co-Pilot sidebar ───────────────────────────── */
          <div className="p-4 flex flex-col gap-3">
            <div className="border border-[#E9EDEF] rounded-xl p-4">
              <div className="font-black text-[13px] text-[#111B21]">Waswa AI Co-Pilot</div>
              <div className="text-[11px] text-[#667781] mt-0.5">HIC: suggestions need approval</div>
              <div className="mt-3 bg-[var(--brand)]/10 border border-[var(--brand)]/20 rounded-xl p-3">
                <div className="font-black text-[12px] text-[var(--brand)] mb-1">Insight</div>
                <div className="text-[11px] text-[#111B21] leading-relaxed">
                  Schema drift spike detected in GT06 (KE) — unknown.field_91 …<br/>
                  Suggested action: enable safe-mode masking + ship parser ho…<br/>
                  Revenue risk: token leakage if metering gaps persist.
                </div>
              </div>
            </div>

            <div className="font-black text-[13px] text-[#111B21]">Recommended Actions</div>
            <button className="w-full h-9 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-[12px] font-black border-none cursor-pointer">Approve Hotfix (HITL)</button>
            <div className="font-black text-[12px] text-[#111B21] px-1">Open Evidence Pack</div>
            <button className="w-full h-9 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-[12px] font-black cursor-pointer">Kill-Switch (HIC)</button>

            <div className="font-black text-[13px] text-[#111B21] mt-1">Quick Links</div>
            <div className="border border-[var(--brand)]/20 rounded-lg px-3 py-2.5 text-[12px] font-black text-[var(--brand)] cursor-pointer hover:bg-[var(--brand)]/5">Token Top-Up (MoMo / Card)</div>
            <div className="border border-[var(--brand)]/20 rounded-lg px-3 py-2.5 text-[12px] font-black text-[var(--brand)] cursor-pointer hover:bg-[var(--brand)]/5">VEBA Leakage Monitor</div>

            <input placeholder="Ask Waswa... (e.g., 'why decoder p95 spiked?')" className="w-full h-8 rounded-lg border border-[#E9EDEF] px-3 text-[11px] text-[#111B21] placeholder:text-[#667781] outline-none mt-auto" />
          </div>
        )}
      </aside>

      {/* ── Modal: New Protocol Mapping ───────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/35 z-50 grid place-items-center" onClick={() => setModalOpen(false)}>
          <div className="w-[min(760px,calc(100vw-24px))] max-h-[calc(100vh-24px)] bg-white rounded-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#E9EDEF] flex items-center justify-between shrink-0">
              <div>
                <div className="font-black text-[16px] text-[#111B21]">New Protocol Mapping</div>
                <div className="text-[11px] text-[#667781] mt-0.5">Wizard • create / test / deploy • audit-linked</div>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-8 h-8 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] font-black text-[14px] cursor-pointer grid place-items-center">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-5">

              {/* Wizard steps */}
              <div className="flex gap-2 mb-5">
                {["1  Metadata","2  Schema","3  Metering","4  Test","5  Deploy"].map((s,i) => (
                  <span key={s} className={`flex-1 h-9 rounded-lg text-[12px] font-black flex items-center justify-center border cursor-pointer ${i === 2 ? "bg-[var(--brand)]/10 border-[var(--brand)]/30 text-[var(--brand)]" : "bg-white border-[#E9EDEF] text-[#667781]"}`}>{s}</span>
                ))}
              </div>

              {/* Protocol Identity */}
              <div className="text-[12px] font-black text-[#667781] mb-2">Protocol Identity</div>
              <div className="border border-[#E9EDEF] rounded-xl p-4 mb-4 text-[12px] text-[#667781] leading-relaxed">
                Name: ________&ensp; Version: ____&ensp; Vendor: ________<br/>
                Kafka topic: navas.________&ensp; Port: ____&ensp; Transport: TCP/UDP<br/>
                ACK/Handshake: Enabled&ensp; Time sync: Enabled
              </div>

              {/* Schema Mapping */}
              <div className="text-[12px] font-black text-[#667781] mb-2">Schema Mapping</div>
              <div className="text-[11px] text-[#667781] mb-2">Map raw fields → canonical params (lat, lon, speed, ign, fuel, …)</div>
              <div className="border border-[#E9EDEF] rounded-xl overflow-hidden mb-4">
                <table className="w-full text-[12px]">
                  <thead><tr className="border-b border-[#E9EDEF] bg-[#F8FAFC]">
                    {["Raw","Canonical","Billing","Mask"].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-black text-[#667781]">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {SCHEMA_ROWS.map(r => (
                      <tr key={r.raw} className="border-b border-[#E9EDEF] last:border-0">
                        <td className="px-3 py-2 font-mono font-black text-[#111B21]">{r.raw}</td>
                        <td className="px-3 py-2 text-[#667781]">{r.canonical}</td>
                        <td className="px-3 py-2 text-[#667781]">{r.billing}</td>
                        <td className="px-3 py-2 text-[#667781]">{r.mask}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Metering (US-03) */}
              <div className="bg-[var(--brand)]/10 border border-[var(--brand)]/20 rounded-xl p-4 mb-4">
                <div className="font-black text-[12px] text-[var(--brand)] mb-1">Metering (US-03)</div>
                <div className="text-[12px] text-[#111B21] leading-relaxed">
                  <strong>Emit usage_events for every billable ingest / parameter / AI inference</strong><br/>
                  Token scope: Type A + VEBA (optional) • FIFO per asset
                </div>
                <div className="border border-[#E9EDEF] rounded-lg px-3 py-2 mt-2 text-[12px] text-[#111B21] bg-white">
                  <strong>Out-of-token behavior: Store raw, mask UI (upsell safe)</strong>
                </div>
              </div>

              {/* High-risk deploy warning */}
              <div className="bg-[#FEF3C7] border border-[#FBBF24]/30 rounded-xl p-4">
                <div className="font-black text-[12px] text-[#EF4444]">High-risk deploy requires HITL approval + audit chain (irrefutable)</div>
                <div className="text-[11px] text-[#667781] mt-1">Applies to: pricing changes, refunds, suspensions, kill-switch</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-[#E9EDEF] bg-white shrink-0">
              <button onClick={() => setModalOpen(false)} className="h-10 px-6 rounded-lg bg-white border border-[#E9EDEF] text-[13px] font-black text-[#111B21] cursor-pointer">Cancel</button>
              <button onClick={() => setModalOpen(false)} className="h-10 px-6 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-[13px] font-black border-none cursor-pointer hover:brightness-105">Save &amp; Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reusable Components ─────────────────────────────────────────────────────
const pillStyles: Record<string, string> = {
  green: "bg-[#25D366] text-[#075E54]",
  ghost: "bg-white border border-[#E9EDEF] text-[#667781]",
};

function KpiSkeleton() {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 animate-pulse">
      <div className="h-3 bg-[#E9EDEF] rounded w-16 mb-2"></div>
      <div className="h-7 bg-[#E9EDEF] rounded w-24 mt-2"></div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[#E9EDEF] last:border-0 animate-pulse">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-3 py-2.5">
          <div className="h-4 bg-[#E9EDEF] rounded w-20"></div>
        </td>
      ))}
    </tr>
  );
}

function SkeletonMetricBar() {
  return (
    <div className="flex items-center gap-3 animate-pulse">
      <div className="w-[140px] h-4 bg-[#E9EDEF] rounded shrink-0"></div>
      <div className="flex-1 h-5 bg-[#E9EDEF] rounded-full"></div>
      <div className="w-[40px] h-4 bg-[#E9EDEF] rounded"></div>
    </div>
  );
}



function Pill({ color = "ghost", onClick, children }: { color?: string; onClick?: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`h-7 px-3 rounded-full text-[11px] font-black border-none cursor-pointer hover:brightness-105 active:opacity-85 transition-all whitespace-nowrap ${pillStyles[color] ?? pillStyles.ghost}`}>{children}</button>;
}

function KpiCard({ label, value, badge }: { label: string; value: string; badge: string }) {
  return (
    <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 relative">
      <span className={`absolute top-3 right-3 px-1.5 py-0.5 rounded-full text-[9px] font-black ${sBadge[badge]}`}>{badge}</span>
      <div className="text-[11px] text-[#667781]">{label}</div>
      <div className="text-[22px] font-black text-[#111B21] mt-1 leading-tight">{value}</div>
    </div>
  );
}

function BSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 border border-[#E9EDEF] rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E9EDEF]"><div className="font-black text-[12px] text-[#111B21]">{title}</div></div>
      {children}
    </div>
  );
}
