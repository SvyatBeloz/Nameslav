/**
 * Parses the PORT env var. Unset/empty -> `fallback`. Fails fast on anything
 * that is not a usable TCP port.
 *
 * Number("nonsense") is NaN, which Express forwards straight to net.listen():
 * the process then dies with a raw ERR_SOCKET_BAD_PORT stack instead of the
 * fail-fast message every other setting in this directory produces.
 */
export function parsePort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  // Matched as a digit literal first, for the same reason the share token's
  // timestamp is: Number() reads "0x10" as 16 and "3e3" as 3000, so a typo in
  // the deployment config would quietly bind a port nobody asked for.
  const port = /^\d+$/.test(raw.trim()) ? Number(raw) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Некорректное значение PORT: "${raw}". Ожидается целое число от 1 до 65535`);
  }
  return port;
}
