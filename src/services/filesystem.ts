import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { dirname } from 'path';

/**
 * File system abstraction for testability
 * Allows swapping between real fs and in-memory implementation
 */
export interface FileSystem {
  exists(path: string): boolean;
  readFile(path: string, encoding: 'utf-8'): string;
  writeFile(path: string, data: string): void;
  appendFile(path: string, data: string): void;
  readDirectory(path: string): string[];
  createDirectory(path: string, options?: { recursive?: boolean }): void;
  rename(oldPath: string, newPath: string): void;
  remove(path: string): void;
}

/**
 * Real filesystem implementation using Node's fs module
 */
export class RealFileSystem implements FileSystem {
  exists(path: string): boolean {
    return existsSync(path);
  }

  readFile(path: string, encoding: 'utf-8'): string {
    return readFileSync(path, encoding);
  }

  writeFile(path: string, data: string): void {
    writeFileSync(path, data, 'utf-8');
  }

  appendFile(path: string, data: string): void {
    appendFileSync(path, data, 'utf-8');
  }

  readDirectory(path: string): string[] {
    return readdirSync(path);
  }

  createDirectory(path: string, options?: { recursive?: boolean }): void {
    mkdirSync(path, options);
  }

  rename(oldPath: string, newPath: string): void {
    renameSync(oldPath, newPath);
  }

  remove(path: string): void {
    unlinkSync(path);
  }
}

/**
 * In-memory filesystem implementation for testing
 * Simulates filesystem behavior without touching disk
 */
export class MemoryFileSystem implements FileSystem {
  private files = new Map<string, string>();
  private directories = new Set<string>();

  exists(path: string): boolean {
    return this.files.has(path) || this.directories.has(path);
  }

  readFile(path: string, _encoding: 'utf-8'): string {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return content;
  }

  writeFile(path: string, data: string): void {
    // Auto-create parent directories
    const dir = dirname(path);
    if (dir !== '.' && dir !== path) {
      this.createDirectory(dir, { recursive: true });
    }
    this.files.set(path, data);
  }

  appendFile(path: string, data: string): void {
    // Auto-create parent directories (consistent with writeFile)
    const dir = dirname(path);
    if (dir !== '.' && dir !== path) {
      this.createDirectory(dir, { recursive: true });
    }
    const existing = this.files.get(path) ?? '';
    this.files.set(path, existing + data);
  }

  readDirectory(path: string): string[] {
    if (!this.directories.has(path)) {
      throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
    }

    const results: string[] = [];
    const prefix = path.endsWith('/') ? path : `${path}/`;

    // Find all direct children (files and directories)
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(prefix)) {
        const relative = filePath.slice(prefix.length);
        const firstSlash = relative.indexOf('/');
        if (firstSlash === -1) {
          // Direct file child
          results.push(relative);
        }
      }
    }

    for (const dirPath of this.directories) {
      if (dirPath.startsWith(prefix) && dirPath !== path) {
        const relative = dirPath.slice(prefix.length);
        const firstSlash = relative.indexOf('/');
        if (firstSlash === -1) {
          // Direct directory child
          results.push(relative);
        }
      }
    }

    return results;
  }

  createDirectory(path: string, options?: { recursive?: boolean }): void {
    if (options?.recursive) {
      // Create all parent directories
      const parts = path.split('/').filter((p) => p);
      let current = path.startsWith('/') ? '/' : '';

      for (const part of parts) {
        current = current === '/' ? `/${part}` : `${current}/${part}`;
        this.directories.add(current);
      }
    } else {
      // Non-recursive: parent must exist
      const parent = dirname(path);
      if (parent !== '.' && parent !== path && !this.directories.has(parent)) {
        throw new Error(`ENOENT: no such file or directory, mkdir '${path}'`);
      }
      this.directories.add(path);
    }
  }

  rename(oldPath: string, newPath: string): void {
    const content = this.files.get(oldPath);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, rename '${oldPath}'`);
    }
    this.files.delete(oldPath);
    this.files.set(newPath, content);
  }

  remove(path: string): void {
    if (!this.files.has(path)) {
      throw new Error(`ENOENT: no such file or directory, unlink '${path}'`);
    }
    this.files.delete(path);
  }

  /**
   * Clear all files and directories (useful for test cleanup)
   */
  clear(): void {
    this.files.clear();
    this.directories.clear();
  }

  /**
   * Get all files for debugging
   */
  getFiles(): Map<string, string> {
    return new Map(this.files);
  }
}

/**
 * Default filesystem instance (uses real fs)
 * Services can accept optional FileSystem parameter for testing
 */
export const defaultFileSystem: FileSystem = new RealFileSystem();
