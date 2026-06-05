/**
 * GatehousePage — stub.
 * The original implementation was corrupted by external file operations.
 * Restore via: git checkout HEAD -- src/features/gatehouse/GatehousePage.tsx
 */
import React from "react";

export default function GatehousePage() {
  return (
    <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center bg-[#F0F2F5]">
      <div className="bg-white border border-[#E9EDEF] rounded-xl p-8 text-center max-w-md">
        <h1 className="font-black text-[20px] text-[#111B21] mb-2">Gatehouse</h1>
        <p className="text-[12px] text-[#667781]">
          Module is being restored. Use `git checkout HEAD -- src/features/gatehouse/GatehousePage.tsx`.
        </p>
      </div>
    </div>
  );
}

// Also expose as named export for moduleRoutes.tsx if it imports that way.
export { GatehousePage };
