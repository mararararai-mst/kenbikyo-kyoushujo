/* =========================================================
   顕微鏡教習所：学科教習「3Dで部品と手順」
   ステージ上下式の光学顕微鏡（教科書 中2 p.88-89）を three.js で表示する。
   長さの単位は cm（実物大）。光軸は x=0, z=0 の鉛直線。手前（のぞく人の側）が +z。
   index.html の startParts3d() が three.min.js とこのファイルを読み込んでから P3.start() を呼ぶ。
   ========================================================= */
(function(){
'use strict';
const T = THREE;
T.ColorManagement.legacyMode = false;
const $ = id => document.getElementById(id);
const V3 = (x, y, z) => new T.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;

/* ---------- 寸法と光学 ---------- */
const Y_F = 13.6;                    // ピントが合うときのスライドガラス上面の高さ
const OBJ = [                        // 対物レンズ：倍率・長さ・ピントが合ったときのプレパラートとの距離・色の帯
  { mag: 4,  len: 2.2,  wd: 1.7,  band: 0xe53935 },
  { mag: 10, len: 3.2,  wd: .7,   band: 0xf2c200 },
  { mag: 40, len: 3.84, wd: .06,  band: 0x29a8e0 },
];
const Y_ATT = Y_F + OBJ[0].wd + OBJ[0].len;   // 光軸の上にある対物レンズの付け根（17.5）
const EYE_MAG = 10;                  // 接眼レンズ 10倍
const FIELD = 18;                    // 視野数（mm）：見える範囲の直径 = 18 ÷ 対物の倍率
// 手前上の窓の光（向き (0,0.5,1)）を真上へ返す反射鏡の傾き：鏡の面の向き ∝ 真上＋光の来る向き（約31.7°）
const WIN_DIR = new THREE.Vector3(0, .5, 1).normalize();
const MIRROR_OK = Math.atan2(WIN_DIR.z, 1 + WIN_DIR.y);
const IRIS_R = [.15, .3, .45, .6, .8];   // 円板しぼりの穴の半径（cm）
const STAGE_T = .8, SLIDE_T = .1;
const STAGE_LOW = 11;                // ステージ上面のいちばん低い位置

/* ---------- 部品（説明は教科書 p.88-89 の文から。★は教科書に名前だけで、説明は提案） ---------- */
const PARTS = [
  { id: 'eyepiece', name: '接眼レンズ', steps: [2], desc: '目をあててのぞくレンズ。顕微鏡の倍率＝対物レンズの倍率×接眼レンズの倍率。この顕微鏡の接眼レンズは10倍。' },
  { id: 'tube', name: '鏡筒', steps: [], desc: '接眼レンズと対物レンズをつなぐ筒。', proposal: true },
  { id: 'revolver', name: 'レボルバー', steps: [0, 4], desc: '回して、対物レンズを切りかえる。高倍率にするときは、プレパラートがぶつからないように回す。' },
  { id: 'objective', name: '対物レンズ', steps: [0, 4], desc: 'プレパラートに近いほうのレンズ。4倍・10倍・40倍がある。倍率が高いものほど、プレパラートとの距離が近くなる。' },
  { id: 'clip', name: 'クリップ', steps: [1], desc: 'プレパラートをステージにとめる。' },
  { id: 'stage', name: 'ステージ', steps: [1, 2], desc: 'プレパラートをのせる台。この顕微鏡（ステージ上下式）は、調節ねじを回すとステージが上下する。' },
  { id: 'iris', name: 'しぼり', steps: [3, 5], desc: '調節して、観察したいものがはっきりと見えるようにする。' },
  { id: 'mirror', name: '反射鏡', steps: [0], desc: '向きを調節して、視野全体の明るさが均一に明るく見えるようにする。明るさが不均一なときも、反射鏡を動かす。' },
  { id: 'knob', name: '調節ねじ', steps: [2], desc: '回して対物レンズとプレパラートの距離を変え、ピントを合わせる。接眼レンズをのぞきながら、遠ざける向きに回す。' },
  { id: 'arm', name: 'アーム', steps: [], desc: '鏡筒やステージを支える柱の部分。', proposal: true },
  { id: 'base', name: '鏡台', steps: [], desc: '顕微鏡全体を支える台。', proposal: true },
];

/* ---------- 使い方①〜⑥（教科書 p.88-89 の文） ---------- */
const STEPS = [
  { text: '対物レンズをいちばん低倍率のものにし、反射鏡を調節して、全体の明るさが均一に明るく見えるようにする。' },
  { text: '観察したいものが対物レンズの真下にくるように、プレパラートを置き、クリップでとめる。' },
  { text: '真横から見ながら、プレパラートと対物レンズをできるだけ近づける。接眼レンズをのぞき、対物レンズとプレパラートを遠ざけながらピントを合わせる。',
    warn: '対物レンズとプレパラートを近づけると、ぶつかる可能性がある。' },
  { text: 'しぼりを調節して、観察したいものがはっきりと見えるようにする。' },
  { text: '高倍率にするときは、低倍率の状態で、視野の中央に観察したいものを置き、レボルバーを回して、プレパラートがぶつからないように、高倍率の対物レンズにする。' },
  { text: 'しぼりを調節し直して、最もはっきり見えるようにする。' },
];
const TARGET = { x: -.55, z: .32 };   // ⑤で視野の中央に置く「観察したいもの」（プレパラート上の位置 mm）

/* ---------- 状態 ---------- */
const BASE = { rev: 1, mirror: .05, iris: 4, stageTop: STAGE_LOW, prepIn: 0, clip: 0, offX: 0, offZ: 0, eyeBig: 0 };
const ST = Object.assign({}, BASE);
// 各ステップが終わったときの状態（前のステップの終わり＝次のステップの始まり）
const ENDS = [
  { rev: 0, mirror: MIRROR_OK },
  { prepIn: 1, clip: 1 },
  { stageTop: Y_F - SLIDE_T },
  { iris: 2 },
  { offX: -TARGET.x / 10, offZ: -TARGET.z / 10, rev: 2 },   // 光軸の下に TARGET が来るようにプレパラートを動かす
  { iris: 4 },
];
function stateAt(i){ const s = Object.assign({}, BASE); for (let k = 0; k < i; k++) Object.assign(s, ENDS[k]); s.eyeBig = 0; return s; }

let R = null;   // three.js の一式（start で作る）
const P3 = window.P3 = { ST, PARTS, STEPS, OBJ, Y_F };

/* =========================================================
   3D の組み立て
   ========================================================= */
function build(){
  const box = $('p3-stage'), cv = $('p3-gl');
  const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(); scene.background = new T.Color(0xdde7f0); scene.fog = new T.Fog(0xdde7f0, 90, 220);
  const camera = new T.PerspectiveCamera(34, 1, .5, 400);

  // 金属が金属らしく見えるように、明るい部屋の映り込みを用意する
  {
    const env = new T.Scene();
    const room = new T.Mesh(new T.BoxGeometry(60, 40, 60), new T.MeshBasicMaterial({ color: 0xcfd8e3, side: T.BackSide }));
    env.add(room);
    const win = new T.Mesh(new T.PlaneGeometry(26, 14), new T.MeshBasicMaterial({ color: 0xffffff })); win.position.set(0, 8, 29.5); win.rotation.y = Math.PI; env.add(win);
    const ceil = new T.Mesh(new T.PlaneGeometry(30, 30), new T.MeshBasicMaterial({ color: 0xf4f7fb })); ceil.position.set(0, 19.5, 0); ceil.rotation.x = Math.PI / 2; env.add(ceil);
    const floorE = new T.Mesh(new T.PlaneGeometry(60, 60), new T.MeshBasicMaterial({ color: 0x8d8a82 })); floorE.position.y = -19.5; floorE.rotation.x = -Math.PI / 2; env.add(floorE);
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, .03).texture;
  }
  scene.add(new T.HemisphereLight(0xffffff, 0xb9b3a6, .45));
  const key = new T.DirectionalLight(0xfff6ea, 1.15); key.position.set(18, 40, 26); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -20, right: 20, top: 30, bottom: -10, near: 1, far: 100 }); key.shadow.bias = -.0006;
  scene.add(key);

  // 材質
  const mat = {
    cream: new T.MeshStandardMaterial({ color: 0xe6dcc6, roughness: .45, metalness: 0, envMapIntensity: .5 }),
    black: new T.MeshStandardMaterial({ color: 0x25272b, roughness: .55, metalness: .1, envMapIntensity: .5 }),
    silver: new T.MeshStandardMaterial({ color: 0xd4d8dd, roughness: .25, metalness: .9 }),
    chrome: new T.MeshStandardMaterial({ color: 0xeef1f4, roughness: .12, metalness: 1 }),
    mirror: new T.MeshStandardMaterial({ color: 0xf2f5f8, roughness: .03, metalness: 1 }),
    dark: new T.MeshStandardMaterial({ color: 0x1c1d20, roughness: .6, metalness: .2 }),
    glass: new T.MeshPhysicalMaterial({ color: 0xe8f7ff, roughness: .05, metalness: 0, transparent: true, opacity: .45, clearcoat: 1, depthWrite: false }),
    table: new T.MeshStandardMaterial({ color: 0xe3e9ef, roughness: .95, metalness: 0 }),
  };
  const pickables = [];
  const partMats = {};   // 部品ごとに材質を複製しておき、選んだときにだけ光らせる
  function m(part, base){
    if (!part) return base;
    partMats[part] = partMats[part] || new Map();
    if (!partMats[part].has(base)) partMats[part].set(base, base.clone());
    return partMats[part].get(base);
  }
  function add(parent, geo, material, part, x = 0, y = 0, z = 0, shadow = true){
    const mesh = new T.Mesh(geo, m(part, material)); mesh.position.set(x, y, z);
    if (shadow) { mesh.castShadow = true; mesh.receiveShadow = true; }
    if (part) { mesh.userData.part = part; pickables.push(mesh); }
    parent.add(mesh); return mesh;
  }
  function rounded(w, d, r, cy = 0){   // 角の丸い長方形（x：±w/2、y：cy±d/2）
    const s = new T.Shape(), x0 = -w / 2, y0 = cy - d / 2;
    s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
    s.lineTo(x0 + w, y0 + d - r); s.quadraticCurveTo(x0 + w, y0 + d, x0 + w - r, y0 + d);
    s.lineTo(x0 + r, y0 + d); s.quadraticCurveTo(x0, y0 + d, x0, y0 + d - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
    return s;
  }
  const root = new T.Group(); scene.add(root);
  { const t = new T.Mesh(new T.CircleGeometry(400, 64), mat.table); t.rotation.x = -Math.PI / 2; t.receiveShadow = true; root.add(t); }

  // 鏡台
  {
    const g = new T.ExtrudeGeometry(rounded(15, 19, 3), { depth: 2.5, bevelEnabled: true, bevelThickness: .25, bevelSize: .25, bevelSegments: 3 });
    g.rotateX(-Math.PI / 2); g.translate(0, 0, -2.5);
    add(root, g, mat.cream, 'base', 0, .25, 0);
  }
  // アーム（横から見て C の字）
  {
    const s = new T.Shape();   // X = -z（奥が +X）、Y = y
    const P = [[9.5, 2.5], [5.2, 2.5], [5.2, 16.5], [4.2, 18.6], [2.6, 19.4], [2.6, 21.2], [6.2, 21.2], [8.8, 19.6], [9.5, 17.5]];
    s.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) s.lineTo(P[i][0], P[i][1]); s.lineTo(P[0][0], P[0][1]);
    const g = new T.ExtrudeGeometry(s, { depth: 3.2, bevelEnabled: true, bevelThickness: .3, bevelSize: .3, bevelSegments: 3 });
    g.rotateY(Math.PI / 2); g.translate(-1.6, 0, 0);
    add(root, g, mat.cream, 'arm');
  }
  // 頭（アームと鏡筒・レボルバーをつなぐ）
  add(root, new T.BoxGeometry(4.2, 3.4, 6), mat.cream, 'arm', 0, 19.9, -1.6);
  // 鏡筒と接眼レンズ
  add(root, new T.CylinderGeometry(1.35, 1.35, 6.4, 32), mat.cream, 'tube', 0, 24.6, 0);
  add(root, new T.CylinderGeometry(1.2, 1.2, 2.6, 32), mat.silver, 'eyepiece', 0, 29.1, 0);
  add(root, new T.CylinderGeometry(1.28, 1.28, .7, 32), mat.dark, 'eyepiece', 0, 30.6, 0);
  add(root, new T.CylinderGeometry(.75, .75, .05, 24), new T.MeshStandardMaterial({ color: 0x0c0d0f, roughness: .2, metalness: .3 }), 'eyepiece', 0, 30.96, 0, false);

  // レボルバーと対物レンズ
  const ALPHA = .35, RR = 1.45;
  const revG = new T.Group(); revG.position.set(0, Y_ATT + RR * Math.sin(ALPHA), -RR * Math.cos(ALPHA)); revG.rotation.x = ALPHA; root.add(revG);
  const revSpin = new T.Group(); revG.add(revSpin);
  add(revSpin, new T.CylinderGeometry(2.3, 2.5, .9, 40), mat.silver, 'revolver', 0, .5, 0);
  add(revSpin, new T.CylinderGeometry(2.55, 2.55, .25, 40), mat.chrome, 'revolver', 0, .9, 0);
  OBJ.forEach((o, i) => {
    const ph = i * 2 * Math.PI / 3;
    const g = new T.Group(); g.position.set(RR * Math.sin(ph), 0, RR * Math.cos(ph));
    const dir = V3(Math.sin(ALPHA) * Math.sin(ph), -Math.cos(ALPHA), Math.sin(ALPHA) * Math.cos(ph)).normalize();
    g.quaternion.setFromUnitVectors(V3(0, -1, 0), dir);
    const L = o.len;
    add(g, new T.CylinderGeometry(.62, .62, L * .55, 28), mat.chrome, 'objective', 0, -L * .275, 0);
    add(g, new T.CylinderGeometry(.64, .64, .22, 28), new T.MeshStandardMaterial({ color: o.band, roughness: .4, metalness: .2 }), 'objective', 0, -L * .6, 0);
    add(g, new T.CylinderGeometry(.5, .34, L * .38, 28), mat.chrome, 'objective', 0, -L * .81, 0);
    add(g, new T.CylinderGeometry(.18, .18, .02, 16), mat.dark, 'objective', 0, -L + .005, 0, false);
    g.userData.obj = i; revSpin.add(g);
  });

  // ステージ（上下に動く）とその下のしぼり
  const stageG = new T.Group(); root.add(stageG);
  {
    // 穴（光の通り道）が光軸の真上に来るように、台は少し奥へずらして作る（シェイプの y ＝ 奥行き −z）
    const s = rounded(12, 11, .8, .8); const hole = new T.Path(); hole.absarc(0, 0, .75, 0, Math.PI * 2, true); s.holes.push(hole);
    const g = new T.ExtrudeGeometry(s, { depth: STAGE_T, bevelEnabled: false, curveSegments: 24 }); g.rotateX(-Math.PI / 2);
    add(stageG, g, mat.black, 'stage', 0, -STAGE_T, 0);
    add(stageG, new T.BoxGeometry(3, 2.6, 1.6), mat.black, 'stage', 0, -1.6, -5.9);   // アームにつながる部分
  }
  // 円板しぼり：5つの大きさの穴。回して光軸の下に来る穴を選ぶ
  const irisG = new T.Group(); irisG.position.set(0, -STAGE_T - .5, -1.75); stageG.add(irisG);
  {
    const s = new T.Shape(); s.absarc(0, 0, 2.7, 0, Math.PI * 2, false);
    // 穴 i は、しぼりの中心から手前（+z）へ 1.75cm の位置＝光軸の下に来るとき rotation.y = −i×72°
    IRIS_R.forEach((r, i) => { const a = i * 2 * Math.PI / IRIS_R.length; const h = new T.Path(); h.absarc(1.75 * Math.sin(a), -1.75 * Math.cos(a), r, 0, Math.PI * 2, true); s.holes.push(h); });
    const g = new T.ExtrudeGeometry(s, { depth: .15, bevelEnabled: false, curveSegments: 20 }); g.rotateX(-Math.PI / 2);
    add(irisG, g, mat.dark, 'iris');
    add(irisG, new T.CylinderGeometry(.25, .25, .6, 12), mat.silver, 'iris', 0, .3, 0);
  }
  // クリップ（奥の端を軸にして、プレパラートの上へ倒れる）
  const clips = [-3.4, 3.4].map(x => {
    const g = new T.Group(); g.position.set(x, .12, -3.2); stageG.add(g);
    add(g, new T.CylinderGeometry(.28, .28, .5, 12), mat.silver, 'clip', 0, .15, 0);
    add(g, new T.BoxGeometry(.55, .1, 4.4), mat.chrome, 'clip', 0, .03, 2.1);   // 下の面がスライドガラスの上面にふれる
    return g;
  });
  // プレパラート（スライドガラス・カバーガラス・タマネギの表皮）
  const prepG = new T.Group(); stageG.add(prepG);
  {
    add(prepG, new T.BoxGeometry(7.6, SLIDE_T, 2.6), mat.glass, null, 0, SLIDE_T / 2, 0, false);
    add(prepG, new T.BoxGeometry(1.8, .02, 1.8), mat.glass, null, 0, SLIDE_T + .01, 0, false);
    const tis = new T.Mesh(new T.PlaneGeometry(.6, .6), new T.MeshBasicMaterial({ color: 0xd9eee8, transparent: true, opacity: .75, depthWrite: false }));
    tis.rotation.x = -Math.PI / 2; tis.position.y = SLIDE_T + .002; prepG.add(tis);
  }
  // 調節ねじ（アームの両側）
  const knobs = [-1, 1].map(sd => {
    const g = new T.Group(); g.position.set(sd * 2.25, 9.4, -7.3); root.add(g);
    const k = add(g, new T.CylinderGeometry(1.7, 1.7, .9, 40), mat.dark, 'knob'); k.rotation.z = Math.PI / 2;
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; const r = add(g, new T.BoxGeometry(.9, .16, .16), mat.dark, 'knob', 0, 1.72 * Math.cos(a), 1.72 * Math.sin(a)); }
    const c = add(g, new T.CylinderGeometry(.6, .6, .95, 24), mat.silver, 'knob'); c.rotation.z = Math.PI / 2;
    return g;
  });
  // 反射鏡（手前の窓の光を真上へ返す）
  const mirrorG = new T.Group(); mirrorG.position.set(0, 5.1, .4); root.add(mirrorG);
  {
    add(root, new T.CylinderGeometry(.3, .3, 1.6, 12), mat.silver, 'mirror', 0, 3.3, .4);
    add(root, new T.BoxGeometry(6.2, .3, .5), mat.silver, 'mirror', 0, 4.1, .4);
    for (const sd of [-1, 1]) add(root, new T.BoxGeometry(.3, 1.3, .5), mat.silver, 'mirror', sd * 3, 4.7, .4);
    add(mirrorG, new T.CylinderGeometry(2.75, 2.75, .45, 40), mat.silver, 'mirror', 0, -.12, 0);
    add(mirrorG, new T.CylinderGeometry(2.5, 2.5, .05, 40), mat.mirror, 'mirror', 0, .13, 0, false);
  }
  // 光の道すじ（窓 → 反射鏡 → 真上へ）
  const beamMat = new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: .0, depthWrite: false });
  const beamUp = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 24, 1, true), beamMat); root.add(beamUp);
  const beamIn = new T.Mesh(new T.CylinderGeometry(1.4, 1.4, 1, 24, 1, true), beamMat.clone()); root.add(beamIn);
  {
    const a = V3(0, 5.2, .4), b = a.clone().addScaledVector(WIN_DIR, 50), d = b.clone().sub(a);
    beamIn.position.copy(a).addScaledVector(d, .5); beamIn.scale.set(1, d.length(), 1);
    beamIn.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  }

  R = { renderer, scene, camera, root, revSpin, stageG, irisG, clips, prepG, knobs, mirrorG, beamUp, beamIn, beamMat, pickables, partMats, box, cv };
  resize();
}

