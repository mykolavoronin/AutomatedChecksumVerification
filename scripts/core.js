var ChecksumCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/core.js
  var core_exports = {};
  __export(core_exports, {
    ALGORITHMS: () => ALGORITHMS,
    DEFAULT_SETTINGS: () => DEFAULT_SETTINGS,
    basename: () => basename,
    canonicalURL: () => canonicalURL,
    catalogForPage: () => catalogForPage,
    discoverURLs: () => discoverURLs,
    downloadDecision: () => downloadDecision,
    fileURL: () => fileURL,
    forFile: () => forFile,
    githubReleaseAssets: () => githubReleaseAssets,
    hashBlob: () => hashBlob,
    isDownloadURL: () => isDownloadURL,
    isPublicHTTPS: () => isPublicHTTPS,
    normalizeAlgorithm: () => normalizeAlgorithm,
    parseChecksums: () => parseChecksums,
    parseStructuredChecksums: () => parseStructuredChecksums,
    sanitizeSettings: () => sanitizeSettings,
    securityWarnings: () => securityWarnings,
    sidecarCandidates: () => sidecarCandidates,
    sidecarInfo: () => sidecarInfo,
    urlFilename: () => urlFilename,
    validEntry: () => validEntry,
    verify: () => verify
  });

  // node_modules/@noble/hashes/_u64.js
  var U32_MASK64 = /* @__PURE__ */ (() => BigInt(2 ** 32 - 1))();
  var _32n = /* @__PURE__ */ BigInt(32);
  function fromBig(n, le = false) {
    if (le)
      return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
    return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
  }
  function split(lst, le = false) {
    const len = lst.length;
    let Ah = new Uint32Array(len);
    let Al = new Uint32Array(len);
    for (let i = 0; i < len; i++) {
      const { h, l } = fromBig(lst[i], le);
      [Ah[i], Al[i]] = [h, l];
    }
    return [Ah, Al];
  }
  var fromNumH = (n) => n / 2 ** 32 | 0;
  var fromNumL = (n) => n >>> 0;
  function setU64FromNum(view, byteOffset, n, isLE2) {
    const h = fromNumH(n);
    const l = fromNumL(n);
    view.setUint32(byteOffset, isLE2 ? l : h, isLE2);
    view.setUint32(byteOffset + 4, isLE2 ? h : l, isLE2);
  }
  var shrSH = (h, _l, s) => h >>> s;
  var shrSL = (h, l, s) => h << 32 - s | l >>> s;
  var rotrSH = (h, l, s) => h >>> s | l << 32 - s;
  var rotrSL = (h, l, s) => h << 32 - s | l >>> s;
  var rotrBH = (h, l, s) => h << 64 - s | l >>> s - 32;
  var rotrBL = (h, l, s) => h >>> s - 32 | l << 64 - s;
  var rotr32H = (_h, l) => l;
  var rotr32L = (h, _l) => h;
  function add(Ah, Al, Bh, Bl) {
    const l = (Al >>> 0) + (Bl >>> 0);
    return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
  }
  var add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
  var add3H = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
  var add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
  var add4H = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
  var add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
  var add5H = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;

  // node_modules/@noble/hashes/utils.js
  function isBytes(a) {
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
  }
  var atitle = (title) => title ? `"${title}" ` : "";
  function anumber(n, title = "") {
    if (typeof n !== "number")
      throw new TypeError(atitle(title) + "expected number, got " + typeof n);
    if (!Number.isSafeInteger(n) || n < 0)
      throw new RangeError(atitle(title) + "expected integer >= 0, got " + n);
    return n;
  }
  function abool(value, title = "") {
    if (typeof value !== "boolean")
      throw new TypeError(atitle(title) + "expected boolean, got type=" + typeof value);
    return value;
  }
  function abytes(value, length, title = "") {
    if (isBytes(value) && (length === void 0 || value.length === length))
      return value;
    if (length !== void 0)
      anumber(length, "length");
    const bytes = isBytes(value);
    const ofLen = length !== void 0 ? ` of length ${length}` : "";
    const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
    const message = atitle(title) + "expected Uint8Array" + ofLen + ", got " + got;
    if (!bytes)
      throw new TypeError(message);
    throw new RangeError(message);
  }
  function copyBytes(bytes) {
    return Uint8Array.from(abytes(bytes));
  }
  var aobject = (value, label) => {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new TypeError((label === "object" ? "" : `"${label}" `) + "expected object, got type=" + typeof value);
  };
  var aopts = (value, label) => {
    aobject(value, label);
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null)
      throw new TypeError(`"${label}" expected plain object`);
    if (Object.hasOwn(value, "__proto__"))
      throw new TypeError(`"${label}.__proto__" is not allowed`);
  };
  function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
      throw new Error("hash was destroyed");
    if (checkFinished && instance.finished)
      throw new Error("digest() was already called");
  }
  function aoutput(out, instance) {
    abytes(out, void 0, "output");
    const min = instance.outputLen;
    if (!(out.length >= min)) {
      throw new RangeError('"output" expected length >= ' + min);
    }
  }
  function u8(arr) {
    return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  function u32(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
  }
  function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
      arrays[i].fill(0);
    }
  }
  function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  function rotr(word, shift) {
    return word << 32 - shift | word >>> shift;
  }
  function rotl(word, shift) {
    return word << shift | word >>> 32 - shift >>> 0;
  }
  var isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
  function byteSwap(word) {
    return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
  }
  var swap8IfBE = isLE ? (n) => n : (n) => byteSwap(n) >>> 0;
  function byteSwap32(arr) {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = byteSwap(arr[i]);
    }
    return arr;
  }
  var swap32IfBE = isLE ? (u) => u : byteSwap32;
  function checkOpts(defaults, opts, title = "opts") {
    aopts(defaults, "defaults");
    if (opts !== void 0)
      aopts(opts, title);
    const merged = Object.assign(/* @__PURE__ */ Object.create(null), defaults, opts);
    return merged;
  }
  function createHasher(hashCons, info = {}) {
    if (typeof hashCons !== "function")
      throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
    info = checkOpts({}, info, "info");
    const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
    const tmp = hashCons(void 0);
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.canXOF = tmp.canXOF;
    hashC.create = (opts) => hashCons(opts);
    Object.assign(hashC, info);
    return Object.freeze(hashC);
  }
  var oidNist = (suffix) => ({
    // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
    // Larger suffix values would need base-128 OID encoding and a different length byte.
    oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
  });

  // node_modules/@noble/hashes/_md.js
  function Chi(a, b, c) {
    return a & b ^ ~a & c;
  }
  function Maj(a, b, c) {
    return a & b ^ a & c ^ b & c;
  }
  var HashMD = class {
    blockLen;
    outputLen;
    canXOF = false;
    padOffset;
    isLE;
    // For partial updates less than block size
    buffer;
    view;
    finished = false;
    length = 0;
    pos = 0;
    destroyed = false;
    constructor(blockLen, outputLen, padOffset, isLE2) {
      this.blockLen = blockLen;
      this.outputLen = outputLen;
      this.padOffset = padOffset;
      this.isLE = isLE2;
      this.buffer = new Uint8Array(blockLen);
      this.view = createView(this.buffer);
    }
    update(data) {
      aexists(this);
      abytes(data);
      const { view, buffer, blockLen } = this;
      const len = data.length;
      let processed = false;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        if (take === blockLen) {
          const dataView = createView(data);
          for (; blockLen <= len - pos; pos += blockLen)
            this.process(dataView, pos);
          processed = true;
          continue;
        }
        buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        pos += take;
        if (this.pos === blockLen) {
          this.process(view, 0);
          this.pos = 0;
          processed = true;
        }
      }
      this.length += data.length;
      if (processed)
        this.roundClean();
      return this;
    }
    digestInto(out) {
      aexists(this);
      aoutput(out, this);
      this.finished = true;
      const { buffer, view, blockLen, isLE: isLE2 } = this;
      let { pos } = this;
      buffer[pos++] = 128;
      buffer.fill(0, pos);
      if (this.padOffset > blockLen - pos) {
        this.process(view, 0);
        buffer.fill(0);
      }
      setU64FromNum(view, blockLen - 8, this.length * 8, isLE2);
      this.process(view, 0);
      this.roundClean();
      const oview = out === buffer ? view : createView(out);
      const len = this.outputLen;
      const outLen = len / 4;
      const state = this.get();
      if (len % 4 || outLen > state.length)
        throw new Error("invalid outputLen");
      for (let i = 0; i < outLen; i++)
        oview.setUint32(4 * i, state[i], isLE2);
    }
    digest() {
      const { buffer, outputLen } = this;
      this.digestInto(buffer);
      const res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
    _cloneIntoMeta(to) {
      const { buffer, length, finished, destroyed, pos } = this;
      to.destroyed = destroyed;
      to.finished = finished;
      to.length = length;
      to.pos = pos;
      if (pos)
        to.buffer.set(buffer);
      return to;
    }
    clone() {
      return this._cloneInto();
    }
  };
  var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);
  var SHA224_IV = /* @__PURE__ */ Uint32Array.from([
    3238371032,
    914150663,
    812702999,
    4144912697,
    4290775857,
    1750603025,
    1694076839,
    3204075428
  ]);
  var SHA384_IV = /* @__PURE__ */ Uint32Array.from([
    3418070365,
    3238371032,
    1654270250,
    914150663,
    2438529370,
    812702999,
    355462360,
    4144912697,
    1731405415,
    4290775857,
    2394180231,
    1750603025,
    3675008525,
    1694076839,
    1203062813,
    3204075428
  ]);
  var SHA512_IV = /* @__PURE__ */ Uint32Array.from([
    1779033703,
    4089235720,
    3144134277,
    2227873595,
    1013904242,
    4271175723,
    2773480762,
    1595750129,
    1359893119,
    2917565137,
    2600822924,
    725511199,
    528734635,
    4215389547,
    1541459225,
    327033209
  ]);

  // node_modules/@noble/hashes/legacy.js
  var SHA1_IV = /* @__PURE__ */ Uint32Array.from([
    1732584193,
    4023233417,
    2562383102,
    271733878,
    3285377520
  ]);
  var SHA1_W = /* @__PURE__ */ new Uint32Array(80);
  var _SHA1 = class extends HashMD {
    A = SHA1_IV[0] | 0;
    B = SHA1_IV[1] | 0;
    C = SHA1_IV[2] | 0;
    D = SHA1_IV[3] | 0;
    E = SHA1_IV[4] | 0;
    constructor() {
      super(64, 20, 8, false);
    }
    get() {
      const { A, B: B2, C, D, E } = this;
      return [A, B2, C, D, E];
    }
    set(A, B2, C, D, E) {
      this.A = A | 0;
      this.B = B2 | 0;
      this.C = C | 0;
      this.D = D | 0;
      this.E = E | 0;
    }
    _cloneInto(to) {
      (to ||= new this.constructor()).set(...this.get());
      return this._cloneIntoMeta(to);
    }
    process(view, offset) {
      for (let i = 0; i < 16; i++, offset += 4)
        SHA1_W[i] = view.getUint32(offset, false);
      for (let i = 16; i < 80; i++)
        SHA1_W[i] = rotl(SHA1_W[i - 3] ^ SHA1_W[i - 8] ^ SHA1_W[i - 14] ^ SHA1_W[i - 16], 1);
      let { A, B: B2, C, D, E } = this;
      for (let i = 0; i < 80; i++) {
        let F, K2;
        if (i < 20) {
          F = Chi(B2, C, D);
          K2 = 1518500249;
        } else if (i < 40) {
          F = B2 ^ C ^ D;
          K2 = 1859775393;
        } else if (i < 60) {
          F = Maj(B2, C, D);
          K2 = 2400959708;
        } else {
          F = B2 ^ C ^ D;
          K2 = 3395469782;
        }
        const T = rotl(A, 5) + F + E + K2 + SHA1_W[i] | 0;
        E = D;
        D = C;
        C = rotl(B2, 30);
        B2 = A;
        A = T;
      }
      A = A + this.A | 0;
      B2 = B2 + this.B | 0;
      C = C + this.C | 0;
      D = D + this.D | 0;
      E = E + this.E | 0;
      this.set(A, B2, C, D, E);
    }
    roundClean() {
      clean(SHA1_W);
    }
    destroy() {
      this.destroyed = true;
      this.set(0, 0, 0, 0, 0);
      clean(this.buffer);
    }
  };
  var sha1 = /* @__PURE__ */ createHasher(() => new _SHA1());
  var p32 = /* @__PURE__ */ Math.pow(2, 32);
  var K = /* @__PURE__ */ Array.from({ length: 64 }, (_, i) => Math.floor(p32 * Math.abs(Math.sin(i + 1))));
  var MD5_IV = /* @__PURE__ */ SHA1_IV.slice(0, 4);
  var MD5_W = /* @__PURE__ */ new Uint32Array(16);
  var MD5_SHIFTS = /* @__PURE__ */ (() => {
    const S = [
      [7, 12, 17, 22],
      [5, 9, 14, 20],
      [4, 11, 16, 23],
      [6, 10, 15, 21]
    ];
    return Uint8Array.from({ length: 64 }, (_, i) => S[Math.floor(i / 16)][i % 4]);
  })();
  var _MD5 = class extends HashMD {
    A = MD5_IV[0] | 0;
    B = MD5_IV[1] | 0;
    C = MD5_IV[2] | 0;
    D = MD5_IV[3] | 0;
    constructor() {
      super(64, 16, 8, true);
    }
    get() {
      const { A, B: B2, C, D } = this;
      return [A, B2, C, D];
    }
    set(A, B2, C, D) {
      this.A = A | 0;
      this.B = B2 | 0;
      this.C = C | 0;
      this.D = D | 0;
    }
    _cloneInto(to) {
      (to ||= new this.constructor()).set(...this.get());
      return this._cloneIntoMeta(to);
    }
    process(view, offset) {
      for (let i = 0; i < 16; i++, offset += 4)
        MD5_W[i] = view.getUint32(offset, true);
      let { A, B: B2, C, D } = this;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) {
          F = Chi(B2, C, D);
          g = i;
        } else if (i < 32) {
          F = Chi(D, B2, C);
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          F = B2 ^ C ^ D;
          g = (3 * i + 5) % 16;
        } else {
          F = C ^ (B2 | ~D);
          g = 7 * i % 16;
        }
        F = F + A + K[i] + MD5_W[g];
        A = D;
        D = C;
        C = B2;
        B2 = B2 + rotl(F, MD5_SHIFTS[i]);
      }
      A = A + this.A | 0;
      B2 = B2 + this.B | 0;
      C = C + this.C | 0;
      D = D + this.D | 0;
      this.set(A, B2, C, D);
    }
    roundClean() {
      clean(MD5_W);
    }
    destroy() {
      this.destroyed = true;
      this.set(0, 0, 0, 0);
      clean(this.buffer);
    }
  };
  var md5 = /* @__PURE__ */ createHasher(() => new _MD5());
  var Rho160 = /* @__PURE__ */ Uint8Array.from([
    7,
    4,
    13,
    1,
    10,
    6,
    15,
    3,
    12,
    0,
    9,
    5,
    2,
    14,
    11,
    8
  ]);
  var Id160 = /* @__PURE__ */ (() => Uint8Array.from(new Array(16).fill(0).map((_, i) => i)))();
  var Pi160 = /* @__PURE__ */ (() => Id160.map((i) => (9 * i + 5) % 16))();
  var idxLR = /* @__PURE__ */ (() => {
    const L = [Id160];
    const R = [Pi160];
    const res = [L, R];
    for (let i = 0; i < 4; i++)
      for (let j of res)
        j.push(j[i].map((k) => Rho160[k]));
    return res;
  })();
  var idxL = /* @__PURE__ */ (() => idxLR[0])();
  var idxR = /* @__PURE__ */ (() => idxLR[1])();
  var shifts160 = /* @__PURE__ */ [
    [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8],
    [12, 13, 11, 15, 6, 9, 9, 7, 12, 15, 11, 13, 7, 8, 7, 7],
    [13, 15, 14, 11, 7, 7, 6, 8, 13, 14, 13, 12, 5, 5, 6, 9],
    [14, 11, 12, 14, 8, 6, 5, 5, 15, 12, 15, 14, 9, 9, 8, 6],
    [15, 12, 13, 13, 9, 5, 8, 6, 14, 11, 12, 11, 8, 6, 5, 5]
  ].map((i) => Uint8Array.from(i));
  var shiftsL160 = /* @__PURE__ */ idxL.map((idx, i) => idx.map((j) => shifts160[i][j]));
  var shiftsR160 = /* @__PURE__ */ idxR.map((idx, i) => idx.map((j) => shifts160[i][j]));
  var Kl160 = /* @__PURE__ */ Uint32Array.from([
    0,
    1518500249,
    1859775393,
    2400959708,
    2840853838
  ]);
  var Kr160 = /* @__PURE__ */ Uint32Array.from([
    1352829926,
    1548603684,
    1836072691,
    2053994217,
    0
  ]);
  function ripemd_f(group, x, y, z) {
    if (group === 0)
      return x ^ y ^ z;
    if (group === 1)
      return x & y | ~x & z;
    if (group === 2)
      return (x | ~y) ^ z;
    if (group === 3)
      return x & z | y & ~z;
    return x ^ (y | ~z);
  }
  var BUF_160 = /* @__PURE__ */ new Uint32Array(16);
  var _RIPEMD160 = class extends HashMD {
    h0 = 1732584193 | 0;
    h1 = 4023233417 | 0;
    h2 = 2562383102 | 0;
    h3 = 271733878 | 0;
    h4 = 3285377520 | 0;
    constructor() {
      super(64, 20, 8, true);
    }
    get() {
      const { h0, h1, h2, h3, h4 } = this;
      return [h0, h1, h2, h3, h4];
    }
    set(h0, h1, h2, h3, h4) {
      this.h0 = h0 | 0;
      this.h1 = h1 | 0;
      this.h2 = h2 | 0;
      this.h3 = h3 | 0;
      this.h4 = h4 | 0;
    }
    _cloneInto(to) {
      (to ||= new this.constructor()).set(...this.get());
      return this._cloneIntoMeta(to);
    }
    process(view, offset) {
      for (let i = 0; i < 16; i++, offset += 4)
        BUF_160[i] = view.getUint32(offset, true);
      let al = this.h0 | 0, ar = al, bl = this.h1 | 0, br = bl, cl = this.h2 | 0, cr = cl, dl = this.h3 | 0, dr = dl, el = this.h4 | 0, er = el;
      for (let group = 0; group < 5; group++) {
        const rGroup = 4 - group;
        const hbl = Kl160[group], hbr = Kr160[group];
        const rl = idxL[group], rr = idxR[group];
        const sl = shiftsL160[group], sr = shiftsR160[group];
        for (let i = 0; i < 16; i++) {
          const tl = rotl(al + ripemd_f(group, bl, cl, dl) + BUF_160[rl[i]] + hbl, sl[i]) + el | 0;
          al = el, el = dl, dl = rotl(cl, 10) | 0, cl = bl, bl = tl;
        }
        for (let i = 0; i < 16; i++) {
          const tr = rotl(ar + ripemd_f(rGroup, br, cr, dr) + BUF_160[rr[i]] + hbr, sr[i]) + er | 0;
          ar = er, er = dr, dr = rotl(cr, 10) | 0, cr = br, br = tr;
        }
      }
      this.set(this.h1 + cl + dr | 0, this.h2 + dl + er | 0, this.h3 + el + ar | 0, this.h4 + al + br | 0, this.h0 + bl + cr | 0);
    }
    roundClean() {
      clean(BUF_160);
    }
    destroy() {
      this.destroyed = true;
      clean(this.buffer);
      this.set(0, 0, 0, 0, 0);
    }
  };
  var ripemd160 = /* @__PURE__ */ createHasher(() => new _RIPEMD160());

  // node_modules/@noble/hashes/sha2.js
  var SHA256_K = /* @__PURE__ */ Uint32Array.from([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
  var SHA2_32B = class extends HashMD {
    // We cannot use array here since array allows indexing by variable
    // which means optimizer/compiler cannot use registers.
    // Numeric initializers matter: starting the fields as `undefined` changes
    // V8's field representation and makes sha256 3x slower (measured).
    A = 0;
    B = 0;
    C = 0;
    D = 0;
    E = 0;
    F = 0;
    G = 0;
    H = 0;
    constructor(outputLen, IV) {
      super(64, outputLen, 8, false);
      this.A = IV[0] | 0;
      this.B = IV[1] | 0;
      this.C = IV[2] | 0;
      this.D = IV[3] | 0;
      this.E = IV[4] | 0;
      this.F = IV[5] | 0;
      this.G = IV[6] | 0;
      this.H = IV[7] | 0;
    }
    get() {
      const { A, B: B2, C, D, E, F, G, H } = this;
      return [A, B2, C, D, E, F, G, H];
    }
    // prettier-ignore
    set(A, B2, C, D, E, F, G, H) {
      this.A = A | 0;
      this.B = B2 | 0;
      this.C = C | 0;
      this.D = D | 0;
      this.E = E | 0;
      this.F = F | 0;
      this.G = G | 0;
      this.H = H | 0;
    }
    _cloneInto(to) {
      (to ||= new this.constructor()).set(...this.get());
      return this._cloneIntoMeta(to);
    }
    process(view, offset) {
      for (let i = 0; i < 16; i++, offset += 4)
        SHA256_W[i] = view.getUint32(offset, false);
      for (let i = 16; i < 64; i++) {
        const W15 = SHA256_W[i - 15];
        const W2 = SHA256_W[i - 2];
        const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
        const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
        SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
      }
      let { A, B: B2, C, D, E, F, G, H } = this;
      for (let i = 0; i < 64; i++) {
        const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
        const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
        const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
        const T2 = sigma0 + Maj(A, B2, C) | 0;
        H = G;
        G = F;
        F = E;
        E = D + T1 | 0;
        D = C;
        C = B2;
        B2 = A;
        A = T1 + T2 | 0;
      }
      A = A + this.A | 0;
      B2 = B2 + this.B | 0;
      C = C + this.C | 0;
      D = D + this.D | 0;
      E = E + this.E | 0;
      F = F + this.F | 0;
      G = G + this.G | 0;
      H = H + this.H | 0;
      this.set(A, B2, C, D, E, F, G, H);
    }
    roundClean() {
      clean(SHA256_W);
    }
    destroy() {
      this.destroyed = true;
      this.set(0, 0, 0, 0, 0, 0, 0, 0);
      clean(this.buffer);
    }
  };
  var _SHA256 = class extends SHA2_32B {
    constructor() {
      super(32, SHA256_IV);
    }
  };
  var _SHA224 = class extends SHA2_32B {
    constructor() {
      super(28, SHA224_IV);
    }
  };
  var K512 = /* @__PURE__ */ (() => split([
    "0x428a2f98d728ae22",
    "0x7137449123ef65cd",
    "0xb5c0fbcfec4d3b2f",
    "0xe9b5dba58189dbbc",
    "0x3956c25bf348b538",
    "0x59f111f1b605d019",
    "0x923f82a4af194f9b",
    "0xab1c5ed5da6d8118",
    "0xd807aa98a3030242",
    "0x12835b0145706fbe",
    "0x243185be4ee4b28c",
    "0x550c7dc3d5ffb4e2",
    "0x72be5d74f27b896f",
    "0x80deb1fe3b1696b1",
    "0x9bdc06a725c71235",
    "0xc19bf174cf692694",
    "0xe49b69c19ef14ad2",
    "0xefbe4786384f25e3",
    "0x0fc19dc68b8cd5b5",
    "0x240ca1cc77ac9c65",
    "0x2de92c6f592b0275",
    "0x4a7484aa6ea6e483",
    "0x5cb0a9dcbd41fbd4",
    "0x76f988da831153b5",
    "0x983e5152ee66dfab",
    "0xa831c66d2db43210",
    "0xb00327c898fb213f",
    "0xbf597fc7beef0ee4",
    "0xc6e00bf33da88fc2",
    "0xd5a79147930aa725",
    "0x06ca6351e003826f",
    "0x142929670a0e6e70",
    "0x27b70a8546d22ffc",
    "0x2e1b21385c26c926",
    "0x4d2c6dfc5ac42aed",
    "0x53380d139d95b3df",
    "0x650a73548baf63de",
    "0x766a0abb3c77b2a8",
    "0x81c2c92e47edaee6",
    "0x92722c851482353b",
    "0xa2bfe8a14cf10364",
    "0xa81a664bbc423001",
    "0xc24b8b70d0f89791",
    "0xc76c51a30654be30",
    "0xd192e819d6ef5218",
    "0xd69906245565a910",
    "0xf40e35855771202a",
    "0x106aa07032bbd1b8",
    "0x19a4c116b8d2d0c8",
    "0x1e376c085141ab53",
    "0x2748774cdf8eeb99",
    "0x34b0bcb5e19b48a8",
    "0x391c0cb3c5c95a63",
    "0x4ed8aa4ae3418acb",
    "0x5b9cca4f7763e373",
    "0x682e6ff3d6b2b8a3",
    "0x748f82ee5defb2fc",
    "0x78a5636f43172f60",
    "0x84c87814a1f0ab72",
    "0x8cc702081a6439ec",
    "0x90befffa23631e28",
    "0xa4506cebde82bde9",
    "0xbef9a3f7b2c67915",
    "0xc67178f2e372532b",
    "0xca273eceea26619c",
    "0xd186b8c721c0c207",
    "0xeada7dd6cde0eb1e",
    "0xf57d4f7fee6ed178",
    "0x06f067aa72176fba",
    "0x0a637dc5a2c898a6",
    "0x113f9804bef90dae",
    "0x1b710b35131c471b",
    "0x28db77f523047d84",
    "0x32caab7b40c72493",
    "0x3c9ebe0a15c9bebc",
    "0x431d67c49c100d4c",
    "0x4cc5d4becb3e42b6",
    "0x597f299cfc657e2a",
    "0x5fcb6fab3ad6faec",
    "0x6c44198c4a475817"
  ].map((n) => BigInt(n))))();
  var SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
  var SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
  var SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
  var SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
  var SHA2_64B = class extends HashMD {
    // We cannot use array here since array allows indexing by variable
    // which means optimizer/compiler cannot use registers.
    // h -- high 32 bits, l -- low 32 bits
    // Numeric initializers matter: starting the fields as `undefined` changes
    // V8's field representation and slows hashing down (measured on sha256).
    Ah = 0;
    Al = 0;
    Bh = 0;
    Bl = 0;
    Ch = 0;
    Cl = 0;
    Dh = 0;
    Dl = 0;
    Eh = 0;
    El = 0;
    Fh = 0;
    Fl = 0;
    Gh = 0;
    Gl = 0;
    Hh = 0;
    Hl = 0;
    constructor(outputLen, IV) {
      super(128, outputLen, 16, false);
      this.Ah = IV[0] | 0;
      this.Al = IV[1] | 0;
      this.Bh = IV[2] | 0;
      this.Bl = IV[3] | 0;
      this.Ch = IV[4] | 0;
      this.Cl = IV[5] | 0;
      this.Dh = IV[6] | 0;
      this.Dl = IV[7] | 0;
      this.Eh = IV[8] | 0;
      this.El = IV[9] | 0;
      this.Fh = IV[10] | 0;
      this.Fl = IV[11] | 0;
      this.Gh = IV[12] | 0;
      this.Gl = IV[13] | 0;
      this.Hh = IV[14] | 0;
      this.Hl = IV[15] | 0;
    }
    // prettier-ignore
    get() {
      const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
      return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
    }
    // prettier-ignore
    set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
      this.Ah = Ah | 0;
      this.Al = Al | 0;
      this.Bh = Bh | 0;
      this.Bl = Bl | 0;
      this.Ch = Ch | 0;
      this.Cl = Cl | 0;
      this.Dh = Dh | 0;
      this.Dl = Dl | 0;
      this.Eh = Eh | 0;
      this.El = El | 0;
      this.Fh = Fh | 0;
      this.Fl = Fl | 0;
      this.Gh = Gh | 0;
      this.Gl = Gl | 0;
      this.Hh = Hh | 0;
      this.Hl = Hl | 0;
    }
    _cloneInto(to) {
      (to ||= new this.constructor()).set(...this.get());
      return this._cloneIntoMeta(to);
    }
    process(view, offset) {
      for (let i = 0; i < 16; i++, offset += 4) {
        SHA512_W_H[i] = view.getUint32(offset);
        SHA512_W_L[i] = view.getUint32(offset += 4);
      }
      for (let i = 16; i < 80; i++) {
        const W15h = SHA512_W_H[i - 15] | 0;
        const W15l = SHA512_W_L[i - 15] | 0;
        const s0h = rotrSH(W15h, W15l, 1) ^ rotrSH(W15h, W15l, 8) ^ shrSH(W15h, W15l, 7);
        const s0l = rotrSL(W15h, W15l, 1) ^ rotrSL(W15h, W15l, 8) ^ shrSL(W15h, W15l, 7);
        const W2h = SHA512_W_H[i - 2] | 0;
        const W2l = SHA512_W_L[i - 2] | 0;
        const s1h = rotrSH(W2h, W2l, 19) ^ rotrBH(W2h, W2l, 61) ^ shrSH(W2h, W2l, 6);
        const s1l = rotrSL(W2h, W2l, 19) ^ rotrBL(W2h, W2l, 61) ^ shrSL(W2h, W2l, 6);
        const SUMl = add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
        const SUMh = add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
        SHA512_W_H[i] = SUMh | 0;
        SHA512_W_L[i] = SUMl | 0;
      }
      let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
      for (let i = 0; i < 80; i++) {
        const sigma1h = rotrSH(Eh, El, 14) ^ rotrSH(Eh, El, 18) ^ rotrBH(Eh, El, 41);
        const sigma1l = rotrSL(Eh, El, 14) ^ rotrSL(Eh, El, 18) ^ rotrBL(Eh, El, 41);
        const CHIh = Eh & Fh ^ ~Eh & Gh;
        const CHIl = El & Fl ^ ~El & Gl;
        const T1ll = add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
        const T1h = add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
        const T1l = T1ll | 0;
        const sigma0h = rotrSH(Ah, Al, 28) ^ rotrBH(Ah, Al, 34) ^ rotrBH(Ah, Al, 39);
        const sigma0l = rotrSL(Ah, Al, 28) ^ rotrBL(Ah, Al, 34) ^ rotrBL(Ah, Al, 39);
        const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
        const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
        Hh = Gh | 0;
        Hl = Gl | 0;
        Gh = Fh | 0;
        Gl = Fl | 0;
        Fh = Eh | 0;
        Fl = El | 0;
        ({ h: Eh, l: El } = add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
        Dh = Ch | 0;
        Dl = Cl | 0;
        Ch = Bh | 0;
        Cl = Bl | 0;
        Bh = Ah | 0;
        Bl = Al | 0;
        const All = add3L(T1l, sigma0l, MAJl);
        Ah = add3H(All, T1h, sigma0h, MAJh);
        Al = All | 0;
      }
      ({ h: Ah, l: Al } = add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
      ({ h: Bh, l: Bl } = add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
      ({ h: Ch, l: Cl } = add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
      ({ h: Dh, l: Dl } = add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
      ({ h: Eh, l: El } = add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
      ({ h: Fh, l: Fl } = add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
      ({ h: Gh, l: Gl } = add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
      ({ h: Hh, l: Hl } = add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
      this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
    }
    roundClean() {
      clean(SHA512_W_H, SHA512_W_L);
    }
    destroy() {
      this.destroyed = true;
      clean(this.buffer);
      this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
  };
  var _SHA512 = class extends SHA2_64B {
    constructor() {
      super(64, SHA512_IV);
    }
  };
  var _SHA384 = class extends SHA2_64B {
    constructor() {
      super(48, SHA384_IV);
    }
  };
  var T224_IV = /* @__PURE__ */ Uint32Array.from([
    2352822216,
    424955298,
    1944164710,
    2312950998,
    502970286,
    855612546,
    1738396948,
    1479516111,
    258812777,
    2077511080,
    2011393907,
    79989058,
    1067287976,
    1780299464,
    286451373,
    2446758561
  ]);
  var T256_IV = /* @__PURE__ */ Uint32Array.from([
    573645204,
    4230739756,
    2673172387,
    3360449730,
    596883563,
    1867755857,
    2520282905,
    1497426621,
    2519219938,
    2827943907,
    3193839141,
    1401305490,
    721525244,
    746961066,
    246885852,
    2177182882
  ]);
  var _SHA512_224 = class extends SHA2_64B {
    constructor() {
      super(28, T224_IV);
    }
  };
  var _SHA512_256 = class extends SHA2_64B {
    constructor() {
      super(32, T256_IV);
    }
  };
  var sha256 = /* @__PURE__ */ createHasher(
    () => new _SHA256(),
    /* @__PURE__ */ oidNist(1)
  );
  var sha224 = /* @__PURE__ */ createHasher(
    () => new _SHA224(),
    /* @__PURE__ */ oidNist(4)
  );
  var sha512 = /* @__PURE__ */ createHasher(
    () => new _SHA512(),
    /* @__PURE__ */ oidNist(3)
  );
  var sha384 = /* @__PURE__ */ createHasher(
    () => new _SHA384(),
    /* @__PURE__ */ oidNist(2)
  );
  var sha512_256 = /* @__PURE__ */ createHasher(
    () => new _SHA512_256(),
    /* @__PURE__ */ oidNist(6)
  );
  var sha512_224 = /* @__PURE__ */ createHasher(
    () => new _SHA512_224(),
    /* @__PURE__ */ oidNist(5)
  );

  // node_modules/@noble/hashes/sha3.js
  var _0n = BigInt(0);
  var _1n = BigInt(1);
  var _2n = BigInt(2);
  var _7n = BigInt(7);
  var _256n = BigInt(256);
  var _0x71n = BigInt(113);
  var SHA3_PI = [];
  var SHA3_ROTL = [];
  var _SHA3_IOTA = [];
  for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
    [x, y] = [y, (2 * x + 3 * y) % 5];
    SHA3_PI.push(2 * (5 * y + x));
    SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
    let t = _0n;
    for (let j = 0; j < 7; j++) {
      R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
      if (R & _2n)
        t ^= _1n << (_1n << BigInt(j)) - _1n;
    }
    _SHA3_IOTA.push(t);
  }
  var IOTAS = split(_SHA3_IOTA, true);
  var SHA3_IOTA_H = IOTAS[0];
  var SHA3_IOTA_L = IOTAS[1];
  var rotlSH = (h, l, s) => h << s | l >>> 32 - s;
  var rotlSL = (h, l, s) => l << s | h >>> 32 - s;
  var rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
  var rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;
  var rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
  var rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
  var B = new Uint32Array(5 * 2);
  function keccakP(s, rounds = 24) {
    if (!(s instanceof Uint32Array))
      throw new TypeError('"s" expected Uint32Array(50), got type=' + typeof s);
    if (s.length !== 50)
      throw new RangeError('"s" expected Uint32Array(50), got length=' + s.length);
    anumber(rounds, "rounds");
    if (rounds < 1 || rounds > 24)
      throw new Error('"rounds" expected integer 1..24');
    for (let round = 24 - rounds; round < 24; round++) {
      for (let x = 0; x < 10; x++)
        B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
      for (let x = 0; x < 10; x += 2) {
        const idx1 = (x + 8) % 10;
        const idx0 = (x + 2) % 10;
        const B0 = B[idx0];
        const B1 = B[idx0 + 1];
        const Th = rotlH(B0, B1, 1) ^ B[idx1];
        const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
        for (let y = 0; y < 50; y += 10) {
          s[x + y] ^= Th;
          s[x + y + 1] ^= Tl;
        }
      }
      let curH = s[2];
      let curL = s[3];
      for (let t = 0; t < 24; t++) {
        const shift = SHA3_ROTL[t];
        const Th = rotlH(curH, curL, shift);
        const Tl = rotlL(curH, curL, shift);
        const PI = SHA3_PI[t];
        curH = s[PI];
        curL = s[PI + 1];
        s[PI] = Th;
        s[PI + 1] = Tl;
      }
      for (let y = 0; y < 50; y += 10) {
        const b0 = s[y], b1 = s[y + 1], b2 = s[y + 2], b3 = s[y + 3];
        s[y] ^= ~s[y + 2] & s[y + 4];
        s[y + 1] ^= ~s[y + 3] & s[y + 5];
        s[y + 2] ^= ~s[y + 4] & s[y + 6];
        s[y + 3] ^= ~s[y + 5] & s[y + 7];
        s[y + 4] ^= ~s[y + 6] & s[y + 8];
        s[y + 5] ^= ~s[y + 7] & s[y + 9];
        s[y + 6] ^= ~s[y + 8] & b0;
        s[y + 7] ^= ~s[y + 9] & b1;
        s[y + 8] ^= ~b0 & b2;
        s[y + 9] ^= ~b1 & b3;
      }
      s[0] ^= SHA3_IOTA_H[round];
      s[1] ^= SHA3_IOTA_L[round];
    }
    clean(B);
  }
  var Keccak = class _Keccak {
    state;
    pos = 0;
    posOut = 0;
    finished = false;
    state32;
    destroyed = false;
    blockLen;
    suffix;
    outputLen;
    canXOF;
    enableXOF = false;
    rounds;
    // NOTE: we accept arguments in bytes instead of bits here.
    constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
      anumber(blockLen, "blockLen");
      anumber(suffix, "suffix");
      anumber(rounds, "rounds");
      abool(enableXOF, "enableXOF");
      this.blockLen = blockLen;
      this.suffix = suffix;
      this.outputLen = outputLen;
      this.enableXOF = enableXOF;
      this.canXOF = enableXOF;
      this.rounds = rounds;
      anumber(outputLen, "outputLen");
      if (!(0 < blockLen && blockLen < 200))
        throw new Error('"blockLen" must be 1..199');
      this.state = new Uint8Array(200);
      this.state32 = u32(this.state);
    }
    clone() {
      return this._cloneInto();
    }
    keccak() {
      swap32IfBE(this.state32);
      keccakP(this.state32, this.rounds);
      swap32IfBE(this.state32);
      this.posOut = 0;
      this.pos = 0;
    }
    update(data) {
      aexists(this);
      abytes(data);
      const { blockLen, state, state32 } = this;
      const len = data.length;
      const canUseU32 = blockLen % 4 === 0 && data.byteOffset % 4 === 0;
      const blockLen32 = blockLen / 4;
      const data32 = canUseU32 && len >= blockLen ? u32(data) : void 0;
      for (let pos = 0; pos < len; ) {
        if (data32 !== void 0 && this.pos === 0 && pos % 4 === 0 && len - pos >= blockLen) {
          for (let i = 0, o = pos / 4; i < blockLen32; i++)
            state32[i] ^= data32[o + i];
          pos += blockLen;
          this.pos = blockLen;
          this.keccak();
          continue;
        }
        const take = Math.min(blockLen - this.pos, len - pos);
        for (let i = 0; i < take; i++)
          state[this.pos++] ^= data[pos++];
        if (this.pos === blockLen)
          this.keccak();
      }
      return this;
    }
    finish() {
      if (this.finished)
        return;
      this.finished = true;
      const { state, suffix, pos, blockLen } = this;
      state[pos] ^= suffix;
      if ((suffix & 128) !== 0 && pos === blockLen - 1)
        this.keccak();
      state[blockLen - 1] ^= 128;
      this.keccak();
    }
    writeInto(out) {
      aexists(this, false);
      abytes(out);
      this.finish();
      const bufferOut = this.state;
      const { blockLen } = this;
      for (let pos = 0, len = out.length; pos < len; ) {
        if (this.posOut >= blockLen)
          this.keccak();
        const take = Math.min(blockLen - this.posOut, len - pos);
        out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
        this.posOut += take;
        pos += take;
      }
      return out;
    }
    xofInto(out) {
      if (!this.enableXOF)
        throw new Error("XOF is not enabled");
      return this.writeInto(out);
    }
    xof(bytes) {
      anumber(bytes);
      return this.xofInto(new Uint8Array(bytes));
    }
    digestInto(out) {
      aoutput(out, this);
      if (this.finished)
        throw new Error("digest() was already called");
      this.writeInto(out.length === this.outputLen ? out : out.subarray(0, this.outputLen));
      this.destroy();
    }
    digest() {
      const out = new Uint8Array(this.outputLen);
      this.digestInto(out);
      return out;
    }
    destroy() {
      this.destroyed = true;
      clean(this.state);
    }
    _cloneInto(to) {
      const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
      to ||= new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds);
      to.blockLen = blockLen;
      to.state32.set(this.state32);
      to.pos = this.pos;
      to.posOut = this.posOut;
      to.finished = this.finished;
      to.rounds = rounds;
      to.suffix = suffix;
      to.outputLen = outputLen;
      to.enableXOF = enableXOF;
      to.canXOF = this.canXOF;
      to.destroyed = this.destroyed;
      return to;
    }
  };
  var genKeccak = (suffix, blockLen, outputLen, info = {}) => createHasher(() => new Keccak(blockLen, suffix, outputLen), info);
  var sha3_224 = /* @__PURE__ */ genKeccak(
    6,
    144,
    28,
    /* @__PURE__ */ oidNist(7)
  );
  var sha3_256 = /* @__PURE__ */ genKeccak(
    6,
    136,
    32,
    /* @__PURE__ */ oidNist(8)
  );
  var sha3_384 = /* @__PURE__ */ genKeccak(
    6,
    104,
    48,
    /* @__PURE__ */ oidNist(9)
  );
  var sha3_512 = /* @__PURE__ */ genKeccak(
    6,
    72,
    64,
    /* @__PURE__ */ oidNist(10)
  );
  var keccak_256 = /* @__PURE__ */ genKeccak(1, 136, 32);
  var genShake = (suffix, blockLen, outputLen, info = {}) => createHasher((opts = {}) => {
    opts = checkOpts({}, opts);
    return new Keccak(blockLen, suffix, opts.dkLen === void 0 ? outputLen : opts.dkLen, true);
  }, info);
  var shake128 = /* @__PURE__ */ genShake(31, 168, 16, /* @__PURE__ */ oidNist(11));
  var shake256 = /* @__PURE__ */ genShake(31, 136, 32, /* @__PURE__ */ oidNist(12));

  // node_modules/@noble/hashes/_blake.js
  var BSIGMA = /* @__PURE__ */ Uint8Array.from([
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    14,
    10,
    4,
    8,
    9,
    15,
    13,
    6,
    1,
    12,
    0,
    2,
    11,
    7,
    5,
    3,
    11,
    8,
    12,
    0,
    5,
    2,
    15,
    13,
    10,
    14,
    3,
    6,
    7,
    1,
    9,
    4,
    7,
    9,
    3,
    1,
    13,
    12,
    11,
    14,
    2,
    6,
    5,
    10,
    4,
    0,
    15,
    8,
    9,
    0,
    5,
    7,
    2,
    4,
    10,
    15,
    14,
    1,
    11,
    12,
    6,
    8,
    3,
    13,
    2,
    12,
    6,
    10,
    0,
    11,
    8,
    3,
    4,
    13,
    7,
    5,
    15,
    14,
    1,
    9,
    12,
    5,
    1,
    15,
    14,
    13,
    4,
    10,
    0,
    7,
    6,
    3,
    9,
    2,
    8,
    11,
    13,
    11,
    7,
    14,
    12,
    1,
    3,
    9,
    5,
    0,
    15,
    4,
    8,
    6,
    2,
    10,
    6,
    15,
    14,
    9,
    11,
    3,
    0,
    8,
    12,
    2,
    13,
    7,
    1,
    4,
    10,
    5,
    10,
    2,
    8,
    4,
    7,
    6,
    1,
    5,
    15,
    11,
    9,
    14,
    3,
    12,
    13,
    0,
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    14,
    10,
    4,
    8,
    9,
    15,
    13,
    6,
    1,
    12,
    0,
    2,
    11,
    7,
    5,
    3,
    // Blake1, unused in others
    11,
    8,
    12,
    0,
    5,
    2,
    15,
    13,
    10,
    14,
    3,
    6,
    7,
    1,
    9,
    4,
    7,
    9,
    3,
    1,
    13,
    12,
    11,
    14,
    2,
    6,
    5,
    10,
    4,
    0,
    15,
    8,
    9,
    0,
    5,
    7,
    2,
    4,
    10,
    15,
    14,
    1,
    11,
    12,
    6,
    8,
    3,
    13,
    2,
    12,
    6,
    10,
    0,
    11,
    8,
    3,
    4,
    13,
    7,
    5,
    15,
    14,
    1,
    9
  ]);
  function G1s(a, b, c, d, x) {
    a = a + b + x | 0;
    d = rotr(d ^ a, 16);
    c = c + d | 0;
    b = rotr(b ^ c, 12);
    return { a, b, c, d };
  }
  function G2s(a, b, c, d, x) {
    a = a + b + x | 0;
    d = rotr(d ^ a, 8);
    c = c + d | 0;
    b = rotr(b ^ c, 7);
    return { a, b, c, d };
  }

  // node_modules/@noble/hashes/blake2.js
  var B2B_IV = /* @__PURE__ */ Uint32Array.from([
    4089235720,
    1779033703,
    2227873595,
    3144134277,
    4271175723,
    1013904242,
    1595750129,
    2773480762,
    2917565137,
    1359893119,
    725511199,
    2600822924,
    4215389547,
    528734635,
    327033209,
    1541459225
  ]);
  var BBUF = /* @__PURE__ */ new Uint32Array(32);
  function G1b(a, b, c, d, msg, x) {
    const Xl = msg[x], Xh = msg[x + 1];
    let Al = BBUF[2 * a], Ah = BBUF[2 * a + 1];
    let Bl = BBUF[2 * b], Bh = BBUF[2 * b + 1];
    let Cl = BBUF[2 * c], Ch = BBUF[2 * c + 1];
    let Dl = BBUF[2 * d], Dh = BBUF[2 * d + 1];
    const ll = add3L(Al, Bl, Xl);
    Ah = add3H(ll, Ah, Bh, Xh);
    Al = ll | 0;
    let xh = Dh ^ Ah, xl = Dl ^ Al;
    Dh = rotr32H(xh, xl);
    Dl = rotr32L(xh, xl);
    ({ h: Ch, l: Cl } = add(Ch, Cl, Dh, Dl));
    xh = Bh ^ Ch;
    xl = Bl ^ Cl;
    Bh = rotrSH(xh, xl, 24);
    Bl = rotrSL(xh, xl, 24);
    BBUF[2 * a] = Al;
    BBUF[2 * a + 1] = Ah;
    BBUF[2 * b] = Bl;
    BBUF[2 * b + 1] = Bh;
    BBUF[2 * c] = Cl;
    BBUF[2 * c + 1] = Ch;
    BBUF[2 * d] = Dl;
    BBUF[2 * d + 1] = Dh;
  }
  function G2b(a, b, c, d, msg, x) {
    const Xl = msg[x], Xh = msg[x + 1];
    let Al = BBUF[2 * a], Ah = BBUF[2 * a + 1];
    let Bl = BBUF[2 * b], Bh = BBUF[2 * b + 1];
    let Cl = BBUF[2 * c], Ch = BBUF[2 * c + 1];
    let Dl = BBUF[2 * d], Dh = BBUF[2 * d + 1];
    const ll = add3L(Al, Bl, Xl);
    Ah = add3H(ll, Ah, Bh, Xh);
    Al = ll | 0;
    let xh = Dh ^ Ah, xl = Dl ^ Al;
    Dh = rotrSH(xh, xl, 16);
    Dl = rotrSL(xh, xl, 16);
    ({ h: Ch, l: Cl } = add(Ch, Cl, Dh, Dl));
    xh = Bh ^ Ch;
    xl = Bl ^ Cl;
    Bh = rotrBH(xh, xl, 63);
    Bl = rotrBL(xh, xl, 63);
    BBUF[2 * a] = Al;
    BBUF[2 * a + 1] = Ah;
    BBUF[2 * b] = Bl;
    BBUF[2 * b + 1] = Bh;
    BBUF[2 * c] = Cl;
    BBUF[2 * c + 1] = Ch;
    BBUF[2 * d] = Dl;
    BBUF[2 * d + 1] = Dh;
  }
  function checkBlake2Opts(outputLen, opts = {}, keyLen, saltLen, persLen) {
    anumber(keyLen);
    if (outputLen <= 0 || outputLen > keyLen)
      throw new Error('"dkLen" must be 1..' + keyLen + ", got " + outputLen);
    const { key, salt, personalization } = opts;
    if (key !== void 0 && (key.length < 1 || key.length > keyLen))
      throw new Error('"key" expected to be undefined or of length=1..' + keyLen);
    if (salt !== void 0)
      abytes(salt, saltLen, "salt");
    if (personalization !== void 0)
      abytes(personalization, persLen, "personalization");
  }
  var _BLAKE2 = class {
    buffer;
    buffer32;
    finished = false;
    destroyed = false;
    length = 0;
    pos = 0;
    blockLen;
    outputLen;
    canXOF = false;
    constructor(blockLen, outputLen) {
      anumber(blockLen);
      anumber(outputLen);
      this.blockLen = blockLen;
      this.outputLen = outputLen;
      this.buffer = new Uint8Array(blockLen);
      this.buffer32 = u32(this.buffer);
    }
    update(data) {
      aexists(this);
      abytes(data);
      const { blockLen, buffer, buffer32 } = this;
      const len = data.length;
      const offset = data.byteOffset;
      const buf = data.buffer;
      for (let pos = 0; pos < len; ) {
        if (this.pos === blockLen) {
          swap32IfBE(buffer32);
          this.compress(buffer32, 0, false);
          swap32IfBE(buffer32);
          this.pos = 0;
        }
        const take = Math.min(blockLen - this.pos, len - pos);
        const dataOffset = offset + pos;
        if (take === blockLen && !(dataOffset % 4) && pos + take < len) {
          const data32 = new Uint32Array(buf, dataOffset, Math.floor((len - pos) / 4));
          swap32IfBE(data32);
          for (let pos32 = 0; pos + blockLen < len; pos32 += buffer32.length, pos += blockLen) {
            this.length += blockLen;
            this.compress(data32, pos32, false);
          }
          swap32IfBE(data32);
          continue;
        }
        buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        this.length += take;
        pos += take;
      }
      return this;
    }
    digestInto(out) {
      aexists(this);
      aoutput(out, this);
      if (out.byteOffset & 3)
        throw new RangeError('"output" expected 4-byte aligned byteOffset, got ' + out.byteOffset);
      const { pos, buffer32 } = this;
      this.finished = true;
      this.buffer.fill(0, pos);
      swap32IfBE(buffer32);
      this.compress(buffer32, 0, true);
      swap32IfBE(buffer32);
      const state = this.get();
      const out32 = out === this.buffer ? buffer32 : u32(out);
      const full = Math.floor(this.outputLen / 4);
      for (let i = 0; i < full; i++)
        out32[i] = swap8IfBE(state[i]);
      const tail = this.outputLen % 4;
      if (!tail)
        return;
      const off = full * 4;
      const word = state[full];
      for (let i = 0; i < tail; i++)
        out[off + i] = word >>> 8 * i;
    }
    digest() {
      const { buffer, outputLen } = this;
      this.digestInto(buffer);
      const res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
    _cloneInto(to) {
      const { buffer, length, finished, destroyed, outputLen, pos } = this;
      to ||= new this.constructor({ dkLen: outputLen });
      to.set(...this.get());
      to.buffer.set(buffer);
      to.destroyed = destroyed;
      to.finished = finished;
      to.length = length;
      to.pos = pos;
      to.outputLen = outputLen;
      return to;
    }
    clone() {
      return this._cloneInto();
    }
  };
  var _BLAKE2b = class extends _BLAKE2 {
    // Same IV words as SHA-512 / BLAKE2b, encoded as LE u32 low/high halves.
    v0l = B2B_IV[0] | 0;
    v0h = B2B_IV[1] | 0;
    v1l = B2B_IV[2] | 0;
    v1h = B2B_IV[3] | 0;
    v2l = B2B_IV[4] | 0;
    v2h = B2B_IV[5] | 0;
    v3l = B2B_IV[6] | 0;
    v3h = B2B_IV[7] | 0;
    v4l = B2B_IV[8] | 0;
    v4h = B2B_IV[9] | 0;
    v5l = B2B_IV[10] | 0;
    v5h = B2B_IV[11] | 0;
    v6l = B2B_IV[12] | 0;
    v6h = B2B_IV[13] | 0;
    v7l = B2B_IV[14] | 0;
    v7h = B2B_IV[15] | 0;
    constructor(opts = {}) {
      opts = checkOpts({}, opts);
      const olen = opts.dkLen === void 0 ? 64 : opts.dkLen;
      super(128, olen);
      checkBlake2Opts(olen, opts, 64, 16, 16);
      let { key, personalization, salt } = opts;
      let keyLength = 0;
      if (key !== void 0) {
        abytes(key, void 0, "key");
        keyLength = key.length;
      }
      this.v0l ^= this.outputLen | keyLength << 8 | 1 << 16 | 1 << 24;
      if (salt !== void 0) {
        abytes(salt, void 0, "salt");
        const slt = u32(copyBytes(salt));
        this.v4l ^= swap8IfBE(slt[0]);
        this.v4h ^= swap8IfBE(slt[1]);
        this.v5l ^= swap8IfBE(slt[2]);
        this.v5h ^= swap8IfBE(slt[3]);
      }
      if (personalization !== void 0) {
        abytes(personalization, void 0, "personalization");
        const pers = u32(copyBytes(personalization));
        this.v6l ^= swap8IfBE(pers[0]);
        this.v6h ^= swap8IfBE(pers[1]);
        this.v7l ^= swap8IfBE(pers[2]);
        this.v7h ^= swap8IfBE(pers[3]);
      }
      if (key !== void 0) {
        const tmp = new Uint8Array(this.blockLen);
        tmp.set(key);
        this.update(tmp);
        clean(tmp);
      }
    }
    // prettier-ignore
    get() {
      let { v0l, v0h, v1l, v1h, v2l, v2h, v3l, v3h, v4l, v4h, v5l, v5h, v6l, v6h, v7l, v7h } = this;
      return [v0l, v0h, v1l, v1h, v2l, v2h, v3l, v3h, v4l, v4h, v5l, v5h, v6l, v6h, v7l, v7h];
    }
    // prettier-ignore
    set(v0l, v0h, v1l, v1h, v2l, v2h, v3l, v3h, v4l, v4h, v5l, v5h, v6l, v6h, v7l, v7h) {
      this.v0l = v0l | 0;
      this.v0h = v0h | 0;
      this.v1l = v1l | 0;
      this.v1h = v1h | 0;
      this.v2l = v2l | 0;
      this.v2h = v2h | 0;
      this.v3l = v3l | 0;
      this.v3h = v3h | 0;
      this.v4l = v4l | 0;
      this.v4h = v4h | 0;
      this.v5l = v5l | 0;
      this.v5h = v5h | 0;
      this.v6l = v6l | 0;
      this.v6h = v6h | 0;
      this.v7l = v7l | 0;
      this.v7h = v7h | 0;
    }
    compress(msg, offset, isLast) {
      const { v0l, v0h, v1l, v1h, v2l, v2h, v3l, v3h, v4l, v4h, v5l, v5h, v6l, v6h, v7l, v7h } = this;
      {
        BBUF[0] = v0l;
        BBUF[1] = v0h;
        BBUF[2] = v1l;
        BBUF[3] = v1h;
        BBUF[4] = v2l;
        BBUF[5] = v2h;
        BBUF[6] = v3l;
        BBUF[7] = v3h;
        BBUF[8] = v4l;
        BBUF[9] = v4h;
        BBUF[10] = v5l;
        BBUF[11] = v5h;
        BBUF[12] = v6l;
        BBUF[13] = v6h;
        BBUF[14] = v7l;
        BBUF[15] = v7h;
      }
      BBUF.set(B2B_IV, 16);
      const l = fromNumL(this.length);
      const h = fromNumH(this.length);
      BBUF[24] = B2B_IV[8] ^ l;
      BBUF[25] = B2B_IV[9] ^ h;
      if (isLast) {
        BBUF[28] = ~BBUF[28];
        BBUF[29] = ~BBUF[29];
      }
      let j = 0;
      const s = BSIGMA;
      for (let i = 0; i < 12; i++) {
        G1b(0, 4, 8, 12, msg, offset + 2 * s[j++]);
        G2b(0, 4, 8, 12, msg, offset + 2 * s[j++]);
        G1b(1, 5, 9, 13, msg, offset + 2 * s[j++]);
        G2b(1, 5, 9, 13, msg, offset + 2 * s[j++]);
        G1b(2, 6, 10, 14, msg, offset + 2 * s[j++]);
        G2b(2, 6, 10, 14, msg, offset + 2 * s[j++]);
        G1b(3, 7, 11, 15, msg, offset + 2 * s[j++]);
        G2b(3, 7, 11, 15, msg, offset + 2 * s[j++]);
        G1b(0, 5, 10, 15, msg, offset + 2 * s[j++]);
        G2b(0, 5, 10, 15, msg, offset + 2 * s[j++]);
        G1b(1, 6, 11, 12, msg, offset + 2 * s[j++]);
        G2b(1, 6, 11, 12, msg, offset + 2 * s[j++]);
        G1b(2, 7, 8, 13, msg, offset + 2 * s[j++]);
        G2b(2, 7, 8, 13, msg, offset + 2 * s[j++]);
        G1b(3, 4, 9, 14, msg, offset + 2 * s[j++]);
        G2b(3, 4, 9, 14, msg, offset + 2 * s[j++]);
      }
      this.v0l ^= BBUF[0] ^ BBUF[16];
      this.v0h ^= BBUF[1] ^ BBUF[17];
      this.v1l ^= BBUF[2] ^ BBUF[18];
      this.v1h ^= BBUF[3] ^ BBUF[19];
      this.v2l ^= BBUF[4] ^ BBUF[20];
      this.v2h ^= BBUF[5] ^ BBUF[21];
      this.v3l ^= BBUF[6] ^ BBUF[22];
      this.v3h ^= BBUF[7] ^ BBUF[23];
      this.v4l ^= BBUF[8] ^ BBUF[24];
      this.v4h ^= BBUF[9] ^ BBUF[25];
      this.v5l ^= BBUF[10] ^ BBUF[26];
      this.v5h ^= BBUF[11] ^ BBUF[27];
      this.v6l ^= BBUF[12] ^ BBUF[28];
      this.v6h ^= BBUF[13] ^ BBUF[29];
      this.v7l ^= BBUF[14] ^ BBUF[30];
      this.v7h ^= BBUF[15] ^ BBUF[31];
      clean(BBUF);
    }
    destroy() {
      this.destroyed = true;
      clean(this.buffer32);
      this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
  };
  var blake2b = /* @__PURE__ */ createHasher((opts) => new _BLAKE2b(opts));
  function _compress(s, offset, msg, rounds, v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15) {
    let j = 0;
    for (let i = 0; i < rounds; i++) {
      ({ a: v0, b: v4, c: v8, d: v12 } = G1s(v0, v4, v8, v12, msg[offset + s[j++]]));
      ({ a: v0, b: v4, c: v8, d: v12 } = G2s(v0, v4, v8, v12, msg[offset + s[j++]]));
      ({ a: v1, b: v5, c: v9, d: v13 } = G1s(v1, v5, v9, v13, msg[offset + s[j++]]));
      ({ a: v1, b: v5, c: v9, d: v13 } = G2s(v1, v5, v9, v13, msg[offset + s[j++]]));
      ({ a: v2, b: v6, c: v10, d: v14 } = G1s(v2, v6, v10, v14, msg[offset + s[j++]]));
      ({ a: v2, b: v6, c: v10, d: v14 } = G2s(v2, v6, v10, v14, msg[offset + s[j++]]));
      ({ a: v3, b: v7, c: v11, d: v15 } = G1s(v3, v7, v11, v15, msg[offset + s[j++]]));
      ({ a: v3, b: v7, c: v11, d: v15 } = G2s(v3, v7, v11, v15, msg[offset + s[j++]]));
      ({ a: v0, b: v5, c: v10, d: v15 } = G1s(v0, v5, v10, v15, msg[offset + s[j++]]));
      ({ a: v0, b: v5, c: v10, d: v15 } = G2s(v0, v5, v10, v15, msg[offset + s[j++]]));
      ({ a: v1, b: v6, c: v11, d: v12 } = G1s(v1, v6, v11, v12, msg[offset + s[j++]]));
      ({ a: v1, b: v6, c: v11, d: v12 } = G2s(v1, v6, v11, v12, msg[offset + s[j++]]));
      ({ a: v2, b: v7, c: v8, d: v13 } = G1s(v2, v7, v8, v13, msg[offset + s[j++]]));
      ({ a: v2, b: v7, c: v8, d: v13 } = G2s(v2, v7, v8, v13, msg[offset + s[j++]]));
      ({ a: v3, b: v4, c: v9, d: v14 } = G1s(v3, v4, v9, v14, msg[offset + s[j++]]));
      ({ a: v3, b: v4, c: v9, d: v14 } = G2s(v3, v4, v9, v14, msg[offset + s[j++]]));
    }
    return { v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15 };
  }
  var B2S_IV = /* @__PURE__ */ SHA256_IV.slice();
  var _BLAKE2s = class extends _BLAKE2 {
    // Internal state, same as SHA-256
    v0 = B2S_IV[0] | 0;
    v1 = B2S_IV[1] | 0;
    v2 = B2S_IV[2] | 0;
    v3 = B2S_IV[3] | 0;
    v4 = B2S_IV[4] | 0;
    v5 = B2S_IV[5] | 0;
    v6 = B2S_IV[6] | 0;
    v7 = B2S_IV[7] | 0;
    constructor(opts = {}) {
      opts = checkOpts({}, opts);
      const olen = opts.dkLen === void 0 ? 32 : opts.dkLen;
      super(64, olen);
      checkBlake2Opts(olen, opts, 32, 8, 8);
      let { key, personalization, salt } = opts;
      let keyLength = 0;
      if (key !== void 0) {
        abytes(key, void 0, "key");
        keyLength = key.length;
      }
      this.v0 ^= this.outputLen | keyLength << 8 | 1 << 16 | 1 << 24;
      if (salt !== void 0) {
        abytes(salt, void 0, "salt");
        const slt = u32(copyBytes(salt));
        this.v4 ^= swap8IfBE(slt[0]);
        this.v5 ^= swap8IfBE(slt[1]);
      }
      if (personalization !== void 0) {
        abytes(personalization, void 0, "personalization");
        const pers = u32(copyBytes(personalization));
        this.v6 ^= swap8IfBE(pers[0]);
        this.v7 ^= swap8IfBE(pers[1]);
      }
      if (key !== void 0) {
        const tmp = new Uint8Array(this.blockLen);
        tmp.set(key);
        this.update(tmp);
        clean(tmp);
      }
    }
    get() {
      const { v0, v1, v2, v3, v4, v5, v6, v7 } = this;
      return [v0, v1, v2, v3, v4, v5, v6, v7];
    }
    // prettier-ignore
    set(v0, v1, v2, v3, v4, v5, v6, v7) {
      this.v0 = v0 | 0;
      this.v1 = v1 | 0;
      this.v2 = v2 | 0;
      this.v3 = v3 | 0;
      this.v4 = v4 | 0;
      this.v5 = v5 | 0;
      this.v6 = v6 | 0;
      this.v7 = v7 | 0;
    }
    compress(msg, offset, isLast) {
      const l = fromNumL(this.length);
      const h = fromNumH(this.length);
      const { v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15 } = _compress(BSIGMA, offset, msg, 10, this.v0, this.v1, this.v2, this.v3, this.v4, this.v5, this.v6, this.v7, B2S_IV[0], B2S_IV[1], B2S_IV[2], B2S_IV[3], l ^ B2S_IV[4], h ^ B2S_IV[5], isLast ? ~B2S_IV[6] : B2S_IV[6], B2S_IV[7]);
      this.v0 ^= v0 ^ v8;
      this.v1 ^= v1 ^ v9;
      this.v2 ^= v2 ^ v10;
      this.v3 ^= v3 ^ v11;
      this.v4 ^= v4 ^ v12;
      this.v5 ^= v5 ^ v13;
      this.v6 ^= v6 ^ v14;
      this.v7 ^= v7 ^ v15;
    }
    destroy() {
      this.destroyed = true;
      clean(this.buffer32);
      this.set(0, 0, 0, 0, 0, 0, 0, 0);
    }
  };
  var blake2s = /* @__PURE__ */ createHasher((opts) => new _BLAKE2s(opts));

  // node_modules/@noble/hashes/blake3.js
  var B3_Flags = {
    CHUNK_START: 1,
    CHUNK_END: 2,
    PARENT: 4,
    ROOT: 8,
    KEYED_HASH: 16,
    DERIVE_KEY_CONTEXT: 32,
    DERIVE_KEY_MATERIAL: 64
  };
  var B3_IV = /* @__PURE__ */ SHA256_IV.slice();
  var B3_SIGMA = /* @__PURE__ */ (() => {
    const Id = Array.from({ length: 16 }, (_, i) => i);
    const permute = (arr) => [2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8].map((i) => arr[i]);
    const res = [];
    for (let i = 0, v = Id; i < 7; i++, v = permute(v))
      res.push(...v);
    return Uint8Array.from(res);
  })();
  var _BLAKE3 = class __BLAKE3 extends _BLAKE2 {
    canXOF = true;
    chunkPos = 0;
    // Position of current block in chunk
    // How many chunks we already have; exact while this stays within
    // JS's safe-integer range.
    chunksDone = 0;
    flags = 0 | 0;
    IV;
    state;
    stack = [];
    // Output
    posOut = 0;
    bufferOut32 = new Uint32Array(16);
    bufferOut;
    // Index of output chunk; exact while this stays within JS's
    // safe-integer range.
    chunkOut = 0;
    enableXOF = true;
    constructor(opts = {}, flags = 0) {
      opts = checkOpts({}, opts);
      super(64, opts.dkLen === void 0 ? 32 : opts.dkLen);
      const { key, context } = opts;
      const hasContext = context !== void 0;
      if (key !== void 0) {
        if (hasContext)
          throw new Error('cannot use both "key" and "context"');
        abytes(key, 32, "key");
        const k = copyBytes(key);
        this.IV = u32(k);
        swap32IfBE(this.IV);
        this.flags = flags | B3_Flags.KEYED_HASH;
      } else if (hasContext) {
        abytes(context, void 0, "context");
        const ctx = context;
        const contextKey = new __BLAKE3({ dkLen: 32 }, B3_Flags.DERIVE_KEY_CONTEXT).update(ctx).digest();
        this.IV = u32(contextKey);
        swap32IfBE(this.IV);
        this.flags = flags | B3_Flags.DERIVE_KEY_MATERIAL;
      } else {
        this.IV = B3_IV;
        this.flags = flags;
      }
      this.state = this.IV.slice();
      this.bufferOut = u8(this.bufferOut32);
    }
    // _BLAKE2's scalar-state hooks are unused here: BLAKE3 keeps its tree/XOF state in arrays and
    // copies it directly in _cloneInto().
    get() {
      return [];
    }
    set() {
    }
    // Truncated chunk/parent compression: seed v8..v15 as IV[0..3], t0, t1,
    // block length, and flags, then keep only the first 8 output words.
    b2Compress(counter, flags, buf, bufPos = 0) {
      const { state: s, pos } = this;
      const t0 = fromNumL(counter);
      const t1 = fromNumH(counter);
      const { v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15 } = _compress(B3_SIGMA, bufPos, buf, 7, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], B3_IV[0], B3_IV[1], B3_IV[2], B3_IV[3], t0, t1, pos, flags);
      s[0] = v0 ^ v8;
      s[1] = v1 ^ v9;
      s[2] = v2 ^ v10;
      s[3] = v3 ^ v11;
      s[4] = v4 ^ v12;
      s[5] = v5 ^ v13;
      s[6] = v6 ^ v14;
      s[7] = v7 ^ v15;
    }
    compress(buf, bufPos = 0, isLast = false) {
      let flags = this.flags;
      if (!this.chunkPos)
        flags |= B3_Flags.CHUNK_START;
      if (this.chunkPos === 15 || isLast)
        flags |= B3_Flags.CHUNK_END;
      if (!isLast)
        this.pos = this.blockLen;
      this.b2Compress(this.chunksDone, flags, buf, bufPos);
      this.chunkPos += 1;
      if (this.chunkPos === 16 || isLast) {
        let chunk = this.state;
        this.state = this.IV.slice();
        for (let last, chunks = this.chunksDone + 1; isLast || !(chunks & 1); chunks = Math.floor(chunks / 2)) {
          if (!(last = this.stack.pop()))
            break;
          this.buffer32.set(last, 0);
          this.buffer32.set(chunk, 8);
          this.pos = this.blockLen;
          this.b2Compress(0, this.flags | B3_Flags.PARENT, this.buffer32, 0);
          chunk = this.state;
          this.state = this.IV.slice();
        }
        this.chunksDone++;
        this.chunkPos = 0;
        this.stack.push(chunk);
      }
      this.pos = 0;
    }
    // Overriding hides _BLAKE2's flat implementation, which would otherwise be inherited
    // and silently miss the tree state (CV stack, chunk counters; get()/set() are stubs here).
    _cloneInto(to) {
      const staleOutput = !!to && to.finished && !to.destroyed;
      to = super._cloneInto(to);
      const { IV, flags, state, chunkPos, posOut, chunkOut, stack, chunksDone } = this;
      to.state.set(state);
      to.stack = stack.map((i) => Uint32Array.from(i));
      if (IV === B3_IV) {
        if (to.IV !== B3_IV)
          clean(to.IV);
        to.IV = B3_IV;
      } else if (to.IV === B3_IV) {
        to.IV = IV.slice();
      } else {
        to.IV.set(IV);
      }
      to.flags = flags;
      to.chunkPos = chunkPos;
      to.chunksDone = chunksDone;
      to.posOut = posOut;
      to.chunkOut = chunkOut;
      to.enableXOF = this.enableXOF;
      if (this.finished) {
        to.bufferOut32.set(this.bufferOut32);
      } else if (staleOutput) {
        clean(to.bufferOut32);
      }
      return to;
    }
    destroy() {
      this.destroyed = true;
      clean(this.state, this.buffer32, this.bufferOut32);
      if (this.IV !== B3_IV)
        clean(this.IV);
      clean(...this.stack);
    }
    // Root/XOF compression: rerun the same ROOT inputs with incrementing output
    // counter `t` and materialize all 16 output words.
    // Same as b2Compress, but doesn't modify state and returns 16 u32 array (instead of 8)
    b2CompressOut() {
      const { state: s, pos, flags, buffer32, bufferOut32: out32 } = this;
      const outCounter = this.chunkOut++;
      const t0 = fromNumL(outCounter);
      const t1 = fromNumH(outCounter);
      swap32IfBE(buffer32);
      const { v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15 } = _compress(B3_SIGMA, 0, buffer32, 7, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], B3_IV[0], B3_IV[1], B3_IV[2], B3_IV[3], t0, t1, pos, flags);
      out32[0] = v0 ^ v8;
      out32[1] = v1 ^ v9;
      out32[2] = v2 ^ v10;
      out32[3] = v3 ^ v11;
      out32[4] = v4 ^ v12;
      out32[5] = v5 ^ v13;
      out32[6] = v6 ^ v14;
      out32[7] = v7 ^ v15;
      out32[8] = s[0] ^ v8;
      out32[9] = s[1] ^ v9;
      out32[10] = s[2] ^ v10;
      out32[11] = s[3] ^ v11;
      out32[12] = s[4] ^ v12;
      out32[13] = s[5] ^ v13;
      out32[14] = s[6] ^ v14;
      out32[15] = s[7] ^ v15;
      swap32IfBE(buffer32);
      swap32IfBE(out32);
      this.posOut = 0;
    }
    finish() {
      if (this.finished)
        return;
      this.finished = true;
      this.buffer.fill(0, this.pos);
      let flags = this.flags | B3_Flags.ROOT;
      if (this.stack.length) {
        flags |= B3_Flags.PARENT;
        swap32IfBE(this.buffer32);
        this.compress(this.buffer32, 0, true);
        swap32IfBE(this.buffer32);
        this.chunksDone = 0;
        this.pos = this.blockLen;
      } else {
        flags |= (!this.chunkPos ? B3_Flags.CHUNK_START : 0) | B3_Flags.CHUNK_END;
      }
      this.flags = flags;
      this.b2CompressOut();
    }
    writeInto(out) {
      aexists(this, false);
      abytes(out);
      this.finish();
      const { blockLen, bufferOut } = this;
      for (let pos = 0, len = out.length; pos < len; ) {
        if (this.posOut >= blockLen)
          this.b2CompressOut();
        const take = Math.min(blockLen - this.posOut, len - pos);
        out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
        this.posOut += take;
        pos += take;
      }
      return out;
    }
    xofInto(out) {
      if (!this.enableXOF)
        throw new Error("no XOF after digest()");
      return this.writeInto(out);
    }
    xof(bytes) {
      anumber(bytes);
      return this.xofInto(new Uint8Array(bytes));
    }
    digestInto(out) {
      aoutput(out, this);
      if (this.finished)
        throw new Error("digest() was already called");
      this.enableXOF = false;
      this.writeInto(out.length === this.outputLen ? out : out.subarray(0, this.outputLen));
      this.destroy();
    }
    digest() {
      const out = new Uint8Array(this.outputLen);
      this.digestInto(out);
      return out;
    }
  };
  var blake3 = /* @__PURE__ */ createHasher((opts = {}) => new _BLAKE3(opts));

  // src/discovery.js
  var DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    revealChecksums: true,
    linkedPages: true,
    crossOriginChecksums: true,
    guessSidecars: true,
    notifications: false,
    resultPopups: false,
    downloadPanels: true,
    blockMode: "dangerous",
    theme: "light",
    historyLimit: 100,
    blockedHosts: [],
    interfaceMode: "basic"
  });
  function sanitizeSettings(input = {}) {
    if (!input || typeof input !== "object") input = {};
    const result = { ...DEFAULT_SETTINGS, blockedHosts: [] };
    for (const key of ["enabled", "revealChecksums", "linkedPages", "crossOriginChecksums", "guessSidecars", "notifications", "resultPopups", "downloadPanels"]) {
      if (typeof input[key] === "boolean") result[key] = input[key];
    }
    if (["off", "dangerous", "require-checksum", "hold-all"].includes(input.blockMode)) result.blockMode = input.blockMode;
    if (["system", "light", "dark"].includes(input.theme)) result.theme = input.theme;
    if (["basic", "advanced"].includes(input.interfaceMode)) result.interfaceMode = input.interfaceMode;
    if ([25, 50, 100].includes(input.historyLimit)) result.historyLimit = input.historyLimit;
    if (Array.isArray(input.blockedHosts)) result.blockedHosts = [...new Set(input.blockedHosts.filter((host) => typeof host === "string").map((host) => host.trim().toLowerCase()).filter((host) => /^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)*[a-z\d](?:[a-z\d-]*[a-z\d])?$/.test(host) && host.length <= 253))].slice(0, 100);
    return result;
  }
  var SUFFIX = /\.(md5|sha-?1|sha-?224|sha-?256|sha-?384|sha-?512|sha512[-_]224|sha512[-_]256|sha3[-_](?:224|256|384|512)|blake2b(?:[-_]?(?:128|160|224|256|384|512))?|blake2s(?:[-_]?(?:128|160|224|256))?|shake128[-_](?:128|256)|shake256[-_](?:256|512)|blake3|b3|crc32|sfv|ripemd160|keccak256)(?:sum)?(?:\.txt)?$/i;
  var FILE = /\.(?:exe|msi|msix|msixbundle|zip|7z|rar|tar(?:\.(?:gz|xz|bz2|zst))?|tgz|dmg|pkg|iso|deb|rpm|apk|appimage|bin|jar|whl|nupkg)$/i;
  function safeURL(value, base) {
    try {
      if (typeof value !== "string" || value.length > 4096) return null;
      const url = new URL(value, base);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
      url.hash = "";
      return url;
    } catch {
      return null;
    }
  }
  function sidecarInfo(value, base) {
    const url = safeURL(value, base);
    if (!url) return null;
    const aggregate = url.pathname.split("/").pop().match(/^(?:(sha-?(?:1|224|256|384|512)|md5|blake3)(?:sums?|checksums?)|checksums?|hashes|digests)(?:[._-](sha-?(?:1|224|256|384|512)|md5|blake3))?(?:\.(?:txt|json|asc))?$/i);
    if (aggregate) return { url: url.href, fileURL: "", filename: "", algorithm: aggregate[1] || aggregate[2] || "" };
    const match = url.pathname.match(SUFFIX);
    if (match) {
      const artifact = new URL(url);
      artifact.pathname = artifact.pathname.slice(0, -match[0].length);
      let filename;
      try {
        filename = decodeURIComponent(artifact.pathname.split("/").pop());
      } catch {
        return null;
      }
      const algorithm = { sfv: "crc32", b3: "blake3" }[match[1].toLowerCase()] || match[1];
      return { url: url.href, fileURL: artifact.href, filename, algorithm };
    }
    const name = url.pathname.split("/").pop();
    if (/^(?:(?:sha-?(?:1|224|256|384|512)|md5|blake3)(?:sums?|checksums?)|checksums?)(?:\.(?:txt|json))?$/i.test(name)) {
      return { url: url.href, fileURL: "", filename: "", algorithm: name.match(/^(sha-?(?:1|224|256|384|512)|md5|blake3)/i)?.[1] || "" };
    }
    return null;
  }
  function isDownloadURL(value, base) {
    const url = safeURL(value, base);
    return !!url && FILE.test(url.pathname);
  }
  function catalogForPage(value) {
    const page = safeURL(value);
    if (page?.protocol === "https:" && page.hostname === "github.com") {
      const match = page.pathname.match(/^\/([a-z\d_.-]+)\/([a-z\d_.-]+)\/releases(?:\/(latest|tag\/(.+)|download\/(.+)\/[^/]+))?\/?$/i);
      if (match) {
        let tag = "";
        try {
          tag = decodeURIComponent(match[4] || match[5] || "");
        } catch {
          return null;
        }
        const repository = `${match[1]}/${match[2]}`;
        return { name: "GitHub release", provider: "github", repository, tag, url: `https://api.github.com/repos/${repository}/releases/${tag ? "tags/" + encodeURIComponent(tag) : "latest"}` };
      }
    }
    if (page && ["www.jetbrains.com", "jetbrains.com"].includes(page.hostname) && /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?toolbox(?:-app)?(?:\/|$)/i.test(page.pathname)) {
      return { name: "JetBrains Toolbox", url: "https://data.services.jetbrains.com/products/releases?code=TBA&latest=true&type=release" };
    }
    return null;
  }
  function discoverURLs(text, base) {
    if (typeof text !== "string") return [];
    const source = text.slice(0, 2 * 1024 * 1024).replace(/\\u002f/ig, "/").replace(/\\u003a/ig, ":").replace(/\\u0026/ig, "&").replace(/\\\//g, "/").replace(/&amp;/g, "&");
    const found = /* @__PURE__ */ new Map();
    const patterns = [/https?:\/\/[^\s"'<>`\\]+/ig, /["'`]((?:\/|\.\.\/|\.\/)[^\s"'<>`\\]+)["'`]/g];
    for (const pattern of patterns) for (const match of source.matchAll(pattern)) {
      const url = safeURL(match[1] || match[0], base);
      if (!url) continue;
      const sidecar = sidecarInfo(url.href);
      if (sidecar?.fileURL && isDownloadURL(sidecar.fileURL)) found.set(sidecar.fileURL, { url: sidecar.fileURL, checksumURL: sidecar.url, foundIn: "Page code" });
      else if (isDownloadURL(url.href)) found.set(url.href, { url: url.href, checksumURL: "", foundIn: "Page code" });
      if (found.size >= 200) return [...found.values()];
    }
    return [...found.values()];
  }
  function sidecarCandidates(item) {
    const candidates = /* @__PURE__ */ new Set();
    for (const value of [item.url, item.finalUrl]) {
      const url = safeURL(value);
      if (!url || !FILE.test(url.pathname)) continue;
      for (const suffix of [".sha256", ".sha512"]) {
        const sidecar = new URL(url);
        sidecar.pathname += suffix;
        candidates.add(sidecar.href);
      }
    }
    const first = safeURL(item.finalUrl || item.url);
    if (first && FILE.test(first.pathname)) {
      const stem = new URL(first);
      stem.pathname = stem.pathname.replace(/\.[^.\/]+$/, ".sha256");
      candidates.add(stem.href);
      for (const name of ["SHA256SUMS", "SHA512SUMS", "checksums.txt", "checksums.sha256", "SHA256SUMS.txt", "checksums.json"]) {
        const list = new URL(first);
        list.pathname = list.pathname.replace(/[^/]+$/, name);
        candidates.add(list.href);
      }
    }
    return [...candidates].slice(0, 10);
  }
  function isPublicHTTPS(value) {
    const url = safeURL(value);
    if (!url || url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host.includes(".") && !/^[\d.]+$/.test(host) && !host.includes(":") && !/(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid)$/.test(host);
  }
  var DANGEROUS = /* @__PURE__ */ new Set(["url", "content", "host", "unwanted", "sensitiveContentBlock", "deepScannedOpenedDangerous", "accountCompromise", "blockedScanFailed"]);
  function downloadDecision(item, entries, settings, algorithms) {
    if (!settings.enabled) return { action: "allow", reason: "" };
    const hosts = [item.url, item.finalUrl].map((value) => safeURL(value)?.hostname.toLowerCase()).filter(Boolean);
    if (hosts.some((host) => settings.blockedHosts.includes(host))) return { action: "cancel", reason: "This download host is on your blocklist." };
    if (settings.blockMode !== "off" && DANGEROUS.has(item.danger)) return { action: "cancel", reason: `Chrome flagged this download: ${item.danger}.` };
    if (settings.blockMode === "hold-all") return { action: "hold", reason: "Your settings require approval for every download." };
    if (settings.blockMode === "require-checksum") {
      const grouped = /* @__PURE__ */ new Map();
      for (const entry of entries) {
        if (!grouped.has(entry.algorithm)) grouped.set(entry.algorithm, /* @__PURE__ */ new Set());
        grouped.get(entry.algorithm).add(entry.value);
      }
      if ([...grouped.values()].some((values) => values.size > 1)) return { action: "hold", reason: "Publisher checksum values conflict. Review them before allowing this download." };
    }
    if (settings.blockMode === "require-checksum" && !entries.some((e) => algorithms[e.algorithm] && !algorithms[e.algorithm].weak)) {
      return { action: "hold", reason: "No strong publisher checksum is associated with this file yet." };
    }
    return { action: "allow", reason: "" };
  }

  // src/core.js
  var CRC32 = class {
    constructor() {
      this.value = 4294967295;
    }
    update(bytes) {
      for (const byte of bytes) {
        this.value ^= byte;
        for (let i = 0; i < 8; i++) this.value = this.value >>> 1 ^ 3988292384 & -(this.value & 1);
      }
      return this;
    }
    digest() {
      const value = (this.value ^ 4294967295) >>> 0;
      return Uint8Array.of(value >>> 24, value >>> 16, value >>> 8, value);
    }
  };
  var ALGORITHMS = Object.freeze({
    crc32: { bytes: 4, weak: true, create: () => new CRC32() },
    md5: { bytes: 16, weak: true, create: md5.create },
    sha1: { bytes: 20, weak: true, create: sha1.create },
    ripemd160: { bytes: 20, weak: true, create: ripemd160.create },
    sha224: { bytes: 28, create: sha224.create },
    sha256: { bytes: 32, create: sha256.create },
    sha384: { bytes: 48, create: sha384.create },
    sha512: { bytes: 64, create: sha512.create },
    sha512224: { bytes: 28, create: sha512_224.create },
    sha512256: { bytes: 32, create: sha512_256.create },
    sha3224: { bytes: 28, create: sha3_224.create },
    sha3256: { bytes: 32, create: sha3_256.create },
    sha3384: { bytes: 48, create: sha3_384.create },
    sha3512: { bytes: 64, create: sha3_512.create },
    keccak256: { bytes: 32, create: keccak_256.create },
    shake128128: { bytes: 16, weak: true, create: () => shake128.create({ dkLen: 16 }) },
    shake128256: { bytes: 32, create: () => shake128.create({ dkLen: 32 }) },
    shake256256: { bytes: 32, create: () => shake256.create({ dkLen: 32 }) },
    shake256512: { bytes: 64, create: () => shake256.create({ dkLen: 64 }) },
    blake2b128: { bytes: 16, weak: true, create: () => blake2b.create({ dkLen: 16 }) },
    blake2b160: { bytes: 20, weak: true, create: () => blake2b.create({ dkLen: 20 }) },
    blake2b224: { bytes: 28, create: () => blake2b.create({ dkLen: 28 }) },
    blake2b256: { bytes: 32, create: () => blake2b.create({ dkLen: 32 }) },
    blake2b384: { bytes: 48, create: () => blake2b.create({ dkLen: 48 }) },
    blake2s128: { bytes: 16, weak: true, create: () => blake2s.create({ dkLen: 16 }) },
    blake2s160: { bytes: 20, weak: true, create: () => blake2s.create({ dkLen: 20 }) },
    blake2s224: { bytes: 28, create: () => blake2s.create({ dkLen: 28 }) },
    blake2b: { bytes: 64, create: blake2b.create },
    blake2s: { bytes: 32, create: blake2s.create },
    blake3: { bytes: 32, create: blake3.create }
  });
  function normalizeAlgorithm(value) {
    const key = String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
    return {
      sha2256: "sha256",
      sha2224: "sha224",
      sha2384: "sha384",
      sha2512: "sha512",
      blake2b512: "blake2b",
      blake2s256: "blake2s",
      blake3256: "blake3"
    }[key] || key;
  }
  function validEntry(entry) {
    return !!entry && Object.hasOwn(ALGORITHMS, entry.algorithm) && typeof entry.value === "string" && entry.value.length === ALGORITHMS[entry.algorithm].bytes * 2 && /^[a-f\d]+$/i.test(entry.value);
  }
  function basename(value) {
    return String(value).replace(/\\/g, "/").split("/").pop();
  }
  function urlFilename(value) {
    try {
      return decodeURIComponent(basename(new URL(value).pathname));
    } catch {
      return "";
    }
  }
  function canonicalURL(value) {
    try {
      if (typeof value !== "string" || value.length > 4096) return null;
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
      url.hash = "";
      return url.href;
    } catch {
      return null;
    }
  }
  function parseStructuredChecksums(text, source = "", filenameHint = "") {
    if (typeof text !== "string" || text.length > 2 * 1024 * 1024) return [];
    let root;
    try {
      root = JSON.parse(text);
    } catch {
      const assignment = text.match(/(?:^|[;\n])\s*(?:(?:const|let|var)\s+)?[\w.$]+\s*=\s*([\[{][\s\S]*[\]}])\s*;?\s*$/);
      if (!assignment) return [];
      try {
        root = JSON.parse(assignment[1]);
      } catch {
        return [];
      }
    }
    const queue = [{ value: root, filename: String(filenameHint), algorithm: "", downloadURL: "" }], entries = [];
    let visited = 0;
    while (queue.length && visited++ < 5e3 && entries.length < 2e3) {
      const { value, filename: inherited, algorithm: inheritedAlgorithm, downloadURL: inheritedURL } = queue.shift();
      if (!value || typeof value !== "object") continue;
      const identity = value.filename || value.fileName || value.file || value.path;
      const url = value.downloadUrl || value.download_url || value.browser_download_url || value.url;
      const itemAlgorithm = normalizeAlgorithm(value.algorithm || value.hashAlgorithm || value.checksumType || value.type || inheritedAlgorithm);
      const filename = typeof identity === "string" ? basename(identity) : typeof url === "string" ? urlFilename(url) : typeof value.name === "string" ? basename(value.name) : inherited;
      const downloadURL = canonicalURL(url) || (filename === inherited ? inheritedURL : "");
      const append = (parsed) => entries.push(...parsed.map((entry) => ({ ...entry, downloadURL })));
      for (const [key, child] of Object.entries(value).slice(0, 500)) {
        const algorithm = normalizeAlgorithm(key);
        if (filename && Object.hasOwn(ALGORITHMS, algorithm) && typeof child === "string") {
          append(parseChecksums(child, { algorithm, filename, source }));
        }
        if (filename && /^(?:checksum|digest|hash|value)$/i.test(key) && typeof child === "string") {
          const hint = itemAlgorithm;
          append(parseChecksums(child, { algorithm: hint, filename, source }));
        }
        const keyFilename = /^[^\s{}\[\]"<>]+\.[a-z\d]{1,12}$/i.test(key) ? basename(key) : "";
        if (keyFilename && typeof child === "string") append(parseChecksums(child, { algorithm: itemAlgorithm, filename: keyFilename, source }));
        if (child && typeof child === "object") {
          queue.push({ value: child, filename: keyFilename || filename, algorithm: Object.hasOwn(ALGORITHMS, algorithm) ? algorithm : itemAlgorithm, downloadURL: keyFilename && keyFilename !== filename ? "" : downloadURL });
        }
      }
    }
    return entries.filter(validEntry).slice(0, 2e3).map((entry) => ({ ...entry, format: "Structured JSON" }));
  }
  function githubReleaseAssets(data, catalog) {
    const files = /* @__PURE__ */ new Map(), entries = [];
    if (catalog?.provider !== "github" || !data || data.draft || typeof data.tag_name !== "string" || !Array.isArray(data.assets) || !data.tag_name) return { files: [], entries: [] };
    if (catalog.tag && catalog.tag !== data.tag_name) return { files: [], entries: [] };
    for (const asset of data.assets.slice(0, 200)) {
      const url = canonicalURL(asset?.browser_download_url);
      if (!url || new URL(url).origin !== "https://github.com" || typeof asset.name !== "string" || urlFilename(url) !== asset.name || asset.state !== "uploaded") continue;
      const identity = new URL(url).pathname.match(/^\/([^/]+)\/([^/]+)\/releases\/download\/(.+)\/[^/]+$/);
      if (!identity || `${identity[1]}/${identity[2]}`.toLowerCase() !== catalog.repository.toLowerCase()) continue;
      try {
        if (decodeURIComponent(identity[3]) !== data.tag_name) continue;
      } catch {
        continue;
      }
      const sidecar = sidecarInfo(url);
      const target = sidecar?.fileURL || url;
      if (!isDownloadURL(target)) continue;
      const previous = files.get(target);
      files.set(target, { url: target, checksumURL: sidecar?.url || previous?.checksumURL || "", foundIn: "Publisher catalog" });
      if (target === url && typeof asset.digest === "string" && /^sha256:[a-f\d]{64}$/i.test(asset.digest)) {
        entries.push({ algorithm: "sha256", value: asset.digest.slice(7).toLowerCase(), filename: asset.name, downloadURL: url, source: catalog.url, inferred: false, format: "GitHub release digest" });
      }
    }
    return { files: [...files.values()], entries };
  }
  var DEFAULTS = { 32: "md5", 40: "sha1", 56: "sha224", 64: "sha256", 96: "sha384", 128: "sha512" };
  var LABEL = /\b(?:sha(?:[-_ ]?3[-_ ]?(?:224|256|384|512)|[-_ ]?512[\/_-](?:224|256)|[-_ ]?2[-_ ]?(?:224|256|384|512)|[-_ ]?(?:1|224|256|384|512))|shake[-_ ]?(?:128[-_ /](?:128|256)|256[-_ /](?:256|512))|md5|crc[-_ ]?32|ripemd[-_ ]?160|blake2[bs](?:[-_ ]?(?:128|160|224|256|384|512))?|blake3(?:[-_ ]?256)?|keccak[-_ ]?256)\b/ig;
  function joinWrappedDigests(text) {
    const lines = text.split(/\r?\n/), result = [];
    for (let index = 0; index < lines.length; index++) {
      const heading = lines[index].trim().match(/^([a-z][a-z\d/_ -]*):?\s*$/i);
      const algorithm = heading && normalizeAlgorithm(heading[1]);
      result.push(lines[index]);
      if (!algorithm || !Object.hasOwn(ALGORITHMS, algorithm)) continue;
      let joined = "", end = index;
      for (let next = index + 1; next < Math.min(index + 10, lines.length); next++) {
        const part = lines[next].trim();
        if (!/^[a-f\d ]{8,}$/i.test(part)) break;
        joined += part.replace(/\s/g, "");
        end = next;
        if (joined.length >= ALGORITHMS[algorithm].bytes * 2) break;
      }
      if (joined.length === ALGORITHMS[algorithm].bytes * 2) {
        result.push(joined);
        index = end;
      }
    }
    return result.join("\n");
  }
  function parseChecksums(text, { source = "", algorithm = "", filename = "" } = {}) {
    if (typeof text !== "string") return [];
    const entries = [];
    const push = (algo, value, file = "", inferred = false, format = "Labeled digest") => {
      const entry = { algorithm: normalizeAlgorithm(algo), value: value.toLowerCase(), filename: file.trim(), source, inferred, format };
      if (validEntry(entry)) entries.push(entry);
    };
    const hint = normalizeAlgorithm(algorithm);
    let sectionHint = hint;
    let input = text.slice(0, 2 * 1024 * 1024);
    if (input.includes("\0")) input = input.split("\0").filter(Boolean).map((record) => "\\" + record.replace(/\\/g, "\\\\").replace(/\r/g, "\\r").replace(/\n/g, "\\n")).join("\n");
    for (const raw of joinWrappedDigests(input).split(/\r?\n/).slice(0, 2e4)) {
      const escaped = raw.startsWith("\\");
      const line = (escaped ? raw.slice(1) : raw).trim().slice(0, 8192);
      const fileName = (value) => escaped ? value.replace(/\\([\\nr])/g, (_, letter) => letter === "n" ? "\n" : letter === "r" ? "\r" : "\\") : value;
      if (!line || /^[;#]/.test(line)) continue;
      const heading = line.match(/^([a-z][a-z\d/_ -]*):?$/i);
      if (heading && Object.hasOwn(ALGORITHMS, normalizeAlgorithm(heading[1]))) {
        sectionHint = normalizeAlgorithm(heading[1]);
        continue;
      }
      let match = line.match(/^(.+?)\s*\((.+)\)\s*=\s*([a-z\d+/]+={0,2})$/i);
      if (match) {
        const named = normalizeAlgorithm(match[1]), value = match[3];
        if (Object.hasOwn(ALGORITHMS, named)) {
          if (/^[a-f\d]+$/i.test(value) && value.length === ALGORITHMS[named].bytes * 2) push(named, value, fileName(match[2]), false, "BSD checksum list");
          else try {
            push(named, [...atob(value)].map((char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join(""), fileName(match[2]), false, "Tagged base64 checksum");
          } catch {
          }
        }
        continue;
      }
      const unique = [...new Set([...line.matchAll(LABEL)].map((m) => normalizeAlgorithm(m[0])))];
      if (unique.some((name) => !Object.hasOwn(ALGORITHMS, name))) continue;
      const labeled = unique.length === 1 ? unique[0] : "";
      const grouped = line.match(/^[a-z][a-z\d/_ -]*\s*[:=]\s*([a-f\d]+(?:[ \t]+[a-f\d]+)+)$/i);
      if (labeled && grouped) {
        push(labeled, grouped[1].replace(/\s/g, ""), filename);
        continue;
      }
      const base64 = line.match(/^[a-z][a-z\d/_ -]*\s*[:=]\s*([A-Za-z\d+/]+={0,2})$/i);
      if (labeled && base64 && (!/^[a-f\d]+$/i.test(base64[1]) || base64[1].length !== ALGORITHMS[labeled].bytes * 2)) {
        try {
          push(labeled, [...atob(base64[1])].map((char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join(""), filename, false, "Base64 digest");
        } catch {
        }
        continue;
      }
      for (const sri of line.matchAll(/\b(sha(?:256|384|512))-([A-Za-z0-9+/]+={0,2})(?=\s|$|["'])/g)) {
        try {
          push(sri[1], [...atob(sri[2])].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join(""), filename);
        } catch {
        }
      }
      match = line.match(/^([a-f\d]{8,128})[ \t]+[* ]?(.+)$/i);
      if (match) {
        const algo = sectionHint || DEFAULTS[match[1].length];
        if (algo) push(algo, match[1], fileName(match[2]), !sectionHint, "GNU checksum list");
        continue;
      }
      match = line.match(/^(.+?)[ \t]+([a-f\d]{8})$/i);
      if (match && (!sectionHint || sectionHint === "crc32") && (!labeled || labeled === "crc32")) {
        push("crc32", match[2], match[1]);
        continue;
      }
      if (unique.length > 1) continue;
      const filenameFirst = line.match(/^([^\s:]+\.[a-z\d.]+)\s*(?::|[ \t])\s*([a-f\d]{32,128})$/i);
      if (filenameFirst) {
        const algo = labeled || sectionHint || DEFAULTS[filenameFirst[2].length];
        if (algo) push(algo, filenameFirst[2], filenameFirst[1], !labeled && !sectionHint, "Filename checksum record");
        continue;
      }
      if (!labeled && /[a-z][a-z\d_-]*\s*[:=]/i.test(line)) continue;
      for (const token of line.matchAll(/(?<![a-z\d])([a-f\d]{8,128})(?![a-z\d])/ig)) {
        const algo = labeled || sectionHint || DEFAULTS[token[1].length];
        if (algo) push(algo, token[1], filename, !labeled && !sectionHint);
      }
      if (entries.length >= 2e3) break;
    }
    return [...new Map(entries.map((e) => [`${e.algorithm}:${e.value}:${e.filename}`, e])).values()].slice(0, 2e3);
  }
  function forFile(entries, filename, allowUnbound = false) {
    return entries.filter((e) => validEntry(e) && (e.filename ? basename(e.filename) === filename : allowUnbound));
  }
  function verify(entries, digests) {
    const grouped = /* @__PURE__ */ new Map();
    for (const entry of entries.filter(validEntry)) {
      if (!grouped.has(entry.algorithm)) grouped.set(entry.algorithm, /* @__PURE__ */ new Set());
      grouped.get(entry.algorithm).add(entry.value.toLowerCase());
    }
    const conflicts = [...grouped].filter(([, values]) => values.size > 1).map(([algorithm]) => algorithm);
    const results = [...grouped].map(([algorithm, values]) => ({
      algorithm,
      expected: [...values],
      actual: digests[algorithm] || "",
      match: values.size === 1 && values.has(digests[algorithm])
    }));
    const status = !results.length ? "unverified" : conflicts.length ? "conflict" : results.every((r) => r.match) ? results.every((r) => ALGORITHMS[r.algorithm].weak) ? "weak-match" : "match" : "mismatch";
    return { status, results, conflicts };
  }
  async function hashBlob(blob, algorithms, progress = () => {
  }) {
    const names = [...new Set(algorithms)];
    if (!names.length || names.some((a) => !Object.hasOwn(ALGORITHMS, a))) throw new Error("Unsupported checksum algorithm.");
    const hashers = names.map((a) => ALGORITHMS[a].create());
    const chunkSize = 1024 * 1024;
    for (let offset = 0; offset < blob.size; offset += chunkSize) {
      const bytes = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
      hashers.forEach((h) => h.update(bytes));
      progress(Math.min(offset + chunkSize, blob.size), blob.size);
    }
    const digests = {};
    names.forEach((a, i) => {
      digests[a] = Array.from(hashers[i].digest(), (b) => b.toString(16).padStart(2, "0")).join("");
    });
    return digests;
  }
  function fileURL(path) {
    if (typeof path !== "string") throw new Error("Missing download path.");
    const normalized = path.replace(/\\/g, "/");
    if (/^[a-z]:\//i.test(normalized)) return "file:///" + normalized.split("/").map((s, i) => i ? encodeURIComponent(s) : s).join("/");
    if (normalized.startsWith("//")) throw new Error("Network file paths require manual verification.");
    if (normalized.startsWith("/")) return "file://" + normalized.split("/").map(encodeURIComponent).join("/");
    throw new Error("The download path is not absolute.");
  }
  function securityWarnings(item, entries = []) {
    const warnings = [];
    if (item.danger && !["safe", "deepScannedSafe", "allowlistedByPolicy"].includes(item.danger)) warnings.push(`Chrome download warning: ${item.danger}`);
    for (const [label, url] of [["Download", item.finalUrl || item.url], ["Checksum page", item.referrer]]) {
      if (url?.startsWith("http:")) warnings.push(`${label} uses insecure HTTP; its contents can be changed in transit.`);
    }
    const name = basename(item.filename || "").toLowerCase();
    if (/\.(?:exe|msi|msix|scr|com|bat|cmd|ps1|vbs|js|jar|dmg|pkg|app|deb|rpm|apk)$/.test(name)) warnings.push("Executable or installer: only run software from a trusted publisher.");
    if (/\.(?:pdf|docx?|xlsx?|png|jpe?g|txt)\.(?:exe|scr|com|bat|cmd|js|vbs)$/i.test(name)) warnings.push("Misleading double extension: this file may be disguised as a document.");
    if (/[\u202a-\u202e\u2066-\u2069]/u.test(name)) warnings.push("The filename contains direction-changing characters that can disguise its type.");
    if (entries.some((e) => ALGORITHMS[e.algorithm]?.weak)) warnings.push("These legacy or short-output checksums provide limited assurance; use a stronger publisher digest when available.");
    if (entries.some((e) => e.inferred)) warnings.push("An unlabeled digest was interpreted using conventional hash lengths; confirm the publisher\u2019s algorithm.");
    if (!entries.length) warnings.push("No checksum could be associated with this file. Integrity is unverified.");
    return warnings;
  }
  return __toCommonJS(core_exports);
})();
