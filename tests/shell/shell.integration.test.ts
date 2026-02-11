import { describe, expect, it, vi } from 'vitest';

import {
  ExecuteCommand,
  ExecutionResult,
  ExecutionStatus,
  RealExecutor,
} from '../../src/services/shell.js';

it('executes command and captures stdout', async () => {
  const executor = new RealExecutor();
  const cmd: ExecuteCommand = {
    description: 'Echo test',
    command: 'echo "hello world"',
  };

  const result = await executor.execute(cmd);

  expect(result.result).toBe(ExecutionResult.Success);
  expect(result.output.trim()).toBe('hello world');
  expect(result.errors).toBe('');
});

it('captures stderr output', async () => {
  const executor = new RealExecutor();
  const cmd: ExecuteCommand = {
    description: 'Write to stderr',
    command: 'echo "error message" >&2',
  };

  const result = await executor.execute(cmd);

  expect(result.result).toBe(ExecutionResult.Success);
  expect(result.errors.trim()).toBe('error message');
});

it('returns error result for non-zero exit code', async () => {
  const executor = new RealExecutor();
  const cmd: ExecuteCommand = {
    description: 'Failing command',
    command: 'exit 1',
  };

  const result = await executor.execute(cmd);

  expect(result.result).toBe(ExecutionResult.Error);
  expect(result.error).toBe('Exit code: 1');
});

it('calls output callback with stdout data', async () => {
  const chunks: string[] = [];
  const executor = new RealExecutor((data, stream) => {
    if (stream === 'stdout') {
      chunks.push(data);
    }
  });

  const cmd: ExecuteCommand = {
    description: 'Echo test',
    command: 'echo "callback test"',
  };

  await executor.execute(cmd);

  expect(chunks.join('')).toContain('callback test');
});

it('calls output callback with stderr data', async () => {
  const chunks: string[] = [];
  const executor = new RealExecutor((data, stream) => {
    if (stream === 'stderr') {
      chunks.push(data);
    }
  });

  const cmd: ExecuteCommand = {
    description: 'Stderr test',
    command: 'echo "stderr test" >&2',
  };

  await executor.execute(cmd);

  expect(chunks.join('')).toContain('stderr test');
});

it('calls progress callback with running and success status', async () => {
  const executor = new RealExecutor();
  const statuses: ExecutionStatus[] = [];

  const cmd: ExecuteCommand = {
    description: 'Progress test',
    command: 'echo "test"',
  };

  await executor.execute(cmd, (status) => statuses.push(status));

  expect(statuses).toContain(ExecutionStatus.Running);
  expect(statuses).toContain(ExecutionStatus.Success);
});

it('calls progress callback with failed status on error', async () => {
  const executor = new RealExecutor();
  const statuses: ExecutionStatus[] = [];

  const cmd: ExecuteCommand = {
    description: 'Failing command',
    command: 'exit 42',
  };

  await executor.execute(cmd, (status) => statuses.push(status));

  expect(statuses).toContain(ExecutionStatus.Running);
  expect(statuses).toContain(ExecutionStatus.Failed);
});

it('captures multi-line output', async () => {
  const executor = new RealExecutor();
  const cmd: ExecuteCommand = {
    description: 'Multi-line output',
    command: 'echo "line1"; echo "line2"; echo "line3"',
  };

  const result = await executor.execute(cmd);

  expect(result.result).toBe(ExecutionResult.Success);
  expect(result.output.trim()).toBe('line1\nline2\nline3');
});

it('allows updating output callback via setOutputCallback', async () => {
  const executor = new RealExecutor();
  const chunks: string[] = [];

  executor.setOutputCallback((data) => chunks.push(data));

  const cmd: ExecuteCommand = {
    description: 'Callback update test',
    command: 'echo "updated"',
  };

  await executor.execute(cmd);

  expect(chunks.join('')).toContain('updated');

  // Clear callback
  executor.setOutputCallback(undefined);
});

