/**
 * GeofenceGroups — Groups tab for organizing geofences into named categories.
 *
 * Features:
 *   - List groups as cards with geozone count
 *   - Create new group (inline form)
 *   - Expand group to see assigned geozones
 *   - Assign/remove geozones to/from groups
 *   - Edit group name/description
 *   - Delete group (unlinks geozones, doesn't delete them)
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { getCookie } from "../../../utils/cookies";
import {
  getGeozoneGroups,
  createGeozoneGroup,
  updateGeozoneGroup,
  deleteGeozoneGroup,
  assignGeozonesToGroup,
  removeGeozonesFromGroup,
} from "../../../api/services/geozones.service";
import type { GeozoneGroup, ParsedGeozone } from "../../../api/types";

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  /** All geozones for this customer (used for assign modal). */
  geozones: ParsedGeozone[];
  /** Callback to refresh geozones after group changes. */
  onGeozonesChanged?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function GeofenceGroups({ geozones, onGeozonesChanged }: Props) {
  const { state: authState } = useAuth();
  const ownerUid = authState.accountRoot || getCookie("_nvxs_account_root") || getCookie("_nvxs_account_uid") || "";

  const [groups, setGroups] = useState<GeozoneGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Expanded group (shows geozones + assign UI)
  const [expandedUid, setExpandedUid] = useState<string | null>(null);

  // Edit
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Assign modal
  const [assignGroupUid, setAssignGroupUid] = useState<string | null>(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [selectedForAssign, setSelectedForAssign] = useState<string[]>([]);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<GeozoneGroup | null>(null);

  const fetchedRef = useRef(false);

  // ── Fetch groups ───────────────────────────────────────────────────────
  const fetchGroups = useCallback(async () => {
    if (!ownerUid) return;
    setLoading(true);
    try {
      const res = await getGeozoneGroups(ownerUid);
      setGroups(Array.isArray(res?.data) ? res.data : []);
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  }, [ownerUid]);

  useEffect(() => {
    if (!fetchedRef.current && ownerUid) {
      fetchedRef.current = true;
      fetchGroups();
    }
  }, [ownerUid, fetchGroups]);

  // ── Create group ───────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      await createGeozoneGroup({
        group_name: newName.trim(),
        group_description: newDesc.trim(),
        group_owner: ownerUid,
      });
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      fetchGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create group.");
    } finally {
      setCreating(false);
    }
  };

  // ── Edit group ─────────────────────────────────────────────────────────
  const handleEdit = async (uid: string) => {
    if (!editName.trim()) return;
    try {
      await updateGeozoneGroup(uid, {
        group_name: editName.trim(),
        group_description: editDesc.trim(),
      });
      setEditingUid(null);
      fetchGroups();
    } catch {
      setError("Failed to update group.");
    }
  };

  // ── Delete group ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGeozoneGroup(deleteTarget.group_uid);
      setDeleteTarget(null);
      fetchGroups();
      onGeozonesChanged?.();
    } catch {
      setError("Failed to delete group.");
    }
  };

  // ── Assign geozones ───────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!assignGroupUid || selectedForAssign.length === 0) return;
    try {
      await assignGeozonesToGroup(assignGroupUid, selectedForAssign);
      setAssignGroupUid(null);
      setSelectedForAssign([]);
      setAssignSearch("");
      fetchGroups();
      onGeozonesChanged?.();
    } catch {
      setError("Failed to assign geozones.");
    }
  };

  // ── Remove geozone from group ──────────────────────────────────────────
  const handleRemove = async (groupUid: string, geozoneUid: string) => {
    try {
      await removeGeozonesFromGroup(groupUid, [geozoneUid]);
      fetchGroups();
      onGeozonesChanged?.();
    } catch {
      setError("Failed to remove geozone from group.");
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  // Note: Geozones don't have group_uid from the frontend type yet,
  // so we can't filter client-side. The backend returns geozone_count per group.
  // For the assign modal, we show ALL geozones and let the customer pick.

  const filteredForAssign = geozones.filter((g) => {
    const q = assignSearch.toLowerCase();
    if (!q) return true;
    return g.geozone_name?.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-[14px] text-[#111B21]">Geofence Groups</h3>
          <p className="text-[11px] text-[#667781]">Organize your geofences into named groups for easier management.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { fetchedRef.current = false; fetchGroups(); }}
            className="h-8 px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all"
          >
            &#8635; Refresh
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="h-8 px-3 rounded-lg bg-[#128C7E] text-white text-[11px] font-black cursor-pointer border-none hover:bg-[#0E7A6D] transition-all"
          >
            + New Group
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg px-3 py-2 text-[12px] text-[#EF4444] font-black">
          {error}
          <button onClick={() => setError("")} className="ml-2 opacity-60 hover:opacity-100 cursor-pointer bg-transparent border-none text-[#EF4444]">✕</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white border border-[#128C7E]/30 rounded-xl p-4">
          <div className="font-black text-[13px] text-[#128C7E] mb-3">Create New Group</div>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Group name (e.g. Kampala Warehouses)"
              className="h-9 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] transition-all"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="h-9 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] transition-all"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all">Cancel</button>
              <button onClick={handleCreate} disabled={!newName.trim() || creating} className="h-8 px-4 rounded-lg bg-[#128C7E] text-white text-[11px] font-black cursor-pointer border-none hover:bg-[#0E7A6D] disabled:opacity-50 transition-all">
                {creating ? "Creating..." : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Groups list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-[#128C7E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 text-center">
          <div className="text-[28px] mb-2">📁</div>
          <p className="text-[13px] font-black text-[#111B21] mb-1">No Groups Yet</p>
          <p className="text-[12px] text-[#667781]">Create your first group to organize geofences.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((g) => {
            const isExpanded = expandedUid === g.group_uid;
            const isEditing = editingUid === g.group_uid;

            return (
              <div key={g.group_uid} className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden">
                {/* Group header */}
                <div
                  className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-[#F8F9FA] transition-colors"
                  onClick={() => setExpandedUid(isExpanded ? null : g.group_uid)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[14px]">{isExpanded ? "📂" : "📁"}</span>
                    <div>
                      {isEditing ? (
                        <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-7 px-2 rounded border border-[#128C7E] text-[12px] outline-none w-[180px]"
                          />
                          <button onClick={() => handleEdit(g.group_uid)} className="h-7 px-2 rounded bg-[#128C7E] text-white text-[10px] font-black cursor-pointer border-none">Save</button>
                          <button onClick={() => setEditingUid(null)} className="h-7 px-2 rounded bg-[#F0F2F5] text-[#667781] text-[10px] font-black cursor-pointer border border-[#E9EDEF]">Cancel</button>
                        </div>
                      ) : (
                        <>
                          <div className="font-black text-[13px] text-[#111B21] capitalize">{g.group_name}</div>
                          {g.group_description && (
                            <div className="text-[10px] text-[#667781]">{g.group_description}</div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black text-[#128C7E] bg-[#128C7E]/10 px-2 py-0.5 rounded-full border border-[#128C7E]/30">
                      {g.geozone_count} geofence{g.geozone_count !== 1 ? "s" : ""}
                    </span>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => { setAssignGroupUid(g.group_uid); setSelectedForAssign([]); setAssignSearch(""); }}
                        title="Assign geofences"
                        className="w-7 h-7 rounded-lg bg-[#128C7E]/10 border border-[#128C7E]/30 text-[#128C7E] text-[11px] cursor-pointer hover:bg-[#128C7E]/20 flex items-center justify-center transition-all"
                      >+</button>
                      <button
                        onClick={() => { setEditingUid(g.group_uid); setEditName(g.group_name); setEditDesc(g.group_description); }}
                        title="Edit group"
                        className="w-7 h-7 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/30 text-[#3B82F6] text-[11px] cursor-pointer hover:bg-[#3B82F6]/20 flex items-center justify-center transition-all"
                      >&#9998;</button>
                      <button
                        onClick={() => setDeleteTarget(g)}
                        title="Delete group"
                        className="w-7 h-7 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-[11px] cursor-pointer hover:bg-[#EF4444]/20 flex items-center justify-center transition-all"
                      >&#128465;</button>
                    </div>
                  </div>
                </div>

                {/* Expanded: show geozones in this group */}
                {isExpanded && (
                  <div className="border-t border-[#E9EDEF] px-4 py-3 bg-[#F8F9FA]">
                    {g.geozone_count === 0 ? (
                      <p className="text-[12px] text-[#667781] text-center py-2">No geofences in this group yet. Click + to assign some.</p>
                    ) : (
                      <div className="text-[11px] text-[#667781]">
                        This group contains {g.geozone_count} geofence{g.geozone_count !== 1 ? "s" : ""}.
                        Use the + button to add more, or manage assignments from the My Geofences tab.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Assign Modal ───────────────────────────────────────────────── */}
      {assignGroupUid && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40" onClick={() => setAssignGroupUid(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-[#E9EDEF] w-[420px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#E9EDEF]">
              <h3 className="font-black text-[15px] text-[#111B21]">Assign Geofences to Group</h3>
              <p className="text-[11px] text-[#667781] mt-0.5">Select geofences to add to this group.</p>
            </div>

            <div className="px-5 py-3">
              <input
                type="text"
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                placeholder="Search geofences..."
                className="w-full h-9 px-3 rounded-lg bg-white border border-[#E9EDEF] text-[12px] outline-none focus:border-[#128C7E] transition-all"
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 [scrollbar-width:thin]">
              {filteredForAssign.length === 0 ? (
                <p className="text-[12px] text-[#667781] text-center py-4">No geofences found.</p>
              ) : (
                filteredForAssign.map((gz) => {
                  const checked = selectedForAssign.includes(gz.geozone_uid);
                  return (
                    <label
                      key={gz.geozone_uid}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-[#F0F2F5] last:border-b-0 rounded transition-colors ${checked ? "bg-[#128C7E]/5" : "hover:bg-[#F8F9FA]"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedForAssign((prev) =>
                            prev.includes(gz.geozone_uid) ? prev.filter((u) => u !== gz.geozone_uid) : [...prev, gz.geozone_uid]
                          );
                        }}
                        className="w-4 h-4 accent-[#128C7E] cursor-pointer"
                      />
                      <div>
                        <div className="text-[12px] font-black text-[#111B21] capitalize">{gz.geozone_name}</div>
                        {gz.geozone_description && <div className="text-[10px] text-[#667781]">{gz.geozone_description}</div>}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="px-5 py-3 border-t border-[#E9EDEF] flex gap-2 justify-end">
              <button onClick={() => setAssignGroupUid(null)} className="h-9 px-4 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[12px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all">Cancel</button>
              <button onClick={handleAssign} disabled={selectedForAssign.length === 0} className="h-9 px-4 rounded-lg bg-[#128C7E] text-white text-[12px] font-black cursor-pointer border-none hover:bg-[#0E7A6D] disabled:opacity-50 transition-all">
                Assign {selectedForAssign.length} Geofence{selectedForAssign.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ─────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-[#E9EDEF] w-[380px] p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-[15px] text-[#111B21] mb-2">Delete Group?</h3>
            <p className="text-[13px] text-[#667781] mb-4 leading-relaxed">
              Are you sure you want to delete <strong className="capitalize">{deleteTarget.group_name}</strong>?
              The {deleteTarget.geozone_count} geofence{deleteTarget.geozone_count !== 1 ? "s" : ""} in this group will be unlinked but not deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="h-9 px-4 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[12px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF] transition-all">Cancel</button>
              <button onClick={handleDelete} className="h-9 px-4 rounded-lg bg-[#EF4444] text-white text-[12px] font-black cursor-pointer border-none hover:bg-[#DC2626] transition-all">Delete Group</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
