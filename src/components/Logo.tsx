import { Cross } from 'lucide-react';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <Cross size={22} strokeWidth={3} />
        <span className="paw">●</span>
      </span>
      {!compact && <span><strong>أليف</strong><small>لإدارة العيادة البيطرية</small></span>}
    </div>
  );
}
