import { useEffect, useState } from "react";
import { useLang } from "../lib/i18n";

export function PhotoPicker({ file, selected, onChange, onSelect, onError, disabled = false }: {
  file: File | null;
  selected: boolean;
  onChange: (file: File) => void;
  onSelect: () => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const { lang } = useLang();
  const ro = lang === "ro";
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className={`mb-4 rounded-xl border-2 bg-white p-3 ${selected ? "border-brand-600" : "border-ink-200"}`}>
      <label className="mb-2 block font-semibold">
        <input type="radio" name="picture" value="custom-upload" checked={selected} onChange={onSelect} disabled={disabled || !file} />{" "}
        {ro ? "Fotografia ta" : "Your photo"}
      </label>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={ro ? "Încarcă o fotografie" : "Upload a photo"}
        disabled={disabled}
        className="block max-w-full text-sm"
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (!next) return;
          if (!["image/jpeg", "image/png", "image/webp"].includes(next.type) || next.size > 9 * 1024 * 1024) {
            event.target.value = "";
            onError(ro ? "Alege o fotografie JPG, PNG sau WebP de maximum 9 MB." : "Choose a JPG, PNG or WebP photo up to 9 MB.");
            return;
          }
          onError("");
          onChange(next);
          onSelect();
        }}
      />
      <p className="mt-2 text-xs text-ink-600">{ro ? "JPG, PNG, WebP · max. 9 MB · ștergere automată după 1h" : "JPG, PNG, WebP · max. 9 MB · deleted automatically after 1h"}</p>
      {preview && <img src={preview} alt={ro ? "Fotografia aleasă" : "Selected photo"} className="mt-3 max-h-48 max-w-full rounded-lg object-contain" />}
    </div>
  );
}