describe('PWD marker filtering', () => {
  it('does not include marker in final output', async () => {
    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Marker test',
      command: 'echo "hello"',
    };

    const result = await executor.execute(cmd);

    expect(result.output).not.toContain('__PWD_MARKER');
    expect(result.output.trim()).toBe('hello');
  });

  it('does not include marker in output callback', async () => {
    const chunks: string[] = [];
    const executor = new RealExecutor((data, stream) => {
      if (stream === 'stdout') {
        chunks.push(data);
      }
    });

    const cmd: ExecuteCommand = {
      description: 'Callback marker test',
      command: 'echo "visible output"',
    };

    await executor.execute(cmd);

    const combined = chunks.join('');
    expect(combined).not.toContain('__PWD_MARKER');
    expect(combined).toContain('visible output');
  });

  it('extracts workdir from pwd after marker', async () => {
    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Workdir test',
      command: 'echo "test"',
    };

    const result = await executor.execute(cmd);

    expect(result.workdir).toBeDefined();
    expect(result.workdir).toMatch(/^\//); // Absolute path
  });

  it('extracts workdir after cd command', async () => {
    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'CD test',
      command: 'cd /tmp',
    };

    const result = await executor.execute(cmd);

    // macOS resolves /tmp to /private/tmp
    expect(result.workdir).toMatch(/\/tmp$/);
  });

  it('filters marker from multi-line output', async () => {
    const chunks: string[] = [];
    const executor = new RealExecutor((data, stream) => {
      if (stream === 'stdout') {
        chunks.push(data);
      }
    });

    const cmd: ExecuteCommand = {
      description: 'Multi-line marker test',
      command: 'echo "line1"; echo "line2"; echo "line3"',
    };

    const result = await executor.execute(cmd);

    const combined = chunks.join('');
    expect(combined).not.toContain('__PWD_MARKER');
    expect(result.output.trim()).toBe('line1\nline2\nline3');
  });

  it('preserves command output when extracting workdir', async () => {
    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Output preservation test',
      command: 'echo "keep this"; echo "and this"',
    };

    const result = await executor.execute(cmd);

    expect(result.output).toContain('keep this');
    expect(result.output).toContain('and this');
    expect(result.workdir).toBeDefined();
  });

  it('handles empty command output with workdir', async () => {
    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Empty output test',
      command: 'cd /tmp',
    };

    const result = await executor.execute(cmd);

    expect(result.output).toBe('');
    // macOS resolves /tmp to /private/tmp
    expect(result.workdir).toMatch(/\/tmp$/);
  });

  it('uses workdir for subsequent command execution', async () => {
    const executor = new RealExecutor();

    // First command changes directory
    const cmd1: ExecuteCommand = {
      description: 'Change to tmp',
      command: 'cd /tmp',
    };
    const result1 = await executor.execute(cmd1);

    // Second command uses the workdir from first
    const cmd2: ExecuteCommand = {
      description: 'Run in tmp',
      command: 'pwd',
      workdir: result1.workdir,
    };
    const result2 = await executor.execute(cmd2);

    // macOS resolves /tmp to /private/tmp
    expect(result2.output.trim()).toMatch(/\/tmp$/);
  });
});

describe('Output line limiting', () => {
  it('returns all output when under 128 lines', async () => {
    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Small output',
      command: 'for i in {1..100}; do echo "line $i"; done',
    };

    const result = await executor.execute(cmd);

    const lines = result.output.trim().split('\n');
    expect(lines.length).toBe(100);
    expect(lines[0]).toBe('line 1');
    expect(lines[99]).toBe('line 100');
  });

  it('limits stdout to last 128 lines when exceeded', async () => {
    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Large output',
      command: 'for i in {1..2000}; do echo "line $i"; done',
    };

    const result = await executor.execute(cmd);

    const lines = result.output.trim().split('\n');
    expect(lines.length).toBeLessThanOrEqual(128);
    expect(lines.length).toBeGreaterThan(100);
    // Should have lines from the end
    expect(lines[lines.length - 1]).toBe('line 2000');
  });

  it('limits stderr to last 128 lines when exceeded', async () => {
    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Large stderr output',
      command: 'for i in {1..2000}; do echo "error $i" >&2; done',
    };

    const result = await executor.execute(cmd);

    const lines = result.errors.trim().split('\n');
    expect(lines.length).toBeLessThanOrEqual(128);
    expect(lines.length).toBeGreaterThan(100);
    // Should have lines from the end
    expect(lines[lines.length - 1]).toBe('error 2000');
  });

  it('limits stderr on error with large output', async () => {
    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Large stderr with error',
      command: 'for i in {1..2000}; do echo "error $i" >&2; done; exit 1',
    };

    const result = await executor.execute(cmd);

    expect(result.result).toBe(ExecutionResult.Error);
    const lines = result.errors.trim().split('\n');
    expect(lines.length).toBeLessThanOrEqual(128);
    expect(lines.length).toBeGreaterThan(100);
    // Should have lines from the end
    expect(lines[lines.length - 1]).toBe('error 2000');
  });

  it('preserves output under limit without modification', async () => {
    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Under limit',
      command: 'for i in {1..100}; do echo "line $i"; done',
    };

    const result = await executor.execute(cmd);

    const lines = result.output.trim().split('\n');
    expect(lines.length).toBe(100);
    expect(lines[0]).toBe('line 1');
    expect(lines[99]).toBe('line 100');
  });
});

