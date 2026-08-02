"use client";

import { useState, useCallback } from "react";

export function useSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  // --- STT: SPEECH TO TEXT (Listening to the student) ---
  const startListening = useCallback((lang: string, onResult: (text: string) => void) => {
    // Check for browser support (Chrome, Edge, Safari)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition. Please try using Google Chrome or Microsoft Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang; // e.g., "en-IN", "hi-IN", "ta-IN"
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.onerror = (event: any) => {
      // "no-speech" is normal if the user clicks the mic but doesn't say anything.
      // We only want to log actual breaking errors to the console.
      if (event.error !== "no-speech") {
        console.error("Speech recognition error:", event.error);
      }
      setIsListening(false); // Turn off the red pulsing mic
    };

    recognition.onend = () => setIsListening(false);

    // Start listening
    recognition.start();
  }, []);

  // --- TTS: TEXT TO SPEECH (AI speaking back) ---
  const speakText = useCallback((text: string, lang: string) => {
    // Abort if the user turned voice off or the browser doesn't support it
    if (!voiceEnabled || !window.speechSynthesis) return;

    // Cancel any ongoing speech before starting a new one
    window.speechSynthesis.cancel();

    // Clean the text: Strip out Markdown bold (**), headers (#), and italics (_)
    // so the AI doesn't physically say the word "asterisk" out loud.
    const cleanText = text.replace(/[*#_]/g, "");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang;
    utterance.rate = 1.0; // Normal conversational speed
    utterance.pitch = 1.0;

    // Try to find the highest-quality native voice for the selected language
    const voices = window.speechSynthesis.getVoices();
    const tutorVoice = 
        voices.find((v) => v.lang === lang) || // Exact match (e.g., "hi-IN")
        voices.find((v) => v.lang.includes(lang.split('-')[0])); // Fallback match (e.g., just "hi")
    
    if (tutorVoice) {
      utterance.voice = tutorVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    // Speak!
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  // --- UTILITY: Stop the AI from talking ---
  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return {
    isListening,
    isSpeaking,
    voiceEnabled,
    setVoiceEnabled,
    startListening,
    speakText,
    stopSpeaking
  };
}