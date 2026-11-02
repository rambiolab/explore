import * as THREE from 'three';

const EYE = 1.6;

export class Player {
  constructor(camera, canvas, { isValid, start, yaw = 0 }) {
    this.camera = camera;
    this.canvas = canvas;
    this.isValid = isValid;
    this.pos = start.clone();
    this.yaw = yaw;
    this.pitch = 0;
    this.keys = new Set();
    this.stick = { x: 0, y: 0 };
    this.bob = 0;
    this.enabled = false;
    this.mouseLook = true;
    this.capture = localStorage.getItem('capture') === '1';
    this.touch = matchMedia('(pointer: coarse)').matches;
    this.pitchLimit = 1.2;
    this.#bindKeyboardMouse();
    this.#bindTouch();
  }

  get locked() { return document.pointerLockElement === this.canvas; }

  look(dx, dy, k) {
    this.yaw -= dx * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k, -this.pitchLimit, this.pitchLimit);
  }

  setCapture(on) {
    this.capture = on;
    localStorage.setItem('capture', on ? '1' : '0');
    if (!on && this.locked) document.exitPointerLock();
  }

  #bindKeyboardMouse() {
    addEventListener('keydown', e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (!e.repeat) this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    let drag = null;
    this.canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || !this.enabled || !this.mouseLook) return;
      if (this.capture && !this.locked) { this.canvas.requestPointerLock?.(); return; }
      drag = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.classList.add('dragging');
    });
    this.canvas.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || !this.mouseLook) return;
      if (this.locked) this.look(e.movementX, e.movementY, 0.0022);
      else if (drag) {
        this.look(e.clientX - drag.x, e.clientY - drag.y, 0.004);
        drag = { x: e.clientX, y: e.clientY };
      }
    });
    const end = () => { drag = null; this.canvas.classList.remove('dragging'); };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('wheel', e => {
      if (!this.enabled || !this.mouseLook) return;
      e.preventDefault();
      this.look(e.deltaX, e.deltaY, 0.0025);
    }, { passive: false });
  }

  #bindTouch() {
    const stickEl = document.getElementById('stick');
    const knob = stickEl.querySelector('.knob');
    let moveId = null, lookId = null, origin = null, last = null;
    const R = 50;
    this.canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      if (this.enabled && e.clientX < innerWidth / 2 && moveId === null) {
        moveId = e.pointerId;
        origin = { x: e.clientX, y: e.clientY };
        stickEl.style.left = `${origin.x}px`;
        stickEl.style.top = `${origin.y}px`;
        stickEl.classList.remove('hidden');
      } else if (lookId === null) {
        lookId = e.pointerId;
        last = { x: e.clientX, y: e.clientY };
      }
    });
    addEventListener('pointermove', e => {
      if (e.pointerId === moveId) {
        let dx = e.clientX - origin.x, dy = e.clientY - origin.y;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.stick = { x: dx / R, y: -dy / R };
      } else if (e.pointerId === lookId) {
        this.look(e.clientX - last.x, e.clientY - last.y, 0.005);
        last = { x: e.clientX, y: e.clientY };
      }
    });
    const end = e => {
      if (e.pointerId === moveId) {
        moveId = null;
        this.stick = { x: 0, y: 0 };
        knob.style.transform = '';
        stickEl.classList.add('hidden');
      }
      if (e.pointerId === lookId) lookId = null;
    };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
  }

  update(dt) {
    const k = this.keys;
    let f = this.stick.y, s = this.stick.x, turn = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD')) s += 1;
    if (k.has('KeyA')) s -= 1;
    if (k.has('KeyQ') || k.has('ArrowLeft')) turn += 1;
    if (k.has('KeyE') || k.has('ArrowRight')) turn -= 1;
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    const speed = (k.has('ShiftLeft') || k.has('ShiftRight')) ? 4.2 : 2.2;
    if (!this.enabled) f = s = turn = 0;
    this.yaw += turn * 1.9 * dt;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const dx = (-sin * f + cos * s) * speed * dt;
    const dz = (-cos * f - sin * s) * speed * dt;
    if (this.isValid(this.pos.x + dx, this.pos.z)) this.pos.x += dx;
    if (this.isValid(this.pos.x, this.pos.z + dz)) this.pos.z += dz;

    const moving = Math.min(1, Math.hypot(f, s));
    this.bob += dt * speed * 3.2 * moving;
    this.camera.position.set(this.pos.x, EYE + Math.sin(this.bob) * 0.025 * moving, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
