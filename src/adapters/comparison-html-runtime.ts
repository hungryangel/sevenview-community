// This self-contained function is serialized into the exported file; no imported runtime.
export function installComparisonSlider(): void {
  const stage = document.getElementById("stage")
  const divider = document.getElementById("divider")
  const range = document.getElementById("position")
  const controls = document.getElementById("controls")
  const leftLabel = document.getElementById("left-label")
  const rightLabel = document.getElementById("right-label")
  const reverse = document.getElementById("reverse")
  const center = document.getElementById("center")
  const [first, second] = document.querySelectorAll<HTMLElement>(".photo")
  if (
    !stage ||
    !divider ||
    !(range instanceof HTMLInputElement) ||
    !controls ||
    !leftLabel ||
    !rightLabel ||
    !reverse ||
    !center ||
    !first ||
    !second
  )
    return

  let position = 50
  let reversed = false
  let pointerId: number | null = null
  const update = (value: number) => {
    position = Math.min(100, Math.max(0, Math.round(value)))
    stage.style.setProperty("--position", `${position}%`)
    range.value = String(position)
    divider.setAttribute("aria-valuenow", String(position))
    divider.setAttribute("aria-valuetext", `왼쪽에서 ${position}%`)
    range.setAttribute("aria-valuetext", `왼쪽에서 ${position}%`)
  }
  const placePhotos = () => {
    const left = reversed ? second : first
    const right = reversed ? first : second
    left.classList.add("photo--left")
    left.classList.remove("photo--right")
    right.classList.add("photo--right")
    right.classList.remove("photo--left")
    leftLabel.textContent = `왼쪽 · ${left.querySelector("figcaption")?.textContent ?? ""}`
    rightLabel.textContent = `오른쪽 · ${right.querySelector("figcaption")?.textContent ?? ""}`
  }
  const movePointer = (event: PointerEvent) => {
    const bounds = stage.getBoundingClientRect()
    if (bounds.width > 0) update(((event.clientX - bounds.left) / bounds.width) * 100)
  }
  divider.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !event.isPrimary) return
    event.preventDefault()
    pointerId = event.pointerId
    divider.setPointerCapture(event.pointerId)
    divider.setAttribute("data-pointer-focus", "")
    divider.focus({ preventScroll: true })
    movePointer(event)
  })
  divider.addEventListener("pointermove", (event) => {
    if (event.pointerId === pointerId) movePointer(event)
  })
  divider.addEventListener("pointerup", (event) => {
    if (event.pointerId !== pointerId) return
    movePointer(event)
    pointerId = null
    divider.releasePointerCapture(event.pointerId)
  })
  divider.addEventListener("pointercancel", () => {
    pointerId = null
  })
  divider.addEventListener("lostpointercapture", () => {
    pointerId = null
  })
  window.addEventListener("blur", () => {
    pointerId = null
  })
  divider.addEventListener("keydown", (event) => {
    divider.removeAttribute("data-pointer-focus")
    const step = event.shiftKey ? 10 : 1
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        update(position + step)
        break
      case "ArrowLeft":
      case "ArrowDown":
        update(position - step)
        break
      case "Home":
        update(0)
        break
      case "End":
        update(100)
        break
      default:
        return
    }
    event.preventDefault()
  })
  divider.addEventListener("blur", () => divider.removeAttribute("data-pointer-focus"))
  range.addEventListener("input", () => update(range.valueAsNumber))
  reverse.addEventListener("click", () => {
    reversed = !reversed
    placePhotos()
  })
  center.addEventListener("click", () => update(50))
  placePhotos()
  update(50)
  stage.classList.add("is-interactive")
  divider.hidden = false
  controls.hidden = false
}
