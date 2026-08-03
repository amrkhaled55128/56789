import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="إغلاق"><X size={20} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}
