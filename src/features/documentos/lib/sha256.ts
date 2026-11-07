export async function sha256Hex(dados: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', dados instanceof Uint8Array ? dados : new Uint8Array(dados));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
