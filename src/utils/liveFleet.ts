/**
 * liveFleet.ts — following a whole fleet on the live position stream.
 *
 * The stream is one long connection per unit, and the stream server speaks
 * HTTP/1.1, where a browser keeps at most 6 connections open to one server.
 * Live Monitoring used to open a stream for every unit at once: with 35 units,
 * 6 connected (the first 6 in the list, mostly silent ones) and the other 29
 * waited for good, so moving vehicles never appeared.
 *
 * Now, as in the mobile app:
 *   - the unit being looked at keeps its own stream, so it moves in real time;
 *   - every other unit is read in turn, a few at a time: open its stream, take
 *     the first frame that says something, close. One pass over 35 units takes
 *     about 15 seconds, then the next starts.
 * That leaves connections free for other screens, whatever the fleet size.
 */
import { liveStreamUrl, parseLiveFrame, type LiveFrame } from "./livePosition.ts";

/** What a stream needs from EventSource; tests pass a fake. */
export interface StreamLike {
  onmessage: ((ev: { data: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  close(): void;
}

export type OpenStream = (url: string) => StreamLike;

export interface LiveFleetOptions {
  /** The stream server, e.g. https://narvasocket.3dservices.co.ug */
  base: string;
  /** Every frame that says something: a position, or that the unit has no data. */
  onFrame: (imei: string, frame: Exclude<LiveFrame, { kind: "ignore" }>) => void;
  /** A unit's read ended without a frame: refused, unreachable or quiet. */
  onSilent?: (imei: string) => void;
  /** Units not to read now (an expired subscription). */
  skip?: (imei: string) => boolean;
  /** Reads at once. With the followed unit's stream that is 5 of the 6. */
  parallel?: number;
  /** How long one read waits for a frame. */
  waitMs?: number;
  /** Pause between passes over the fleet. */
  restMs?: number;
  /** Wait before reopening the followed unit's dropped stream. */
  retryMs?: number;
  open?: OpenStream;
}

export class LiveFleet {
  private readonly o: Required<Omit<LiveFleetOptions, "onSilent" | "skip">> &
    Pick<LiveFleetOptions, "onSilent" | "skip">;
  private units: string[] = [];
  private queue: string[] = [];
  private running = false;
  private workers = 0;
  private readonly reads = new Set<StreamLike>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private followed: string | null = null;
  private followStream: StreamLike | null = null;

  constructor(options: LiveFleetOptions) {
    this.o = {
      parallel: 4,
      waitMs: 8000,
      restMs: 5000,
      retryMs: 4000,
      open: (url) => new EventSource(url) as unknown as StreamLike,
      ...options,
    };
  }

  /** The units to follow. Units added later are read in the current pass. */
  setUnits(imeis: string[]) {
    const added = imeis.filter((i) => !this.units.includes(i));
    this.units = [...new Set(imeis)];
    this.queue = this.queue.filter((i) => this.units.includes(i));
    this.queue.push(...added);
    this.fill();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.queue = [...this.units];
    this.fill();
    if (this.followed) this.openFollowed(this.followed);
  }

  /** Closes every connection and pending retry; nothing reopens after this. */
  stop() {
    this.running = false;
    this.queue = [];
    this.reads.forEach((s) => close(s));
    this.reads.clear();
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    if (this.followStream) close(this.followStream);
    this.followStream = null;
  }

  /** Keep [imei]'s stream open (real time), or none. */
  follow(imei: string | null) {
    if (imei === this.followed) return;
    if (this.followStream) close(this.followStream);
    this.followStream = null;
    this.followed = imei;
    if (imei && this.running) this.openFollowed(imei);
  }

  private openFollowed(imei: string) {
    let s: StreamLike;
    try { s = this.o.open(liveStreamUrl(this.o.base, imei)); } catch { return; }
    this.followStream = s;
    s.onmessage = (ev) => {
      const frame = parseLiveFrame(ev.data, imei);
      if (frame.kind !== "ignore") this.o.onFrame(imei, frame);
    };
    // A dropped stream is normal (sleep, network change): reopen it while
    // the unit is still the one being looked at.
    s.onerror = () => {
      close(s);
      if (this.followStream !== s) return;
      this.followStream = null;
      this.later(() => {
        if (this.running && this.followed === imei && !this.followStream) this.openFollowed(imei);
      }, this.o.retryMs);
    };
  }

  private fill() {
    if (!this.running) return;
    while (this.workers < this.o.parallel && this.queue.length) {
      const imei = this.queue.shift()!;
      if (imei === this.followed || this.o.skip?.(imei)) continue;
      this.workers++;
      this.read(imei).then(() => {
        this.workers--;
        this.fill();
        this.restIfDone();
      });
    }
    this.restIfDone();
  }

  /** The pass is over: start the next one after a pause. */
  private restIfDone() {
    if (!this.running || this.workers || this.queue.length || this.resting) return;
    this.resting = true;
    this.later(() => {
      this.resting = false;
      if (!this.running) return;
      this.queue = [...this.units];
      this.fill();
    }, this.o.restMs);
  }
  private resting = false;

  /** One frame from [imei]'s stream, then the connection is closed. */
  private read(imei: string): Promise<void> {
    return new Promise((done) => {
      let s: StreamLike;
      try { s = this.o.open(liveStreamUrl(this.o.base, imei)); } catch {
        this.o.onSilent?.(imei);
        return done();
      }
      this.reads.add(s);
      let finished = false;
      const finish = (frame: Exclude<LiveFrame, { kind: "ignore" }> | null) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        this.timers.delete(timer);
        close(s);
        this.reads.delete(s);
        if (this.running) {
          if (frame) this.o.onFrame(imei, frame);
          else this.o.onSilent?.(imei);
        }
        done();
      };
      const timer = this.later(() => finish(null), this.o.waitMs);
      s.onmessage = (ev) => {
        const frame = parseLiveFrame(ev.data, imei);
        if (frame.kind !== "ignore") finish(frame);
      };
      s.onerror = () => finish(null);
    });
  }

  private later(fn: () => void, ms: number) {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
    return t;
  }
}

function close(s: StreamLike) {
  s.onmessage = null;
  s.onerror = null;
  try { s.close(); } catch { /* already closed */ }
}

/**
 * A queue that runs at most [limit] tasks at once, for per-unit calls (100
 * of them fired together hold up every other request to the same server).
 */
export function limiter(limit: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  const next = () => {
    if (active >= limit || !waiting.length) return;
    active++;
    waiting.shift()!();
  };
  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      waiting.push(() => {
        task().then(resolve, reject).finally(() => { active--; next(); });
      });
      next();
    });
}
