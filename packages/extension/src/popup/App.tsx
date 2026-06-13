import { hostOf, type PositionRecord } from '@reader-mode/core';
import { usePopup } from './usePopup';

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-stone-100 disabled:opacity-40"
    >
      <span>
        <span className="block text-sm font-medium text-stone-900">{label}</span>
        {description && <span className="block text-xs text-stone-500">{description}</span>}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-emerald-500' : 'bg-stone-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function PositionItem({
  record,
  onOpen,
  onTogglePin,
  onRemove,
}: {
  record: PositionRecord;
  onOpen: () => void;
  onTogglePin: () => void;
  onRemove: () => void;
}) {
  const title = record.title || record.url || 'Saved position';
  const host = record.url ? hostOf(record.url) : '';
  return (
    <li className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-stone-100">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left" title={title}>
        <span className="block truncate text-sm text-stone-800">{title}</span>
        <span className="block truncate text-xs text-stone-400">{host}</span>
      </button>
      <button
        type="button"
        onClick={onTogglePin}
        title={record.pinned ? 'Unpin' : 'Pin to resume later'}
        className={`text-base leading-none ${record.pinned ? 'text-amber-500' : 'text-stone-300 hover:text-stone-500'}`}
      >
        {record.pinned ? '★' : '☆'}
      </button>
      <button
        type="button"
        onClick={onRemove}
        title="Remove"
        className="text-stone-300 opacity-0 group-hover:opacity-100 hover:text-rose-500"
      >
        ✕
      </button>
    </li>
  );
}

export function App() {
  const popup = usePopup();
  const { settings, positions, currentHost } = popup;

  const domainEnabled = currentHost ? !settings?.disabledDomains.includes(currentHost) : false;
  const pinned = positions.filter((p) => p.pinned);
  const recent = positions.filter((p) => !p.pinned);

  const open = (record: PositionRecord) => {
    if (record.url) void chrome.tabs.create({ url: record.url });
  };

  return (
    <main className="w-80 p-3 font-sans text-stone-900">
      <header className="px-2 pb-2">
        <h1 className="text-base font-semibold">Reader Mode</h1>
        <p className="text-xs text-stone-500">Reading position persistence</p>
      </header>

      <section className="border-t border-stone-200 py-1">
        <Toggle
          label="Enabled"
          description="Remember where you stop reading"
          checked={settings?.enabled ?? false}
          onChange={popup.toggleEnabled}
        />
        <Toggle
          label="On this site"
          description={currentHost ?? 'No active page'}
          checked={domainEnabled}
          disabled={!currentHost || !settings?.enabled}
          onChange={popup.toggleCurrentDomain}
        />
      </section>

      <section className="border-t border-stone-200 pt-2">
        <h2 className="px-2 pb-1 text-xs font-semibold tracking-wide text-stone-400 uppercase">
          Continue reading
        </h2>
        {positions.length === 0 ? (
          <p className="px-2 py-3 text-sm text-stone-400">No saved positions yet.</p>
        ) : (
          <ul className="max-h-72 overflow-y-auto">
            {pinned.map((record) => (
              <PositionItem
                key={record.urlHash}
                record={record}
                onOpen={() => open(record)}
                onTogglePin={() => popup.togglePinned(record)}
                onRemove={() => popup.remove(record)}
              />
            ))}
            {recent.map((record) => (
              <PositionItem
                key={record.urlHash}
                record={record}
                onOpen={() => open(record)}
                onTogglePin={() => popup.togglePinned(record)}
                onRemove={() => popup.remove(record)}
              />
            ))}
          </ul>
        )}
      </section>

      {positions.length > 0 && (
        <footer className="border-t border-stone-200 pt-2">
          <button
            type="button"
            onClick={popup.clearAll}
            className="w-full rounded-md px-2 py-1.5 text-sm text-stone-500 hover:bg-rose-50 hover:text-rose-600"
          >
            Clear all positions
          </button>
        </footer>
      )}
    </main>
  );
}
