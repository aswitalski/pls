/**
 * Exit application after brief delay to allow UI to render
 */
export function exitApp(code: 0 | 1) {
  setTimeout(() => process.exit(code), 100);
}
