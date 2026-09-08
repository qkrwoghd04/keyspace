import type { Passage, PassageChoice } from './types';

// Original, versioned prompts. Repetition is deterministic so a ghost has exactly
// the same course. No code is evaluated, fetched, completed or persisted as input.
const korean = [
  '작은 창문 너머로 아침 햇살이 천천히 들어온다. 오늘은 조금 느려도 괜찮다.',
  '손끝에서 시작된 생각이 한 줄의 문장이 된다. 편안한 호흡으로 다음 글자를 이어 간다.',
  '비가 그친 골목에는 맑은 물방울이 남아 있다. 익숙한 길에서도 새로운 풍경을 만난다.',
  '책상 위의 따뜻한 차와 조용한 음악처럼 작은 습관이 하루의 리듬을 만든다.',
  '높은 기록보다 중요한 것은 어제보다 정확한 한 글자다. 실수한 자리는 다시 고칠 수 있다.',
  '바람이 나뭇잎을 흔들고 먼 구름이 산을 넘어간다. 길게 바라보면 변화가 보인다.',
  '서랍에서 꺼낸 오래된 편지에는 다정한 인사가 적혀 있다. 기억은 작은 문장에 머문다.',
  '다음 여행에서는 낯선 시장을 걷고 바다 가까운 카페에 앉아 새로운 이야기를 적고 싶다.',
  '어려운 문제도 작은 조각으로 나누면 시작할 수 있다. 확인한 사실부터 차분하게 쌓아 간다.',
  '불빛이 하나둘 켜지는 저녁에는 잠시 손을 멈추고 오늘의 좋은 순간을 떠올린다.',
  '좋아하는 도구는 오래 사용할수록 손에 익는다. 나에게 맞는 속도로 꾸준히 나아간다.',
  '정답을 서두르지 않고 끝까지 읽는 마음이 필요하다. 짧은 쉼표 뒤에는 새로운 시작이 있다.',
];
const english = [
  'A quiet room leaves enough space for a new thought. Let your hands find a steady rhythm.',
  'Morning light moves across the table while the city slowly wakes. Small details make familiar places feel new.',
  'Build one useful thing, test what it does, and leave a clear path for the next person.',
  'The best pace is a pace you can sustain. Correct the small mistake and keep moving forward.',
  'A notebook holds unfinished sketches, careful questions, and plans for a journey not yet taken.',
  'Beyond the window, the rain has stopped. A few bright drops remain on the leaves of a young tree.',
  'Every letter has a place in the sentence. Focus on the next one instead of racing toward the last.',
  'An old wooden bridge leads to a garden where the afternoon seems to last a little longer.',
  'Simple tools can make complicated work feel calm. Choose a good starting point and make it better.',
  'The road follows the coast before turning toward the hills. We stop to watch the clouds cross the water.',
  'Good ideas grow through patient attention. Ask a clear question, listen carefully, and try again.',
  'When evening arrives, the desk is ready for one final line. Save the useful lesson and begin again tomorrow.',
];
const code = [
  'const double = (value: number) => value * 2;\nconst values = [2, 4, 6].map(double);',
  'function greet(name: string) {\n  return `Hello, ${name}!`;\n}\nconst message = greet("friend");',
  'type Point = { x: number; y: number };\nconst origin: Point = { x: 0, y: 0 };',
  'const colors = ["red", "green", "blue"];\nconst first = colors.at(0) ?? "gray";',
  'function sum(items: number[]) {\n  return items.reduce((total, item) => total + item, 0);\n}',
  'const active = users.filter(user => user.active);\nconst names = active.map(user => user.name);',
  'const delay = (ms: number) =>\n  new Promise(resolve => setTimeout(resolve, ms));',
  'function clamp(value: number, min: number, max: number) {\n  return Math.min(max, Math.max(min, value));\n}',
];
function course(parts: readonly string[], separator: string) {
  const round = parts.join(separator);
  return Array.from({ length: Math.ceil(14000 / round.length) }, () => round).join(separator);
}
export const PASSAGES: Record<PassageChoice, Passage> = {
  korean: { id: 'quiet-days-ko', version: 1, choice: 'korean', title: '작은 하루', language: 'ko', kind: 'prose', text: course(korean, ' ') },
  english: { id: 'a-quiet-room-en', version: 1, choice: 'english', title: 'A quiet room', language: 'en', kind: 'prose', text: course(english, ' ') },
  code: { id: 'small-functions-ts', version: 1, choice: 'code', title: 'Small functions', language: 'en', kind: 'code', text: course(code, '\n\n') },
};
export const findPassage = (id: string) => Object.values(PASSAGES).find(passage => passage.id === id);
