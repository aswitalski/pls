import os from 'os';

export interface SystemInfo {
  platform: string;
  shell: string;
}

export function getSystemInfo(): SystemInfo {
  const platform = os.platform();
  const release = os.release();
  const shell = process.env.SHELL?.split('/').pop() || 'unknown';

  // Format OS name with version
  let osName: string;
  if (platform === 'darwin') {
    // Extract major.minor from Darwin version (e.g., "23.5.0" -> macOS 14.5)
    const parts = release.split('.');
    const darwinMajor = parseInt(parts[0], 10);
    const macOSMajor = darwinMajor - 9; // Darwin 23 = macOS 14
    const macOSMinor = parts[1] || '0';
    osName = `macOS ${macOSMajor}.${macOSMinor}`;
  } else if (platform === 'win32') {
    osName = `Windows ${release}`;
  } else {
    osName = `Linux ${release}`;
  }

  return { platform: osName, shell };
}

export function formatSystemContext(action: string): string {
  const info = getSystemInfo();
  return (
    `  - accepted schedule: "${action}"\n` +
    `  - operating system: ${info.platform}\n` +
    `  - shell: ${info.shell}`
  );
}
