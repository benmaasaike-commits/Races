/**
 * Desk Racer Dynamic Engine Sound System & WebAudio Engine
 *
 * Features:
 * 1. Velocity & Speedometer-Mapped Dynamic Pitch & Volume:
 *    - Engine pitch scales dynamically from 70 Hz idle up to 340+ Hz at top speed (100+ km/h).
 *    - Engine volume scales dynamically from quiet idle (0.28) up to full-throttle roar (1.0+)
 *      based on live speedometer data (scaleKmh: 0 -> 106 km/h).
 *    - Responsive throttle acceleration torque boost and deceleration/braking pitch-down.
 * 2. Hybrid Procedural Harmonic Synthesizer + Real Studio Stems:
 *    - Real-time multi-harmonic cylinder pulse synthesis (sine + triangle + saturation)
 *      with dynamic resonant filter whose cutoff opens from 650 Hz (idle) to 7500 Hz (wide-open).
 *    - Studio stem loops (`kart_idle_loop.wav`, `kart_cruise_mid_loop.wav`, `kart_tire_drift_loop.wav`,
 *      `curb_rumble_loop.wav`) with dynamic equal-power crossfading and velocity-dependent volume.
 * 3. F1 Countdown Beeps, Rail Impacts, Lap Chimes, Overrun Sputters & Race Finish Fanfare.
 */

const LOOP_STEM_FILES = {
  idle: 'kart_idle_loop.wav',
  cruise: 'kart_cruise_mid_loop.wav',
  drift: 'kart_tire_drift_loop.wav',
  curb: 'curb_rumble_loop.wav',
};

const ONESHOT_STEM_FILES = {
  sputter: [
    'engine_sputter_burst_1.wav',
    'engine_sputter_burst_2.wav',
    'engine_sputter_burst_3.wav',
  ],
};

/**
 * Creates soft saturation curve for procedural engine harmonic drive
 */
