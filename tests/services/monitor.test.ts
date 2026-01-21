import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  killGracefully,
  MemoryMonitor,
  SIGKILL_GRACE_PERIOD,
} from '../../src/services/monitor.js';

// Create a mock ChildProcess for testing
function createMockChild(pid?: number): {
  child: ChildProcess;
  killMock: ReturnType<typeof vi.fn>;
} {
  const emitter = new EventEmitter();
  const child = emitter as unknown as ChildProcess;
  Object.defineProperty(child, 'pid', {
    value: pid ?? 12345,
    writable: true,
    configurable: true,
  });
  const killMock = vi.fn().mockReturnValue(true);
  child.kill = killMock;
  return { child, killMock };
}

describe('MemoryMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates with memory limit in MB', () => {
    const { child } = createMockChild();
    const monitor = new MemoryMonitor(child, 100);
    expect(monitor.wasKilledByMemoryLimit()).toBe(false);
  });

  it('accepts optional onExceeded callback', () => {
    const { child } = createMockChild();
    const monitor = new MemoryMonitor(child, 100, vi.fn());
    expect(monitor.wasKilledByMemoryLimit()).toBe(false);
  });

  it('accepts getMemoryFn for dependency injection', () => {
    const { child } = createMockChild();
    const monitor = new MemoryMonitor(
      child,
      100,
      undefined,
      vi.fn().mockResolvedValue(1024)
    );
    expect(monitor.wasKilledByMemoryLimit()).toBe(false);
  });

  it('start does nothing if child has no pid', () => {
    const { child, killMock } = createMockChild(undefined);
    const monitor = new MemoryMonitor(child, 100);
    monitor.start();
    vi.advanceTimersByTime(2000);
    expect(killMock).not.toHaveBeenCalled();
  });

  it('start checks immediately then polls after interval', async () => {
    const { child } = createMockChild(12345);
    const mockGetMemory = vi.fn().mockResolvedValue(1 * 1024 * 1024);
    const monitor = new MemoryMonitor(child, 100, undefined, mockGetMemory);

    monitor.start();
    // First check happens immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(mockGetMemory).toHaveBeenCalledTimes(1);
    // Second check after 250ms interval
    await vi.advanceTimersByTimeAsync(250);
    expect(mockGetMemory).toHaveBeenCalledTimes(2);
    monitor.stop();
  });

  it('stop clears the monitoring interval', () => {
    const { child } = createMockChild();
    const monitor = new MemoryMonitor(child, 100);
    monitor.start();
    monitor.stop();
    vi.advanceTimersByTime(5000);
  });

  it('stop can be called multiple times safely', () => {
    const { child } = createMockChild();
    const monitor = new MemoryMonitor(child, 100);
    monitor.start();
    monitor.stop();
    monitor.stop();
  });

  it('stop can be called before start', () => {
    const { child } = createMockChild();
    const monitor = new MemoryMonitor(child, 100);
    monitor.stop();
  });

  it('stop prevents further memory checks', async () => {
    const { child } = createMockChild(12345);
    const mockGetMemory = vi.fn().mockResolvedValue(1 * 1024 * 1024);
    const monitor = new MemoryMonitor(child, 100, undefined, mockGetMemory);

    monitor.start();
    await vi.advanceTimersByTimeAsync(1050);
    const callCount = mockGetMemory.mock.calls.length;
    monitor.stop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockGetMemory.mock.calls.length).toBe(callCount);
  });

  it('wasKilledByMemoryLimit returns false when not killed', () => {
    const { child } = createMockChild();
    const monitor = new MemoryMonitor(child, 100);
    expect(monitor.wasKilledByMemoryLimit()).toBe(false);
  });

  it('wasKilledByMemoryLimit returns false when under limit', async () => {
    const { child } = createMockChild(12345);
    const monitor = new MemoryMonitor(
      child,
      100,
      undefined,
      vi.fn().mockResolvedValue(50 * 1024 * 1024)
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(2000);
    expect(monitor.wasKilledByMemoryLimit()).toBe(false);
    monitor.stop();
  });

  it('wasKilledByMemoryLimit returns true after limit exceeded', async () => {
    const { child } = createMockChild(12345);
    const monitor = new MemoryMonitor(
      child,
      10,
      undefined,
      vi.fn().mockResolvedValue(100 * 1024 * 1024)
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(1050);
    expect(monitor.wasKilledByMemoryLimit()).toBe(true);
    monitor.stop();
  });

  it('sends SIGTERM when memory exceeds limit', async () => {
    const { child, killMock } = createMockChild(12345);
    const monitor = new MemoryMonitor(
      child,
      10,
      vi.fn(),
      vi.fn().mockResolvedValue(100 * 1024 * 1024)
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(1050);
    expect(killMock).toHaveBeenCalledWith('SIGTERM');
    monitor.stop();
  });

  it('calls onExceeded callback with memory info', async () => {
    const { child } = createMockChild(12345);
    const onExceeded = vi.fn();
    const monitor = new MemoryMonitor(
      child,
      10,
      onExceeded,
      vi.fn().mockResolvedValue(50 * 1024 * 1024)
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(1050);
    expect(onExceeded).toHaveBeenCalledWith({
      limit: 10,
      used: 50,
    });
    monitor.stop();
  });

  it('escalates to SIGKILL after grace period', async () => {
    const { child, killMock } = createMockChild(12345);
    const monitor = new MemoryMonitor(
      child,
      10,
      undefined,
      vi.fn().mockResolvedValue(100 * 1024 * 1024)
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(1050);
    expect(killMock).toHaveBeenCalledWith('SIGTERM');
    await vi.advanceTimersByTimeAsync(3100);
    expect(killMock).toHaveBeenCalledWith('SIGKILL');
    monitor.stop();
  });

  it('does not send SIGKILL if stopped before grace period', async () => {
    const { child, killMock } = createMockChild(12345);
    const monitor = new MemoryMonitor(
      child,
      10,
      undefined,
      vi.fn().mockResolvedValue(100 * 1024 * 1024)
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(1050);
    monitor.stop();
    killMock.mockClear();
    await vi.advanceTimersByTimeAsync(3100);
    expect(killMock).not.toHaveBeenCalledWith('SIGKILL');
  });

  it('only kills once even if memory stays high', async () => {
    const { child, killMock } = createMockChild(12345);
    const monitor = new MemoryMonitor(
      child,
      10,
      undefined,
      vi.fn().mockResolvedValue(100 * 1024 * 1024)
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(2000);
    const sigtermCalls = killMock.mock.calls.filter((c) => c[0] === 'SIGTERM');
    expect(sigtermCalls.length).toBe(1);
    monitor.stop();
  });

  it('does not kill when memory is under limit', async () => {
    const { child, killMock } = createMockChild(12345);
    const monitor = new MemoryMonitor(
      child,
      100,
      undefined,
      vi.fn().mockResolvedValue(50 * 1024 * 1024)
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(2000);
    expect(killMock).not.toHaveBeenCalled();
    monitor.stop();
  });

  it('handles undefined memory reading gracefully', async () => {
    const { child, killMock } = createMockChild(12345);
    const monitor = new MemoryMonitor(
      child,
      10,
      undefined,
      vi.fn().mockResolvedValue(undefined)
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(2000);
    expect(killMock).not.toHaveBeenCalled();
    monitor.stop();
  });

  it('kills at exact limit boundary', async () => {
    const { child, killMock } = createMockChild(12345);
    const monitor = new MemoryMonitor(
      child,
      10,
      undefined,
      vi.fn().mockResolvedValue(10 * 1024 * 1024)
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(1050);
    expect(killMock).toHaveBeenCalledWith('SIGTERM');
    monitor.stop();
  });

  it('does not kill just under limit', async () => {
    const { child, killMock } = createMockChild(12345);
    const monitor = new MemoryMonitor(
      child,
      10,
      undefined,
      vi.fn().mockResolvedValue(10 * 1024 * 1024 - 1)
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(1050);
    expect(killMock).not.toHaveBeenCalled();
    monitor.stop();
  });

  it('uses injected getMemoryFn when provided', async () => {
    const { child } = createMockChild(12345);
    const mockGetMemory = vi.fn().mockResolvedValue(1 * 1024 * 1024);
    const monitor = new MemoryMonitor(child, 100, undefined, mockGetMemory);

    monitor.start();
    await vi.advanceTimersByTimeAsync(1050);
    expect(mockGetMemory).toHaveBeenCalledWith(12345);
    monitor.stop();
  });

  it('handles double start safely', async () => {
    const { child } = createMockChild(12345);
    const mockGetMemory = vi.fn().mockResolvedValue(1 * 1024 * 1024);
    const monitor = new MemoryMonitor(child, 100, undefined, mockGetMemory);

    monitor.start();
    monitor.start(); // Double start
    await vi.advanceTimersByTimeAsync(1050);
    expect(mockGetMemory).toHaveBeenCalled();
    monitor.stop();
  });

  it('does not unkill after memory drops below limit', async () => {
    const { child, killMock } = createMockChild(12345);
    let memoryValue = 100 * 1024 * 1024;
    const mockGetMemory = vi.fn().mockImplementation(() => {
      return Promise.resolve(memoryValue);
    });
    const monitor = new MemoryMonitor(child, 10, undefined, mockGetMemory);

    monitor.start();
    await vi.advanceTimersByTimeAsync(1050);
    expect(killMock).toHaveBeenCalledWith('SIGTERM');
    expect(monitor.wasKilledByMemoryLimit()).toBe(true);

    // Memory drops but should still be killed
    memoryValue = 1 * 1024 * 1024;
    expect(monitor.wasKilledByMemoryLimit()).toBe(true);
    monitor.stop();
  });

  it('handles stop called during memory check', async () => {
    const { child, killMock } = createMockChild(12345);
    let resolveMemory: (value: number) => void;
    const mockGetMemory = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveMemory = resolve;
      });
    });
    const monitor = new MemoryMonitor(child, 10, undefined, mockGetMemory);

    monitor.start();
    await vi.advanceTimersByTimeAsync(1050);
    expect(mockGetMemory).toHaveBeenCalled();

    // Stop while memory check is pending
    monitor.stop();

    // Resolve with high memory after stop
    resolveMemory!(100 * 1024 * 1024);
    await vi.advanceTimersByTimeAsync(0);

    // Should not kill because monitor was stopped
    expect(killMock).not.toHaveBeenCalled();
    expect(monitor.wasKilledByMemoryLimit()).toBe(false);
  });
});

describe('killGracefully', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends SIGTERM immediately', () => {
    const { child, killMock } = createMockChild();
    killGracefully(child);
    expect(killMock).toHaveBeenCalledWith('SIGTERM');
  });

  it('sends SIGKILL after grace period', async () => {
    const { child, killMock } = createMockChild();
    killGracefully(child);
    expect(killMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(SIGKILL_GRACE_PERIOD + 100);
    expect(killMock).toHaveBeenCalledWith('SIGKILL');
    expect(killMock).toHaveBeenCalledTimes(2);
  });

  it('returns timeout ID for cleanup', () => {
    const { child } = createMockChild();
    const timeoutId = killGracefully(child);
    expect(timeoutId).toBeDefined();
    clearTimeout(timeoutId);
  });

  it('accepts custom grace period', async () => {
    const { child, killMock } = createMockChild();
    killGracefully(child, 500);
    await vi.advanceTimersByTimeAsync(400);
    expect(killMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(killMock).toHaveBeenCalledWith('SIGKILL');
  });

  it('handles SIGKILL error when process already terminated', async () => {
    const { child, killMock } = createMockChild();
    killMock.mockImplementation((signal: string) => {
      if (signal === 'SIGKILL') {
        throw new Error('Process already terminated');
      }
      return true;
    });
    killGracefully(child);
    // Should not throw
    await vi.advanceTimersByTimeAsync(SIGKILL_GRACE_PERIOD + 100);
  });
});

describe('MemoryMonitor edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles getMemoryFn that throws', async () => {
    const { child, killMock } = createMockChild(12345);
    const throwingGetMemory = vi
      .fn()
      .mockRejectedValue(new Error('Mock error'));
    const monitor = new MemoryMonitor(child, 10, undefined, throwingGetMemory);

    monitor.start();
    // Should not throw, should not kill, and should continue checking
    await vi.advanceTimersByTimeAsync(3000);
    expect(killMock).not.toHaveBeenCalled();
    // Should have continued scheduling checks despite errors
    expect(throwingGetMemory.mock.calls.length).toBeGreaterThan(1);
    monitor.stop();
  });

  it('handles child losing PID during monitoring', async () => {
    const emitter = new EventEmitter();
    const child = emitter as unknown as ChildProcess;
    let currentPid: number | undefined = 12345;
    Object.defineProperty(child, 'pid', {
      get: () => currentPid,
      configurable: true,
    });
    const killMock = vi.fn().mockReturnValue(true);
    child.kill = killMock;

    const mockGetMemory = vi.fn().mockResolvedValue(1 * 1024 * 1024);
    const monitor = new MemoryMonitor(child, 10, undefined, mockGetMemory);

    monitor.start();
    await vi.advanceTimersByTimeAsync(1050);
    expect(mockGetMemory).toHaveBeenCalled();

    // Remove PID (simulating process exit)
    currentPid = undefined;
    mockGetMemory.mockClear();

    // Should stop checking when PID becomes undefined
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockGetMemory).not.toHaveBeenCalled();
    monitor.stop();
  });

  it('does not schedule check after killed', async () => {
    const { child } = createMockChild(12345);
    const mockGetMemory = vi
      .fn()
      .mockResolvedValueOnce(100 * 1024 * 1024) // First check exceeds limit
      .mockResolvedValue(1 * 1024 * 1024); // Subsequent checks normal

    const monitor = new MemoryMonitor(child, 10, undefined, mockGetMemory);

    monitor.start();
    await vi.advanceTimersByTimeAsync(1050);
    expect(monitor.wasKilledByMemoryLimit()).toBe(true);

    // Should not schedule more checks after kill
    const callCountAfterKill = mockGetMemory.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3000);
    expect(mockGetMemory.mock.calls.length).toBe(callCountAfterKill);
    monitor.stop();
  });

  it('still kills process when onExceeded callback throws', async () => {
    const { child, killMock } = createMockChild(12345);
    const callOrder: string[] = [];

    const throwingCallback = vi.fn().mockImplementation(() => {
      callOrder.push('callback');
      throw new Error('Callback error');
    });

    // Track when kill is called
    killMock.mockImplementation((signal: string) => {
      callOrder.push(`kill:${signal}`);
      return true;
    });

    const monitor = new MemoryMonitor(
      child,
      10,
      throwingCallback,
      vi.fn().mockResolvedValue(100 * 1024 * 1024)
    );

    monitor.start();

    // Should not throw - callback errors are caught internally
    await vi.advanceTimersByTimeAsync(1050);

    // Kill should happen before callback (kill first, notify second)
    expect(callOrder[0]).toBe('kill:SIGTERM');
    expect(callOrder[1]).toBe('callback');
    expect(throwingCallback).toHaveBeenCalled();
    expect(monitor.wasKilledByMemoryLimit()).toBe(true);
    monitor.stop();
  });

  it('does not kill when memory returns zero bytes', async () => {
    const { child, killMock } = createMockChild(12345);
    const monitor = new MemoryMonitor(
      child,
      10,
      undefined,
      vi.fn().mockResolvedValue(0)
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(2000);
    expect(killMock).not.toHaveBeenCalled();
    monitor.stop();
  });

  it('continues monitoring after memory reading returns zero', async () => {
    const { child } = createMockChild(12345);
    const mockGetMemory = vi
      .fn()
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValue(1 * 1024 * 1024);

    const monitor = new MemoryMonitor(child, 100, undefined, mockGetMemory);

    monitor.start();
    await vi.advanceTimersByTimeAsync(3050);
    expect(mockGetMemory.mock.calls.length).toBeGreaterThanOrEqual(3);
    monitor.stop();
  });

  it('ceils memory usage to whole MB in callback', async () => {
    const { child } = createMockChild(12345);
    const onExceeded = vi.fn();
    const monitor = new MemoryMonitor(
      child,
      10,
      onExceeded,
      // 10.1 MB should ceil to 11 MB (not round to 10 MB)
      vi.fn().mockResolvedValue(10.1 * 1024 * 1024)
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(1050);
    expect(onExceeded).toHaveBeenCalledWith({
      limit: 10,
      used: 11,
    });
    monitor.stop();
  });

  it('ceils fractional bytes to next MB', async () => {
    const { child } = createMockChild(12345);
    const onExceeded = vi.fn();
    const monitor = new MemoryMonitor(
      child,
      10,
      onExceeded,
      // 10 MB + 1 byte should ceil to 11 MB
      vi.fn().mockResolvedValue(10 * 1024 * 1024 + 1)
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(1050);
    expect(onExceeded).toHaveBeenCalledWith({
      limit: 10,
      used: 11,
    });
    monitor.stop();
  });
});
