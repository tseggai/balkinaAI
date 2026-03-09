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
    <div className="mt-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
      <span className="text-sm font-medium text-gray-700">
        {selectedCount} of {totalCount} selected
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onClearSelection}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : `Delete (${selectedCount})`}
        </button>
      </div>
    </div>
  );
}
