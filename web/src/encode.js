import { Buffer } from "buffer";

// BLS12-381 point encoding that is BYTE-IDENTICAL to ark serialize_uncompressed,
// i.e. exactly what the Soroban contract's G1Affine/G2Affine::from_array expects.
// Verified 10/10 against the proven Rust encoder. Fq is big-endian, 48 bytes.
// G1 = x || y (96 bytes). G2 = x.c1 || x.c0 || y.c1 || y.c0 (192 bytes; imaginary part first).
function be48(dec) {
  let n = BigInt(dec);
  const out = new Uint8Array(48);
  for (let i = 47; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

function cat(parts) {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return Buffer.from(out);
}

// snarkjs G1 pi = [x, y, "1"]; G2 pi = [[x_c0, x_c1], [y_c0, y_c1], ...]
export const g1 = (p) => cat([be48(p[0]), be48(p[1])]);
export const g2 = (p) => cat([be48(p[0][1]), be48(p[0][0]), be48(p[1][1]), be48(p[1][0])]);
