import { usePhotoUrl } from "./Photo";
import type { Baby } from "../types";

/** The baby's photo in a circle, or the first letter of the name when there's no photo. */
export function BabyAvatar({ baby, size = 44 }: { baby: Pick<Baby, "name" | "photo_path">; size?: number }) {
  const src = usePhotoUrl(baby.photo_path);
  return (
    <span className="avatar baby-avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {src ? <img src={src} alt="" /> : (baby.name.trim()[0] ?? "•").toUpperCase()}
    </span>
  );
}
