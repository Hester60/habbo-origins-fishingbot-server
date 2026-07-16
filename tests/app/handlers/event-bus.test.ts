import { describe, expect, it } from 'vitest';
import EventBus from '../../../src/app/handlers/event-bus.js';

type TestEvents = {
  PING: [];
  MESSAGE: [text: string];
  COORDINATES: [x: number, y: number];
};

describe('EventBus', () => {
  it('calls a registered callback when the matching event is emitted', () => {
    const bus = new EventBus<TestEvents>();
    let called = false;

    bus.on('PING', () => {
      called = true;
    });
    bus.emit('PING');

    expect(called).toBe(true);
  });

  it('passes the emitted argument through to the callback', () => {
    const bus = new EventBus<TestEvents>();
    let received: string | undefined;

    bus.on('MESSAGE', (text) => {
      received = text;
    });
    bus.emit('MESSAGE', 'salut');

    expect(received).toBe('salut');
  });

  it('passes multiple arguments through, in order', () => {
    const bus = new EventBus<TestEvents>();
    let receivedX: number | undefined;
    let receivedY: number | undefined;

    bus.on('COORDINATES', (x, y) => {
      receivedX = x;
      receivedY = y;
    });
    bus.emit('COORDINATES', 3, 7);

    expect(receivedX).toBe(3);
    expect(receivedY).toBe(7);
  });

  it('calls every callback registered for the same event, in the order they were added', () => {
    const bus = new EventBus<TestEvents>();
    const calls: number[] = [];

    bus.on('PING', () => calls.push(1));
    bus.on('PING', () => calls.push(2));
    bus.emit('PING');

    expect(calls).toEqual([1, 2]);
  });

  it('never calls a callback registered for a different event', () => {
    const bus = new EventBus<TestEvents>();
    let pingCalled = false;

    bus.on('PING', () => {
      pingCalled = true;
    });
    bus.emit('MESSAGE', 'salut');

    expect(pingCalled).toBe(false);
  });

  it('does not throw when emitting an event with no listeners registered', () => {
    const bus = new EventBus<TestEvents>();

    expect(() => bus.emit('PING')).not.toThrow();
  });
});
