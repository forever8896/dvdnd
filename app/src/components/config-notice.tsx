import { MISSING_CONFIG, NETWORK } from "@/lib/config";

/** Shown when the selected network is missing settings (e.g. mainnet before deploy). */
export function ConfigNotice() {
  if (!MISSING_CONFIG.length) return null;
  return (
    <div className="geo-notice" role="alert" style={{ background: "var(--red)" }}>
      <span style={{ flex: 1 }}>
        dvdnd is set to {NETWORK.name} but isn&apos;t configured yet. Missing: {MISSING_CONFIG.join(", ")}.
      </span>
    </div>
  );
}