/* ---------- 状態を 3D に反映 ---------- */
function apply(){
  const s = ST;
  R.revSpin.rotation.y = -s.rev * 2 * Math.PI / 3;
  R.stageG.position.y = s.stageTop;
  R.knobs.forEach((k, i) => k.rotation.x = (s.stageTop - STAGE_LOW) * 3.2 * (i ? 1 : -1));
  R.irisG.rotation.y = -s.iris * 2 * Math.PI / IRIS_R.length;
  R.clips.forEach((c, i) => c.rotation.y = (i ? 1 : -1) * (1 - s.clip) * .9);   // とめる前は外側へ開いている
  R.prepG.position.set(s.offX, 0, (1 - s.prepIn) * 9 + s.offZ);
  R.prepG.visible = s.prepIn > .01;
  R.mirrorG.rotation.x = s.mirror;
  // 光：反射鏡が合っているほど強く、しぼりの穴の大きさで太さが変わる
  const b = light();
  const irisR = irisRadius();
  const top = 30.5;
  R.beamUp.position.set(0, (5.3 + top) / 2, 0); R.beamUp.scale.set(irisR * .9, top - 5.3, irisR * .9);
  // 光の筋は、反射鏡やしぼりが関係する場面（①④⑥・反射鏡としぼりを選んだとき）だけ見せる
  const showBeam = (mode === 'steps' && [0, 3, 5].includes(stepIdx)) || (mode === 'parts' && (sel === 'mirror' || sel === 'iris'));
  R.beamMat.opacity = showBeam ? .06 + .26 * b.mirror * alignFactor() : 0;
  R.beamIn.material.opacity = showBeam ? .12 : 0;
  drawEye();
}
const irisRadius = () => { const i = ST.iris, a = Math.floor(i), f = i - a; return lerp(IRIS_R[a % 5], IRIS_R[(a + 1) % 5], f); };
function alignFactor(){ const d = Math.abs(ST.rev - Math.round(ST.rev)); return clamp(1 - d * 9, 0, 1); }
function curObj(){ return OBJ[clamp(Math.round(ST.rev), 0, 2)]; }
function light(){
  const err = Math.abs(ST.mirror - MIRROR_OK);
  const mirror = clamp(1 - err * 2.1, .06, 1);
  const uneven = clamp(err * 2.6, 0, 1);
  const r = irisRadius();
  const irisB = .3 + .7 * (r / .8);                 // 穴が大きいほど明るい
  const contrast = .25 + .75 * (1 - r / .8);        // 穴が小さいほど、かべの線がくっきり
  const magB = { 4: 1, 10: .82, 40: .52 }[curObj().mag];   // 倍率を高くすると暗くなる（教科書 p.89）
  return { mirror, uneven, bright: mirror * irisB * magB * alignFactor(), contrast };
}

