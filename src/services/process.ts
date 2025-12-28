/**
 * Process control abstraction for testability
 * Allows mocking process.exit() in tests
 */
export interface ProcessControl {
  exit(code: number): void;
}

export const defaultProcessControl: ProcessControl = {
  exit: (code: number) => process.exit(code),
};

/**
 * Exit application after brief delay to allow UI to render
 */
export function exitApp(
  code: 0 | 1,
  processControl: ProcessControl = defaultProcessControl
) {
  setTimeout(() => {
    processControl.exit(code);
  }, 100);
}
