/**
 * BrandingPage — a client administrator sets the account's colours and the
 * assistant's name, for the OLIWA web console and mobile app.
 *
 * Shown as the Branding tab of User Management, only to someone the server
 * says may change it (GET /branding/me → can_edit): 3D Services switches it on
 * per client in the CMS, for all of the client's administrators or chosen
 * ones. The server checks again on every save.
 *
 * Saving applies at once here and in the app the next time it loads. The
 * server refuses colours that text would not read on, and says why.
 */
import React, { useEffect, useMemo, useState } from "react";
import { resetBranding, saveBranding } from "../../api/services/branding.service";
import type { BrandingChanges } from "../../api/types/branding.types";
import { useBranding } from "../../branding/branding";

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** The server's message (it names the first field at fault). The API client
 *  keeps only the message, so it is put under the field when just one field
 *  was sent; otherwise it shows in the banner. */
function errorOf(e: unknown, sent: string[] = []): { message: string; fields: Record<string, string> } {
  const message = (e as { message?: string })?.message || "Could not save the branding.";
  return { message, fields: sent.length === 1 ? { [sent[0]]: message } : {} };
}

/** Readable text on [hex]: white or dark ink (the same rule as the server). */
function inkOn(hex: string): string {
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const l = lum(hex);
  const white = 1.05 / (l + 0.05);
  const dark = (l + 0.05) / (lum("#111B21") + 0.05);
  return white >= dark ? "#FFFFFF" : "#111B21";
}

