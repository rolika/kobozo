/**
 * Audio and haptic feedback helper for field log tallying
 */
let audioCtx: AudioContext | null = null;

export function playBeep(freq = 880, duration = 0.08, type: OscillatorType = 'sine') {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);

    // Haptic feedback if supported (Vibrate API)
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  } catch {
    // Ignore audio permission or playback restrictions
  }
}

export function playSuccessSound() {
  playBeep(784, 0.06); // G5
  setTimeout(() => playBeep(1046, 0.08), 60); // C6
}

export function playDeleteSound() {
  playBeep(350, 0.1, 'triangle');
}