function makeDistortionCurve(k = 20) {
  const n_samples = 256;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export function createDeskRacerHybridAudio(options = {}) {
  const baseUrl = (options.baseUrl || '/assets/audio').replace(/\/$/, '');
  const masterVolume = options.masterVolume ?? 0.32;
  const cacheBust = options.cacheBust || 'v=9';

  let ctx = null;
  let enabled = false;
  let stemsLoaded = false;
  let loadingPromise = null;

  let masterGain = null;
  let engineBusGain = null;
  let misfireDuckGain = null;
  let lowShelfFilter = null;
  let engineBusFilter = null;
  let presencePeakFilter = null;

  // Active looping AudioBufferSourceNodes & their GainNodes
  const loopNodes = {};
  const oneShotBuffers = { sputter: [] };

  // Procedural Harmonic Engine Synthesizer Nodes
  let synthOscPrimary = null;
  let synthOscSecondary = null;
  let synthOscSub = null;
  let synthFilter = null;
  let synthGain = null;
  let synthWaveShaper = null;

  // Clean LFE Sub-Harmonic Sine Resonator (<95 Hz)
  let rumbleSubOsc = null;
  let rumbleLowpass = null;
  let rumbleOutGain = null;

  // User-tunable parameters
  let userRumbleAmount = options.rumbleAmount ?? 1.0;
  let userSputterAmount = options.sputterAmount ?? 1.0;

  // Smoothed telemetry state
  let smoothSpeedKmh = 0.0;
  let smoothNormSpeed = 0.0;
  let smoothAccelRate = 0.0;
  let smoothBoostBlend = 0.0;
  let smoothHillAndCurlLoad = 0.0;
  let prevSpeed = 0.0;
  let prevTimeMs = performance.now();
  let nextSputterTime = 0;
  let sputterCount = 0;

  let lastDiag = {};
  const rawBufferPromises = new Map();
  const decodedBufferCache = new Map();
  let preloadPromise = null;

  function fetchRawArrayBuffer(url) {
    const sep = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${sep}${cacheBust}`;
    if (!rawBufferPromises.has(fullUrl)) {
      const p = fetch(fullUrl).then((resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
        return resp.arrayBuffer();
      });
      rawBufferPromises.set(fullUrl, p);
    }
    return rawBufferPromises.get(fullUrl);
  }

  async function fetchAndDecodeBuffer(url, decodeCtx = ctx) {
    const sep = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${sep}${cacheBust}`;
    if (decodedBufferCache.has(fullUrl)) {
      return decodedBufferCache.get(fullUrl);
    }
    const arr = await fetchRawArrayBuffer(url);
    const targetCtx = decodeCtx || ctx;
    if (!targetCtx) return null;
    const decoded = await targetCtx.decodeAudioData(arr.slice(0));
    decodedBufferCache.set(fullUrl, decoded);
    return decoded;
  }

  function preload() {
    if (preloadPromise) return preloadPromise;
    preloadPromise = (async () => {
      try {
        const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const offlineCtx = OfflineCtx ? new OfflineCtx(2, 1, 44100) : null;
        const allUrls = [
          ...Object.values(LOOP_STEM_FILES).map((f) => `${baseUrl}/${f}`),
          ...ONESHOT_STEM_FILES.sputter.map((f) => `${baseUrl}/${f}`),
        ];
        await Promise.all(
          allUrls.map(async (url) => {
            try {
              if (offlineCtx) {
                await fetchAndDecodeBuffer(url, offlineCtx);
              } else {
                await fetchRawArrayBuffer(url);
              }
            } catch (_) {
              // Ignore individual stem preload errors
            }
          })
        );
      } catch (_) {
        // Fallback to on-demand loading
      }
    })();
    return preloadPromise;
  }

  async function loadAllStems() {
    if (!ctx || loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
      try {
        const activeLoopKeys = ['idle', 'cruise', 'drift', 'curb'];
        await Promise.all(
          activeLoopKeys.map(async (key) => {
            const filename = LOOP_STEM_FILES[key];
            try {
              const buffer = await fetchAndDecodeBuffer(`${baseUrl}/${filename}`);
              if (!buffer) return;
              const src = ctx.createBufferSource();
              src.buffer = buffer;
              src.loop = true;

              const gain = ctx.createGain();
              gain.gain.value = 0.0;

              src.connect(gain);
              if (key === 'drift' || key === 'curb') {
                gain.connect(masterGain);
              } else {
                gain.connect(misfireDuckGain);
              }

              src.start(0, 0);
              loopNodes[key] = { src, gain, buffer };
            } catch (e) {
              console.warn(`[DynamicAudio] Stem load fallback for ${filename}:`, e);
            }
          })
        );

        for (const file of ONESHOT_STEM_FILES.sputter) {
          try {
            const buf = await fetchAndDecodeBuffer(`${baseUrl}/${file}`);
            if (buf) oneShotBuffers.sputter.push(buf);
          } catch (_) {
            // Sputter buffer optional fallback
          }
        }

        stemsLoaded = Boolean(loopNodes.cruise);
      } catch (err) {
        console.warn('[DynamicAudio] Stem loading warning:', err);
      }
    })();
    return loadingPromise;
  }

  function initAudio() {
    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.0001;
    masterGain.connect(ctx.destination);

    // Presence peak filter (1.5 kHz mechanical rasp & valve definition)
    presencePeakFilter = ctx.createBiquadFilter();
    presencePeakFilter.type = 'peaking';
    presencePeakFilter.frequency.value = 1550;
    presencePeakFilter.Q.value = 1.0;
    presencePeakFilter.gain.value = 1.6;
    presencePeakFilter.connect(masterGain);

    // Dynamic engine bus lowpass filter that opens up with velocity
    engineBusFilter = ctx.createBiquadFilter();
    engineBusFilter.type = 'lowpass';
    engineBusFilter.frequency.value = 6200;
    engineBusFilter.Q.value = 0.707;
    engineBusFilter.connect(presencePeakFilter);

    // Formant low-shelf filter for deep piston resonance
    lowShelfFilter = ctx.createBiquadFilter();
    lowShelfFilter.type = 'lowshelf';
    lowShelfFilter.frequency.value = 98;
    lowShelfFilter.gain.value = 3.5;
    lowShelfFilter.connect(engineBusFilter);

    // Misfire duck gain node
    misfireDuckGain = ctx.createGain();
    misfireDuckGain.gain.value = 1.0;
    misfireDuckGain.connect(lowShelfFilter);

    // Dynamic Engine Bus Gain (velocity-mapped volume master for all engine channels)
    engineBusGain = ctx.createGain();
    engineBusGain.gain.value = 0.35;
    engineBusGain.connect(misfireDuckGain);

    // -----------------------------------------------------------------------
    // Procedural Harmonic Engine Synthesizer (Instantaneous zero-lag synthesis)
    // -----------------------------------------------------------------------
    synthGain = ctx.createGain();
    synthGain.gain.value = 0.08;

    synthFilter = ctx.createBiquadFilter();
    synthFilter.type = 'lowpass';
    synthFilter.frequency.value = 1200;
    synthFilter.Q.value = 2.4; // Nice warm acoustic resonance peak

    synthWaveShaper = ctx.createWaveShaper();
    synthWaveShaper.curve = makeDistortionCurve(12);
    synthWaveShaper.oversample = '2x';

    synthOscPrimary = ctx.createOscillator();
    synthOscPrimary.type = 'triangle';
    synthOscPrimary.frequency.value = 75;

    synthOscSecondary = ctx.createOscillator();
    synthOscSecondary.type = 'sawtooth';
    synthOscSecondary.frequency.value = 150; // 2nd harmonic
    const secGain = ctx.createGain();
    secGain.gain.value = 0.28;
    synthOscSecondary.connect(secGain);

    synthOscSub = ctx.createOscillator();
    synthOscSub.type = 'sine';
    synthOscSub.frequency.value = 37.5; // Sub-octave chest thump
    const subGain = ctx.createGain();
    subGain.gain.value = 0.45;
    synthOscSub.connect(subGain);

    synthOscPrimary.connect(synthWaveShaper);
    secGain.connect(synthWaveShaper);
    subGain.connect(synthFilter);

    synthWaveShaper.connect(synthFilter);
    synthFilter.connect(synthGain);
    synthGain.connect(engineBusGain);

    synthOscPrimary.start();
    synthOscSecondary.start();
    synthOscSub.start();

    // Clean LFE Sub-Harmonic Sine Resonator (<95 Hz)
    rumbleSubOsc = ctx.createOscillator();
    rumbleSubOsc.type = 'sine';
    rumbleSubOsc.frequency.value = 55.0;

    rumbleLowpass = ctx.createBiquadFilter();
    rumbleLowpass.type = 'lowpass';
    rumbleLowpass.frequency.value = 95.0;
    rumbleLowpass.Q.value = 0.707;

    rumbleOutGain = ctx.createGain();
    rumbleOutGain.gain.value = 0.0;

    rumbleSubOsc.connect(rumbleLowpass);
    rumbleLowpass.connect(rumbleOutGain);
    rumbleOutGain.connect(masterGain);
    rumbleSubOsc.start();

    loadAllStems();
  }

  function fireSingleRealSputterPop(delayS = 0.0, intensity = 1.0, mode = 'idle') {
    if (!ctx || !enabled || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + delayS;
    const isIdleStumble = mode === 'idle';
    const isOverrunBackfire = mode === 'overrun';
    const v = 0.92 + 0.16 * Math.random();

    if (misfireDuckGain) {
      misfireDuckGain.gain.setValueAtTime(1.0, t0);
      misfireDuckGain.gain.linearRampToValueAtTime(isIdleStumble ? 0.55 : 0.42, t0 + 0.008);
      misfireDuckGain.gain.linearRampToValueAtTime(1.0, t0 + 0.036);
    }

    const tPop = t0 + 0.012;
    const dur = isOverrunBackfire ? 0.05 : 0.038;

    const thumpOsc = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thumpOsc.type = 'sine';
    thumpOsc.frequency.setValueAtTime((isIdleStumble ? 76.0 : 98.0) * v, tPop);
    thumpOsc.frequency.exponentialRampToValueAtTime((isIdleStumble ? 40.0 : 45.0) * v, tPop + dur);

    const peakGain = Math.min(0.3, (isIdleStumble ? 0.12 : 0.18) * intensity);
    thumpGain.gain.setValueAtTime(0.0001, tPop);
    thumpGain.gain.linearRampToValueAtTime(peakGain, tPop + 0.003);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, tPop + dur);

    thumpOsc.connect(thumpGain);
    thumpGain.connect(masterGain);
    thumpOsc.start(tPop);
    thumpOsc.stop(tPop + dur + 0.01);

    if ((isOverrunBackfire || isIdleStumble) && oneShotBuffers.sputter.length > 0) {
      const buf = isIdleStumble
        ? oneShotBuffers.sputter[0]
        : oneShotBuffers.sputter[
            1 + Math.floor(Math.random() * Math.max(1, oneShotBuffers.sputter.length - 1))
          ] || oneShotBuffers.sputter[oneShotBuffers.sputter.length - 1];
      const sliceDur = 0.16 + 0.1 * Math.random();
      const maxOffset = Math.max(0.0, buf.duration - sliceDur - 0.05);
      const offset = Math.random() * maxOffset;

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 0.94 + 0.12 * Math.random();

      const g = ctx.createGain();
      const gPeak = Math.min(0.55, (isIdleStumble ? 0.22 : 0.32) * intensity);
      g.gain.setValueAtTime(0.0001, tPop);
      g.gain.linearRampToValueAtTime(gPeak, tPop + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, tPop + sliceDur);

      src.connect(g);
      g.connect(presencePeakFilter);
      src.start(tPop, offset, sliceDur + 0.02);
    }
  }

  function triggerSputterBurst(intensity = 1.0, mode = 'auto') {
    if (!ctx || !enabled) return;
    sputterCount += 1;
    let resolvedMode = mode;
    if (resolvedMode === 'auto') {
      if (smoothAccelRate < -0.25 && smoothNormSpeed > 0.18) {
        resolvedMode = 'overrun';
      } else if (smoothNormSpeed < 0.15) {
        resolvedMode = 'idle';
      } else {
        resolvedMode = 'accel';
      }
    }
    const numPops = resolvedMode === 'overrun' ? 1 + Math.floor(Math.random() * 2) : 1;
    let offset = 0.0;
    for (let i = 0; i < numPops; i++) {
      fireSingleRealSputterPop(offset, intensity * (0.85 + 0.2 * Math.random()), resolvedMode);
      offset += 0.075 + 0.065 * Math.random();
    }
  }

  function setEnabled(state) {
    enabled = Boolean(state);
    if (enabled) {
      initAudio();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
      if (masterGain && ctx) {
        masterGain.gain.setTargetAtTime(masterVolume, ctx.currentTime, 0.05);
      }
    } else if (masterGain && ctx) {
      masterGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
    }
    return enabled;
  }

  function toggle() {
    return setEnabled(!enabled);
  }

  /**
   * Main audio telemetry update loop.
   * Maps current vehicle velocity and speedometer reading (scaleKmh: 0..106+ km/h)
   * to dynamic pitch and volume.
   */
  function update(state) {
    if (!enabled || !ctx || ctx.state !== 'running') return;

    const nowMs = performance.now();
    const dt = Math.min(0.1, Math.max(0.004, (nowMs - prevTimeMs) * 0.001));
    prevTimeMs = nowMs;

    const rawSpeed = Math.abs(state.speed || 0.0);
    // Explicit speedometer reading (0 to 106+ km/h) mapped directly from the speedometer formula
    const targetScaleKmh =
      typeof state.scaleKmh === 'number'
        ? state.scaleKmh
        : Math.round(rawSpeed * 102.35 * 3.6);

    const targetNormSpeed = Math.min(1.5, rawSpeed / 0.204);
    const rawAccel = (targetNormSpeed - prevSpeed) / dt;
    prevSpeed = targetNormSpeed;

    const speedAlpha = 1.0 - Math.exp(-9.5 * dt);
    const accelAlpha = 1.0 - Math.exp(-6.5 * dt);
    const boostAlpha = 1.0 - Math.exp(-6.0 * dt);
    const loadAlpha = 1.0 - Math.exp(-7.5 * dt);

    smoothSpeedKmh += (targetScaleKmh - smoothSpeedKmh) * speedAlpha;
    smoothNormSpeed += (targetNormSpeed - smoothNormSpeed) * speedAlpha;
    smoothAccelRate += (rawAccel - smoothAccelRate) * accelAlpha;

    const isBoostActive = (state.boostActive || 0) > 0 || rawSpeed > 0.245;
    const targetBoost = isBoostActive ? 1.0 : 0.0;
    smoothBoostBlend += (targetBoost - smoothBoostBlend) * boostAlpha;

    // Track slope & curl load
    const slope =
      typeof state.slope === 'number'
        ? state.slope
        : state.tangent && typeof state.tangent.y === 'number'
          ? state.tangent.y
          : 0.0;
    const sPos = typeof state.s === 'number' ? ((state.s % 3.12) + 3.12) % 3.12 : -1.0;

    let spiralCurlLoad = 0.0;
    if (sPos >= 0.4 && sPos <= 1.34) {
      const uCat = (sPos - 0.4) / 0.94;
      const entryFade = Math.min(1.0, uCat / 0.16);
      const exitFade = Math.min(1.0, (1.0 - uCat) / 0.28);
      const climbShape = 0.35 + 0.65 * Math.exp(-Math.pow((uCat - 0.32) / 0.28, 2.0));
      spiralCurlLoad = entryFade * exitFade * climbShape;
    } else if (sPos >= 1.46 && sPos <= 2.48) {
      const uLamp = (sPos - 1.46) / 1.02;
      const entryFade = Math.min(1.0, uLamp / 0.16);
      const exitFade = Math.min(1.0, (1.0 - uLamp) / 0.26);
      const climbShape = 0.35 + 0.65 * Math.exp(-Math.pow((uLamp - 0.38) / 0.28, 2.0));
      spiralCurlLoad = entryFade * exitFade * climbShape;
    }

    const uphillLug = slope > 0.0 ? slope * 0.72 : slope * 0.32;
    const targetHillAndCurlLoad = Math.max(-0.12, Math.min(0.36, uphillLug + spiralCurlLoad * 0.18));
    smoothHillAndCurlLoad += (targetHillAndCurlLoad - smoothHillAndCurlLoad) * loadAlpha;

    const accelKick =
      smoothAccelRate >= 0.0
        ? Math.min(0.12, smoothAccelRate * 0.08)
        : Math.max(-0.15, smoothAccelRate * 0.14);

    // -------------------------------------------------------------------------
    // 1. DYNAMIC SPEEDOMETER-MAPPED ENGINE VOLUME
    // -------------------------------------------------------------------------
    // Smooth, progressive volume swell from quiet idle (0.28) up to 1.05 at 100+ km/h
    // Velocity ratio from speedometer: 0 km/h = 0.0, 75 km/h = 1.0, 106 km/h = 1.41
    const velocityRatio = Math.max(0.0, smoothSpeedKmh / 75.0);
    const baseDynamicVolume = 0.28 + 0.72 * Math.pow(Math.min(1.35, velocityRatio), 0.88);
    const accelVolBonus = Math.max(0.0, smoothAccelRate * 0.12);
    const boostVolBonus = smoothBoostBlend * 0.18;
    const dynamicEngineGain = Math.min(1.28, baseDynamicVolume + accelVolBonus + boostVolBonus);

    // -------------------------------------------------------------------------
    // 2. DYNAMIC SPEEDOMETER-MAPPED ENGINE PITCH
    // -------------------------------------------------------------------------
    // Idle at 0 km/h: ~72 Hz
    // 35 km/h: ~135 Hz
    // 75 km/h: ~235 Hz
    // 105 km/h (redline/boost): ~340 Hz
    const targetF0 = Math.max(
      65.0,
      Math.min(
        380.0,
        72.0 +
          (smoothSpeedKmh / 75.0) * 165.0 +
          accelKick * 65.0 +
          smoothBoostBlend * 55.0 -
          smoothHillAndCurlLoad * 42.0
      )
    );

    // Map target fundamental to stem loop playback rate (122 Hz cruise stem anchor)
    const targetCruiseRate = Math.max(0.58, Math.min(1.85, targetF0 / 122.0));

    const now = ctx.currentTime;
    const timeConst = 0.035;

    // Apply dynamic volume to engine bus master
    if (engineBusGain) {
      engineBusGain.gain.setTargetAtTime(dynamicEngineGain, now, 0.04);
    }

    // Dynamic Stem Loops Update
    if (loopNodes.idle && loopNodes.cruise) {
      // Crossfade from idle stem to cruise stem based on speedometer velocity
      const launchU = Math.min(1.0, Math.max(0.0, (smoothSpeedKmh - 1.5) / 12.0));
      const idleGain = Math.cos(0.5 * Math.PI * launchU) * (0.85 + 0.15 * (1.0 - launchU));
      const cruiseGain = Math.sin(0.5 * Math.PI * launchU) * dynamicEngineGain;

      loopNodes.idle.gain.gain.setTargetAtTime(idleGain, now, timeConst);
      loopNodes.idle.src.playbackRate.setTargetAtTime(0.92 + 0.18 * (smoothSpeedKmh / 20.0), now, timeConst);

      loopNodes.cruise.gain.gain.setTargetAtTime(cruiseGain, now, timeConst);
      loopNodes.cruise.src.playbackRate.setTargetAtTime(targetCruiseRate, now, timeConst);
    } else if (loopNodes.cruise) {
      loopNodes.cruise.gain.gain.setTargetAtTime(dynamicEngineGain, now, timeConst);
      loopNodes.cruise.src.playbackRate.setTargetAtTime(targetCruiseRate, now, timeConst);
    }

    // -------------------------------------------------------------------------
    // 3. DYNAMIC PROCEDURAL SYNTHESIZER UPDATE
    // -------------------------------------------------------------------------
    // Instantaneous multi-harmonic synthesis responding directly to velocity
    if (synthOscPrimary && synthOscSecondary && synthOscSub && synthFilter && synthGain) {
      const primaryHz = targetF0;
      const secondaryHz = targetF0 * 2.0; // 2nd harmonic
      const subHz = targetF0 * 0.5;

      synthOscPrimary.frequency.setTargetAtTime(primaryHz, now, 0.025);
      synthOscSecondary.frequency.setTargetAtTime(secondaryHz, now, 0.025);
      synthOscSub.frequency.setTargetAtTime(subHz, now, 0.025);

      // Filter cutoff opens dramatically with speedometer speed (650 Hz idle -> 7200 Hz at 100+ km/h)
      const targetFilterCutoff = Math.max(
        600,
        Math.min(7600, 700 + (smoothSpeedKmh / 75.0) * 4800 + (smoothBoostBlend * 1200))
      );
      synthFilter.frequency.setTargetAtTime(targetFilterCutoff, now, 0.035);

      // Procedural synth volume increases proportionally with velocity
      const targetSynthGain = Math.min(0.24, 0.04 + 0.16 * Math.pow(Math.min(1.2, velocityRatio), 0.95));
      synthGain.gain.setTargetAtTime(targetSynthGain, now, 0.035);
    }

    // Formant EQ & Chest Sub-Bass Update
    const pitchAboveOne = Math.max(0.0, targetCruiseRate - 0.95);
    const lugWarmth = Math.max(0.0, smoothHillAndCurlLoad) * 8.5;
    const shelfDb =
      userRumbleAmount *
      (2.5 + 8.0 * pitchAboveOne + lugWarmth + 1.2 * Math.max(0, accelKick * 10));
    if (lowShelfFilter) {
      lowShelfFilter.gain.setTargetAtTime(Math.min(10.5, shelfDb), now, 0.04);
    }

    if (presencePeakFilter) {
      const presDb = Math.max(
        -1.5,
        (targetCruiseRate < 0.92 ? 2.4 : 2.0 - 2.5 * pitchAboveOne) -
          Math.max(0.0, smoothHillAndCurlLoad) * 7.0
      );
      presencePeakFilter.gain.setTargetAtTime(presDb, now, 0.04);
    }

    if (rumbleSubOsc && rumbleOutGain) {
      const subRumbleHz = Math.min(88.0, Math.max(38.0, targetF0 * 0.5));
      rumbleSubOsc.frequency.setTargetAtTime(subRumbleHz, now, 0.03);
      const subGain = Math.min(
        0.22,
        0.07 * userRumbleAmount * (0.8 + 0.45 * Math.min(1.2, velocityRatio))
      );
      rumbleOutGain.gain.setTargetAtTime(subGain, now, 0.04);
    }

    // Tire drift & curb rumble (triggered during drifts, sharp turns, and heavy braking)
    const isSkidAudio =
      Boolean(state.isDrifting) ||
      (Boolean(state.isBraking) && smoothNormSpeed > 0.10) ||
      ((state.throttle !== undefined && state.throttle < -0.15) && smoothNormSpeed > 0.10) ||
      ((Math.abs(state.steerInput || 0) > 0.32 || Math.abs(state.steerAngle || 0) > 0.18) && smoothNormSpeed > 0.16);
    const targetDriftGain =
      isSkidAudio ? 0.44 * Math.min(1.0, smoothNormSpeed / 0.25) : 0.0;
    const targetCurbGain =
      (state.curbRumble || 0) > 0.05 ? Math.min(0.48, state.curbRumble * 0.48) : 0.0;

    if (loopNodes.drift) {
      loopNodes.drift.gain.gain.setTargetAtTime(targetDriftGain, now, 0.04);
      loopNodes.drift.src.playbackRate.setTargetAtTime(0.92 + 0.18 * smoothNormSpeed, now, 0.05);
    }
    if (loopNodes.curb) {
      loopNodes.curb.gain.gain.setTargetAtTime(targetCurbGain, now, 0.03);
      loopNodes.curb.src.playbackRate.setTargetAtTime(0.88 + 0.32 * smoothNormSpeed, now, 0.04);
    }

    // Sputter scheduler for deceleration overrun
    const decelFactor = Math.min(
      1.0,
      Math.max(0.0, (-smoothAccelRate - 0.06) / 0.55 + Math.max(0.0, smoothHillAndCurlLoad) * 0.75)
    );
    if (userSputterAmount > 0.05 && now >= nextSputterTime) {
      if (decelFactor > 0.22 && smoothNormSpeed > 0.22) {
        triggerSputterBurst(userSputterAmount * 0.85, 'overrun');
        nextSputterTime = now + (0.6 + 0.75 * Math.random()) / Math.max(0.3, userSputterAmount);
      } else if (smoothNormSpeed < 0.1) {
        triggerSputterBurst(userSputterAmount * 0.45, 'idle');
        nextSputterTime = now + (3.2 + 2.5 * Math.random()) / Math.max(0.3, userSputterAmount);
      } else {
        nextSputterTime = now + 0.35;
      }
    }

    lastDiag = {
      stemsLoaded,
      speedKmh: Math.round(smoothSpeedKmh),
      pitchHz: Math.round(targetF0),
      volumeGain: Number(dynamicEngineGain.toFixed(2)),
      cruisePlaybackRate: Number(targetCruiseRate.toFixed(2)),
    };
  }

  function playLapChime() {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.001, now + idx * 0.07);
      g.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.35);
      o.connect(g);
      g.connect(masterGain);
      o.start(now + idx * 0.07);
      o.stop(now + idx * 0.07 + 0.38);
    });
  }

  function playF1CountdownBeep(isGo = false) {
    if (!enabled) return;
    initAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const baseFreq = isGo ? 1760.0 : 880.0;
    const dur = isGo ? 0.42 : 0.2;
    const peakGain = isGo ? 1.1 : 0.88;

    if (misfireDuckGain) {
      misfireDuckGain.gain.setValueAtTime(0.72, now);
      misfireDuckGain.gain.linearRampToValueAtTime(1.0, now + dur);
    }

    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = 'lowpass';
    toneFilter.frequency.value = isGo ? 5200 : 3000;
    toneFilter.Q.value = 0.707;
    toneFilter.connect(masterGain);

    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(peakGain, now + 0.005);
    envGain.gain.setValueAtTime(peakGain * 0.92, now + dur * 0.65);
    envGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    envGain.connect(toneFilter);

    const oscMain = ctx.createOscillator();
    oscMain.type = 'sine';
    oscMain.frequency.setValueAtTime(baseFreq, now);
    oscMain.connect(envGain);

    const oscHarm = ctx.createOscillator();
    oscHarm.type = 'triangle';
    oscHarm.frequency.setValueAtTime(baseFreq, now);
    const harmGain = ctx.createGain();
    harmGain.gain.value = 0.32;
    oscHarm.connect(harmGain);
    harmGain.connect(envGain);

    oscMain.start(now);
    oscHarm.start(now);
    oscMain.stop(now + dur + 0.02);
    oscHarm.stop(now + dur + 0.02);
  }

  function playRailImpact(intensity = 1.0) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const strength = Math.max(0.2, Math.min(1.35, Number(intensity) || 1.0));
    const pitchJitter = 0.96 + 0.08 * Math.random();

    if (misfireDuckGain) {
      misfireDuckGain.gain.cancelScheduledValues(now);
      misfireDuckGain.gain.setValueAtTime(1.0, now);
      misfireDuckGain.gain.linearRampToValueAtTime(
        Math.max(0.38, 1.0 - 0.45 * strength),
        now + 0.01
      );
      misfireDuckGain.gain.linearRampToValueAtTime(1.0, now + 0.085);
    }

    const thudDur = 0.09;
    const thudGain = ctx.createGain();
    const thudPeak = Math.min(0.42, 0.28 * strength);
    thudGain.gain.setValueAtTime(0.0001, now);
    thudGain.gain.linearRampToValueAtTime(thudPeak, now + 0.004);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, now + thudDur);
    thudGain.connect(masterGain);

    const thudSine = ctx.createOscillator();
    thudSine.type = 'sine';
    thudSine.frequency.setValueAtTime(110.0 * pitchJitter, now);
    thudSine.frequency.exponentialRampToValueAtTime(42.0 * pitchJitter, now + thudDur);
    thudSine.connect(thudGain);

    thudSine.start(now);
    thudSine.stop(now + thudDur + 0.015);
  }

  function playRaceFinishFanfare() {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;

    if (misfireDuckGain) {
      misfireDuckGain.gain.cancelScheduledValues(now);
      misfireDuckGain.gain.setValueAtTime(0.68, now);
      misfireDuckGain.gain.linearRampToValueAtTime(1.0, now + 1.15);
    }

    const fanfareFilter = ctx.createBiquadFilter();
    fanfareFilter.type = 'lowpass';
    fanfareFilter.frequency.setValueAtTime(3600, now);
    fanfareFilter.frequency.linearRampToValueAtTime(5400, now + 0.34);
    fanfareFilter.frequency.exponentialRampToValueAtTime(2400, now + 1.35);
    fanfareFilter.Q.value = 0.707;
    fanfareFilter.connect(masterGain);

    const arpeggio = [
      { freq: 523.25, start: 0.0, dur: 0.32, gain: 0.14 },
      { freq: 659.25, start: 0.07, dur: 0.34, gain: 0.14 },
      { freq: 783.99, start: 0.14, dur: 0.36, gain: 0.15 },
      { freq: 987.77, start: 0.21, dur: 0.42, gain: 0.15 },
      { freq: 1046.5, start: 0.29, dur: 0.92, gain: 0.19 },
    ];

    arpeggio.forEach(({ freq, start, dur, gain }) => {
      const t0 = now + start;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(gain, t0 + 0.014);
      env.gain.setValueAtTime(gain * 0.85, t0 + dur * 0.35);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      env.connect(fanfareFilter);

      const oscSine = ctx.createOscillator();
      oscSine.type = 'sine';
      oscSine.frequency.setValueAtTime(freq, t0);
      oscSine.connect(env);

      oscSine.start(t0);
      oscSine.stop(t0 + dur + 0.02);
    });
  }

  return {
    preload,
    toggle,
    setEnabled,
    update,
    playLapChime,
    playRaceFinishFanfare,
    playRailImpact,
    playF1CountdownBeep,
    triggerSputterBurst,
    setRumbleAmount: (v) => {
      userRumbleAmount = Math.max(0.0, Math.min(2.5, Number(v)));
    },
    setSputterAmount: (v) => {
      userSputterAmount = Math.max(0.0, Math.min(2.5, Number(v)));
    },
    isEnabled: () => enabled,
    getDiagnostics: () => lastDiag,
  };
}

export const createWebAudioSynth = createDeskRacerHybridAudio;
