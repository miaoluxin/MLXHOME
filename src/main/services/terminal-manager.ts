import { spawn, IPty } from '@lydell/node-pty';
import { EventEmitter } from 'events';

interface TerminalSession {
  pty: IPty;
  callbacks: Array<(data: string) => void>;
  label: string;
  createdAt: number;
}

export type SessionEventType = 'session-created' | 'session-closed' | 'output' | 'label-changed';

export class TerminalManager extends EventEmitter {
  private sessions = new Map<string, TerminalSession>();
  private pendingLaunch = new Set<string>();
  private launchTimers = new Map<string, NodeJS.Timeout>();
  private launchCommands = new Map<string, string>();

  private genId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  create(options: { cwd: string; cols?: number; rows?: number; command?: string; label?: string }): string {
    const id = this.genId();
    const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
    const shellArgs = process.platform === 'win32' ? [] : [];

    const pty = spawn(shell, shellArgs, {
      name: 'xterm-256color',
      cols: options.cols ?? 120,
      rows: options.rows ?? 40,
      cwd: options.cwd,
      env: { ...process.env, TERM: 'xterm-256color' } as any,
    });

    const session: TerminalSession = {
      pty,
      callbacks: [],
      label: options.label ?? `终端 ${id.slice(0, 4)}`,
      createdAt: Date.now(),
    };
    this.sessions.set(id, session);

    pty.onData((data: string) => {
      for (const cb of session.callbacks) {
        cb(data);
      }
      this.emit('output', id, data);
    });

    const startCommand = options.command ?? 'claude';
    this.pendingLaunch.add(id);
    this.launchCommands.set(id, startCommand);

    const fallbackTimer = setTimeout(() => {
      if (this.pendingLaunch.has(id)) {
        this.pendingLaunch.delete(id);
        this.launchCommands.delete(id);
        pty.write(`${startCommand}\r`);
      }
    }, 2000);
    this.launchTimers.set(id, fallbackTimer);

    this.emit('session-created', id, session.label);
    return id;
  }

  onData(sessionId: string, callback: (data: string) => void): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.callbacks.push(callback);
    }
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.write(data);
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.resize(cols, rows);

      if (this.pendingLaunch.has(sessionId)) {
        this.pendingLaunch.delete(sessionId);
        const timer = this.launchTimers.get(sessionId);
        if (timer) { clearTimeout(timer); this.launchTimers.delete(sessionId); }
        const command = this.launchCommands.get(sessionId) ?? 'claude';
        this.launchCommands.delete(sessionId);
        session.pty.write(`${command}\r`);
      }
    }
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.kill();
      this.sessions.delete(sessionId);
    }
    this.pendingLaunch.delete(sessionId);
    const timer = this.launchTimers.get(sessionId);
    if (timer) { clearTimeout(timer); this.launchTimers.delete(sessionId); }
    this.launchCommands.delete(sessionId);
    this.emit('session-closed', sessionId);
  }

  rename(sessionId: string, label: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.label = label;
      this.emit('label-changed', sessionId, label);
    }
  }
}

let instance: TerminalManager | null = null;

export function getTerminalManager(): TerminalManager {
  if (!instance) {
    instance = new TerminalManager();
  }
  return instance;
}
