export type SinglePhotoOperation = {
  readonly controller: AbortController
  readonly id: number
  readonly workspaceGeneration: number
}

type CurrentValue<T> = { readonly current: T }

export class SinglePhotoOperationCoordinator {
  private counter = 0
  private readonly operations = new Map<string, SinglePhotoOperation>()

  constructor(
    private readonly mounted: CurrentValue<boolean>,
    private readonly workspaceGeneration: CurrentValue<number>,
  ) {}

  abortAll(): void {
    for (const operation of this.operations.values()) operation.controller.abort()
    this.operations.clear()
  }

  begin(key: string): SinglePhotoOperation {
    this.operations.get(key)?.controller.abort()
    this.counter += 1
    const operation = {
      controller: new AbortController(),
      id: this.counter,
      workspaceGeneration: this.workspaceGeneration.current,
    }
    this.operations.set(key, operation)
    return operation
  }

  finish(key: string, operation: SinglePhotoOperation): void {
    if (this.operations.get(key) === operation) this.operations.delete(key)
  }

  isCurrent(key: string, operation: SinglePhotoOperation): boolean {
    return (
      this.mounted.current &&
      !operation.controller.signal.aborted &&
      this.workspaceGeneration.current === operation.workspaceGeneration &&
      this.operations.get(key) === operation
    )
  }
}
