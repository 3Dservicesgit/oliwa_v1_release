/**
 * GeofenceList — Scrollable card list of the client's geofences.
 *
 * Features:
 *   - Search/filter by name
 *   - Click card → highlight polygon on map (parent controls selectedUid)
 *   - Action buttons: Edit, Attach Devices, Delete (permission-gated)
 *   - Shows zone name, description, date created, coordinate count
 */
import React from "react";
import { GuardedButton } from "../../../auth/guards";
import type { ParsedGeozone } from "../../../api/types";

export interface GeofenceListProps {
  geozones: ParsedGeozone[];
  selectedUid: string | null;
  search: string;
  onSearchChange: (v: string) => void;
  onSelect: (uid: string) => void;
  onEdit: (gz: ParsedGeozone) => void;
  onDelete: (gz: ParsedGeozone) => void;
  onAttachDevices: (gz: ParsedGeozone) => void;
}

export function GeofenceList({
  geozones,
  selectedUid,
  search,
  onSearchChange,
  onSelect,
  onEdit,
  onDelete,
  onAttachDevices,
}: GeofenceListProps) {
  const filtered = geozones.filter((gz) =>
    gz.geozone_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Search */}
      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8696A0] pointer-events-none">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Search geofences…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E9EDEF] bg-white text-[12px] text-[#111B21] placeholder:text-[#8696A0] outline-none focus:border-[#128C7E]"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-col gap-1.5">
        {filtered.length === 0 && (
          <div className="text-center text-[12px] text-[#667781] py-8">
            {search ? "No geofences match your search" : "No geofences created yet"}
          </div>
        )}
        {filtered.map((gz) => {
          const isSelected = gz.geozone_uid === selectedUid;
          return (
            <article
              key={gz.geozone_uid}
              onClick={() => onSelect(gz.geozone_uid)}
              className={[
                "bg-white border rounded-xl p-3 cursor-pointer transition-all",
                isSelected
                  ? "border-[#128C7E] shadow-sm ring-1 ring-[#128C7E]/20"
                  : "border-[#E9EDEF] hover:border-[#128C7E]/40",
              ].join(" ")}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-extrabold text-[13px] text-[#111B21] truncate">
                    {gz.geozone_name}
                  </div>
                  <div className="text-[11px] text-[#667781] mt-0.5 line-clamp-2">
                    {gz.geozone_description || "No description"}
                  </div>
                </div>
                {/* Vertex count badge */}
                <span className="shrink-0 text-[10px] font-extrabold bg-[#F0F2F5] border border-[#E9EDEF] text-[#667781] rounded-full px-2 py-0.5">
                  {gz.path.length} pts
                </span>
              </div>

              {/* Meta row */}
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-[#667781]">
                  Created {gz.date_created}
                </span>

                {/* Action buttons (stop propagation so card click doesn't fire) */}
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <GuardedButton
                    permission="can_edit_geofence"
                    fallback="hide"
                    onClick={() => onEdit(gz)}
                    className="h-6 px-2 text-[10px] font-extrabold rounded-md bg-[#F0F2F5] border border-[#E9EDEF] text-[#111B21] hover:bg-[#E9EDEF] cursor-pointer"
                  >
                    Edit
                  </GuardedButton>

                  <GuardedButton
                    permission="can_edit_geofence"
                    fallback="hide"
                    onClick={() => onAttachDevices(gz)}
                    className="h-6 px-2 text-[10px] font-extrabold rounded-md bg-[#E9F7F4] border border-[#C2E8E1] text-[#075E54] hover:bg-[#C2E8E1] cursor-pointer"
                  >
                    Devices
                  </GuardedButton>

                  <GuardedButton
                    permission="can_delete_geofence"
                    fallback="hide"
                    onClick={() => onDelete(gz)}
                    className="h-6 px-2 text-[10px] font-extrabold rounded-md bg-[#FFF5F5] border border-[#FFD6D6] text-[#B00020] hover:bg-[#FFD6D6] cursor-pointer"
                  >
                    Delete
                  </GuardedButton>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
