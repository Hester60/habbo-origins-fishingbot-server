/**
 * Generic, strictly-typed pub/sub — T maps each event name to its argument
 * tuple, so on()/emit() are checked at compile time: a typo'd event name or
 * a wrong argument shape is rejected before the code ever runs, unlike a
 * plain string-keyed emitter. Not tied to any specific event set — every
 * module (handshake, keep-alive, future features) can have its own T.
 */
export default class EventBus<T extends Record<string, unknown[]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly listeners: Map<keyof T, Array<(...args: any[]) => void>> = new Map();

  public on<K extends keyof T>(event: K, callback: (...args: T[K]) => void): void {
    const callbacks = this.listeners.get(event) ?? [];
    callbacks.push(callback);
    this.listeners.set(event, callbacks);
  }

  public emit<K extends keyof T>(event: K, ...args: T[K]): void {
    for (const callback of this.listeners.get(event) ?? []) {
      callback(...args);
    }
  }
}