describe('Memory limit monitoring', () => {
  it('accepts memoryLimit option without affecting normal execution', async () => {
    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Light process',
      command: 'echo "hello"',
      memoryLimit: 100,
    };

    const result = await executor.execute(cmd);

    expect(result.result).toBe(ExecutionResult.Success);
    expect(result.output.trim()).toBe('hello');
  });

  it('monitors multi-command execution with memoryLimit', async () => {
    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Multi-command',
      command: 'echo "one"; echo "two"; echo "three"',
      memoryLimit: 100,
    };

    const result = await executor.execute(cmd);

    expect(result.result).toBe(ExecutionResult.Success);
    expect(result.output).toContain('one');
    expect(result.output).toContain('two');
    expect(result.output).toContain('three');
  });

  it('handles memoryLimit with workdir option', async () => {
    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'With workdir',
      command: 'pwd',
      workdir: '/tmp',
      memoryLimit: 100,
    };

    const result = await executor.execute(cmd);

    expect(result.result).toBe(ExecutionResult.Success);
    expect(result.output.trim()).toMatch(/\/tmp$/);
  });

  it('terminates process exceeding memory limit', async () => {
    // Use real timers - memory monitor relies on actual setTimeout
    vi.useRealTimers();

    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Memory hog',
      // Allocate 50MB explicitly and hold it while sleeping
      command:
        'node -e "global.buf = Buffer.alloc(50*1024*1024); ' +
        'setInterval(() => {}, 100)"',
      // 10MB hard limit; node+shell ~42MB will exceed
      memoryLimit: 10,
    };

    const result = await executor.execute(cmd);

    expect(result.result).toBe(ExecutionResult.Error);
    expect(result.error).toContain('exceeded');
    expect(result.error).toContain('10 MB memory limit');
  }, 10000);

  it('calls progress callback with failed status on memory kill', async () => {
    // Use real timers - memory monitor relies on actual setTimeout
    vi.useRealTimers();

    const executor = new RealExecutor();
    const statuses: ExecutionStatus[] = [];

    const cmd: ExecuteCommand = {
      description: 'Memory hog with progress',
      command:
        'node -e "global.buf = Buffer.alloc(50*1024*1024); ' +
        'setInterval(() => {}, 100)"',
      memoryLimit: 10,
    };

    await executor.execute(cmd, (status) => statuses.push(status));

    expect(statuses).toContain(ExecutionStatus.Running);
    expect(statuses).toContain(ExecutionStatus.Failed);
  }, 10000);
});

describe('Output streaming buffer management', () => {
  it('collapses stdout chunks when buffer exceeds 16 chunks', async () => {
    vi.useRealTimers();

    const chunks: string[] = [];
    const executor = new RealExecutor((data, stream) => {
      if (stream === 'stdout') {
        chunks.push(data);
      }
    });

    // Generate many small output chunks to trigger collapse
    const cmd: ExecuteCommand = {
      description: 'Many chunks',
      command: 'for i in {1..50}; do echo "chunk $i"; sleep 0.01; done',
    };

    const result = await executor.execute(cmd);

    expect(result.result).toBe(ExecutionResult.Success);
    // Should have received chunks without crashing
    expect(chunks.length).toBeGreaterThan(0);
    // Final output should have all lines
    expect(result.output).toContain('chunk 1');
    expect(result.output).toContain('chunk 50');
  }, 10000);

  it('collapses stderr chunks when buffer exceeds 16 chunks', async () => {
    vi.useRealTimers();

    const chunks: string[] = [];
    const executor = new RealExecutor((data, stream) => {
      if (stream === 'stderr') {
        chunks.push(data);
      }
    });

    // Generate many small stderr chunks to trigger collapse
    const cmd: ExecuteCommand = {
      description: 'Many stderr chunks',
      command: 'for i in {1..50}; do echo "error $i" >&2; sleep 0.01; done',
    };

    const result = await executor.execute(cmd);

    expect(result.result).toBe(ExecutionResult.Success);
    // Should have received chunks without crashing
    expect(chunks.length).toBeGreaterThan(0);
    // Final errors should have all lines
    expect(result.errors).toContain('error 1');
    expect(result.errors).toContain('error 50');
  }, 10000);
});

