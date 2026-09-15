function abortError(): DOMException {
  return new DOMException("Analysis cancelled", "AbortError")
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw signal.reason ?? abortError()
}

export function yieldToBrowser(signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal)
  return new Promise((resolve, reject) => {
    let frame = 0
    let channel: MessageChannel | null = null
    let settled = false

    const cleanup = () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      channel?.port1.close()
      channel?.port2.close()
      document.removeEventListener("visibilitychange", onVisibilityChange)
      signal?.removeEventListener("abort", onAbort)
    }
    const finish = () => {
      if (settled) return
      settled = true
      cleanup()
      try {
        throwIfAborted(signal)
        resolve()
      } catch (error: unknown) {
        reject(error)
      }
    }
    const scheduleMessageYield = () => {
      if (frame !== 0) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      if (channel !== null) return
      channel = new MessageChannel()
      channel.port1.onmessage = finish
      channel.port2.postMessage(undefined)
    }
    const onVisibilityChange = () => {
      if (document.hidden) scheduleMessageYield()
    }
    const onAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(signal?.reason ?? abortError())
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    signal?.addEventListener("abort", onAbort, { once: true })
    if (document.hidden) scheduleMessageYield()
    else frame = requestAnimationFrame(finish)
  })
}
