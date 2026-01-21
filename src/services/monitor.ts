import { execFile, execSync, ChildProcess } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { platform } from 'os';
import { promisify } from 'util';

export interface MemoryLimitExceeded {
  used: number;
  limit: number;
}

// Memory monitoring constants
const MEMORY_CHECK_INTERVAL = 250;
const DEFAULT_PAGE_SIZE = 4096;

export const SIGKILL_GRACE_PERIOD = 3000;

/**
 * Get system page size in bytes.
 * Computed lazily on first call, then cached at module level.
 */
let cachedPageSize: number | undefined;

function getPageSize(): number {
  if (cachedPageSize !== undefined) {
    return cachedPageSize;
  }

  if (platform() === 'linux') {
    try {
      const output = execSync('getconf PAGESIZE', {
        encoding: 'utf-8',
        timeout: 1000,
      }).trim();
      const size = parseInt(output, 10);
      if (!isNaN(size) && size > 0) {
        cachedPageSize = size;
        return cachedPageSize;
      }
    } catch {
      // Fall through to default
    }
  }

  cachedPageSize = DEFAULT_PAGE_SIZE;
  return cachedPageSize;
}

/**
 * Gracefully terminate a child process with SIGTERM, escalating to SIGKILL
 * after a grace period if the process doesn't terminate.
 * Returns the kill timeout ID for cleanup.
 */
export function killGracefully(
  child: ChildProcess,
  gracePeriod = SIGKILL_GRACE_PERIOD
): NodeJS.Timeout {
  child.kill('SIGTERM');
  return setTimeout(() => {
    try {
      child.kill('SIGKILL');
    } catch {
      // Process already terminated
    }
  }, gracePeriod);
}

const execFileAsync = promisify(execFile);

/**
 * Run a command asynchronously and return stdout.
 * Returns undefined on error or timeout.
 */
async function runCommandAsync(
  command: string,
  args: string[],
  timeout = 1000
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout });
    return stdout.trim();
  } catch {
    return undefined;
  }
}

/**
 * Get memory usage of a process in bytes.
 * Returns undefined if the process doesn't exist or memory can't be read.
 * On macOS, uses async subprocess; on Linux, reads from /proc (fast).
 */
async function getProcessMemoryBytes(pid: number): Promise<number | undefined> {
  try {
    if (platform() === 'linux') {
      // Linux: Read from /proc/[pid]/statm (memory in pages)
      // This is fast and effectively non-blocking for procfs
      const statmPath = `/proc/${pid}/statm`;
      if (!existsSync(statmPath)) return undefined;

      const statm = readFileSync(statmPath, 'utf-8');
      const rssPages = parseInt(statm.split(' ')[1], 10);
      return rssPages * getPageSize();
    } else {
      // macOS/BSD: Use ps command asynchronously
      const output = await runCommandAsync('ps', [
        '-o',
        'rss=',
        '-p',
        `${pid}`,
      ]);
      if (!output) return undefined;
      const rssKB = parseInt(output, 10);
      if (isNaN(rssKB)) return undefined;
      return rssKB * 1024;
    }
  } catch {
    return undefined;
  }
}

/**
 * Get child PIDs of a single process.
 */
async function getChildPids(pid: number): Promise<number[]> {
  try {
    let output: string | undefined;
    if (platform() === 'linux') {
      output = await runCommandAsync('ps', ['-o', 'pid=', '--ppid', `${pid}`]);
    } else {
      output = await runCommandAsync('pgrep', ['-P', `${pid}`]);
    }
    if (!output) return [];
    return output
      .split('\n')
      .map((p) => parseInt(p.trim(), 10))
      .filter((p) => !isNaN(p) && p > 0);
  } catch {
    return [];
  }
}

/**
 * Get all descendant PIDs of a process.
 * Uses iterative BFS with parallel child lookups at each level.
 */
async function getAllDescendantPids(pid: number): Promise<number[]> {
  const visited = new Set<number>();
  const pids: number[] = [];
  let currentLevel = [pid];

  while (currentLevel.length > 0) {
    // Add unvisited PIDs from current level
    const unvisited = currentLevel.filter((p) => !visited.has(p));
    for (const p of unvisited) visited.add(p);
    pids.push(...unvisited);

    // Fetch children of all current level PIDs in parallel
    const childArrays = await Promise.all(unvisited.map(getChildPids));
    currentLevel = childArrays.flat();
  }

  return pids;
}

/**
 * Get total memory usage of a process tree.
 * Sums memory of the process and all its descendants.
 */
async function getProcessTreeMemoryBytes(
  pid: number
): Promise<number | undefined> {
  try {
    const allPids = await getAllDescendantPids(pid);

    let totalBytes = 0;
    for (const p of allPids) {
      const mem = await getProcessMemoryBytes(p);
      if (mem) totalBytes += mem;
    }

    return totalBytes > 0 ? totalBytes : undefined;
  } catch {
    return getProcessMemoryBytes(pid);
  }
}

