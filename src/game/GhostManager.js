import * as THREE from 'three';

/**
 * GhostManager
 * Records the player's best lap trajectory and provides smooth interpolation
 * for ghost car playback on subsequent laps to visualize performance improvement.
 */
export class GhostManager {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'desk_racer_ghost_best_lap_v1';
    this.sampleInterval = options.sampleInterval || 0.030; // ~33 Hz recording rate

    this.isRecording = false;
    this.currentLapSamples = [];
    this.lastSampleTime = -1;

    this.bestLapTime = null;
    this.bestLapSamples = null;

    this.enabled = true;

    // Reusable math objects for zero-GC interpolation
    this._pos0 = new THREE.Vector3();
    this._pos1 = new THREE.Vector3();
    this._quat0 = new THREE.Quaternion();
    this._quat1 = new THREE.Quaternion();

    this._outPose = {
      active: false,
      visible: false,
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      speed: 0,
      steerAngle: 0,
      driftAngle: 0,
      boost: false,
      s: 0,
      lapTime: 0,
      bestLapTime: 0,
      deltaSeconds: 0,
      isAhead: false,
      finished: false,
    };

    // Load persisted best lap from localStorage if available
    this.loadPersistedGhost();
  }

  loadPersistedGhost() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        if (data && typeof data.bestLapTime === 'number' && Array.isArray(data.samples) && data.samples.length >= 2) {
          this.bestLapTime = data.bestLapTime;
          this.bestLapSamples = data.samples;
        }
      }
    } catch (_err) {
      // Ignore localStorage errors (e.g. private browsing quota)
    }
  }

  savePersistedGhost() {
    try {
      if (this.bestLapTime !== null && this.bestLapSamples && this.bestLapSamples.length >= 2) {
        const payload = JSON.stringify({
          bestLapTime: this.bestLapTime,
          samples: this.bestLapSamples,
        });
        localStorage.setItem(this.storageKey, payload);
      }
    } catch (_err) {
      // Ignore localStorage quota warnings
    }
  }

  clearGhost() {
    this.bestLapTime = null;
    this.bestLapSamples = null;
    this.currentLapSamples = [];
    try {
      localStorage.removeItem(this.storageKey);
    } catch (_err) {
      // Ignore
    }
  }

  hasBestLap() {
    return Boolean(this.bestLapTime !== null && this.bestLapSamples && this.bestLapSamples.length >= 2);
  }

  startRecording() {
    this.isRecording = true;
    this.currentLapSamples = [];
    this.lastSampleTime = -1;
  }

  stopRecording() {
    this.isRecording = false;
    this.currentLapSamples = [];
  }

  /**
   * Records a snapshot of the vehicle state during an active race lap
   */
  recordSample(lapTime, state) {
    if (!this.isRecording || lapTime < 0) return;

    if (this.lastSampleTime >= 0 && lapTime - this.lastSampleTime < this.sampleInterval) {
      return;
    }
    this.lastSampleTime = lapTime;

    this.currentLapSamples.push({
      t: Number(lapTime.toFixed(3)),
      x: Number(state.position.x.toFixed(5)),
      y: Number(state.position.y.toFixed(5)),
      z: Number(state.position.z.toFixed(5)),
      qx: Number(state.quaternion.x.toFixed(4)),
      qy: Number(state.quaternion.y.toFixed(4)),
      qz: Number(state.quaternion.z.toFixed(4)),
      qw: Number(state.quaternion.w.toFixed(4)),
      speed: Number(state.speed.toFixed(4)),
      steerAngle: Number((state.steerAngle || 0).toFixed(3)),
      driftAngle: Number((state.driftAngle || 0).toFixed(3)),
      boost: Boolean(state.boostActive > 0),
      s: Number(state.s.toFixed(4)),
    });
  }

  /**
   * Called when the player crosses the finish line for a lap.
   * If this lap was faster than bestLapTime, it becomes the new best lap ghost!
   * @return {boolean} true if this lap became the new best ghost lap
   */
  onLapComplete(lapTime) {
    let wasNewBest = false;
    if (this.isRecording && this.currentLapSamples.length >= 10 && lapTime > 3.0) {
      if (this.bestLapTime === null || lapTime < this.bestLapTime) {
        this.bestLapTime = lapTime;
        this.bestLapSamples = this.currentLapSamples.slice();
        this.savePersistedGhost();
        wasNewBest = true;
      }
    }
    // Reset recording buffer for next lap
    this.currentLapSamples = [];
    this.lastSampleTime = -1;
    return wasNewBest;
  }

  /**
   * Evaluates the interpolated ghost pose for a given lap elapsed time.
   * Also computes real-time performance delta against player position.
   */
  getGhostPose(currentLapTime, playerState = null) {
    const out = this._outPose;
    out.active = false;
    out.visible = false;

    if (!this.enabled || !this.hasBestLap()) {
      return out;
    }

    const samples = this.bestLapSamples;
    const n = samples.length;
    out.active = true;
    out.bestLapTime = this.bestLapTime;
    out.lapTime = currentLapTime;

    // If current lap time is past best lap finish, hold ghost at finish line or last recorded pose
    if (currentLapTime >= this.bestLapTime) {
      const last = samples[n - 1];
      out.position.set(last.x, last.y, last.z);
      out.quaternion.set(last.qx, last.qy, last.qz, last.qw);
      out.speed = 0;
      out.steerAngle = 0;
      out.driftAngle = 0;
      out.boost = false;
      out.s = last.s;
      out.finished = true;
      out.visible = true;

      if (playerState) {
        // Player is behind ghost if currentLapTime > bestLapTime and player has not finished yet
        out.deltaSeconds = currentLapTime - this.bestLapTime;
        out.isAhead = false; // Player is behind ghost
      }
      return out;
    }

    out.finished = false;
    out.visible = true;

    // Binary search for sample interval [i0, i1]
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (samples[mid].t <= currentLapTime) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    const i0 = lo;
    const i1 = Math.min(n - 1, lo + 1);
    const s0 = samples[i0];
    const s1 = samples[i1];

    let alpha = 0.0;
    const dt = s1.t - s0.t;
    if (dt > 1e-4) {
      alpha = THREE.MathUtils.clamp((currentLapTime - s0.t) / dt, 0.0, 1.0);
    }

    // Interpolate 3D position
    this._pos0.set(s0.x, s0.y, s0.z);
    this._pos1.set(s1.x, s1.y, s1.z);
    out.position.lerpVectors(this._pos0, this._pos1, alpha);

    // Spherical interpolation for smooth rotation
    this._quat0.set(s0.qx, s0.qy, s0.qz, s0.qw);
    this._quat1.set(s1.qx, s1.qy, s1.qz, s1.qw);
    out.quaternion.copy(this._quat0).slerp(this._quat1, alpha);

    out.speed = THREE.MathUtils.lerp(s0.speed, s1.speed, alpha);
    out.steerAngle = THREE.MathUtils.lerp(s0.steerAngle, s1.steerAngle, alpha);
    out.driftAngle = THREE.MathUtils.lerp(s0.driftAngle, s1.driftAngle, alpha);
    out.boost = s0.boost || s1.boost;
    out.s = THREE.MathUtils.lerp(s0.s, s1.s, alpha);

    // Compute live performance delta against player if playerState is provided
    if (playerState) {
      // Find the ghost's timestamp when it was at the player's current spline track position state.s
      const playerS = playerState.s;
      let ghostTimeAtPlayerS = -1;
      let minArcDiff = Infinity;

      for (let k = 0; k < n; k++) {
        const diff = Math.abs(samples[k].s - playerS);
        if (diff < minArcDiff) {
          minArcDiff = diff;
          ghostTimeAtPlayerS = samples[k].t;
        }
      }

      if (ghostTimeAtPlayerS >= 0) {
        // Delta = player's current time minus ghost's time at this same track point
        // If delta < 0: player arrived here earlier -> player is FASTER (ahead of ghost)
        // If delta > 0: player arrived here later -> player is SLOWER (behind ghost)
        out.deltaSeconds = currentLapTime - ghostTimeAtPlayerS;
        out.isAhead = out.deltaSeconds <= 0;
      } else {
        out.deltaSeconds = 0;
        out.isAhead = true;
      }
    }

    return out;
  }
}
