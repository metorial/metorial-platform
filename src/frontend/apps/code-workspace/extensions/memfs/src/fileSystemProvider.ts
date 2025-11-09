/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';

let PQueue = import('p-queue').then(m => m.default || m);

interface FileInfo {
  path: string;
  size: number;
  content_type: string;
  modified_at: string;
}

interface QueuedOperation {
  type: 'put' | 'delete';
  uri: vscode.Uri;
  content?: Uint8Array;
  contentType?: string;
  timestamp: number;
}

export class File implements vscode.FileStat {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;

  name: string;
  data?: Uint8Array;

  constructor(name: string) {
    this.type = vscode.FileType.File;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
  }
}

export class Directory implements vscode.FileStat {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;

  name: string;
  entries: Map<string, File | Directory>;

  constructor(name: string) {
    this.type = vscode.FileType.Directory;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
    this.entries = new Map();
  }
}

export type Entry = File | Directory;

export class MemFS implements vscode.FileSystemProvider {
  root = new Directory('');
  remoteRoot = this.root;
  remoteConfig: { id?: string; token?: string; apiUrl: string };
  pathPrefix = '';

  // Operation queue and throttling
  private operationQueue: QueuedOperation[] = [];
  private isProcessingQueue = false;
  private queueProcessingDelay = 1000; // 1 second throttle
  private maxQueueSize = 100;
  private queueTimer?: NodeJS.Timeout;

  // Loading state
  private isLoaded = false;
  private loadingPromise?: Promise<void>;

  constructor(apiUrl: string = 'http://localhost:8080') {
    this.remoteConfig = { apiUrl };
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    await this.ensureLoaded();

    const entry = await this._lookup(uri, false);
    return entry;
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    await this.ensureLoaded();

    const entry = await this._lookupAsDirectory(uri, false);
    const result: [string, vscode.FileType][] = [];

    for (const [name, child] of entry.entries) {
      result.push([name, child.type]);
    }

    return result;
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    await this.ensureLoaded();

    const file = await this._lookupAsFile(uri, false);

    if (file.data) {
      return file.data;
    }

    throw vscode.FileSystemError.FileNotFound();
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): Promise<void> {
    await this.ensureLoaded();

    const basename = path.posix.basename(uri.path);
    const parent = await this._lookupParentDirectory(uri);
    let entry = parent.entries.get(basename);

    if (entry instanceof Directory) {
      throw vscode.FileSystemError.FileIsADirectory(uri);
    }

    if (!entry && !options.create) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    if (entry && options.create && !options.overwrite) {
      throw vscode.FileSystemError.FileExists(uri);
    }

    if (!entry) {
      entry = new File(basename);
      parent.entries.set(basename, entry);
      this._fireSoon({ type: vscode.FileChangeType.Created, uri });
    }

    entry.mtime = Date.now();
    entry.size = content.byteLength;
    entry.data = content;

    this._fireSoon({ type: vscode.FileChangeType.Changed, uri });

    // Queue the remote operation
    this.queueOperation({
      type: 'put',
      uri,
      content,
      contentType: 'application/octet-stream',
      timestamp: Date.now()
    });
  }

