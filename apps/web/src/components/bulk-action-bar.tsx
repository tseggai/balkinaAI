'use client';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onDelete: () => void;
  onClearSelection: () => void;
  deleting?: boolean;
}

export function BulkActionBar({ selectedCount, totalCount, onDelete, onClearSelection, deleting }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="mt-4 flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5">
      <span className="text-sm font-medium text-brand-700">
        {selectedCount} of {totalCount} selected
      </span>
      <div className="h-4 w-px bg-brand-200" />
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {deleting ? 'Deleting...' : 'Delete'}
      </button>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onClearSelection}
        className="text-sm text-brand-600 hover:text-brand-800"
      >
        Clear selection
      </button>
    </div>
  );
}
