type ShaderMediaEntry = {
  bitmap: ImageBitmap | null;
  ready: boolean;
  settled: Promise<void>;
  url: string;
};

const entries = new Map<string, ShaderMediaEntry>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

async function decodeEntry(entry: ShaderMediaEntry): Promise<void> {
  try {
    const response = await fetch(entry.url);
    entry.bitmap = response.ok
      ? await createImageBitmap(await response.blob())
      : null;
    entry.ready = entry.bitmap !== null;
  } catch {
    entry.ready = false;
  }
  notify();
}

function loadEntry(url: string): ShaderMediaEntry {
  const entry: ShaderMediaEntry = {
    bitmap: null,
    ready: false,
    settled: Promise.resolve(),
    url,
  };
  entry.settled = decodeEntry(entry);
  return entry;
}

export function syncShaderMediaRegistry(
  desired: ReadonlyMap<string, string>,
): void {
  let changed = false;
  for (const [assetId, entry] of entries) {
    if (desired.get(assetId) !== entry.url) {
      entry.bitmap?.close();
      entries.delete(assetId);
      changed = true;
    }
  }
  for (const [assetId, url] of desired) {
    const existing = entries.get(assetId);
    if (existing?.url === url) continue;
    entries.set(assetId, loadEntry(url));
    changed = true;
  }
  if (changed) notify();
}

export function getShaderMediaBitmap(
  assetId: string,
): ImageBitmap | undefined {
  const entry = entries.get(assetId);
  return entry?.ready && entry.bitmap ? entry.bitmap : undefined;
}

export async function settleShaderMediaImage(
  assetId: string,
): Promise<boolean> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const entry = entries.get(assetId);
    if (entry) {
      await entry.settled;
      return entry.ready;
    }
    if (Date.now() >= deadline) return false;
    await new Promise<void>((resolve) => {
      const unsubscribe = subscribeShaderMediaRegistry(() => {
        unsubscribe();
        resolve();
      });
    });
  }
}

export function subscribeShaderMediaRegistry(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearShaderMediaRegistry(): void {
  if (entries.size === 0) return;
  for (const entry of entries.values()) entry.bitmap?.close();
  entries.clear();
  notify();
}
