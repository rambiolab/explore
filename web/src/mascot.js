import * as THREE from 'three';

const BODY = 0x4eb377;
const DEEP = 0x14855a;
const PINK = 0xf4b6c2;

function helix(length, turns, amp) {
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const u = i / 64;
    const a = u * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * amp * (0.3 + u), -u * length, Math.sin(a) * amp * (0.3 + u)));
  }
  return new THREE.CatmullRomCurve3(pts);
}

export function createMascot() {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  const skin = new THREE.MeshPhysicalMaterial({ color: BODY, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.22, sheen: 0.6, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xd8f5e2), iridescence: 0.15 });
  const deep = new THREE.MeshStandardMaterial({ color: DEEP, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const black = new THREE.MeshStandardMaterial({ color: 0x14231c, roughness: 0.15 });
  const pink = new THREE.MeshStandardMaterial({ color: PINK, roughness: 0.6 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.85, 12, 32), skin);
  body.position.y = 1.0;
  rig.add(body);

  const face = new THREE.Group();
  face.position.set(0, 1.28, 0.335);
  rig.add(face);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sx * 0.12, 0, 0);
    const white_ = new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 16), white);
    white_.scale.z = 0.7;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), black);
    pupil.position.set(sx * -0.008, 0.005, 0.045);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), white);
    glint.position.set(0.012, 0.02, 0.085);
    eye.add(white_, pupil, glint);
    face.add(eye);
    eyes.push(eye);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), pink);
    cheek.scale.set(1.2, 0.7, 0.4);
    cheek.position.set(sx * 0.2, -0.11, -0.025);
    face.add(cheek);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 24, Math.PI), black);
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -0.1, 0.035);
  face.add(mouth);

  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.34, 1.05, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.28, 6, 12), skin);
    arm.position.y = -0.17;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), deep);
    hand.position.y = -0.35;
    pivot.add(arm, hand);
    pivot.rotation.z = sx * 0.35;
    rig.add(pivot);
    arms.push(pivot);
  }

  const legs = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.14, 0.45, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 6, 12), skin);
    leg.position.y = -0.18;
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), deep);
    foot.scale.set(1, 0.55, 1.4);
    foot.position.set(0, -0.4, 0.04);
    pivot.add(leg, foot);
    rig.add(pivot);
    legs.push(pivot);
  }

  const flagella = [];
  for (let k = 0; k < 3; k++) {
    const pivot = new THREE.Group();
    const a = (k / 3) * Math.PI * 2 + 0.6;
    pivot.position.set(Math.sin(a) * 0.18, 0.62, -0.18 + Math.cos(a) * 0.08);
    pivot.rotation.set(1.0, a * 0.3, 0);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(helix(0.9, 3, 0.05), 96, 0.012, 6), deep);
    pivot.add(tube);
    rig.add(pivot);
    flagella.push(pivot);
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 32),
    new THREE.MeshBasicMaterial({ color: 0x0f3a28, transparent: true, opacity: 0.18, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  root.add(shadow);

  let blink = 2, talk = 0, wave = 0;
  const state = {
    root,
    level: 0,
    headPosition: new THREE.Vector3(),
    talk(seconds) { talk = Math.max(talk, seconds); },
    wave() { wave = 1.6; },
    update(t, dt, target) {
      rig.position.y = Math.abs(Math.sin(t * 2.2)) * 0.035;
      rig.rotation.z = Math.sin(t * 1.1) * 0.04;
      if (target) {
        const want = Math.atan2(target.x - root.position.x, target.z - root.position.z);
        let d = want - root.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        root.rotation.y += d * Math.min(1, dt * 3);
      }
      blink -= dt;
      const closed = blink < 0.12;
      eyes.forEach(e => { e.scale.y = closed ? 0.1 : 1; });
      if (blink < 0) blink = 2 + Math.random() * 3;

      talk = Math.max(0, talk - dt);
      const open = state.level > 0.02 ? state.level * 2.2 : talk > 0 ? Math.abs(Math.sin(t * 16)) * 1.4 : 0;
      mouth.scale.set(1, 0.6 + open, 1);

      wave = Math.max(0, wave - dt);
      arms[1].rotation.z = wave > 0 ? 2.5 + Math.sin(t * 12) * 0.35 : 0.35 + Math.sin(t * 2.2) * 0.08;
      arms[0].rotation.z = -0.35 - Math.sin(t * 2.2) * 0.08;
      legs.forEach((l, k) => { l.rotation.x = Math.sin(t * 2.2 + k * Math.PI) * 0.05; });
      flagella.forEach((f, k) => { f.children[0].rotation.y = t * 9 + k; });
      root.getWorldPosition(state.headPosition);
      state.headPosition.y += 1.95;
    },
  };
  return state;
}
