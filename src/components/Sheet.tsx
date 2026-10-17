import { useEffect, useRef, type ReactNode } from "react";

/** iOS-style bottom sheet: grabber, Cancel · Title · Save bar, drag down to dismiss. */
export function Sheet({ title, onClose, onSave, saveLabel, cancelLabel, children }: {
  title: string;
  onClose: () => void;
  onSave?: () => void;
  saveLabel?: string;
  cancelLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, dy: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    ref.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onUp = () => {
    if (!drag.current || !ref.current) return;
    if (drag.current.dy > 120) onClose();
    else ref.current.style.transform = "";
    drag.current = null;
  };

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={title}>
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} style={{ touchAction: "none" }}>
          <div className="grabber" />
          <div className="bar">
            <button className="link" onClick={onClose}>{cancelLabel}</button>
            <div className="t-headline">{title}</div>
            {onSave ? <button className="link strong" onClick={onSave}>{saveLabel}</button> : <span />}
          </div>
        </div>
        <div className="body">{children}</div>
      </div>
    </>
  );
}

export function Seg<V extends string>({ value, options, onChange, label }: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  label?: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}