  async rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { overwrite: boolean }
  ): Promise<void> {
    await this.ensureLoaded();

    if (!options.overwrite && (await this._lookup(newUri, true))) {
      throw vscode.FileSystemError.FileExists(newUri);
    }

    const entry = await this._lookup(oldUri, false);
    const oldParent = await this._lookupParentDirectory(oldUri);
    const newParent = await this._lookupParentDirectory(newUri);
    const newName = path.posix.basename(newUri.path);

    oldParent.entries.delete(entry.name);
    entry.name = newName;
    newParent.entries.set(newName, entry);

    this._fireSoon(
      { type: vscode.FileChangeType.Deleted, uri: oldUri },
      { type: vscode.FileChangeType.Created, uri: newUri }
    );

    // Queue remote operations
    this.queueOperation({
      type: 'delete',
      uri: oldUri,
      timestamp: Date.now()
    });

    if (entry instanceof File && entry.data) {
      this.queueOperation({
        type: 'put',
        uri: newUri,
        content: entry.data,
        contentType: 'application/octet-stream',
        timestamp: Date.now()
      });
    }
  }

  async delete(uri: vscode.Uri): Promise<void> {
    await this.ensureLoaded();

    const dirname = uri.with({ path: path.posix.dirname(uri.path) });
    const basename = path.posix.basename(uri.path);
    const parent = await this._lookupAsDirectory(dirname, false);

    if (!parent.entries.has(basename)) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    parent.entries.delete(basename);
    parent.mtime = Date.now();
    parent.size -= 1;

    this._fireSoon(
      { type: vscode.FileChangeType.Changed, uri: dirname },
      { uri, type: vscode.FileChangeType.Deleted }
    );

    // Queue the remote operation
    this.queueOperation({
      type: 'delete',
      uri,
      timestamp: Date.now()
    });
  }

  async createDirectory(uri: vscode.Uri): Promise<void> {
    await this.ensureLoaded();

    const basename = path.posix.basename(uri.path);
    const dirname = uri.with({ path: path.posix.dirname(uri.path) });
    const parent = await this._lookupAsDirectory(dirname, false);

    const entry = new Directory(basename);
    parent.entries.set(entry.name, entry);
    parent.mtime = Date.now();
    parent.size += 1;

    this._fireSoon(
      { type: vscode.FileChangeType.Changed, uri: dirname },
      { type: vscode.FileChangeType.Created, uri }
    );
  }

  // --- lookup

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    if (!this.remoteConfig.token) return;

    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this.loadAllFiles();
    await this.loadingPromise;
  }

  private _lookup(uri: vscode.Uri, silent: false): Promise<Entry>;
  private _lookup(uri: vscode.Uri, silent: boolean): Promise<Entry | undefined>;
  private async _lookup(uri: vscode.Uri, silent: boolean): Promise<Entry | undefined> {
    if (!this.remoteConfig.token) {
      let parts = uri.path.split('/').filter(Boolean);

      if (parts.length >= 2) {
        let [tokenId, name] = parts;
        const [mtbucket, base64Json] = tokenId.split('::');
        if (mtbucket !== 'mtbucket') {
          throw vscode.FileSystemError.FileNotFound(uri);
        }

        this.pathPrefix = `/${tokenId}/${name}`;

        let data = JSON.parse(atob(base64Json)) as { id: string; token: string; url: string };

        this.remoteConfig.id = data.id;
        this.remoteConfig.token = data.token;
        this.remoteConfig.apiUrl = data.url;

        let dir1 = new Directory(tokenId);
        let dir2 = new Directory(name);
        dir1.entries.set(dir2.name, dir2);
        this.root.entries.set(dir1.name, dir1);
        dir2.mtime = Date.now();
        dir2.size = 1;

        this.remoteRoot = dir2;

        this.root.mtime = Date.now();
        this.root.size += 1;

        this._fireSoon(
          { type: vscode.FileChangeType.Created, uri: uri.with({ path: `/${tokenId}` }) },
          {
            type: vscode.FileChangeType.Created,
            uri: uri.with({ path: `/${tokenId}/${name}` })
          },
          { type: vscode.FileChangeType.Changed, uri: uri.with({ path: '/' }) }
        );
      } else {
        return undefined;
      }
    }

    await this.ensureLoaded();

    const parts = uri.path.split('/');
    let entry: Entry = this.root;
    for (const part of parts) {
      if (!part) {
        continue;
      }
      let child: Entry | undefined;
      if (entry instanceof Directory) {
        child = entry.entries.get(part);
      }
      if (!child) {
        if (!silent) {
          throw vscode.FileSystemError.FileNotFound(uri);
        } else {
          return undefined;
        }
      }
      entry = child;
    }
    return entry;
  }

  private async _lookupAsDirectory(uri: vscode.Uri, silent: boolean): Promise<Directory> {
    const entry = await this._lookup(uri, silent);
    if (entry instanceof Directory) {
      return entry;
    }
    throw vscode.FileSystemError.FileNotADirectory(uri);
  }

  private async _lookupAsFile(uri: vscode.Uri, silent: boolean): Promise<File> {
    const entry = await this._lookup(uri, silent);
    if (entry instanceof File) {
      return entry;
    }
    throw vscode.FileSystemError.FileIsADirectory(uri);
  }

  private async _lookupParentDirectory(uri: vscode.Uri): Promise<Directory> {
    const dirname = uri.with({ path: path.posix.dirname(uri.path) });
    return await this._lookupAsDirectory(dirname, false);
  }

  // --- manage file events

  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  private _bufferedEvents: vscode.FileChangeEvent[] = [];
  private _fireSoonHandle?: NodeJS.Timeout;

  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

  watch(_resource: vscode.Uri): vscode.Disposable {
    // ignore, fires for all changes...
    return new vscode.Disposable(() => {});
  }

  private _fireSoon(...events: vscode.FileChangeEvent[]): void {
    this._bufferedEvents.push(...events);

    if (this._fireSoonHandle) {
      clearTimeout(this._fireSoonHandle);
    }

    this._fireSoonHandle = setTimeout(() => {
      this._emitter.fire(this._bufferedEvents);
      this._bufferedEvents.length = 0;
    }, 5);
  }

  // Remote operations

  private async makeRequest(
    method: string,
    url: string,
    body?: any,
    contentType?: string
  ): Promise<Response> {
    if (!this.remoteConfig.token) {
      throw new Error('Remote config not initialized');
    }

    const headers: Record<string, string> = {};

    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    let fullUrl = new URL(this.remoteConfig.apiUrl);
    fullUrl.pathname = url;
    fullUrl.searchParams.set('metorial-code-bucket-id', this.remoteConfig.id!);
    fullUrl.searchParams.set('metorial-code-bucket-token', this.remoteConfig.token!);

    const response = await fetch(fullUrl, {
      method,
      headers,
      body: body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  private async loadAllFiles(): Promise<void> {
    if (!this.remoteConfig || this.isLoaded) {
      return;
    }

    try {
      const response = await this.makeRequest('GET', `/files`);

      // @ts-ignore
      const files: FileInfo[] = await response.json();

      // Clear existing entries (except the root structure)
      // this.root.entries.clear();

      // // Recreate directory structure

      // const rootDir = new Directory(this.pathPrefix);
      // this.root.entries.set(this.pathPrefix, rootDir);

      let Q = await PQueue;
      let queue = new Q({
        concurrency: 20
      });

      // Load each file
      for (const fileInfo of files) {
        queue.add(() => this.loadFile(fileInfo));
      }

      await queue.onIdle();

      this.isLoaded = true;
    } catch (error) {
      console.error('MemFS: Failed to load files from remote:', error);
      throw error;
    }
  }

  private async loadFile(fileInfo: FileInfo): Promise<void> {
    if (!this.remoteConfig) {
      return;
    }

    try {
      let apiPath = this.getApiPath(vscode.Uri.parse(fileInfo.path));
      if (!apiPath.startsWith('/')) apiPath = `/${apiPath}`;

      // Get file content
      const response = await this.makeRequest('GET', `/files${apiPath}`);

      const content = new Uint8Array(await response.arrayBuffer());

      // Create file structure in memory
      const fullPath = this.getFullPath(fileInfo.path);
      const uri = vscode.Uri.parse(`memfs:${fullPath}`);

      this.createFileInMemory(uri, content, new Date(fileInfo.modified_at).getTime());
    } catch (error) {
      console.error(`MemFS: Failed to load file ${fileInfo.path}:`, error);
    }
  }

  private createFileInMemory(uri: vscode.Uri, content: Uint8Array, mtime: number): void {
    const basename = path.posix.basename(uri.path);
    const parent = this.ensureParentDirectory(uri);

    const file = new File(basename);
    file.data = content;
    file.size = content.byteLength;
    file.mtime = mtime;
    file.ctime = mtime;

    parent.entries.set(basename, file);
  }

  private ensureParentDirectory(uri: vscode.Uri): Directory {
    const parts = uri.path.split('/').filter(Boolean);
    let current: Entry = this.root;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];

      if (current instanceof Directory) {
        let child = current.entries.get(part);

        if (!child) {
          child = new Directory(part);
          current.entries.set(part, child);
        }

        if (child instanceof Directory) {
          current = child;
        } else {
          throw new Error(`Path conflict: ${part} is not a directory`);
        }
      }
    }

    return current as Directory;
  }

  private getFullPath(filePath: string): string {
    if (!this.remoteConfig.token) {
      return filePath;
    }

    return `${this.pathPrefix}/${filePath}`;
  }

  private getApiPath(uri: vscode.Uri): string {
    if (!this.remoteConfig.token) {
      throw new Error('Remote config not initialized');
    }

    if (uri.path.startsWith(this.pathPrefix)) {
      return uri.path.substring(this.pathPrefix.length);
    }

    return uri.path;
  }

  private queueOperation(operation: QueuedOperation): void {
    // Remove any existing operations for the same URI
    this.operationQueue = this.operationQueue.filter(
      op => op.uri.toString() !== operation.uri.toString()
    );

    // Add new operation
    this.operationQueue.push(operation);

    // Limit queue size
    if (this.operationQueue.length > this.maxQueueSize) {
      this.operationQueue = this.operationQueue.slice(-this.maxQueueSize);
    }

    this.scheduleQueueProcessing();
  }

  private scheduleQueueProcessing(): void {
    if (this.queueTimer) {
      clearTimeout(this.queueTimer);
    }

    this.queueTimer = setTimeout(() => {
      this.processQueue();
    }, this.queueProcessingDelay);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const operations = [...this.operationQueue];
      this.operationQueue = [];

      for (const operation of operations) {
        try {
          await this.executeOperation(operation);
        } catch (error) {
          console.error(
            `MemFS: Failed to execute operation ${operation.type} on ${operation.uri.path}:`,
            error
          );
        }
      }
    } finally {
      this.isProcessingQueue = false;

      // Process any operations that were queued while we were processing
      if (this.operationQueue.length > 0) {
        this.scheduleQueueProcessing();
      }
    }
  }

  private async executeOperation(operation: QueuedOperation): Promise<void> {
    if (!this.remoteConfig.token) {
      throw new Error('Remote config not initialized');
    }

    let apiPath = this.getApiPath(operation.uri);
    if (!apiPath.startsWith('/')) apiPath = `/${apiPath}`;
    const url = `/files${apiPath}`;

    switch (operation.type) {
      case 'put':
        if (operation.content) {
          await this.makeRequest('PUT', url, operation.content, operation.contentType);
        }
        break;

      case 'delete':
        await this.makeRequest('DELETE', url);
        break;
    }
  }
}
