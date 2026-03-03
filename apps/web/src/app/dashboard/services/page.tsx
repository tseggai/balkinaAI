'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ServiceForm } from '@/components/service-form';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServiceExtra {
  id?: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface ServiceStaffMember {
  staff_id: string;
  staff_name: string;
}

interface Service {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  service_category: string | null;
  service_subcategory: string | null;
  duration_minutes: number;
  price: number;
  deposit_enabled: boolean;
  deposit_type: 'fixed' | 'percentage' | null;
  deposit_amount: number | null;
  image_url: string | null;
  color: string;
  description: string | null;
  buffer_time_before: number;
  buffer_time_after: number;
  custom_duration: boolean;
  is_recurring: boolean;
  capacity: number;
  hide_price: boolean;
  hide_duration: boolean;
  visibility: string;
  min_booking_lead_time: number;
  max_booking_days_ahead: number;
  min_extras: number;
  max_extras: number | null;
  booking_limit_per_customer: number | null;
  booking_limit_per_customer_interval: string | null;
  booking_limit_per_slot: number | null;
  booking_limit_per_slot_interval: string | null;
  timesheet: Record<string, unknown> | null;
  created_at: string;
  service_extras?: ServiceExtra[];
  service_staff?: ServiceStaffMember[];
}

type ViewMode = 'list' | 'diagram';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic pastel-ish color from a string */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 65%)`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface CategoryGroup {
  category: string;
  color: string;
  subcategories: Map<string, Service[]>;
}

function buildCategoryTree(services: Service[]): CategoryGroup[] {
  const map = new Map<string, Map<string, Service[]>>();

  for (const s of services) {
    const cat = s.service_category || s.category_name || 'Uncategorized';
    const subcat = s.service_subcategory || '';

    if (!map.has(cat)) {
      map.set(cat, new Map());
    }
    const catMap = map.get(cat)!;
    if (!catMap.has(subcat)) {
      catMap.set(subcat, []);
    }
    catMap.get(subcat)!.push(s);
  }

  const groups: CategoryGroup[] = [];
  for (const [category, subcategories] of map) {
    groups.push({
      category,
      color: category === 'Uncategorized' ? '#9ca3af' : stringToColor(category),
      subcategories,
    });
  }

  // Sort: Uncategorized last
  groups.sort((a, b) => {
    if (a.category === 'Uncategorized') return 1;
    if (b.category === 'Uncategorized') return -1;
    return a.category.localeCompare(b.category);
  });

  return groups;
}

// ---------------------------------------------------------------------------
// SVG Icons (inline)
// ---------------------------------------------------------------------------

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function DiagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function FitIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function EllipsisIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DuplicateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ActionMenu — 3-dot menu for list view
// ---------------------------------------------------------------------------

function ActionMenu({
  onEdit,
  onDuplicate,
  onDelete,
}: {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      >
        <EllipsisIcon />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => { setOpen(false); onEdit(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <EditIcon /> Edit
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onDuplicate(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <DuplicateIcon /> Duplicate
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <TrashIcon /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiagramView
// ---------------------------------------------------------------------------

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const DEFAULT_ZOOM = 0.6;
const ZOOM_STEP = 0.1;

function DiagramView({
  services,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  services: Service[];
  onEdit: (s: Service) => void;
  onDuplicate: (s: Service) => void;
  onDelete: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });

  const categoryTree = buildCategoryTree(services);

  function handleZoomIn() {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }

  function handleZoomOut() {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }

  function handleFitToScreen() {
    if (!containerRef.current || !contentRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const contentW = contentRef.current.scrollWidth;
    const contentH = contentRef.current.scrollHeight;
    if (contentW === 0 || contentH === 0) return;
    const scaleX = containerRect.width / contentW;
    const scaleY = containerRect.height / contentH;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(scaleX, scaleY) * 0.9));
    setZoom(newZoom);
    setPan({ x: 0, y: 0 });
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
  }

  function handleMouseDown(e: React.MouseEvent) {
    // Only start panning if clicking on the background (not on a card button)
    if ((e.target as HTMLElement).closest('button')) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
    panOffsetRef.current = { ...pan };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({
      x: panOffsetRef.current.x + dx,
      y: panOffsetRef.current.y + dy,
    });
  }

  function handleMouseUp() {
    setIsPanning(false);
  }

  return (
    <div className="relative h-[calc(100vh-220px)] min-h-[500px] overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
      {/* Zoom Controls */}
      <div className="absolute right-3 top-3 z-20 flex flex-col gap-1">
        <button
          type="button"
          onClick={handleZoomIn}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
          title="Zoom in"
        >
          <ZoomInIcon />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
          title="Zoom out"
        >
          <ZoomOutIcon />
        </button>
        <button
          type="button"
          onClick={handleFitToScreen}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
          title="Fit to screen"
        >
          <FitIcon />
        </button>
        <div className="mt-1 text-center text-[10px] font-medium text-gray-400">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={contentRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top left',
          }}
          className="inline-flex gap-8 p-10"
        >
          {categoryTree.map((group) => (
            <div key={group.category} className="flex-shrink-0">
              {/* Category Header */}
              <div
                className="mb-4 rounded-xl px-5 py-3 shadow-sm"
                style={{ backgroundColor: group.color, minWidth: 220 }}
              >
                <h3 className="text-base font-bold text-white drop-shadow-sm">
                  {group.category}
                </h3>
                <p className="mt-0.5 text-xs font-medium text-white/80">
                  {Array.from(group.subcategories.values()).reduce((acc, arr) => acc + arr.length, 0)} service{Array.from(group.subcategories.values()).reduce((acc, arr) => acc + arr.length, 0) !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Subcategory Groups */}
              <div className="space-y-4">
                {Array.from(group.subcategories.entries()).map(([subcat, svcs]) => (
                  <div key={subcat || '__none__'}>
                    {subcat && (
                      <div className="mb-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: group.color + '22' }}>
                        <span className="text-xs font-semibold" style={{ color: group.color }}>
                          {subcat}
                        </span>
                      </div>
                    )}
                    <div className="space-y-2">
                      {svcs.map((s) => (
                        <DiagramServiceCard
                          key={s.id}
                          service={s}
                          onEdit={() => onEdit(s)}
                          onDuplicate={() => onDuplicate(s)}
                          onDelete={() => onDelete(s.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {services.length === 0 && (
            <div className="flex h-40 w-80 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white">
              <p className="text-sm text-gray-400">No services to display</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiagramServiceCard
// ---------------------------------------------------------------------------

function DiagramServiceCard({
  service,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  service: Service;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      {/* Action buttons (visible on hover) */}
      <div className="absolute -right-1 -top-1 hidden gap-0.5 group-hover:flex">
        <button
          type="button"
          onClick={onEdit}
          className="flex h-6 w-6 items-center justify-center rounded bg-white text-gray-500 shadow-sm ring-1 ring-gray-200 hover:text-brand-600"
          title="Edit"
        >
          <EditIcon />
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="flex h-6 w-6 items-center justify-center rounded bg-white text-gray-500 shadow-sm ring-1 ring-gray-200 hover:text-brand-600"
          title="Duplicate"
        >
          <DuplicateIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-6 w-6 items-center justify-center rounded bg-white text-gray-500 shadow-sm ring-1 ring-gray-200 hover:text-red-600"
          title="Delete"
        >
          <TrashIcon />
        </button>
      </div>

      {/* Top row: color dot + name */}
      <div className="flex items-center gap-2">
        <div
          className="h-3 w-3 flex-shrink-0 rounded-full"
          style={{ backgroundColor: service.color || '#6366f1' }}
        />
        <span className="truncate text-sm font-semibold text-gray-900">{service.name}</span>
      </div>

      {/* Price & Duration */}
      <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
        <span className="font-medium text-gray-700">${service.price.toFixed(2)}</span>
        <span>{service.duration_minutes} min</span>
      </div>

      {/* Staff avatars */}
      {service.service_staff && service.service_staff.length > 0 && (
        <div className="mt-2 flex -space-x-1.5">
          {service.service_staff.slice(0, 5).map((st) => (
            <div
              key={st.staff_id}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white"
              style={{ backgroundColor: stringToColor(st.staff_name) }}
              title={st.staff_name}
            >
              {getInitials(st.staff_name)}
            </div>
          ))}
          {service.service_staff.length > 5 && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-[9px] font-bold text-gray-600">
              +{service.service_staff.length - 5}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const fetchServices = useCallback(async () => {
    const res = await fetch('/api/services');
    const json = await res.json();
    setServices(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this service?')) return;
    await fetch(`/api/services?id=${id}`, { method: 'DELETE' });
    fetchServices();
  }

  function handleEdit(service: Service) {
    setEditing(service);
    setShowForm(true);
  }

  function handleDuplicate(service: Service) {
    const duplicated: Service = {
      ...service,
      id: '',
      name: `${service.name} (Copy)`,
    };
    setEditing(duplicated);
    setShowForm(true);
  }

  function handleClose() {
    setShowForm(false);
    setEditing(null);
    fetchServices();
  }

  // -- Form view --
  if (showForm) {
    return (
      <div className="p-6 lg:p-8">
        <ServiceForm service={editing} onClose={handleClose} />
      </div>
    );
  }

  const filteredServices = search.trim()
    ? services.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : services;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
            {services.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-300 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center justify-center rounded-md px-2.5 py-1.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="List view"
            >
              <ListIcon />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('diagram')}
              className={`flex items-center justify-center rounded-md px-2.5 py-1.5 transition-colors ${
                viewMode === 'diagram'
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Diagram view"
            >
              <DiagramIcon />
            </button>
          </div>

          {/* Add Service */}
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <PlusIcon />
            Add Service
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mt-4">
        <input
          type="text"
          placeholder="Search services by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Content */}
      <div className="mt-6">
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
            Loading...
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-sm text-gray-500">
              {search.trim() ? 'No services match your search.' : 'No services yet.'}
            </p>
            {!search.trim() && (
              <button
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
                className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Add your first service
              </button>
            )}
          </div>
        ) : viewMode === 'list' ? (
          /* ====== LIST VIEW ====== */
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Image</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Subcategory</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Staff</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Visibility</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredServices.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      {/* Image / Color dot */}
                      <td className="whitespace-nowrap px-4 py-3">
                        {s.image_url ? (
                          <img
                            src={s.image_url}
                            alt={s.name}
                            className="h-8 w-8 rounded-md object-cover"
                          />
                        ) : (
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: s.color || '#6366f1' }}
                          />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {s.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {s.service_category || s.category_name || '\u2014'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {s.service_subcategory || '\u2014'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        ${s.price.toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {s.duration_minutes} min
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {s.service_staff?.length ?? 0}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {s.visibility === 'staff_only' ? (
                          <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                            Staff Only
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Public
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <ActionMenu
                          onEdit={() => handleEdit(s)}
                          onDuplicate={() => handleDuplicate(s)}
                          onDelete={() => handleDelete(s.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ====== DIAGRAM VIEW ====== */
          <DiagramView
            services={filteredServices}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}
