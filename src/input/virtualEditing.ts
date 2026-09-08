import { KEY_BY_CODE } from '../keyboard/layout';

/** Existing explicit pointer editing, shared by both native textareas. */
export function editVirtualKey(textarea: HTMLTextAreaElement, code: string, held: ReadonlySet<string>) {
  if (['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight'].some(key => held.has(key))) return false;
  const definition = KEY_BY_CODE.get(code), shifted = held.has('ShiftLeft') || held.has('ShiftRight');
  let insertion = shifted ? definition?.shiftCharacter ?? definition?.character : definition?.character;
  let start = textarea.selectionStart, end = textarea.selectionEnd;
  if (code === 'Enter') insertion = '\n';
  if (code === 'Backspace') {
    insertion = '';
    if (start === end && start > 0) start -= [...textarea.value.slice(0, start)].at(-1)!.length;
  }
  if (code === 'Delete') {
    insertion = '';
    if (start === end && end < textarea.value.length) end += String.fromCodePoint(textarea.value.codePointAt(end)!).length;
  }
  if (insertion === undefined) return false;
  textarea.setRangeText(insertion, start, end, 'end');
  return true;
}
