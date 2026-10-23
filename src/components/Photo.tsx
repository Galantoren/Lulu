import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { backend } from "../lib/backend";

/** Resolves a stored photo path to something an <img> can show (signed URL in cloud mode). */
export function usePhotoUrl(path: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return setSrc(null);
    let alive = true;
    backend.photoUrl(path).then((u) => alive && setSrc(u)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [path]);
  return src;
}

/** Shows a private photo (signed URL in cloud mode) with a full-screen viewer on tap. */
export function Photo({ path, className, viewer = true }: { path: string; className?: string; viewer?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    let alive = true;
    backend.photoUrl(path).then((u) => alive && setSrc(u)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [path]);
  if (!src) return <div className={className} />;
  return (
    <>
      <img src={src} className={className} alt="" onClick={(e) => {
        if (!viewer) return;
        e.stopPropagation();
        setFull(true);
      }} />
      {full && createPortal(
        <div className="photo-full" onClick={() => setFull(false)}><img src={src} alt="" /></div>,
        document.body,
      )}
    </>
  );
}