/* =========================================================
   接眼レンズの中（タマネギのりん片の表皮）
   ========================================================= */
let CELLS = null;
function makeCells(){
  // 細長い細胞がれんがのように並ぶ（1つ 約0.22mm×0.07mm）。範囲は 6mm 四方
  let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cells = [];
  for (let z = -3; z < 3;) {
    const h = .062 + rnd() * .018;
    let x = -3 - rnd() * .2;
    while (x < 3) {
      // 細長い長方形に近い形。かべは少しだけ不ぞろい（教科書 p.89 の写真）
      const w = .17 + rnd() * .1, t = .005, j = () => (rnd() - .5) * .006;
      const z0 = z, z1 = z + h, zc = (z0 + z1) / 2 + (rnd() - .5) * .008;
      cells.push({ p: [[x, zc], [x + t, z0 + j()], [x + w - t, z0 + j()], [x + w, zc], [x + w - t, z1 + j()], [x + t, z1 + j()]],
        n: rnd() < .7 ? [x + w * (.25 + rnd() * .5), zc + (rnd() - .5) * h * .4] : null });
      x += w;
    }
    z += h;
  }
  // 観察したいもの：TARGET をふくむ細胞。核がよく見える細胞にする
  const t = cells.find(c => TARGET.x >= c.p[0][0] && TARGET.x <= c.p[3][0] && TARGET.z >= c.p[1][1] && TARGET.z <= c.p[4][1]);
  if (t) { t.target = true; t.n = [(t.p[0][0] + t.p[3][0]) / 2 + .02, (t.p[1][1] + t.p[4][1]) / 2]; }
  return cells;
}
const eyeOff = document.createElement('canvas'), eyeBlur = document.createElement('canvas');
let eyeKey = '';
function drawEye(){
  const c = $('p3-eye'); if (!c) return;
  const W = c.width, g = c.getContext('2d'), Rr = W / 2;
  // 見え方が変わらないフレームは描き直さない
  const key = [W, ST.prepIn, ST.offX, ST.offZ, ST.stageTop, ST.rev, ST.iris, ST.mirror].map(v => (+v).toFixed(4)).join();
  if (key === eyeKey) return; eyeKey = key;
  const L = light(), o = curObj(), total = o.mag * EYE_MAG;
  // 見える明るさ
  const B = L.bright;
  const Bv = B < .05 ? B * 7 : .35 + .65 * B;   // 光がほぼ来ないときは真っ暗、来ているときは暗くなりすぎない
  const bg = [234, 246, 244].map(v => Math.round(18 + (v - 18) * Math.min(1, Bv)));
  g.clearRect(0, 0, W, W);
  g.save(); g.beginPath(); g.arc(Rr, Rr, Rr - 1, 0, Math.PI * 2); g.clip();
  g.fillStyle = `rgb(${bg})`; g.fillRect(0, 0, W, W);
  // 試料：プレパラートが置かれていて、ピントのずれでぼける
  if (ST.prepIn > .98) {
    if (!CELLS) CELLS = makeCells();
    if (eyeOff.width !== W) { eyeOff.width = eyeOff.height = W; }
    const e = eyeOff.getContext('2d'); e.setTransform(1, 0, 0, 1, 0, 0); e.clearRect(0, 0, W, W);
    const fov = FIELD / o.mag, pxmm = W / fov;
    // 光軸の下に来ているプレパラート上の点（mm）。プレパラートを動かすと逆向きにずれる
    const sx = -ST.offX * 10, sz = -(ST.offZ + (1 - ST.prepIn) * 9) * 10;
    // 像は上下左右が逆（180°回転）
    e.setTransform(-pxmm, 0, 0, -pxmm, Rr + sx * pxmm, Rr + sz * pxmm);
    const lw = Math.max(1, .0045 * pxmm) / pxmm;
    e.lineWidth = lw; e.lineJoin = 'round';
    const a = .35 + .6 * L.contrast;
    e.strokeStyle = `rgba(52,120,122,${a})`; e.fillStyle = `rgba(160,214,210,${.12 + .12 * L.contrast})`;
    const half = fov / 2 + .3;
    for (const cl of CELLS) {
      const p0 = cl.p[0]; if (Math.abs(p0[0] - sx) > half || Math.abs(p0[1] - sz) > half) continue;
      e.beginPath(); e.moveTo(p0[0], p0[1]); for (let i = 1; i < 6; i++) e.lineTo(cl.p[i][0], cl.p[i][1]); e.closePath(); e.fill(); e.stroke();
      if (cl.n && (pxmm > 120 || cl.target)) {
        const big = cl.target ? 1.35 : 1;
        e.beginPath(); e.ellipse(cl.n[0], cl.n[1], .011 * big, .008 * big, 0, 0, Math.PI * 2);
        e.fillStyle = `rgba(52,120,122,${(cl.target ? .55 : .25) + .35 * L.contrast})`; e.fill();
        e.fillStyle = `rgba(160,214,210,${.12 + .12 * L.contrast})`;
      }
    }
    // ピントのずれ → ぼけ（倍率が高いほど、ずれに敏感）
    const err = Math.abs(ST.stageTop + STAGE_T * 0 + SLIDE_T - Y_F);
    const blur = Math.min(40, err * 10 * pxmm * .012 + err * 26);
    g.globalAlpha = clamp(Bv * 1.1, 0, 1);
    if (blur > .4) {
      // 強くぼかすときは、小さく縮めてからぼかして広げる（同じ見た目で、ずっと軽い）
      const k = blur > 2 ? Math.min(8, blur / 2) : 1, sw = Math.round(W / k);
      if (eyeBlur.width !== sw) eyeBlur.width = eyeBlur.height = sw;
      const b = eyeBlur.getContext('2d'); b.clearRect(0, 0, sw, sw);
      b.filter = `blur(${(blur / k).toFixed(2)}px)`; b.drawImage(eyeOff, 0, 0, sw, sw); b.filter = 'none';
      g.drawImage(eyeBlur, 0, 0, W, W);
    } else g.drawImage(eyeOff, 0, 0);
    g.globalAlpha = 1;
  }
  // 反射鏡がずれていると、明るさが不均一になる
  if (L.uneven > .02) {
    const gr = g.createLinearGradient(0, 0, W, W * .4);
    gr.addColorStop(0, `rgba(10,12,14,${.75 * L.uneven})`); gr.addColorStop(.7, `rgba(10,12,14,${.15 * L.uneven})`); gr.addColorStop(1, 'rgba(10,12,14,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, W);
  }
  // レボルバーを回している途中は、光が通らない
  const al = alignFactor(); if (al < 1) { g.fillStyle = `rgba(12,13,15,${1 - al})`; g.fillRect(0, 0, W, W); }
  g.restore();
  $('p3-eyecap').textContent = `接眼レンズの中（${total}倍）`;
}

/* =========================================================
   カメラ
   ========================================================= */
const VIEWS = {
  front:    { t: [0, 16, -1.5], az: .62, el: .2, d: 56 },
  revolver: { t: [0, 17.5, -.5], az: .85, el: .1, d: 30 },
  mirror:   { t: [0, 7, .5], az: .7, el: .32, d: 30 },
  stage:    { t: [0, 13, .5], az: .55, el: .6, d: 34 },
  side:     { t: [0, 15.6, -1], az: Math.PI / 2, el: .04, d: 30 },
  iris:     { t: [0, 11, -.5], az: .55, el: -.08, d: 28 },
};
const cam = { az: .62, el: .2, d: 62, t: V3(0, 16, -1.5) };
let camGoal = null;
function setCam(name, instant){
  const v = VIEWS[name]; camGoal = { az: v.az, el: v.el, d: v.d * fitScale(), t: V3(...v.t) };
  if (instant) { Object.assign(cam, { az: camGoal.az, el: camGoal.el, d: camGoal.d }); cam.t.copy(camGoal.t); camGoal = null; }
}
const fitScale = () => { const a = R.cv.clientWidth / Math.max(1, R.cv.clientHeight); return a > .2 && a < 1.1 ? 1.1 / a : 1; };
function stepCam(dt){
  if (camGoal) {
    const k = 1 - Math.exp(-dt * 3.2);
    let da = camGoal.az - cam.az; cam.az += da * k; cam.el += (camGoal.el - cam.el) * k; cam.d += (camGoal.d - cam.d) * k; cam.t.lerp(camGoal.t, k);
    if (Math.abs(da) + Math.abs(camGoal.el - cam.el) < 1e-3 && Math.abs(camGoal.d - cam.d) < .02) camGoal = null;
  }
  R.camera.position.set(cam.t.x + cam.d * Math.cos(cam.el) * Math.sin(cam.az), cam.t.y + cam.d * Math.sin(cam.el), cam.t.z + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
  R.camera.lookAt(cam.t);
}
function resize(){
  const w = R.box.clientWidth, h = R.box.clientHeight;
  if (w < 2 || h < 2) return;   // 画面が隠れて幅0のときは計算しない（縦横比0でカメラが壊れる）
  R.renderer.setSize(w, h, false); R.camera.aspect = w / Math.max(1, h); R.camera.updateProjectionMatrix();
  const e = $('p3-eye'), dpr = Math.min(2, devicePixelRatio || 1); const px = Math.round(250 * dpr);
  if (e.width !== px) { e.width = e.height = px; }
}

/* =========================================================
   ラベル：カーソルをのせた部品だけ名前が出る（タッチはタップで2秒ほど）
   ========================================================= */
const lbls = {};
let hover = null;   // { id, x, y, until }
function makeLabels(){
  const box = $('p3-labels'); box.innerHTML = '';
  for (const p of PARTS) { const el = document.createElement('div'); el.className = 'p3-lbl'; el.textContent = p.name; box.appendChild(el); lbls[p.id] = el; }
}
function updateLabels(){
  const W = R.cv.clientWidth, H = R.cv.clientHeight;
  for (const id in lbls) lbls[id].style.display = 'none';
  if (ST.eyeBig > .5 || !hover || (hover.until && performance.now() > hover.until)) return;   // 接眼レンズの中を大きく見ているときは出さない
  const el = lbls[hover.id]; el.style.display = ''; el.classList.toggle('sel', hover.id === sel);
  const w = el.offsetWidth, h = el.offsetHeight;
  el.style.transform = `translate(${clamp(hover.x + 14, 4, W - w - 4).toFixed(1)}px,${clamp(hover.y - h - 10, 4, H - h - 4).toFixed(1)}px)`;
}

/* =========================================================
   選ぶ（部品を調べる）
   ========================================================= */
let sel = null, mode = 'parts', stepLabels = [];
function highlight(){
  for (const id in R.partMats) for (const mm of R.partMats[id].values()) {
    const on = id === sel;
    mm.emissive = mm.emissive || new T.Color(0); mm.emissive.setHex(on ? 0xff8f00 : 0x000000); mm.emissiveIntensity = on ? .55 : 0;
  }
}
function selectPart(id){
  sel = id; highlight();
  const p = PARTS.find(q => q.id === id), card = $('p3-card');
  if (!p) { card.innerHTML = '<div class="p3-hint">3Dの部品をタップするか、上のボタンを押そう。</div>'; return; }
  const stepBtns = p.steps.map(i => `<button class="p3-go" data-step="${i}">使い方${'①②③④⑤⑥'[i]}で見る</button>`).join('');
  card.innerHTML = `<div class="p3-name">${p.name}</div><div class="p3-desc">${p.desc}</div>${stepBtns ? `<div class="p3-gos">${stepBtns}</div>` : ''}`;
  document.querySelectorAll('#p3-chips button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
  // 選んだ部品が見える向きへ
  const v = { mirror: 'mirror', iris: 'iris', revolver: 'revolver', objective: 'revolver', knob: 'front', clip: 'stage', stage: 'stage' }[id] || 'front';
  setCam(v);
}

/* =========================================================
   使い方①〜⑥（動きの再生）
   ========================================================= */
let stepIdx = 0, seq = [], seqT = 0, seqCur = null, playing = false;
function tw(dur, props, say){ return { dur, props, say }; }
function SEQ(i){
  const f = stateAt(i), o = ENDS[i];
  switch (i) {
    case 0: return [
      { cam: 'revolver', say: 'レボルバーを回して、いちばん低倍率（4倍）の対物レンズにする', labels: ['revolver', 'objective'] },
      tw(1.4, { rev: o.rev }), { wait: .4 },
      { cam: 'mirror', say: '反射鏡の向きを調節して、視野全体を明るくする', labels: ['mirror'] },
      { props0: { eyeBig: 1 } }, tw(2.2, { mirror: o.mirror }), { wait: .5 },
      { say: '視野全体が、均一に明るく見えるようになった' }, { wait: 1.2 }, tw(.5, { eyeBig: 0 }) ];
    case 1: return [
      { cam: 'stage', say: '観察したいものが対物レンズの真下にくるように、プレパラートを置く', labels: ['stage', 'clip'] },
      tw(1.6, { prepIn: 1 }), { say: 'クリップでとめる' }, tw(.8, { clip: 1 }), { wait: .4 },
      { props0: { eyeBig: 1 }, say: 'のぞいても、まだピントが合っていないので何も見えない' }, { wait: 1.6 }, tw(.5, { eyeBig: 0 }) ];
    case 2: {
      const near = Y_F + OBJ[0].wd - .25 - SLIDE_T;
      return [
        { cam: 'side', say: '真横から見ながら、調節ねじを回してプレパラートと対物レンズを近づける', labels: ['knob', 'objective', 'stage'] },
        tw(2.6, { stageTop: near }), { say: 'できるだけ近づけた（のぞきながら近づけると、ぶつかることがある）' }, { wait: 1.2 },
        { cam: 'front', props0: { eyeBig: 1 }, say: '接眼レンズをのぞき、遠ざける向きに調節ねじを回していく' }, { wait: .4 },
        tw(3.2, { stageTop: o.stageTop }), { say: 'ピントが合った（40倍）' }, { wait: 1.4 }, tw(.5, { eyeBig: 0 }) ];
    }
    case 3: return [
      { cam: 'iris', say: 'しぼりを回して、穴の大きさを変える', labels: ['iris'] }, { wait: .4 },
      { props0: { eyeBig: 1 } }, tw(2, { iris: o.iris }), { say: '細胞のしきりが、はっきりと見えるようになった' }, { wait: 1.5 }, tw(.5, { eyeBig: 0 }) ];
    case 4: return [
      { cam: 'stage', props0: { eyeBig: 1 }, say: 'まず低倍率のまま、観察したいもの（核がよく見える細胞）を視野の中央に置く', labels: ['stage'] }, { wait: 1 },
      { say: 'プレパラートを動かした向きと、見えているものが動く向きは逆になる' },
      tw(2.2, { offX: o.offX, offZ: o.offZ }), { wait: .6 }, tw(.5, { eyeBig: 0 }),
      { cam: 'revolver', say: 'レボルバーを回して、10倍の対物レンズにする（100倍）', labels: ['revolver', 'objective'] },
      tw(1.5, { rev: 1 }), { props0: { eyeBig: 1 } }, { wait: 1.3 }, tw(.4, { eyeBig: 0 }),
      { say: 'さらに40倍の対物レンズにする（400倍）。プレパラートとの距離が近くなる' }, tw(1.5, { rev: 2 }),
      { cam: 'side' }, { wait: 1.4 },
      { props0: { eyeBig: 1 }, say: '倍率を高くすると、視野はせまく、暗くなる' }, { wait: 1.8 }, tw(.5, { eyeBig: 0 }) ];
    case 5: return [
      { cam: 'iris', say: 'しぼりを調節し直す', labels: ['iris'] }, { props0: { eyeBig: 1 } }, { wait: .5 },
      tw(2, { iris: o.iris }), { say: '最もはっきり見えるようになった。これで観察できる' }, { wait: 1.8 }, tw(.5, { eyeBig: 0 }) ];
  }
}
function showStep(i, autoplay = true){
  stepIdx = clamp(i, 0, 5);
  Object.assign(ST, stateAt(stepIdx)); apply();
  $('p3-stepno').textContent = '①②③④⑤⑥'[stepIdx];
  $('p3-steptext').textContent = STEPS[stepIdx].text;
  const w = $('p3-stepwarn'); w.style.display = STEPS[stepIdx].warn ? '' : 'none'; w.textContent = STEPS[stepIdx].warn ? '注意：' + STEPS[stepIdx].warn : '';
  document.querySelectorAll('#p3-dots span').forEach((d, k) => { d.classList.toggle('on', k === stepIdx); d.classList.toggle('done', k < stepIdx); });
  $('p3-prev').disabled = stepIdx === 0;
  $('p3-next').textContent = stepIdx === 5 ? '修了 ✔' : 'つぎへ ▶';
  if (stepIdx < 5) $('p3-finish').classList.add('hidden');   // 教官のひとことは⑥のときだけ
  sel = null; highlight();
  if (autoplay) play(); else { seq = []; playing = false; $('p3-play').textContent = '▶ 再生'; $('p3-now').textContent = ''; }
}
function play(){
  Object.assign(ST, stateAt(stepIdx)); apply();
  seq = SEQ(stepIdx).slice(); seqCur = null; seqT = 0; playing = true; stepLabels = [];
  $('p3-play').textContent = '⏸ とめる';
}
function stopPlay(){ playing = false; seq = []; seqCur = null; $('p3-play').textContent = '▶ もう一度'; }
function runSeq(dt){
  if (!playing) return;
  while (true) {
    if (!seqCur) {
      if (!seq.length) { playing = false; $('p3-play').textContent = '▶ もう一度'; $('p3-now').textContent = '✔ ' + $('p3-now').textContent.replace(/^✔ /, ''); if (stepIdx === 5) finish(); return; }
      seqCur = seq.shift(); seqT = 0;
      if (seqCur.say) $('p3-now').textContent = seqCur.say;
      if (seqCur.cam) setCam(seqCur.cam);
      if (seqCur.labels) stepLabels = seqCur.labels;
      if (seqCur.props0) Object.assign(ST, seqCur.props0);
      if (seqCur.props) seqCur.from = Object.fromEntries(Object.keys(seqCur.props).map(k => [k, ST[k]]));
      if (!seqCur.dur && !seqCur.wait) { seqCur = null; continue; }
    }
    seqT += dt;
    const D = seqCur.dur || seqCur.wait, k = clamp(seqT / D, 0, 1);
    if (seqCur.props) for (const key in seqCur.props) ST[key] = lerp(seqCur.from[key], seqCur.props[key], ease(k));
    if (k >= 1) { seqCur = null; dt = 0; continue; }
    return;
  }
}
function finish(){
  if (typeof stamp === 'function') stamp('gakka3d');
  $('p3-finish').classList.remove('hidden');
}

/* =========================================================
   入力
   ========================================================= */
function hookInput(){
  const cv = R.cv, ray = new T.Raycaster(), ndc = new T.Vector2();
  let drag = null;
  const pick = e => {
    const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, R.camera); const h = ray.intersectObjects(R.pickables, false)[0];
    return h ? h.object.userData.part : null;
  };
  cv.addEventListener('pointerdown', e => {
    const id = pick(e);
    // 部品の上から始めたら「選ぶ」、何もないところから始めたら「回す」（指のずれで取りちがえない）
    if (id) {
      drag = { type: 'tap', id };
      if (e.pointerType === 'touch') { const r = cv.getBoundingClientRect(); hover = { id, x: e.clientX - r.left, y: e.clientY - r.top, until: performance.now() + 1800 }; }
      return;
    }
    drag = { type: 'orbit', x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointerleave', () => { if (hover && !hover.until) hover = null; });
  cv.addEventListener('pointermove', e => {
    if (!drag && e.pointerType !== 'touch') {
      const r = cv.getBoundingClientRect(), id = pick(e);
      hover = id ? { id, x: e.clientX - r.left, y: e.clientY - r.top } : null; cv.style.cursor = id ? 'pointer' : '';
    }
    if (!drag || drag.type !== 'orbit') return;
    cam.az = clamp(cam.az - (e.clientX - drag.x) * .008, -1.6, 2.4); cam.el = clamp(cam.el + (e.clientY - drag.y) * .006, -.25, 1.2);
    drag.x = e.clientX; drag.y = e.clientY; camGoal = null;
  });
  const up = () => { if (drag && drag.type === 'tap' && mode === 'parts') selectPart(drag.id); drag = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => drag = null);
  cv.addEventListener('wheel', e => { e.preventDefault(); cam.d = clamp(cam.d * (1 + e.deltaY * .001), 14, 120); camGoal = null; }, { passive: false });
  document.querySelectorAll('#p3-tabs button').forEach(b => b.onclick = () => setMode(b.dataset.t));
  $('p3-chips').innerHTML = PARTS.map(p => `<button data-id="${p.id}">${p.name}</button>`).join('');
  $('p3-chips').onclick = e => { const b = e.target.closest('button'); if (b) selectPart(b.dataset.id); };
  $('p3-card').onclick = e => { const b = e.target.closest('.p3-go'); if (b) { setMode('steps'); showStep(+b.dataset.step); } };
  $('p3-prev').onclick = () => showStep(stepIdx - 1);
  $('p3-next').onclick = () => { if (stepIdx === 5) { stopPlay(); Object.assign(ST, stateAt(6)); finish(); } else showStep(stepIdx + 1); };
  $('p3-play').onclick = () => { if (playing) stopPlay(); else play(); };
  $('p3-rotL').onclick = () => { camGoal = { az: cam.az + .6, el: cam.el, d: cam.d, t: cam.t.clone() }; };
  $('p3-rotR').onclick = () => { camGoal = { az: cam.az - .6, el: cam.el, d: cam.d, t: cam.t.clone() }; };
  $('p3-rotH').onclick = () => setCam('front');
  addEventListener('resize', () => { if (R) resize(); });
}
function setMode(m){
  mode = m;
  document.querySelectorAll('#p3-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === m));
  $('p3-parts').classList.toggle('hidden', m !== 'parts'); $('p3-steps').classList.toggle('hidden', m !== 'steps');
  if (m === 'parts') {
    stopPlay(); Object.assign(ST, stateAt(4), { rev: 1 }); ST.eyeBig = 0; apply();   // 部品を調べるときは100倍（教科書の写真と同じ）
    $('p3-now').textContent = '部品にカーソルをのせると名前、タップするとはたらきが出る（何もないところをドラッグで回す）';
    selectPart(sel); if (!sel) setCam('front');
  } else { sel = null; highlight(); showStep(stepIdx); }
}

/* =========================================================
   ループ
   ========================================================= */
let last = 0;
function frame(dt, draw = true){
  runSeq(dt);
  apply();
  $('p3-eye').classList.toggle('big', ST.eyeBig > .5);
  stepCam(dt);
  if (!draw) return;
  R.renderer.render(R.scene, R.camera);
  updateLabels();
}
function loop(t){
  requestAnimationFrame(loop);
  const scr = $('p3-screen'); if (!scr || scr.classList.contains('hidden') || R.box.clientWidth < 2) { last = t; return; }
  if (Math.abs(R.camera.aspect - R.box.clientWidth / R.box.clientHeight) > .01) resize();   // 表示が戻ったら合わせ直す
  const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
  frame(dt);
}

P3.start = function(){
  if (!R) {
    build(); makeLabels(); hookInput();
    $('p3-loading').style.display = 'none';
    setMode('parts'); setCam('front', true);
    // URLで直接開く：?p3=parts&sel=mirror ／ ?p3=steps&step=3（&still=1 でそのステップの終わりの状態）
    const q = new URLSearchParams(location.search);
    if (q.get('p3') === 'steps') {
      setMode('steps'); const i = clamp((+q.get('step') || 1) - 1, 0, 5);
      if (q.get('still')) { showStep(i, false); Object.assign(ST, stateAt(i + 1)); ST.eyeBig = q.get('big') ? 1 : 0; const c = { 0: 'mirror', 1: 'stage', 2: 'side', 3: 'iris', 4: 'side', 5: 'iris' }[i]; setCam(c, true); }
      else { showStep(i); }
    } else if (q.get('sel')) { selectPart(q.get('sel')); if (camGoal) { const g = camGoal; Object.assign(cam, { az: g.az, el: g.el, d: g.d }); cam.t.copy(g.t); camGoal = null; } }
    requestAnimationFrame(loop);
  } else resize();
};
P3.tick = (n = 60) => { for (let i = 0; i < n; i++) frame(1 / 60, i === n - 1); };
P3.dbg = () => ({ R, cam, setCam, showStep, setMode, selectPart, light, curObj, stateAt, get mode(){ return mode; }, get stepIdx(){ return stepIdx; }, get playing(){ return playing; } });
})();
