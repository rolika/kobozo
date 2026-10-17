/**
 * Hungarian Voice Control for Forestry Scaling (12 to 100 cm diameters)
 * Features:
 * - Robust Hungarian Speech Recognition parsing (12-100 cm)
 * - Accent-insensitive & compound word matching
 * - Spoken feedback (hu-HU speech synthesis + Web Audio chime)
 * - Haptic vibration feedback (1 short vibration on success, 2 long vibrations on unrecognised)
 * - Audio fallbacks for devices without vibration motors (e.g. laptops)
 */

export function stripHungarianAccents(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ő/g, 'o')
    .replace(/ű/g, 'u');
}

// Spoken tens in Hungarian
const TENS: { [key: number]: { prefix: string; standalone: string } } = {
  10: { prefix: 'tizen', standalone: 'tíz' },
  20: { prefix: 'huszon', standalone: 'húsz' },
  30: { prefix: 'harminc', standalone: 'harminc' },
  40: { prefix: 'negyven', standalone: 'negyven' },
  50: { prefix: 'ötven', standalone: 'ötven' },
  60: { prefix: 'hatvan', standalone: 'hatvan' },
  70: { prefix: 'hetven', standalone: 'hetven' },
  80: { prefix: 'nyolcvan', standalone: 'nyolcvan' },
  90: { prefix: 'kilencven', standalone: 'kilencven' },
};

// Spoken units in Hungarian
const UNITS: { [key: number]: string[] } = {
  1: ['egy', 'egyes', 'egyest'],
  2: ['kettő', 'két', 'kettes', 'kettest'],
  3: ['három', 'hármas', 'harmas', 'hármast'],
  4: ['négy', 'négyes', 'negyes', 'négyest'],
  5: ['öt', 'ötös', 'otos', 'ötöst'],
  6: ['hat', 'hatos', 'hatost'],
  7: ['hét', 'hetes', 'hetest'],
  8: ['nyolc', 'nyolcas', 'nyolcast'],
  9: ['kilenc', 'kilences', 'kilencest'],
};

/**
 * Returns the official Hungarian spoken representation of a diameter 12-100
 */
export function getHungarianSpokenName(num: number): string {
  if (num === 100) return 'száz';
  if (num < 10 || num > 100) return num.toString();

  const ten = Math.floor(num / 10) * 10;
  const unit = num % 10;

  if (unit === 0) {
    return TENS[ten]?.standalone || num.toString();
  }

  const prefix = TENS[ten]?.prefix || '';
  const unitWord = unit === 2 ? 'kettő' : UNITS[unit]?.[0] || unit.toString();
  return `${prefix}${unitWord}`;
}

/**
 * Build comprehensive dictionary mapping spoken variations (both accented and unaccented)
 * to numerical diameters (12..100)
 */
function buildHungarianNumberDictionary(): Map<string, number> {
  const dict = new Map<string, number>();

  const register = (rawKey: string, val: number) => {
    if (!rawKey) return;
    const cleanAccented = rawKey.toLowerCase().trim().replace(/[-\s]+/g, '');
    const cleanStripped = stripHungarianAccents(cleanAccented);
    if (cleanAccented) dict.set(cleanAccented, val);
    if (cleanStripped) dict.set(cleanStripped, val);
  };

  // 100 variations
  register('100', 100);
  register('száz', 100);
  register('egyszáz', 100);
  register('egy száz', 100);
  register('százas', 100);
  register('százat', 100);
  register('száz centi', 100);
  register('száz centiméter', 100);
  register('százas rönk', 100);

  for (let n = 12; n <= 99; n++) {
    // Number digits
    register(n.toString(), n);
    register(`${n}-es`, n);
    register(`${n}es`, n);
    register(`${n}-as`, n);
    register(`${n}as`, n);
    register(`${n}-ös`, n);
    register(`${n}ös`, n);
    register(`${n}-est`, n);
    register(`${n}-ast`, n);
    register(`${n}-öst`, n);
    register(`${n}cm`, n);
    register(`${n} cm`, n);
    register(`${n} centi`, n);

    const ten = Math.floor(n / 10) * 10;
    const unit = n % 10;

    if (unit === 0) {
      // 20, 30, 40, 50, 60, 70, 80, 90
      const standalone = TENS[ten].standalone;
      register(standalone, n);
      register(`${standalone}as`, n);
      register(`${standalone}es`, n);
      register(`${standalone}os`, n);
      register(`${standalone}ös`, n);
      register(`${standalone}at`, n);
      register(`${standalone}et`, n);
      register(`${standalone}ot`, n);
      register(`${standalone}öt`, n);
      continue;
    }

    const prefix = TENS[ten].prefix;
    const unitVariants = UNITS[unit] || [];

    for (const u of unitVariants) {
      register(`${prefix}${u}`, n);
      register(`${prefix} ${u}`, n);
      register(`${prefix}-${u}`, n);
      register(`${prefix}${u}as`, n);
      register(`${prefix}${u}es`, n);
      register(`${prefix}${u}os`, n);
      register(`${prefix}${u}ös`, n);
    }
  }

  return dict;
}