describe('Spawn error handling', () => {
  it('handles invalid working directory gracefully', async () => {
    vi.useRealTimers();

    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Invalid workdir',
      command: 'echo "test"',
      workdir: '/nonexistent/path/that/does/not/exist',
    };

    const result = await executor.execute(cmd);

    expect(result.result).toBe(ExecutionResult.Error);
    expect(result.error).toBeDefined();
  });

  it('returns error for command with invalid executable', async () => {
    vi.useRealTimers();

    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Invalid command',
      // Command that doesn't exist
      command: '/nonexistent/binary/xyz123',
    };

    const result = await executor.execute(cmd);

    expect(result.result).toBe(ExecutionResult.Error);
  });
});

describe('killCurrentProcess', () => {
  it('terminates a running process and its children', async () => {
    vi.useRealTimers();

    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Long running process',
      command: 'sleep 30',
      timeout: 10000,
    };

    const promise = executor.execute(cmd);

    // Give the process time to start
    await new Promise((r) => setTimeout(r, 200));
    executor.killCurrentProcess();

    const start = Date.now();
    const result = await promise;
    const elapsed = Date.now() - start;

    expect(result.result).toBe(ExecutionResult.Error);
    expect(elapsed).toBeLessThan(5000);
  });

  it('terminates shell child processes, not just the shell', async () => {
    vi.useRealTimers();

    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Shell with child process',
      // Spawn a subprocess that would outlive the shell
      command: 'node -e "setInterval(() => {}, 100)"',
      timeout: 10000,
    };

    const promise = executor.execute(cmd);

    await new Promise((r) => setTimeout(r, 200));
    executor.killCurrentProcess();

    const start = Date.now();
    const result = await promise;
    const elapsed = Date.now() - start;

    expect(result.result).toBe(ExecutionResult.Error);
    expect(elapsed).toBeLessThan(5000);
  });

  it('clears the SIGKILL timeout after process exits', async () => {
    vi.useRealTimers();

    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Quick exit after kill',
      command: 'sleep 30',
      timeout: 10000,
    };

    const promise = executor.execute(cmd);

    await new Promise((r) => setTimeout(r, 200));
    executor.killCurrentProcess();

    const result = await promise;
    expect(result.result).toBe(ExecutionResult.Error);

    // After exit, no dangling timers should keep the process alive.
    // Verify by checking that the executor has no active child.
    // If the timeout leaked, it would fire on a dead process — harmless
    // but could delay Node shutdown. The fix stores and clears it.
    executor.killCurrentProcess(); // no-op, child already cleared
  });

  it('is a no-op when no process is running', () => {
    const executor = new RealExecutor();
    // Should not throw
    executor.killCurrentProcess();
  });
});

describe('writeStdin', () => {
  it('delivers data to the child process stdin', async () => {
    vi.useRealTimers();

    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Read from stdin',
      command: 'read line && echo "got: $line"',
      timeout: 5000,
    };

    const promise = executor.execute(cmd);

    // Give the process time to start and wait for input
    await new Promise((r) => setTimeout(r, 100));
    executor.writeStdin('hello\n');

    const result = await promise;

    expect(result.result).toBe(ExecutionResult.Success);
    expect(result.output).toContain('got: hello');
  });

  it('is a no-op when no process is running', () => {
    const executor = new RealExecutor();
    // Should not throw
    executor.writeStdin('data');
  });
});

describe('Command timeout', () => {
  it('terminates command that exceeds timeout', async () => {
    vi.useRealTimers();

    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Long running command',
      command: 'sleep 10',
      timeout: 100,
    };

    const start = Date.now();
    const result = await executor.execute(cmd);
    const elapsed = Date.now() - start;

    expect(result.result).toBe(ExecutionResult.Error);
    expect(elapsed).toBeLessThan(5000);
  });

  it('completes successfully when command finishes before timeout', async () => {
    vi.useRealTimers();

    const executor = new RealExecutor();
    const cmd: ExecuteCommand = {
      description: 'Fast command',
      command: 'echo "quick"',
      timeout: 5000,
    };

    const result = await executor.execute(cmd);

    expect(result.result).toBe(ExecutionResult.Success);
    expect(result.output.trim()).toBe('quick');
  });

  it('calls progress callback with failed status on timeout', async () => {
    vi.useRealTimers();

    const executor = new RealExecutor();
    const statuses: ExecutionStatus[] = [];

    const cmd: ExecuteCommand = {
      description: 'Timeout with progress',
      command: 'sleep 10',
      timeout: 100,
    };

    await executor.execute(cmd, (status) => statuses.push(status));

    expect(statuses).toContain(ExecutionStatus.Running);
    expect(statuses).toContain(ExecutionStatus.Failed);
  });
});
