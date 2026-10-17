import {
  BATTERY_LEVEL,
  BATTERY_SERVICE,
  HEART_RATE_MEASUREMENT,
  HEART_RATE_SERVICE,
  parseHeartRate,
  usableBpm,
  type HeartPacket,
} from "./heart";

/**
 * A Bluetooth heart-rate sensor in the browser (Web Bluetooth): any strap or arm band with the standard Heart Rate
 * Service. Chrome and Edge on Android, Windows, macOS, ChromeOS and Linux have Web Bluetooth; Safari (every iPhone
 * browser) and Firefox don't, and the page says so instead of offering a button that can't work.
 *
 * The heart rate is read here, in the browser: only the 10-s samples of the workout are uploaded with the session
 * (never the RR intervals or the sensor's name). The paired sensor's id is remembered in this browser so the next
 * workout can reconnect without the picker where the browser allows it (navigator.bluetooth.getDevices).
 */

export type SensorState = "idle" | "connecting" | "connected" | "reconnecting" | "lost";

export type BleSupport = "ok" | "ios" | "unsupported" | "insecure";

interface BtCharacteristic extends EventTarget {
  value?: DataView;
  startNotifications(): Promise<BtCharacteristic>;
  readValue(): Promise<DataView>;
}
interface BtService {
  getCharacteristic(uuid: number): Promise<BtCharacteristic>;
}
interface BtServer {
  connected: boolean;
  connect(): Promise<BtServer>;
  disconnect(): void;
  getPrimaryService(uuid: number): Promise<BtService>;
}
interface BtDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BtServer;
  watchAdvertisements?: (o?: { signal?: AbortSignal }) => Promise<void>;
}
interface Bt {
  requestDevice(o: { filters: { services: number[] }[]; optionalServices?: number[] }): Promise<BtDevice>;
  getDevices?: () => Promise<BtDevice[]>;
  getAvailability?: () => Promise<boolean>;
}

const REMEMBER_KEY = "vvake-app-hr-sensor";

const bt = (): Bt | null => (typeof navigator !== "undefined" ? ((navigator as Navigator & { bluetooth?: Bt }).bluetooth ?? null) : null);

/** Whether this browser can pair a sensor, and if not why (for the honest note). */
export function bleSupport(): BleSupport {
  if (typeof window === "undefined") return "unsupported";
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (bt()) return window.isSecureContext ? "ok" : "insecure";
  return ios ? "ios" : "unsupported";
}

export function rememberedSensor(): { id: string; name: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(REMEMBER_KEY) ?? "null") as { id?: unknown; name?: unknown } | null;
    return v && typeof v.id === "string" ? { id: v.id, name: typeof v.name === "string" ? v.name : "" } : null;
  } catch {
    return null;
  }
}

export function forgetSensor() {
  try {
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // nothing kept
  }
}

export interface SensorEvents {
  onReading?: (bpm: number, p: HeartPacket) => void;
  onState?: (s: SensorState) => void;
  onBattery?: (pct: number) => void;
}

/** Retries after a drop: 1 s, 2 s, 4 s … up to this many before saying it's lost (a button reconnects). */
const MAX_RETRIES = 6;

export class HeartSensor {
  private device: BtDevice | null = null;
  private retries = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  state: SensorState = "idle";
  name = "";
  battery: number | null = null;
  bpm: number | null = null;

  constructor(private readonly ev: SensorEvents = {}) {}

  private set(s: SensorState) {
    this.state = s;
    this.ev.onState?.(s);
  }

  private onValue = (e: Event) => {
    const v = (e.target as BtCharacteristic).value;
    if (!v) return;
    const p = parseHeartRate(v);
    if (!usableBpm(p)) return;
    this.bpm = p.bpm;
    this.ev.onReading?.(p.bpm, p);
  };

  private onDisconnect = () => {
    if (this.closed) return;
    this.bpm = null;
    this.retry();
  };

  private retry() {
    if (this.closed || !this.device) return;
    if (this.retries >= MAX_RETRIES) return this.set("lost");
    this.set("reconnecting");
    const wait = 1000 * 2 ** this.retries++;
    this.timer = setTimeout(() => void this.attach().catch(() => this.retry()), wait);
  }

  private async attach() {
    const d = this.device;
    if (!d?.gatt) throw new Error("no gatt");
    const server = await d.gatt.connect();
    const hr = await (await server.getPrimaryService(HEART_RATE_SERVICE)).getCharacteristic(HEART_RATE_MEASUREMENT);
    hr.removeEventListener("characteristicvaluechanged", this.onValue);
    hr.addEventListener("characteristicvaluechanged", this.onValue);
    await hr.startNotifications();
    this.retries = 0;
    this.set("connected");
    // The battery, when the sensor has the standard Battery Service.
    try {
      const level = await (await server.getPrimaryService(BATTERY_SERVICE)).getCharacteristic(BATTERY_LEVEL);
      const v = await level.readValue();
      this.battery = v.getUint8(0);
      this.ev.onBattery?.(this.battery);
    } catch {
      this.battery = null;
    }
  }

  private use(d: BtDevice) {
    this.device?.removeEventListener("gattserverdisconnected", this.onDisconnect);
    this.device = d;
    this.name = d.name ?? "";
    d.addEventListener("gattserverdisconnected", this.onDisconnect);
    try {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ id: d.id, name: d.name ?? "" }));
    } catch {
      // not remembered: the picker shows next time
    }
  }

  /** Opens the browser's picker (must run from a tap) and connects. */
  async pair(): Promise<void> {
    const b = bt();
    if (!b) throw new Error("unsupported");
    this.closed = false;
    const d = await b.requestDevice({ filters: [{ services: [HEART_RATE_SERVICE] }], optionalServices: [BATTERY_SERVICE] });
    this.use(d);
    this.set("connecting");
    try {
      await this.attach();
    } catch (e) {
      this.set("idle");
      throw e;
    }
  }

  /**
   * Reconnects the sensor paired before, without the picker, where the browser keeps permitted devices
   * (getDevices). False when it can't (then a tap on "Connect" opens the picker).
   */
  async reconnectRemembered(): Promise<boolean> {
    const b = bt();
    const saved = rememberedSensor();
    if (!b?.getDevices || !saved) return false;
    try {
      const d = (await b.getDevices()).find((x) => x.id === saved.id);
      if (!d) return false;
      this.closed = false;
      this.use(d);
      this.set("connecting");
      // Some browsers only connect to a device they have just heard advertising.
      if (d.watchAdvertisements) {
        const ac = new AbortController();
        const heard = new Promise<void>((resolve) => d.addEventListener("advertisementreceived", () => resolve(), { once: true }));
        await d.watchAdvertisements({ signal: ac.signal }).catch(() => undefined);
        await Promise.race([heard, new Promise((r) => setTimeout(r, 6000))]);
        ac.abort();
      }
      await this.attach();
      return true;
    } catch {
      this.set("idle");
      return false;
    }
  }

  /** After "lost": try again (from a tap). */
  async retryNow() {
    this.retries = 0;
    if (this.device) {
      this.set("connecting");
      await this.attach().catch(() => this.retry());
    }
  }

  disconnect() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    try {
      this.device?.gatt?.disconnect();
    } catch {
      // already gone
    }
    this.bpm = null;
    this.set("idle");
  }
}