const NUMBER_DICT = buildHungarianNumberDictionary();

/**
 * Parse a spoken transcript in Hungarian and extract a diameter strictly between 12 and 100 cm.
 * Returns the diameter number or null if no valid diameter found.
 */
export function parseHungarianDiameter(transcript: string): number | null {
  if (!transcript || typeof transcript !== 'string') return null;

  // 1. Direct digit extraction: Look for any isolated sequence of digits
  const digitMatches = transcript.match(/\d+/g);
  if (digitMatches) {
    for (const dStr of digitMatches) {
      const val = parseInt(dStr, 10);
      if (val >= 12 && val <= 100) {
        return val;
      }
    }
  }

  // 2. Normalize transcript
  const rawClean = transcript
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!rawClean) return null;

  // Try direct lookup with spaces removed
  const noSpaces = rawClean.replace(/\s+/g, '');
  if (NUMBER_DICT.has(noSpaces)) {
    return NUMBER_DICT.get(noSpaces)!;
  }
  const noSpacesStripped = stripHungarianAccents(noSpaces);
  if (NUMBER_DICT.has(noSpacesStripped)) {
    return NUMBER_DICT.get(noSpacesStripped)!;
  }

  // 3. Remove conversational filler phrases often spoken in forestry
  // (e.g. "átmérő 35", "legyen 40", "következő 28", "harmincöt centi", "negyvenkettő rönk")
  const sanitizedWords = rawClean
    .split(' ')
    .filter((w) => {
      const s = stripHungarianAccents(w);
      return !['atmero', 'legyen', 'kovetkezo', 'ronk', 'darab', 'centi', 'centimeter', 'cm', 'szam'].includes(s);
    });

  if (sanitizedWords.length > 0) {
    const sanitizedTogether = sanitizedWords.join('');
    if (NUMBER_DICT.has(sanitizedTogether)) {
      return NUMBER_DICT.get(sanitizedTogether)!;
    }
    const sanitizedStripped = stripHungarianAccents(sanitizedTogether);
    if (NUMBER_DICT.has(sanitizedStripped)) {
      return NUMBER_DICT.get(sanitizedStripped)!;
    }
  }

  // 4. Check word pairs (e.g. "harminc" + "öt", "huszon" + "kettő")
  const words = rawClean.split(' ').filter(Boolean);
  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i]}${words[i + 1]}`;
    if (NUMBER_DICT.has(pair)) return NUMBER_DICT.get(pair)!;

    const pairStripped = stripHungarianAccents(pair);
    if (NUMBER_DICT.has(pairStripped)) return NUMBER_DICT.get(pairStripped)!;
  }

  // 5. Check individual words
  for (const word of words) {
    if (NUMBER_DICT.has(word)) return NUMBER_DICT.get(word)!;

    const stripped = stripHungarianAccents(word);
    if (NUMBER_DICT.has(stripped)) return NUMBER_DICT.get(stripped)!;

    // Check with trailing suffixes stripped
    const baseWord = stripped.replace(/(cm|centi|centimeter|es|as|os|os|est|ast|ost)$/g, '');
    if (baseWord && NUMBER_DICT.has(baseWord)) {
      return NUMBER_DICT.get(baseWord)!;
    }
  }

  return null;
}

/**
 * Web Audio chime for acoustic feedback
 */
export function playTone(freq: number, durationSec: number, type: OscillatorType = 'sine'): void {
  try {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + durationSec);
    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    }, (durationSec + 0.1) * 1000);
  } catch {
    // ignore
  }
}

/**
 * Immediately unlocks and wakes up browser audio context and audio hardware on user gesture
 */
export function unlockAudioContext(): void {
  playTone(587.33, 0.08, 'sine'); // D5 note - subtle, pleasant prompt sound
}

/**
 * Convert any integer (1 to 9999) to its standard Hungarian spoken words.
 * Examples:
 * 27 -> "huszonhét"
 * 100 -> "száz"
 * 150 -> "százötven"
 * 248 -> "kétszáznegyvennyolc"
 * 1000 -> "ezer"
 * 1010 -> "ezertíz"
 * 1631 -> "ezerszázharmincegy"
 * 2000 -> "kétezer"
 * 2145 -> "kétezer-száznegyvenöt"
 * 3488 -> "háromezer-négyszáznyolcvannyolc"
 */
export function getHungarianNumberWords(num: number): string {
  if (num <= 0) return 'nulla';
  if (num > 9999) return num.toString();

  const ONES = ['', 'egy', 'kettő', 'három', 'négy', 'öt', 'hat', 'hét', 'nyolc', 'kilenc'];
  const TENS_STANDALONE: Record<number, string> = {
    10: 'tíz',
    20: 'húsz',
    30: 'harminc',
    40: 'negyven',
    50: 'ötven',
    60: 'hatvan',
    70: 'hetven',
    80: 'nyolcvan',
    90: 'kilencven',
  };
  const TENS_PREFIX: Record<number, string> = {
    10: 'tizen',
    20: 'huszon',
    30: 'harminc',
    40: 'negyven',
    50: 'ötven',
    60: 'hatvan',
    70: 'hetven',
    80: 'nyolcvan',
    90: 'kilencven',
  };

  const getTensAndOnes = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return ONES[n];
    const tensVal = Math.floor(n / 10) * 10;
    const onesVal = n % 10;
    if (onesVal === 0) return TENS_STANDALONE[tensVal] || '';
    return `${TENS_PREFIX[tensVal] || ''}${ONES[onesVal]}`;
  };

  const getHundreds = (n: number): string => {
    if (n === 0) return '';
    const h = Math.floor(n / 100);
    const rem = n % 100;
    let hStr = '';
    if (h === 1) {
      hStr = 'száz';
    } else if (h === 2) {
      hStr = 'kétszáz';
    } else if (h > 2) {
      hStr = `${ONES[h]}száz`;
    }
    const remStr = getTensAndOnes(rem);
    return `${hStr}${remStr}`;
  };

  const thousands = Math.floor(num / 1000);
  const remainder = num % 1000;

  if (thousands === 0) {
    return getHundreds(remainder);
  }

  let thStr = '';
  if (thousands === 1) {
    thStr = 'ezer';
  } else if (thousands === 2) {
    thStr = 'kétezer';
  } else {
    thStr = `${ONES[thousands]}ezer`;
  }

  if (remainder === 0) {
    return thStr;
  }

  const remStr = getHundreds(remainder);
  if (num <= 2000) {
    return `${thStr}${remStr}`;
  } else {
    return `${thStr}-${remStr}`;
  }
}

/**
 * Voice feedback: Speaks the Hungarian name of the number aloud
 * Also triggers a subtle pleasant confirmation chime.
 */
export function speakHungarianNumber(num: number): Promise<void> {
  // Play subtle confirmation chime
  playTone(880, 0.15, 'sine');

  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any pending spoken speech

      const spokenWord = getHungarianSpokenName(num);
      const utterance = new SpeechSynthesisUtterance(spokenWord);
      utterance.lang = 'hu-HU';
      utterance.rate = 1.05; // Slightly brisk for responsive field entry
      utterance.pitch = 1.0;

      // Select Hungarian voice if present
      const voices = window.speechSynthesis.getVoices();
      const huVoice = voices.find((v) => v.lang.startsWith('hu') || v.lang.toLowerCase().includes('hungarian'));
      if (huVoice) {
        utterance.voice = huVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);

      // Safety fallback timeout
      setTimeout(resolve, 1500);
    } catch {
      resolve();
    }
  });
}

/**
 * Spoken feedback for the statistical volume datum in liters
 * Speaks e.g. "száznegyven liter" or "ezerszázharmincegy liter"
 */
export function speakHungarianVolume(liters: number): Promise<void> {
  // Play subtle confirmation chime
  playTone(880, 0.12, 'sine');

  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any pending spoken speech

      const words = getHungarianNumberWords(liters);
      const spokenText = `${words} liter`;
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = 'hu-HU';
      utterance.rate = 1.08; // Crisp, responsive speed for forestry work
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const huVoice = voices.find((v) => v.lang.startsWith('hu') || v.lang.toLowerCase().includes('hungarian'));
      if (huVoice) {
        utterance.voice = huVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);

      // Safety fallback timeout
      setTimeout(resolve, 1600);
    } catch {
      resolve();
    }
  });
}


/**
 * Audible failure sound (two low warning beeps) for devices without vibration (e.g. laptops)
 */
export function playAudibleFailureWarning(): void {
  playTone(240, 0.25, 'triangle');
  setTimeout(() => {
    playTone(200, 0.28, 'triangle');
  }, 350);
}

/**
 * Haptic feedback: Short vibration on success (recognised diameter 12-100)
 */
export function vibrateSuccess(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(120); // Egy rövid rezgés (120ms)
    } catch {
      // Ignore vibration errors if disabled by browser policy
    }
  }
}

/**
 * Haptic feedback: Two long vibrations on error / unrecognised voice input
 * + Audible failure warning on desktop/laptop
 */
export function vibrateError(): void {
  // 1. Two long vibrations
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([400, 200, 400]); // Két hosszú rezgés köztük szünettel
    } catch {
      // Ignore vibration errors
    }
  }
  // 2. Also play audible failure tone for laptops without vibration motors
  playAudibleFailureWarning();
}

/**
 * Check if the browser supports Speech Recognition
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
}
