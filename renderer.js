/* Gloamwood cinematic renderer — WebGL2 raycast scene with filmic post-processing.
   The gameplay layer stays in game.js; this file only turns world state into pixels. */
(() => {
  'use strict';

  const VERT = `#version 300 es
  layout(location = 0) in vec2 aPos;
  void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const COMMON = `
  const float PI = 3.14159265;
  float hash12(vec2 p){
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p){
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++){ s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return s;
  }
  float fbm3(vec2 p){
    float s = 0.0, a = 0.55;
    for (int i = 0; i < 3; i++){ s += a * noise(p); p = p * 2.07 + 11.7; a *= 0.5; }
    return s;
  }
  `;

  const SCENE_FRAG = `#version 300 es
  precision highp float;
  precision highp int;
  uniform vec2  uRes;
  uniform float uTime;
  uniform vec2  uPos;
  uniform float uAngle;
  uniform float uFlash;
  uniform float uLightning;
  uniform float uHorizon;
  uniform int   uLightCount;
  uniform vec3  uLightPos[8];
  uniform vec3  uLightCol[8];
  uniform highp sampler2DArray uTex;
  uniform highp usampler2D uMap;
  uniform int   uMapSize;
  out vec4 outColor;
  ${COMMON}
  int readCell(ivec2 c){
    if (c.x < 0 || c.y < 0 || c.x >= uMapSize || c.y >= uMapSize) return 1;
    return int(texelFetch(uMap, c, 0).r);
  }
  vec3 texel(float layer, vec2 uv){
    return texture(uTex, vec3(uv, layer)).rgb;
  }
  vec3 aces(vec3 x){
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  vec3 skyColor(vec3 rd, float lightning){
    vec2 ray = rd.xz;
    vec2 cp = ray / max(0.055, rd.y);
    float clouds = fbm3(cp * 0.30 + vec2(uTime * 0.010, -uTime * 0.006));
    clouds = smoothstep(0.38, 0.80, clouds);
    float up = clamp(rd.y, 0.0, 1.0);
    vec3 zenith = vec3(0.026, 0.038, 0.050);
    vec3 horizon = vec3(0.092, 0.118, 0.122);
    vec3 col = mix(horizon, zenith, pow(up, 0.55));
    col += vec3(0.095, 0.120, 0.130) * exp(-up * 7.0);
    vec3 moonDir = normalize(vec3(0.42, 0.33, -0.84));
    float md = max(dot(rd, moonDir), 0.0);
    col += vec3(0.30, 0.34, 0.37) * pow(md, 420.0) * 0.85;
    col += vec3(0.12, 0.15, 0.18) * pow(md, 12.0) * 0.30;
    vec3 cloudDark = vec3(0.034, 0.044, 0.050);
    vec3 cloudLit = vec3(0.170, 0.188, 0.190);
    vec3 cloudCol = mix(cloudDark, cloudLit, clouds * (0.35 + 0.65 * smoothstep(0.0, 0.5, md)));
    cloudCol += vec3(0.35, 0.40, 0.48) * lightning * (0.45 + 0.55 * clouds);
    col = mix(col, cloudCol, clouds * 0.88);
    col += vec3(0.55, 0.62, 0.72) * lightning * 0.32;
    float haze = exp(-up * 14.0);
    col = mix(col, vec3(0.078, 0.098, 0.102), haze * 0.52);
    return col;
  }

  void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    float aspect = uRes.x / uRes.y;
    float camX = uv.x * 2.0 - 1.0;
    float horizon = uHorizon * uRes.y;
    vec2 dir = vec2(cos(uAngle), sin(uAngle));
    vec2 plane = vec2(-dir.y, dir.x) * 0.66;
    vec2 ray = dir + plane * camX;
    float focal = uRes.x * 0.757576;

    int mapX = int(floor(uPos.x));
    int mapY = int(floor(uPos.y));
    vec2 delta = abs(1.0 / max(abs(ray), vec2(1e-5)));
    ivec2 stepI = ivec2(ray.x < 0.0 ? -1 : 1, ray.y < 0.0 ? -1 : 1);
    vec2 sideDist;
    sideDist.x = ray.x < 0.0 ? (uPos.x - float(mapX)) * delta.x : (float(mapX) + 1.0 - uPos.x) * delta.x;
    sideDist.y = ray.y < 0.0 ? (uPos.y - float(mapY)) * delta.y : (float(mapY) + 1.0 - uPos.y) * delta.y;
    int side = 0;
    int mat = 0;
    ivec2 hitCell = ivec2(0);
    float wallDist = 90.0;
    for (int i = 0; i < 90; i++){
      if (sideDist.x < sideDist.y){ sideDist.x += delta.x; mapX += stepI.x; side = 0; }
      else { sideDist.y += delta.y; mapY += stepI.y; side = 1; }
      int c = readCell(ivec2(mapX, mapY));
      if (c > 0){
        wallDist = max(0.03, side == 0 ? sideDist.x - delta.x : sideDist.y - delta.y);
        mat = c; hitCell = ivec2(mapX, mapY); break;
      }
      if (mapX < -1 || mapY < -1 || mapX > uMapSize || mapY > uMapSize) break;
    }
    bool hasWall = mat > 0;
    float wallTop = hasWall ? horizon - (focal * 0.5) / wallDist : -1e9;
    float wallBottom = hasWall ? horizon + (focal * 0.5) / wallDist : -1e9;

    vec3 color = vec3(0.0);
    float wet = 0.0;
    vec3 fogCol = vec3(0.080, 0.100, 0.104);

    if (hasWall && gl_FragCoord.y >= wallTop && gl_FragCoord.y <= wallBottom){
      float u = side == 0 ? fract(uPos.y + ray.y * wallDist) : fract(uPos.x + ray.x * wallDist);
      float v = clamp((gl_FragCoord.y - wallTop) / max(1.0, wallBottom - wallTop), 0.0, 1.0);
      int layer = clamp((mat >= 11 ? mat - 10 : mat) - 1, 0, 8);
      vec3 albedo = texel(float(layer), vec2(u, v));
      float cellHash = hash12(vec2(hitCell));
      vec3 emissive = vec3(0.0);
      vec3 n = side == 0 ? vec3(-float(stepI.x), 0.0, 0.0) : vec3(0.0, 0.0, -float(stepI.y));

      if (layer < 9 && cellHash > 0.30){
        float wx = smoothstep(0.335, 0.356, u) * (1.0 - smoothstep(0.644, 0.665, u));
        float wy = smoothstep(0.232, 0.252, v) * (1.0 - smoothstep(0.568, 0.588, v));
        float win = wx * wy;
        float lit = step(0.44, hash12(vec2(hitCell) * 1.37 + 9.1));
        float warm = step(0.56, hash12(vec2(hitCell) + 3.7));
        vec3 wcol = mix(vec3(1.00, 0.60, 0.30), vec3(0.54, 0.82, 0.76), warm);
        float inner = win * smoothstep(0.006, 0.018, min(min(u - 0.335, 0.665 - u), min(v - 0.232, 0.588 - v)));
        float b1 = 1.0 - smoothstep(0.0, 0.0065, abs(u - 0.440));
        float b2 = 1.0 - smoothstep(0.0, 0.0065, abs(u - 0.560));
        float b3 = 1.0 - smoothstep(0.0, 0.0060, abs(v - 0.405));
        float bars = win * max(max(b1, b2), b3);
        albedo = mix(albedo, vec3(0.010, 0.014, 0.019), win * 0.94);
        albedo = mix(albedo, vec3(0.072, 0.060, 0.048), bars * 0.92);
        float frame = clamp(win - inner, 0.0, 1.0);
        albedo = mix(albedo, vec3(0.095, 0.078, 0.058), frame * 0.86);
        float curtain = 0.55 + 0.45 * smoothstep(0.26, 0.55, v) + 0.06 * sin(u * 83.0 + cellHash * 40.0);
        float shape = smoothstep(0.52, 0.60, hash12(vec2(hitCell) * 2.11 + 5.0));
        float sil = shape * smoothstep(0.10, 0.0, abs(u - 0.48)) * smoothstep(0.36, 0.24, v);
        emissive += wcol * lit * inner * curtain * (1.0 - 0.65 * sil) * 0.20;
        emissive += wcol * lit * bars * 0.015;
        albedo += vec3(0.020, 0.030, 0.040) * win * (1.0 - lit) * 0.7;
      }
      if (layer < 9 && cellHash > 0.67){
        float dx = smoothstep(0.425, 0.448, u) * (1.0 - smoothstep(0.552, 0.575, u));
        float door = dx * smoothstep(0.772, 0.800, v);
        float dframe = dx * (1.0 - smoothstep(0.772, 0.788, v));
        albedo = mix(albedo, vec3(0.045, 0.032, 0.023), door * 0.84);
        albedo = mix(albedo, vec3(0.090, 0.070, 0.050), dframe * 0.6);
        albedo = mix(albedo, vec3(0.020, 0.025, 0.022), smoothstep(0.83, 0.835, v) * door * 0.5);
        emissive += vec3(1.0, 0.48, 0.18) * door * smoothstep(0.972, 1.0, v) * 0.16;
      }
      vec3 P = vec3(uPos.x + ray.x * wallDist, 1.0 - v, uPos.y + ray.y * wallDist);
      vec3 V = normalize(vec3(uPos.x, 0.5, uPos.y) - P);
      float grain = noise(vec2(u * 37.0, v * 61.0));
      float wallWet = 0.45 + 0.55 * grain;
      float rainRun = smoothstep(0.55, 1.0, noise(vec2(u * 21.0, v * 3.0 - uTime * 0.35))) * 0.18;
      albedo *= 1.0 - rainRun;
      vec3 lit = albedo * vec3(0.360, 0.395, 0.410);
      lit += albedo * vec3(0.028, 0.036, 0.042);
      lit += emissive;

      if (uFlash > 0.5){
        vec3 toEye = normalize(vec3(uPos.x, 0.5, uPos.y) - P);
        vec3 beamDir = normalize(vec3(ray.x, (horizon - gl_FragCoord.y) / focal, ray.y));
        float spot = smoothstep(0.45, 0.93, dot(beamDir, vec3(dir.x, 0.0, dir.y)));
        float dist = max(0.15, wallDist);
        float power = 2.75 / (1.0 + 0.10 * dist * dist);
        float ndl = max(dot(n, toEye), 0.0);
        vec3 flashCol = vec3(1.0, 0.90, 0.70);
        lit += albedo * flashCol * ndl * spot * power * 2.4;
        lit += flashCol * pow(max(dot(n, toEye), 0.0), 22.0) * spot * power * wallWet * 0.22;
      }

      for (int i = 0; i < 8; i++){
        if (i >= uLightCount) break;
        vec3 lp = uLightPos[i];
        vec3 Lv = vec3(lp.x - P.x, 1.12 - P.y, lp.y - P.z);
        float dl = length(Lv);
        float att = max(0.0, 1.0 - dl / max(0.2, lp.z));
        att = pow(att, 1.25) / (1.0 + 0.035 * dl * dl);
        vec3 L = Lv / max(0.001, dl);
        float ndl = max(dot(n, L), 0.0);
        lit += albedo * uLightCol[i] * ndl * att * 3.4;
        vec3 H = normalize(L + V);
        lit += uLightCol[i] * pow(max(dot(n, H), 0.0), 34.0) * att * wallWet * 0.85;
      }

      lit += albedo * vec3(0.58, 0.66, 0.78) * uLightning;
      float fog = 1.0 - exp(-pow(wallDist * 0.088, 1.65));
      color = mix(lit, fogCol, clamp(fog, 0.0, 0.94));
    }
    else if (gl_FragCoord.y > horizon){
      float gd = (0.5 * focal) / max(0.5, gl_FragCoord.y - horizon);
      vec2 wp = uPos + ray * gd;
      ivec2 wc = ivec2(floor(wp.x), floor(wp.y));
      bool roadX = (wc.x % 6 == 0);
      bool roadY = (wc.y % 6 == 0);
      bool road = roadX || roadY;
      int layer = road ? 9 : 10;
      vec2 fuv = wp * (road ? 0.58 : 1.30);
      vec3 albedo = texel(float(layer), fuv);
      vec2 fcell = fract(wp);
      float cellRand = hash12(vec2(wc) + 4.3);
      float manhole = (1.0 - smoothstep(0.28, 0.31, length(fcell - vec2(0.5)))) * step(0.74, cellRand);
      albedo = mix(albedo, vec3(0.052, 0.060, 0.058), manhole * 0.9);
      float dashX = roadX ? (1.0 - smoothstep(0.016, 0.034, abs(fcell.x - 0.5))) * step(0.45, fract(wp.y * 0.62)) : 0.0;
      float dashY = roadY ? (1.0 - smoothstep(0.016, 0.034, abs(fcell.y - 0.5))) * step(0.45, fract(wp.x * 0.62)) : 0.0;
      float dash = clamp(dashX + dashY, 0.0, 1.0);
      albedo = mix(albedo, vec3(0.42, 0.37, 0.27), dash * 0.38);
      float pud = fbm3(wp * 0.42 + vec2(3.7, 9.2));
      pud = smoothstep(0.47, 0.62, pud);
      float fres = pow(1.0 - 0.5 / max(0.25, sqrt(gd * gd + 0.25)), 2.6);
      float ripple = noise(wp * 7.5 + vec2(uTime * 0.9, -uTime * 1.3));
      albedo *= mix(1.0, 0.46, pud);
      albedo *= 0.88 + 0.24 * ripple;
      vec3 P = vec3(wp.x, 0.0, wp.y);
      vec3 V = normalize(vec3(uPos.x, 0.5, uPos.y) - P);
      vec3 N = normalize(vec3((ripple - 0.5) * 0.22 * pud, 1.0, (noise(wp * 5.0 + 4.2) - 0.5) * 0.22 * pud));
      vec3 lit = albedo * vec3(0.330, 0.365, 0.375);
      if (uFlash > 0.5){
        vec3 beamDir = normalize(vec3(ray.x, (horizon - gl_FragCoord.y) / focal, ray.y));
        float spot = smoothstep(0.42, 0.94, dot(beamDir, vec3(dir.x, 0.0, dir.y)));
        float power = 2.35 / (1.0 + 0.10 * gd * gd);
        float ndl = 0.92;
        vec3 flashCol = vec3(1.0, 0.90, 0.70);
        lit += albedo * flashCol * ndl * spot * power * 2.4;
        vec3 H = normalize(V + V);
        lit += flashCol * pow(max(dot(N, H), 0.0), 90.0) * spot * power * (0.25 + pud * 2.4);
      }
      for (int i = 0; i < 8; i++){
        if (i >= uLightCount) break;
        vec3 lp = uLightPos[i];
        vec3 Lv = vec3(lp.x - P.x, 1.12, lp.y - P.z);
        float dl = length(Lv);
        float att = max(0.0, 1.0 - dl / max(0.2, lp.z));
        att = pow(att, 1.25) / (1.0 + 0.035 * dl * dl);
        vec3 L = Lv / max(0.001, dl);
        float ndl = max(dot(N, L), 0.0);
        lit += albedo * uLightCol[i] * ndl * att * 3.0;
        vec3 H = normalize(L + V);
        lit += uLightCol[i] * pow(max(dot(N, H), 0.0), 70.0) * att * (0.25 + pud * 3.3);
      }
      lit += albedo * vec3(0.58, 0.66, 0.78) * uLightning;
      float edge = clamp((gl_FragCoord.y - wallBottom) / max(1.0, focal * 0.5 / max(0.2, wallDist)), 0.0, 2.0);
      lit *= mix(0.52, 1.0, smoothstep(0.0, 0.55, edge));
      float fog = 1.0 - exp(-pow(gd * 0.086, 1.65));
      color = mix(lit, fogCol, clamp(fog, 0.0, 0.96));
      wet = clamp(pud * fres * 1.15, 0.0, 1.0);
    }
    else {
      vec3 rd = normalize(vec3(ray.x, (horizon - gl_FragCoord.y) / focal, ray.y));
      color = skyColor(rd, uLightning);
    }

    outColor = vec4(clamp(color, 0.0, 1.0), wet);
  }
  `;

  const POST_FRAG = `#version 300 es
  precision highp float;
  uniform sampler2D uScene;
  uniform vec2  uRes;
  uniform float uTime;
  uniform float uHorizon;
  uniform float uLightning;
  out vec4 outColor;
  ${COMMON}
  vec3 aces(vec3 x){
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    vec4 base = texture(uScene, uv);
    vec3 col = base.rgb;
    float wet = base.a;

    if (wet > 0.015){
      vec2 ruv = vec2(uv.x, uHorizon * 2.0 - uv.y);
      float rip = noise(vec2(uv.x * 210.0, uv.y * 130.0 + uTime * 5.0)) - 0.5;
      ruv.x += rip * 0.0035 * clamp((uv.y - uHorizon) * 4.0, 0.0, 1.0);
      ruv.y += rip * 0.0018;
      ruv = clamp(ruv, vec2(0.002), vec2(0.998));
      vec3 refl;
      refl.r = texture(uScene, clamp(ruv + vec2(0.0013, 0.0), vec2(0.002), vec2(0.998))).r;
      refl.g = texture(uScene, ruv).g;
      refl.b = texture(uScene, clamp(ruv - vec2(0.0013, 0.0), vec2(0.002), vec2(0.998))).b;
      col = mix(col, refl * 0.82 + vec3(0.008, 0.011, 0.012), wet * 0.62);
    }

    vec2 d = uv - 0.5;
    float ca = dot(d, d) * 0.0035;
    col.r = mix(col.r, texture(uScene, clamp(uv + d * ca, vec2(0.001), vec2(0.999))).r, 0.55);
    col.b = mix(col.b, texture(uScene, clamp(uv - d * ca, vec2(0.001), vec2(0.999))).b, 0.55);

    vec3 bloom = vec3(0.0);
    for (int i = 0; i < 8; i++){
      float a = float(i) * 0.785398 + 0.4;
      float r = 0.006 + 0.004 * float((i + 1) % 3);
      vec3 s = texture(uScene, clamp(uv + vec2(cos(a), sin(a)) * r, vec2(0.001), vec2(0.999))).rgb;
      bloom += max(s - vec3(0.66), vec3(0.0));
    }
    col += bloom * 0.15;

    float vig = smoothstep(0.92, 0.28, length(d * vec2(1.05, 1.18)));
    col *= mix(0.66, 1.0, vig);
    col *= 1.04;
    col = aces(col * 1.38);
    col = pow(col, vec3(0.88));
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 grade = mix(vec3(0.80, 0.95, 1.05), vec3(1.07, 1.00, 0.88), smoothstep(0.06, 0.62, luma));
    col = mix(vec3(luma), col, 1.08) * grade;
    col += vec3(0.45, 0.53, 0.62) * uLightning * 0.09;

    float grain = hash12(gl_FragCoord.xy + fract(uTime) * 431.0);
    col += (grain - 0.5) * 0.030;
    col += (hash12(gl_FragCoord.xy * 1.37) - 0.5) * 0.010;
    outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
  `;

  const rng = (seed) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  function makeTex(paint){
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d', { alpha: false });
    paint(g, 256);
    const d = g.getImageData(0, 0, 256, 256).data;
    return new Uint8Array(d.buffer);
  }
  function speckle(g, s, seed, amount, alpha, light){
    const r = rng(seed);
    for (let i = 0; i < amount; i++){
      const v = light ? 180 + r() * 60 : 0 + r() * 50;
      g.fillStyle = `rgba(${v},${v},${v},${alpha * (0.4 + r())})`;
      g.fillRect(r() * s, r() * s, 1 + r() * 3, 1 + r() * 2);
    }
  }
  function grime(g, s, seed){
    const r = rng(seed);
    const grd = g.createLinearGradient(0, s * 0.62, 0, s);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.72, 'rgba(0,0,0,0.18)');
    grd.addColorStop(1, 'rgba(0,0,0,0.52)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 16; i++){
      const x = r() * s, w = 2 + r() * 9, h = 30 + r() * 150;
      const st = g.createLinearGradient(0, s - h, 0, s);
      st.addColorStop(0, 'rgba(10,16,13,0)');
      st.addColorStop(1, `rgba(8,14,11,${0.10 + r() * 0.20})`);
      g.fillStyle = st;
      g.fillRect(x, s - h, w, h);
    }
    for (let i = 0; i < 5; i++){
      g.fillStyle = `rgba(42,58,38,${0.06 + r() * 0.10})`;
      g.beginPath();
      g.ellipse(r() * s, s * (0.82 + r() * 0.16), 10 + r() * 34, 6 + r() * 16, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  function brick(g, s, base, mortar, accent){
    g.fillStyle = mortar; g.fillRect(0, 0, s, s);
    const r = rng(base.length * 97 + 13);
    const bh = 32, bw = 64;
    for (let row = 0; row < s / bh; row++){
      const off = (row % 2) * (bw / 2);
      for (let col = -1; col < s / bw + 1; col++){
        const x = col * bw + off + 2, y = row * bh + 2;
        const v = 0.78 + r() * 0.36;
        g.fillStyle = shade(base, v);
        g.fillRect(x, y, bw - 4, bh - 4);
        g.fillStyle = 'rgba(255,255,255,0.055)';
        g.fillRect(x, y, bw - 4, 1.5);
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(x, y + bh - 6, bw - 4, 2);
        if (r() > 0.72){ g.fillStyle = accent; g.fillRect(x + r() * 30, y + 4, 4 + r() * 16, 2 + r() * 4); }
      }
    }
    speckle(g, s, 71, 1400, 0.10, false);
    grime(g, s, 33);
  }
  function boards(g, s, base, line, seed){
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    const r = rng(seed);
    for (let y = 0; y < s; y += 22){
      g.fillStyle = shade(base, 0.82 + r() * 0.3);
      g.fillRect(0, y, s, 20);
      g.fillStyle = line; g.fillRect(0, y + 20, s, 2);
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, y, s, 1);
      for (let i = 0; i < 7; i++){
        g.strokeStyle = `rgba(10,12,10,${0.05 + r() * 0.08})`;
        g.lineWidth = 1;
        g.beginPath();
        const yy = y + 3 + r() * 15;
        g.moveTo(0, yy); g.bezierCurveTo(s * 0.3, yy + r() * 4 - 2, s * 0.7, yy + r() * 4 - 2, s, yy);
        g.stroke();
      }
    }
    speckle(g, s, seed + 3, 900, 0.08, true);
    grime(g, s, seed + 9);
  }
  function stone(g, s, base, mortar, seed){
    g.fillStyle = mortar; g.fillRect(0, 0, s, s);
    const r = rng(seed);
    let y = 0;
    while (y < s){
      const h = 28 + r() * 22, off = r() * 40;
      let x = -off;
      while (x < s){
        const w = 40 + r() * 48;
        g.fillStyle = shade(base, 0.72 + r() * 0.5);
        g.fillRect(x + 2, y + 2, w - 4, h - 4);
        g.fillStyle = 'rgba(255,255,255,0.06)';
        g.fillRect(x + 2, y + 2, w - 4, 2);
        g.fillStyle = 'rgba(0,0,0,0.20)';
        g.fillRect(x + 2, y + h - 5, w - 4, 2);
        x += w;
      }
      y += h;
    }
    speckle(g, s, seed + 5, 1600, 0.09, false);
    grime(g, s, seed + 11);
  }
  function concrete(g, s, base, seam, seed){
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    const r = rng(seed);
    for (let i = 0; i < 26; i++){
      g.fillStyle = `rgba(255,255,255,${r() * 0.035})`;
      g.beginPath();
      g.ellipse(r() * s, r() * s, 20 + r() * 70, 12 + r() * 40, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = seam; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, s * 0.52); g.lineTo(s, s * 0.52); g.stroke();
    g.beginPath(); g.moveTo(s * 0.56, 0); g.lineTo(s * 0.56, s); g.stroke();
    for (let i = 0; i < 4; i++){
      g.strokeStyle = `rgba(8,12,10,${0.18 + r() * 0.2})`; g.lineWidth = 1;
      let x = r() * s, y = r() * s;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++){ x += r() * 22 - 11; y += 10 + r() * 22; g.lineTo(x, y); }
      g.stroke();
    }
    speckle(g, s, seed + 17, 1800, 0.10, false);
    grime(g, s, seed + 23);
  }
  function metal(g, s, base, seed){
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    const r = rng(seed);
    for (let x = 0; x < s; x += 16){
      const grd = g.createLinearGradient(x, 0, x + 16, 0);
      grd.addColorStop(0, 'rgba(0,0,0,0.30)');
      grd.addColorStop(0.42, shade(base, 1.22));
      grd.addColorStop(0.62, 'rgba(255,255,255,0.07)');
      grd.addColorStop(1, 'rgba(0,0,0,0.34)');
      g.fillStyle = grd; g.fillRect(x, 0, 16, s);
    }
    for (let i = 0; i < 24; i++){
      g.fillStyle = `rgba(120,66,32,${0.08 + r() * 0.18})`;
      g.beginPath(); g.ellipse(r() * s, r() * s, 3 + r() * 20, 2 + r() * 13, r() * 3, 0, Math.PI * 2); g.fill();
    }
    speckle(g, s, seed + 7, 900, 0.10, false);
    grime(g, s, seed + 13);
  }
  function plaster(g, s, base, under, seed){
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    const r = rng(seed);
    for (let i = 0; i < 12; i++){
      const x = r() * s, y = r() * s, w = 12 + r() * 42, h = 8 + r() * 30;
      g.fillStyle = under;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 1; k < 7; k++) g.lineTo(x + (w * k) / 6, y + (r() - 0.5) * 10);
      for (let k = 6; k >= 1; k--) g.lineTo(x + (w * k) / 6, y + h + (r() - 0.5) * 8);
      g.closePath(); g.fill();
    }
    speckle(g, s, seed + 3, 1500, 0.11, false);
    grime(g, s, seed + 21);
  }
  function asphalt(g, s, seed){
    g.fillStyle = '#171d1b'; g.fillRect(0, 0, s, s);
    const r = rng(seed);
    for (let i = 0; i < 3200; i++){
      const v = 28 + r() * 34;
      g.fillStyle = `rgba(${v},${v + 4},${v + 2},${0.16 + r() * 0.30})`;
      g.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2);
    }
    for (let i = 0; i < 9; i++){
      g.strokeStyle = `rgba(7,10,9,${0.20 + r() * 0.25})`; g.lineWidth = 1 + r() * 2;
      let x = r() * s, y = r() * s;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++){ x += r() * 30 - 15; y += 8 + r() * 20; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 5; i++){
      g.fillStyle = `rgba(190,200,196,${0.03 + r() * 0.045})`;
      g.beginPath(); g.ellipse(r() * s, r() * s, 16 + r() * 46, 22 + r() * 60, r() * 3, 0, Math.PI * 2); g.fill();
    }
  }
  function sidewalk(g, s, seed){
    g.fillStyle = '#232a27'; g.fillRect(0, 0, s, s);
    const r = rng(seed), n = 4, c = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++){
      g.fillStyle = shade('#2a312d', 0.9 + r() * 0.22);
      g.fillRect(x * c + 2, y * c + 2, c - 4, c - 4);
      g.fillStyle = 'rgba(255,255,255,0.035)';
      g.fillRect(x * c + 2, y * c + 2, c - 4, 1);
    }
    speckle(g, s, seed + 2, 1300, 0.10, false);
    grime(g, s, seed + 6);
  }
  function shade(color, mul){
    let r, g, b;
    if (color[0] === '#'){
      const n = parseInt(color.slice(1), 16);
      r = n >> 16; g = (n >> 8) & 255; b = n & 255;
    } else {
      const m = color.match(/\d+/g) || [0, 0, 0];
      r = +m[0]; g = +m[1]; b = +m[2];
    }
    return `rgb(${Math.min(255, Math.round(r * mul))},${Math.min(255, Math.round(g * mul))},${Math.min(255, Math.round(b * mul))})`;
  }
  function buildTextureData(){
    return [
      (g, s) => concrete(g, s, 'rgb(43,50,45)', 'rgba(16,20,17,0.6)', 7),
      (g, s) => brick(g, s, 'rgb(70,58,48)', '#2a2521', 'rgba(96,74,52,0.5)'),
      (g, s) => stone(g, s, 'rgb(66,67,64)', '#262925', 41),
      (g, s) => boards(g, s, 'rgb(60,70,58)', 'rgba(18,24,18,0.75)', 19),
      (g, s) => concrete(g, s, 'rgb(55,64,61)', 'rgba(14,20,18,0.6)', 61),
      (g, s) => brick(g, s, 'rgb(70,62,52)', '#28231f', 'rgba(86,64,42,0.5)'),
      (g, s) => plaster(g, s, 'rgb(61,68,58)', 'rgb(47,53,45)', 83),
      (g, s) => metal(g, s, 'rgb(55,64,62)', 29),
      (g, s) => brick(g, s, 'rgb(72,64,52)', '#2b2721', 'rgba(100,80,54,0.45)'),
      (g, s) => asphalt(g, s, 101),
      (g, s) => sidewalk(g, s, 131)
    ];
  }

  function compile(gl, type, src){
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
      console.error('Gloamwood shader error:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }
  function program(gl, vsSrc, fsSrc){
    const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)){
      console.error('Gloamwood link error:', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function create(canvas, opts){
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, powerPreference: 'high-performance'
    });
    if (!gl) return null;
    const sceneProg = program(gl, VERT, SCENE_FRAG);
    const postProg = program(gl, VERT, POST_FRAG);
    if (!sceneProg || !postProg) return null;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const layers = buildTextureData();
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    const planeSize = 256 * 256 * 4;
    const allLayers = new Uint8Array(planeSize * layers.length);
    for (let i = 0; i < layers.length; i++) allLayers.set(layers[i], i * planeSize);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 256, 256, layers.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, allLayers);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso){
      const maxAniso = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      gl.texParameterf(gl.TEXTURE_2D_ARRAY, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, maxAniso));
    }

    const mapSize = opts.mapSize || 30;
    const mapData = new Uint8Array(mapSize * mapSize);
    for (let y = 0; y < mapSize; y++) for (let x = 0; x < mapSize; x++){
      mapData[y * mapSize + x] = Math.max(0, Math.min(255, opts.getCell(x, y) | 0));
    }
    const mapTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, mapTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, mapSize, mapSize, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, mapData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const su = {}, pu = {};
    const sceneNames = ['uRes','uTime','uPos','uAngle','uFlash','uLightning','uHorizon','uLightCount','uLightPos[0]','uLightCol[0]','uTex','uMap','uMapSize'];
    sceneNames.forEach(n => su[n] = gl.getUniformLocation(sceneProg, n));
    ['uScene','uRes','uTime','uHorizon','uLightning'].forEach(n => pu[n] = gl.getUniformLocation(postProg, n));

    let target = null, targetTex = null;
    let glW = 0, glH = 0, quality = 1, cssW = 0, cssH = 0, dpr = 1;
    const lightPos = new Float32Array(24), lightCol = new Float32Array(24);

    function rebuildTarget(w, h){
      glW = w; glH = h;
      canvas.width = w; canvas.height = h;
      if (targetTex) gl.deleteTexture(targetTex);
      if (target) gl.deleteFramebuffer(target);
      targetTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, targetTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      target = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, target);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    function resize(w, h, ratio){
      cssW = w; cssH = h; dpr = ratio || 1;
      const touch = (navigator.maxTouchPoints || 0) > 0 || matchMedia('(pointer: coarse)').matches;
      const budget = (touch ? 520000 : 1080000) * quality;
      const aspect = Math.max(0.35, Math.min(3.4, w / h));
      let rh = Math.sqrt(budget / aspect);
      let rw = rh * aspect;
      const maxH = Math.min(980, h * Math.min(dpr, 1.6));
      if (rh > maxH){ rh = maxH; rw = rh * aspect; }
      rebuildTarget(Math.max(320, Math.round(rw)), Math.max(180, Math.round(rh)));
    }

    function render(st){
      if (!glW || !target) return false;
      if (gl.isContextLost && gl.isContextLost()) return false;

      gl.bindFramebuffer(gl.FRAMEBUFFER, target);
      gl.viewport(0, 0, glW, glH);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(sceneProg);
      gl.bindVertexArray(vao);

      gl.uniform2f(su.uRes, glW, glH);
      gl.uniform1f(su.uTime, st.time || 0);
      gl.uniform2f(su.uPos, st.x, st.y);
      gl.uniform1f(su.uAngle, st.angle);
      gl.uniform1f(su.uFlash, st.flashlight ? 1 : 0);
      gl.uniform1f(su.uLightning, st.lightning || 0);
      gl.uniform1f(su.uHorizon, st.horizon || 0.49);
      gl.uniform1i(su.uMapSize, mapSize);

      const lights = st.lights || [];
      const count = Math.min(8, lights.length);
      lightPos.fill(0); lightCol.fill(0);
      for (let i = 0; i < count; i++){
        const l = lights[i];
        lightPos[i * 3] = l.x;
        lightPos[i * 3 + 1] = l.y;
        lightPos[i * 3 + 2] = l.radius;
        const p = l.power == null ? 1 : l.power;
        const c = l.color || [1, 0.7, 0.4];
        lightCol[i * 3] = c[0] * p;
        lightCol[i * 3 + 1] = c[1] * p;
        lightCol[i * 3 + 2] = c[2] * p;
      }
      gl.uniform1i(su.uLightCount, count);
      gl.uniform3fv(su['uLightPos[0]'], lightPos);
      gl.uniform3fv(su['uLightCol[0]'], lightCol);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
      gl.uniform1i(su.uTex, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, mapTex);
      gl.uniform1i(su.uMap, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, glW, glH);
      gl.useProgram(postProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targetTex);
      gl.uniform1i(pu.uScene, 0);
      gl.uniform2f(pu.uRes, glW, glH);
      gl.uniform1f(pu.uTime, st.time || 0);
      gl.uniform1f(pu.uHorizon, st.horizon || 0.49);
      gl.uniform1f(pu.uLightning, st.lightning || 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      return true;
    }

    function setQuality(q){
      const next = Math.max(0.55, Math.min(1.25, q));
      if (Math.abs(next - quality) < 0.02) return;
      quality = next;
      if (cssW && cssH) resize(cssW, cssH, dpr);
    }

    return { resize, render, setQuality, canvas };
  }

  window.GloamRenderer = { create };
})();
