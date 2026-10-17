import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  parseHungarianDiameter, 
  speakHungarianNumber, 
  vibrateSuccess, 
  vibrateError,
  isSpeechRecognitionSupported,
  unlockAudioContext
} from '../utils/hungarianVoiceControl';

interface UseVoiceScalingControlProps {
  onDiameterRecognized: (diameter: number) => void;
  enabled?: boolean;
}

export interface VoiceControlState {
  isListening: boolean;
  isSupported: boolean;
  isSpeaking: boolean;
  isHearingSound: boolean;
  isHearingSpeech: boolean;
  lastTranscript: string;
  lastRecognizedDiameter: number | null;
  lastError: string | null;
  statusText: string;
  toggleListening: () => void;
  startListening: () => void;
  stopListening: () => void;
  restartListening: () => void;
  simulateVoiceInput: (testInput: string) => void;
}

export function useVoiceScalingControl({
  onDiameterRecognized,
  enabled = true
}: UseVoiceScalingControlProps): VoiceControlState {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isHearingSound, setIsHearingSound] = useState<boolean>(false);
  const [isHearingSpeech, setIsHearingSpeech] = useState<boolean>(false);
  const [lastTranscript, setLastTranscript] = useState<string>('');
  const [lastRecognizedDiameter, setLastRecognizedDiameter] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('Kikapcsolva');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const startupAttemptsRef = useRef<number>(0);
  const initWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onRecognizedRef = useRef(onDiameterRecognized);

  // Track processed utterance to avoid duplicates
  const lastProcessedTimeRef = useRef<number>(0);
  const lastProcessedDiameterRef = useRef<number | null>(null);

  useEffect(() => {
    onRecognizedRef.current = onDiameterRecognized;
  }, [onDiameterRecognized]);

  const isSupported = isSpeechRecognitionSupported();

  // Safely cleanup recognition instance without race conditions
  const cleanupRecognition = useCallback(() => {
    if (initWatchdogRef.current) {
      clearTimeout(initWatchdogRef.current);
      initWatchdogRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        const rec = recognitionRef.current;
        recognitionRef.current = null;
        rec.onstart = null;
        rec.onaudiostart = null;
        rec.onsoundstart = null;
        rec.onspeechstart = null;
        rec.onspeechend = null;
        rec.onsoundend = null;
        rec.onaudioend = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.abort();
      } catch {
        // ignore
      }
    }
    isStartingRef.current = false;
  }, []);

  // Forward declarations for references to avoid circular dependencies
  const startSessionRef = useRef<() => void>(() => {});
  const restartProcedureRef = useRef<() => void>(() => {});

  // Handle a successfully identified diameter (12-100)
  const handleValidDiameter = useCallback((diameter: number, transcript: string) => {
    const now = Date.now();
    // Prevent duplicate triggers of identical diameter within 800ms
    if (lastProcessedDiameterRef.current === diameter && now - lastProcessedTimeRef.current < 800) {
      return;
    }

    lastProcessedTimeRef.current = now;
    lastProcessedDiameterRef.current = diameter;

    // 1. Egy rövid rezgéssel azonnal jelezze a megértést (120ms)
    vibrateSuccess();

    // 2. Felület frissítése
    setLastRecognizedDiameter(diameter);
    setLastTranscript(transcript || diameter.toString());
    setStatusText(`✓ ${diameter} cm felismerve és rögzítve!`);
    setLastError(null);

    // 3. Aktiválja a számhoz tartozó nyomógombot és növelje a számlálót
    onRecognizedRef.current(diameter);

    // 4. Hangos visszamondás magyarul: felfüggesztjük a mikrofont, hogy ne hallja meg önmagát
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    cleanupRecognition();

    speakHungarianNumber(diameter).finally(() => {
      // 300ms szünet a visszhang / hangszóró lecsengése után, majd folytatjuk a figyelést
      setTimeout(() => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        if (isListeningRef.current) {
          startSessionRef.current();
        }
      }, 300);
    });
  }, [cleanupRecognition]);

  // Handle an utterance that could not be parsed as 12-100 cm
  const handleInvalidUtterance = useCallback((rawTranscript: string) => {
    if (!rawTranscript || rawTranscript.trim().length === 0) return;
    const clean = rawTranscript.trim();
    
    // "ha nem értette meg a kimondott számot, két hosszú rezgéssel jelezze"
    vibrateError();
    setLastTranscript(clean);
    setLastError(`Nem értelmezhető átmérő: „${clean}”. Csak 12 és 100 közötti átmérőt mondjon!`);
    setStatusText('⚠ Nem értelmezhető szám (12-100 cm)');
  }, []);

  // Main recognition starter function
  const startSession = useCallback(() => {
    if (!isListeningRef.current || isSpeakingRef.current) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setLastError('A beszédfelismerés nem elérhető ebben a böngészőben. Google Chrome, Edge vagy Safari javasolt.');
      setStatusText('Nem támogatott böngésző');
      setIsListening(false);
      isListeningRef.current = false;
      return;
    }

    cleanupRecognition();

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'hu-HU';
      // Use continuous = false: UNIVERSALLY supported on Android Chrome, iOS Safari, Desktop Chrome
      recognition.continuous = false;
      // Interim results = true: real-time transcription feedback as the user speaks
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      isStartingRef.current = true;

      // Watchdog: If recognition does not actively start within 750ms,
      // run the exact restart procedure that reliably initializes the microphone!
      if (initWatchdogRef.current) clearTimeout(initWatchdogRef.current);
      initWatchdogRef.current = setTimeout(() => {
        if (isListeningRef.current && isStartingRef.current) {
          startupAttemptsRef.current += 1;
          console.warn(`SpeechRecognition startup watchdog: restarting stuck microphone (attempt ${startupAttemptsRef.current})`);
          setStatusText(`Mikrofon inicializálása (${startupAttemptsRef.current})...`);
          
          // Re-prime audio hardware just like the successful manual restart button
          unlockAudioContext();
          cleanupRecognition();

          setTimeout(() => {
            if (isListeningRef.current && !isSpeakingRef.current) {
              startSessionRef.current();
            }
          }, 80);
        }
      }, 750);

      const markActive = () => {
        if (initWatchdogRef.current) {
          clearTimeout(initWatchdogRef.current);
          initWatchdogRef.current = null;
        }
        isStartingRef.current = false;
        startupAttemptsRef.current = 0;
        setStatusText('Figyelés aktív – mondjon egy átmérőt (pl. 24, harminchat, 50, száz)!');
        setLastError(null);
      };

      recognition.onstart = () => {
        if (!isListeningRef.current) {
          try { recognition.abort(); } catch { /* ignore */ }
          return;
        }
        markActive();
      };

      recognition.onaudiostart = () => {
        setIsHearingSound(true);
        markActive();
      };

      recognition.onsoundstart = () => {
        setIsHearingSound(true);
        markActive();
      };

      recognition.onspeechstart = () => {
        markActive();
        setIsHearingSpeech(true);
        setStatusText('Beszéd észlelve, feldolgozás...');
      };

      recognition.onspeechend = () => {
        setIsHearingSpeech(false);
      };

      recognition.onsoundend = () => {
        setIsHearingSound(false);
      };

      recognition.onaudioend = () => {
        setIsHearingSound(false);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        markActive();
        if (isSpeakingRef.current || !isListeningRef.current) return;

        const results = event.results;
        if (!results || results.length === 0) return;

        // Get the latest result
        const lastResult = results[results.length - 1];
        if (!lastResult || lastResult.length === 0) return;

        const transcript = lastResult[0]?.transcript?.trim() || '';
        const isFinal = !!lastResult.isFinal;

        if (transcript) {
          setLastTranscript(transcript);
        }

        const parsed = parseHungarianDiameter(transcript);

        if (parsed !== null) {
          // Valid diameter 12-100 cm recognized
          handleValidDiameter(parsed, transcript);
        } else if (isFinal && transcript.length > 0) {
          // Utterance finalized, but not a valid diameter 12-100
          handleInvalidUtterance(transcript);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        if (initWatchdogRef.current) {
          clearTimeout(initWatchdogRef.current);
          initWatchdogRef.current = null;
        }
        isStartingRef.current = false;
        const err = event.error;

        if (err === 'no-speech') {
          // Normal silence, keep listening loop alive
          return;
        }
        if (err === 'aborted') {
          // Expected when stopping or speaking back or resetting
          return;
        }
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          setLastError('A mikrofon hozzáférés le van tiltva vagy megtagadva. Kérjük engedélyezze a mikrofont a böngésző címsorában!');
          setStatusText('Mikrofon letiltva');
          setIsListening(false);
          isListeningRef.current = false;
          cleanupRecognition();
          return;
        }
        if (err === 'audio-capture') {
          setLastError('Nem érhető el a mikrofon (más app használja vagy nincs csatlakoztatva).');
          setStatusText('Mikrofon nem elérhető');
          setIsListening(false);
          isListeningRef.current = false;
          cleanupRecognition();
          return;
        }
        if (err === 'network') {
          setLastError('A Google beszédszolgáltatáshoz hálózati kapcsolat szükséges.');
          setStatusText('Hálózati kapcsolat szükséges');
          return;
        }

        console.warn('SpeechRecognition warning:', err);
      };

      recognition.onend = () => {
        if (initWatchdogRef.current) {
          clearTimeout(initWatchdogRef.current);
          initWatchdogRef.current = null;
        }
        isStartingRef.current = false;
        setIsHearingSound(false);
        setIsHearingSpeech(false);
        recognitionRef.current = null;

        // Seamless continuous loop: Restart listening if user hasn't turned it off and we're not speaking
        if (isListeningRef.current && !isSpeakingRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (isListeningRef.current && !isSpeakingRef.current) {
              startSessionRef.current();
            }
          }, 120);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: unknown) {
      if (initWatchdogRef.current) {
        clearTimeout(initWatchdogRef.current);
        initWatchdogRef.current = null;
      }
      isStartingRef.current = false;
      console.warn('SpeechRecognition start error:', err);
      const errMsg = String(err);
      if (errMsg.includes('already started')) {
        setStatusText('Figyelés aktív – mondjon egy átmérőt (pl. 24, harminchat, 50, száz)!');
      } else {
        setLastError(`Hiba a mikrofon indításakor: ${errMsg}`);
        setStatusText('Hiba a mikrofon indításakor');
        setIsListening(false);
        isListeningRef.current = false;
      }
    }
  }, [cleanupRecognition, handleValidDiameter, handleInvalidUtterance]);

  useEffect(() => {
    startSessionRef.current = startSession;
  }, [startSession]);

  // Clean stop of recognition
  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    isStartingRef.current = false;
    setIsListening(false);
    setIsHearingSound(false);
    setIsHearingSpeech(false);
    setStatusText('Kikapcsolva');

    if (initWatchdogRef.current) {
      clearTimeout(initWatchdogRef.current);
      initWatchdogRef.current = null;
    }

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    cleanupRecognition();
  }, [cleanupRecognition]);

  // The unified, reliable start/restart procedure:
  // Wakes audio context, cancels stale speech synthesis, cleans up, and launches session
  const startListening = useCallback(() => {
    if (!isSupported) {
      setLastError('A hangfelismerés nem támogatott ebben a böngészőben (Google Chrome, Edge vagy Safari javasolt).');
      setStatusText('Nem támogatott böngésző');
      return;
    }

    // 1. Immediately wake audio hardware on user gesture
    unlockAudioContext();

    setLastError(null);
    isListeningRef.current = true;
    setIsListening(true);
    setStatusText('Mikrofon indítása...');
    startupAttemptsRef.current = 0;

    // 2. Unlock SpeechSynthesis on user gesture
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    // 3. Clean up any existing instance with abort
    cleanupRecognition();

    // 4. Start recognition directly on user gesture
    startSession();
  }, [isSupported, cleanupRecognition, startSession]);

  useEffect(() => {
    restartProcedureRef.current = startListening;
  }, [startListening]);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  // Test simulation for manual validation or diagnostics
  const simulateVoiceInput = useCallback((testInput: string) => {
    setLastTranscript(testInput);
    const diameter = parseHungarianDiameter(testInput);

    if (diameter !== null) {
      handleValidDiameter(diameter, testInput);
    } else {
      handleInvalidUtterance(testInput);
    }
  }, [handleValidDiameter, handleInvalidUtterance]);

  // CRITICAL: Cleanup ONLY on component unmount!
  // Do NOT include isListening in dependencies, as that would trigger cleanup on initial start!
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      isStartingRef.current = false;
      if (initWatchdogRef.current) {
        clearTimeout(initWatchdogRef.current);
        initWatchdogRef.current = null;
      }
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      cleanupRecognition();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [cleanupRecognition]);

  // Stop listening only when enabled prop externally turns false
  useEffect(() => {
    if (!enabled && isListeningRef.current) {
      stopListening();
    }
  }, [enabled, stopListening]);

  return {
    isListening,
    isSupported,
    isSpeaking,
    isHearingSound,
    isHearingSpeech,
    lastTranscript,
    lastRecognizedDiameter,
    lastError,
    statusText,
    toggleListening,
    startListening,
    stopListening,
    restartListening: startListening,
    simulateVoiceInput
  };
}