/**
 * Function type for getting process memory.
 * Allows injection for testing.
 */
export type GetProcessMemoryFn = (pid: number) => Promise<number | undefined>;

/** Monitor lifecycle state */
enum MonitorState {
  Idle = 'idle',
  Running = 'running',
  Stopped = 'stopped',
  Killed = 'killed',
}

/**
 * Monitors a child process memory and kills it when the limit is exceeded.
 * Uses async self-scheduling to avoid blocking the event loop.
 * By default monitors only the root process; set includeDescendants for tree.
 */
export class MemoryMonitor {
  private nextCheckId?: NodeJS.Timeout;
  private killTimeoutId?: NodeJS.Timeout;
  private child: ChildProcess;
  private memoryLimit: number;
  private limitBytes: number;
  private onExceeded?: (info: MemoryLimitExceeded) => void;
  private onMemoryUpdate?: (memoryMB: number) => void;
  private state: MonitorState = MonitorState.Idle;
  private getMemoryFn: GetProcessMemoryFn;
  private currentMemoryMB = 0;

  constructor(
    child: ChildProcess,
    memoryLimitMB: number,
    onExceeded?: (info: MemoryLimitExceeded) => void,
    getMemoryFn?: GetProcessMemoryFn,
    onMemoryUpdate?: (memoryMB: number) => void
  ) {
    this.child = child;
    this.memoryLimit = memoryLimitMB;
    this.limitBytes = memoryLimitMB * 1024 * 1024;
    this.onExceeded = onExceeded;
    this.onMemoryUpdate = onMemoryUpdate;

    // Always monitor full process tree by default
    this.getMemoryFn = getMemoryFn ?? getProcessTreeMemoryBytes;
  }

  /**
   * Start monitoring the child process memory.
   * Uses async self-scheduling loop instead of setInterval for non-blocking.
   * Performs an immediate check, then polls at regular intervals.
   */
  start(): void {
    if (!this.child.pid) return;
    this.state = MonitorState.Running;
    void this.checkMemory();
  }

  /**
   * Schedule the next memory check after the configured interval.
   */
  private scheduleNextCheck(): void {
    if (this.state !== MonitorState.Running) return;

    this.nextCheckId = setTimeout(() => {
      void this.checkMemory();
    }, MEMORY_CHECK_INTERVAL);
  }

  /**
   * Perform async memory check and schedule next one.
   */
  private async checkMemory(): Promise<void> {
    if (this.state !== MonitorState.Running || !this.child.pid) return;

    let memoryBytes: number | undefined;
    try {
      memoryBytes = await this.getMemoryFn(this.child.pid);
    } catch {
      // Memory reading failed, schedule next check and continue
      this.scheduleNextCheck();
      return;
    }

    // Re-check after async operation - state may have changed
    if (this.state !== MonitorState.Running) return; // eslint-disable-line @typescript-eslint/no-unnecessary-condition

    // Track current memory
    if (memoryBytes !== undefined) {
      this.currentMemoryMB = Math.ceil(memoryBytes / 1024 / 1024);
      this.onMemoryUpdate?.(this.currentMemoryMB);
    }

    if (memoryBytes !== undefined && memoryBytes >= this.limitBytes) {
      this.terminateProcess(memoryBytes);
    } else {
      this.scheduleNextCheck();
    }
  }

  /**
   * Stop monitoring and cancel any pending timeouts.
   */
  stop(): void {
    if (this.state !== MonitorState.Killed) {
      this.state = MonitorState.Stopped;
    }
    if (this.nextCheckId) {
      clearTimeout(this.nextCheckId);
      this.nextCheckId = undefined;
    }
    if (this.killTimeoutId) {
      clearTimeout(this.killTimeoutId);
      this.killTimeoutId = undefined;
    }
  }

  /**
   * Terminate the child process due to memory limit exceeded.
   */
  private terminateProcess(currentMemoryBytes: number): void {
    if (this.state === MonitorState.Killed) return;
    this.state = MonitorState.Killed;

    // Clear only the next check timeout, keep killTimeoutId for cleanup
    if (this.nextCheckId) {
      clearTimeout(this.nextCheckId);
      this.nextCheckId = undefined;
    }

    // Kill first, then notify - ensures termination even if callback throws
    this.killTimeoutId = killGracefully(this.child);

    const info: MemoryLimitExceeded = {
      used: Math.ceil(currentMemoryBytes / 1024 / 1024),
      limit: this.memoryLimit,
    };

    try {
      this.onExceeded?.(info);
    } catch {
      // Ignore callback errors - kill already initiated
    }
  }

  /**
   * Check if the process was killed due to memory limit.
   */
  wasKilledByMemoryLimit(): boolean {
    return this.state === MonitorState.Killed;
  }

  /**
   * Get current memory in MB.
   * Returns 0 if no memory has been recorded yet.
   */
  getCurrentMemoryMB(): number {
    return this.currentMemoryMB;
  }
}
