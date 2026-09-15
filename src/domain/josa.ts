const HANGUL_SYLLABLE_START = 0xac00
const HANGUL_SYLLABLE_END = 0xd7a3
const JONGSEONG_COUNT = 28

// 받침 유무로 '과/와'를 골라 붙인다. "아래 (턱 밑)"처럼 괄호로 끝나는 라벨은
// 한글이 아닌 꼬리를 떼고 판정한다. 판정 불가(한글 없음)면 '와'로 둔다.
export function joinGwaWa(word: string): string {
  const core = word.replace(/[^가-힣]+$/u, "")
  const code = core.charCodeAt(core.length - 1)
  const hasFinalConsonant =
    code >= HANGUL_SYLLABLE_START &&
    code <= HANGUL_SYLLABLE_END &&
    (code - HANGUL_SYLLABLE_START) % JONGSEONG_COUNT !== 0
  return `${word}${hasFinalConsonant ? "과" : "와"}`
}
