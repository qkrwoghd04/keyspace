import { useEffect, useRef, useState } from 'react';
import { THEMES } from '../themes/registry';
import type { ThemeCategory, ThemeDefinition } from '../themes/types';

export function CollectionIcon() {
  return <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.25" /><path d="M7 4v12" stroke="currentColor" strokeWidth="1.25" /></svg>;
}

function ThemeList({ active, pending, onSelect, closed, onToggle, reveal, disabled }: {
  active: ThemeDefinition; pending: ThemeDefinition; onSelect: (theme: ThemeDefinition) => void;
  closed: readonly ThemeCategory[]; onToggle: (category: ThemeCategory) => void; reveal: number;
  disabled: boolean;
}) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = list.current;
    const selected = node?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!node || !selected || !node.getClientRects().length || closed.includes(active.category)) return;
    const outer = node.getBoundingClientRect(), inner = selected.getBoundingClientRect();
    if (inner.top < outer.top) node.scrollTop += inner.top - outer.top - 40;
    else if (inner.bottom > outer.bottom) node.scrollTop += inner.bottom - outer.bottom + 12;
  }, [active.id, active.category, closed, reveal]);
  return <div className="collection-list" ref={list}>
    {(['CLASSIC', 'EXPERIMENTAL', 'ANIMATION'] as const).map(category => <section className="collection-group" key={category} aria-label={category} data-current={active.category === category}>
      <h2><button type="button" className="collection-group-toggle" aria-label={`${category} group`} aria-expanded={!closed.includes(category)} onClick={() => onToggle(category)}>
        <span className="group-title"><span className="group-chevron" aria-hidden="true">›</span>{category}<span className="group-count">{THEMES.filter(theme => theme.category === category).length}</span></span>
        <span className="group-current" aria-hidden="true">{active.category === category ? closed.includes(category) ? active.name : 'SELECTED' : ''}</span>
      </button></h2>
      <div className="collection-options" hidden={closed.includes(category)}>
        {THEMES.filter(theme => theme.category === category).map(theme => <button
          key={theme.id} type="button" className="collection-item" aria-label={theme.name}
          disabled={disabled} title={disabled ? '경기 종료 또는 취소 후 테마 변경 가능' : undefined}
          data-theme={theme.id}
          aria-pressed={theme.id === active.id} aria-busy={pending.id === theme.id && pending.id !== active.id}
          onClick={() => onSelect(theme)}
        >
          <span className="collection-preview" style={{ background: theme.appearance.background }}>
            <img src={theme.thumbnail} alt="" width="112" height="76" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
          </span>
          <span className="collection-name">{theme.name}</span>
          <span className="collection-selection" aria-hidden="true" />
        </button>)}
      </div>
    </section>)}
  </div>;
}

interface Props {
  disabled?: boolean;
  active: ThemeDefinition;
  pending: ThemeDefinition;
  collapsed: boolean;
  sheetOpen: boolean;
  onCollapse: () => void;
  onSheetClose: () => void;
  onSelect: (theme: ThemeDefinition) => void;
}

export default function ThemeCollection({ active, pending, collapsed, sheetOpen, onCollapse, onSheetClose, onSelect, disabled = false }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [closed, setClosed] = useState<ThemeCategory[]>([]);
  const [reveal, setReveal] = useState(0);
  const onClose = useRef(onSheetClose);
  onClose.current = onSheetClose;

  useEffect(() => {
    setClosed(previous => previous.includes(active.category) ? previous.filter(category => category !== active.category) : previous);
    setReveal(previous => previous + 1);
  }, [active.id, active.category, sheetOpen, collapsed]);

  const toggle = (category: ThemeCategory) => setClosed(previous => previous.includes(category) ? previous.filter(item => item !== category) : [...previous, category]);
  const revealSelected = () => {
    setClosed(previous => previous.filter(category => category !== active.category));
    setReveal(previous => previous + 1);
  };

  useEffect(() => {
    const node = dialog.current;
    if (!node || !sheetOpen) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node.showModal();
    const focusFrame = requestAnimationFrame(() => node.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true }));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const desktop = window.matchMedia('(min-width: 1024px)');
    const resize = () => { if (desktop.matches) onClose.current(); };
    desktop.addEventListener('change', resize);
    return () => {
      cancelAnimationFrame(focusFrame);
      desktop.removeEventListener('change', resize);
      document.body.style.overflow = previousOverflow;
      node.close();
      returnFocus?.focus({ preventScroll: true });
    };
  }, [sheetOpen]);

  const list = <ThemeList active={active} pending={pending} onSelect={onSelect} closed={closed} onToggle={toggle} reveal={reveal} disabled={disabled} />;
  return <>
    <aside className="collection-sidebar" hidden={collapsed} data-keyboard-controls aria-label="Keyboard collection">
      <div className="collection-heading"><span>The collection</span><button type="button" className="icon-button" onClick={onCollapse} aria-label="Collapse collection"><CollectionIcon /></button></div>
      {list}
      <button type="button" className="collection-locate" onClick={revealSelected} aria-label="Find selected theme"><span>NOW VIEWING</span><span>{active.name}<span aria-hidden="true">↗</span></span></button>
      <div className="collection-footnote"><span>KEYSPACE OBJECTS</span><span>14 OBJECTS</span></div>
    </aside>
    <dialog ref={dialog} className="collection-sheet" data-keyboard-controls aria-labelledby="sheet-title" onCancel={onSheetClose} onClick={event => { if (event.target === event.currentTarget) onSheetClose(); }}>
      <div className="sheet-content">
        <div className="collection-heading"><span id="sheet-title">The collection</span><button type="button" className="icon-button sheet-close" onClick={onSheetClose} aria-label="Close collection">×</button></div>
        {list}
      </div>
    </dialog>
  </>;
}
