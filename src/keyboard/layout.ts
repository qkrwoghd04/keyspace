export interface KeyDefinition {
  code: string;
  label: string;
  secondary?: string;
  /** Left edge in keyboard units. */
  x: number;
  /** Row center in keyboard units. */
  z: number;
  width: number;
  tone: 'ivory' | 'gray' | 'orange';
  character?: string;
  shiftCharacter?: string;
}

const key = (
  code: string, label: string, x: number, z: number, width = 1,
  tone: KeyDefinition['tone'] = 'ivory',
  character?: string, shiftCharacter?: string, secondary?: string,
): KeyDefinition => ({ code, label, x, z, width, tone, character, shiftCharacter, secondary });

const functionPositions = [2, 3, 4, 5, 6.25, 7.25, 8.25, 9.25, 10.5, 11.5, 12.5, 13.5];
const digits = [
  ['Backquote', '`', '~'], ['Digit1', '1', '!'], ['Digit2', '2', '@'],
  ['Digit3', '3', '#'], ['Digit4', '4', '$'], ['Digit5', '5', '%'],
  ['Digit6', '6', '^'], ['Digit7', '7', '&'], ['Digit8', '8', '*'],
  ['Digit9', '9', '('], ['Digit0', '0', ')'], ['Minus', '-', '_'], ['Equal', '=', '+'],
];
const letters = (value: string, x: number, z: number): KeyDefinition[] =>
  [...value].map((letter, index) => key(`Key${letter}`, letter, x + index, z, 1, 'ivory', letter.toLowerCase(), letter));

/** 82-key 75% ANSI. Fn has no standard browser code and responds to on-screen taps. */
export const KEYS: KeyDefinition[] = [
  key('Escape', 'esc', 0, 0, 1, 'orange'),
  ...functionPositions.map((x, i) => key(`F${i + 1}`, `F${i + 1}`, x, 0, 1, 'gray')),
  key('Delete', 'del', 15.3, 0, 1, 'gray'),

  ...digits.map(([code, character, shifted], x) => key(code, character, x, 1.25, 1, 'ivory', character, shifted, shifted)),
  key('Backspace', 'backspace', 13, 1.25, 2, 'gray'),
  key('Home', 'home', 15.3, 1.25, 1, 'gray'),

  key('Tab', 'tab', 0, 2.25, 1.5, 'gray'),
  ...letters('QWERTYUIOP', 1.5, 2.25),
  key('BracketLeft', '[', 11.5, 2.25, 1, 'ivory', '[', '{', '{'),
  key('BracketRight', ']', 12.5, 2.25, 1, 'ivory', ']', '}', '}'),
  key('Backslash', '\\', 13.5, 2.25, 1.5, 'ivory', '\\', '|', '|'),
  key('PageUp', 'pg up', 15.3, 2.25, 1, 'gray'),

  key('CapsLock', 'caps lock', 0, 3.25, 1.75, 'gray'),
  ...letters('ASDFGHJKL', 1.75, 3.25),
  key('Semicolon', ';', 10.75, 3.25, 1, 'ivory', ';', ':', ':'),
  key('Quote', "'", 11.75, 3.25, 1, 'ivory', "'", '"', '"'),
  key('Enter', 'enter', 12.75, 3.25, 2.25, 'gray'),
  key('PageDown', 'pg dn', 15.3, 3.25, 1, 'gray'),

  key('ShiftLeft', 'shift', 0, 4.25, 2.25, 'gray'),
  ...letters('ZXCVBNM', 2.25, 4.25),
  key('Comma', ',', 9.25, 4.25, 1, 'ivory', ',', '<', '<'),
  key('Period', '.', 10.25, 4.25, 1, 'ivory', '.', '>', '>'),
  key('Slash', '/', 11.25, 4.25, 1, 'ivory', '/', '?', '?'),
  key('ShiftRight', 'shift', 12.25, 4.25, 1.75, 'gray'),
  key('ArrowUp', '↑', 14.25, 4.25, 1, 'gray'),
  key('End', 'end', 15.3, 4.25, 1, 'gray'),

  key('ControlLeft', 'ctrl', 0, 5.25, 1.25, 'gray'),
  key('MetaLeft', 'super', 1.25, 5.25, 1.25, 'gray'),
  key('AltLeft', 'alt', 2.5, 5.25, 1.25, 'gray'),
  key('Space', '', 3.75, 5.25, 6.25, 'ivory', ' ', ' '),
  key('AltRight', 'alt', 10, 5.25, 1.25, 'gray'),
  key('Fn', 'fn', 11.25, 5.25, 1, 'gray'),
  key('ControlRight', 'ctrl', 12.25, 5.25, 1, 'gray'),
  key('ArrowLeft', '←', 13.25, 5.25, 1, 'gray'),
  key('ArrowDown', '↓', 14.25, 5.25, 1, 'gray'),
  key('ArrowRight', '→', 15.3, 5.25, 1, 'gray'),
];

export const KEY_BY_CODE = new Map(KEYS.map((definition) => [definition.code, definition]));
export const BOARD_WIDTH = 16.3;
export const BOARD_DEPTH = 6.25;
