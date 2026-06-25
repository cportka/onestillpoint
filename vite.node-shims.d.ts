// Minimal Node typings for vite.config.ts *only*.
//
// We deliberately do NOT depend on @types/node: adding it to the global `types`
// would pull Node's `setTimeout`/`clearTimeout` into every src file and shadow the
// DOM ones (settings.ts relies on `clearTimeout(timer: number)`). This ambient
// declaration covers exactly the one fs call the overlay-inlining plugin needs, and
// is pulled in by a triple-slash reference from vite.config.ts — nowhere else.
declare module 'node:fs' {
  export function readFileSync(path: URL, encoding: 'utf8'): string;
}