export function BrandingPage() {
  const { branding, replace } = useBranding();
  const [brand, setBrand] = useState(branding.brand_color);
  const [accent, setAccent] = useState(branding.accent_color);
  const [name, setName] = useState(branding.assistant_name);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // A save or reset (here or in another tab) brings new values.
  useEffect(() => {
    setBrand(branding.brand_color);
    setAccent(branding.accent_color);
    setName(branding.assistant_name);
  }, [branding.brand_color, branding.accent_color, branding.assistant_name]);

  const changes = useMemo(() => {
    const c: BrandingChanges = {};
    if (branding.allow_colors && brand.toUpperCase() !== branding.brand_color.toUpperCase()) c.brand_color = brand;
    if (branding.allow_colors && accent.toUpperCase() !== branding.accent_color.toUpperCase()) c.accent_color = accent;
    if (branding.allow_assistant_name && name.trim() !== branding.assistant_name) c.assistant_name = name.trim();
    return c;
  }, [brand, accent, name, branding]);
  const dirty = Object.keys(changes).length > 0;
  const previewBrand = HEX.test(brand) ? brand : branding.brand_color;
  const previewAccent = HEX.test(accent) ? accent : branding.accent_color;
  const previewName = name.trim() || branding.defaults.assistant_name;

  const save = async () => {
    setBusy(true); setError(null); setFieldErrors({}); setNotice(null);
    try {
      replace(await saveBranding(changes));
      setNotice("Saved. The console uses it now; the mobile app picks it up the next time it opens.");
    } catch (e) {
      const { message, fields } = errorOf(e, Object.keys(changes));
      setFieldErrors(fields);
      setError(Object.keys(fields).length ? null : message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setConfirmReset(false); setBusy(true); setError(null); setFieldErrors({}); setNotice(null);
    try {
      replace(await resetBranding());
      setNotice("Back to the OLIWA defaults.");
    } catch (e) {
      setError(errorOf(e).message);
    } finally {
      setBusy(false);
    }
  };

  const colourField = (label: string, value: string, set: (v: string) => void, key: string, hint: string) => (
    <div>
      <label className="block text-[11px] font-extrabold text-[#667781] mb-1" htmlFor={`brand-${key}`}>{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} picker`} value={HEX.test(value) ? value : "#000000"}
          onChange={(e) => set(e.target.value.toUpperCase())} disabled={!branding.allow_colors || busy}
          className="w-10 h-9 p-0.5 rounded-lg border border-[#E9EDEF] bg-white cursor-pointer disabled:cursor-default" />
        <input id={`brand-${key}`} value={value} onChange={(e) => set(e.target.value.trim())} maxLength={7}
          disabled={!branding.allow_colors || busy}
          className={`w-28 h-9 rounded-lg border px-2 text-[13px] font-mono outline-none ${fieldErrors[key] || (value && !HEX.test(value)) ? "border-[#E53935]" : "border-[#E9EDEF]"}`} />
      </div>
      <div className={`text-[11px] mt-1 ${fieldErrors[key] ? "text-[#B00020]" : "text-[#667781]"}`}>{fieldErrors[key] ?? hint}</div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#F0F2F5] p-3 gap-3 overflow-y-auto">
      <div className="bg-white border border-[#E9EDEF] rounded-xl px-4 py-3">
        <div className="font-black text-[16px] text-[#111B21]">Branding</div>
        <div className="text-[12px] text-[#667781] mt-0.5">
          Your account's colours and your assistant's name, in this console and the OLIWA mobile app.
        </div>
      </div>

      {notice && <div className="rounded-xl px-4 py-2.5 bg-[#E7FFEF] border border-[#BEF0D2] text-[12px] text-[#075E54] font-semibold">{notice}</div>}
      {error && <div className="rounded-xl px-4 py-2.5 bg-[#FDECEC] border border-[#F5C2C0] text-[12px] text-[#B00020] font-semibold">{error}</div>}

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="bg-white border border-[#E9EDEF] rounded-xl p-4 flex flex-col gap-4">
          {branding.allow_colors ? (
            <>
              <div className="font-black text-[13px] text-[#111B21]">Colours</div>
              {branding.defaults.presets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {branding.defaults.presets.map((p) => (
                    <button key={p.name} type="button" disabled={busy}
                      onClick={() => { setBrand(p.brand_color); setAccent(p.accent_color); }}
                      className="h-8 pl-1 pr-3 rounded-full border border-[#E9EDEF] bg-white text-[12px] font-bold text-[#111B21] cursor-pointer flex items-center gap-1.5 hover:bg-[#F8F9FA]">
                      <span className="w-6 h-6 rounded-full flex overflow-hidden border border-black/10">
                        <span className="w-1/2 h-full" style={{ background: p.brand_color }} />
                        <span className="w-1/2 h-full" style={{ background: p.accent_color }} />
                      </span>
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-6">
                {colourField("Brand colour", brand, setBrand, "brand_color", "Headers and the main colour. White text goes on it.")}
                {colourField("Accent colour", accent, setAccent, "accent_color", "Main buttons and highlights.")}
              </div>
            </>
          ) : (
            <div className="text-[12px] text-[#667781]">3D Services has not enabled colour changes for your account.</div>
          )}

          <div className="border-t border-[#E9EDEF]" />

          {branding.allow_assistant_name ? (
            <div>
              <label className="block font-black text-[13px] text-[#111B21] mb-1" htmlFor="brand-assistant">Assistant name</label>
              <input id="brand-assistant" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} disabled={busy}
                placeholder={branding.defaults.assistant_name}
                className={`w-full max-w-[280px] h-9 rounded-lg border px-3 text-[13px] outline-none ${fieldErrors.assistant_name ? "border-[#E53935]" : "border-[#E9EDEF]"}`} />
              <div className={`text-[11px] mt-1 ${fieldErrors.assistant_name ? "text-[#B00020]" : "text-[#667781]"}`}>
                {fieldErrors.assistant_name ?? "2 to 24 letters. Your team sees this name, and the assistant introduces itself with it."}
              </div>
            </div>
          ) : (
            <div className="text-[12px] text-[#667781]">3D Services has not enabled renaming the assistant for your account.</div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={save} disabled={!dirty || busy}
              className="h-9 px-4 rounded-lg border-0 bg-[#128C7E] text-white text-[12px] font-extrabold cursor-pointer disabled:opacity-50 disabled:cursor-default">
              {busy ? "Saving…" : "Save"}
            </button>
            {dirty && (
              <button type="button" disabled={busy}
                onClick={() => { setBrand(branding.brand_color); setAccent(branding.accent_color); setName(branding.assistant_name); setFieldErrors({}); }}
                className="h-9 px-4 rounded-lg border border-[#E9EDEF] bg-white text-[12px] font-extrabold text-[#111B21] cursor-pointer">
                Undo changes
              </button>
            )}
            {!confirmReset ? (
              <button type="button" onClick={() => setConfirmReset(true)} disabled={busy}
                className="h-9 px-4 rounded-lg border border-[#E9EDEF] bg-white text-[12px] font-extrabold text-[#B00020] cursor-pointer ml-auto">
                Reset to default
              </button>
            ) : (
              <span className="ml-auto flex items-center gap-2 text-[12px] text-[#111B21]">
                Go back to OLIWA teal and “{branding.defaults.assistant_name}”?
                <button type="button" onClick={reset} className="h-8 px-3 rounded-lg border-0 bg-[#B00020] text-white text-[12px] font-extrabold cursor-pointer">Reset</button>
                <button type="button" onClick={() => setConfirmReset(false)} className="h-8 px-3 rounded-lg border border-[#E9EDEF] bg-white text-[12px] font-extrabold cursor-pointer">Cancel</button>
              </span>
            )}
          </div>
        </div>

        {/* Live preview: how the choice looks before it is saved. */}
        <div className="bg-white border border-[#E9EDEF] rounded-xl p-4 flex flex-col gap-3" aria-label="Preview">
          <div className="font-black text-[13px] text-[#111B21]">Preview</div>
          <div className="rounded-xl overflow-hidden border border-[#E9EDEF]">
            <div className="px-3 py-2.5 text-[13px] font-black" style={{ background: previewBrand, color: "#FFFFFF" }}>
              OLIWA · Fleet status
            </div>
            <div className="p-3 bg-[#F0F2F5] flex flex-col gap-2.5">
              <div className="bg-white rounded-lg p-2.5 text-[12px] text-[#111B21]">
                6 of 35 online · <span className="font-black" style={{ color: previewBrand }}>View all</span>
              </div>
              <button type="button" tabIndex={-1} className="h-9 rounded-lg border-0 text-[12px] font-extrabold"
                style={{ background: previewAccent, color: inkOn(previewAccent) }}>
                + Record fuel
              </button>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-[14px]" style={{ background: previewBrand, color: "#FFFFFF" }}>✦</span>
                <span className="bg-white rounded-lg px-2.5 py-1.5 text-[12px] text-[#111B21]">Hi, I'm {previewName}. Ask me about your vehicles.</span>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-[#667781]">
            Status colours (red alerts, amber warnings, green OK) stay the same, so they always mean the same thing.
          </div>
        </div>
      </div>
    </div>
  );
}
