// --- STATE CONFIGURATION ---
const state = {
  isActivated: false,          // True if Maddy has been woken up and is waiting for a command
  continuousListening: true,   // Looping Speech recognition
  speakReplies: true,          // Speak replies back
  geminiKey: localStorage.getItem('maddy_gemini_key') || '',
  selectedVoiceName: localStorage.getItem('maddy_voice_name') || '',
  speechRate: parseFloat(localStorage.getItem('maddy_speech_rate')) || 1.0,
  voices: []
};

// --- DOM ELEMENTS ---
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const hudTime = document.getElementById('hud-time');
const orbContainer = document.getElementById('orb-trigger');
const orbSubtext = document.getElementById('orb-subtext');
const chatLogs = document.getElementById('chat-logs');
const chatContainer = document.getElementById('chat-container');
const commandInput = document.getElementById('command-input');
const micTrigger = document.getElementById('mic-trigger');
const micIcon = document.getElementById('mic-icon');
const sendTrigger = document.getElementById('send-trigger');
const continuousIndicator = document.getElementById('continuous-indicator');
const voiceLockBtn = document.getElementById('voice-lock-btn');
const voiceHud = document.getElementById('voice-hud');
const voiceTranscript = document.getElementById('voice-transcript');

// Settings Elements
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const geminiKeyInput = document.getElementById('gemini-key');
const voiceSelect = document.getElementById('voice-select');
const voiceRateSlider = document.getElementById('voice-rate');
const rateValue = document.getElementById('rate-value');
const voiceFeedbackCheckbox = document.getElementById('voice-feedback');
const saveSettingsBtn = document.getElementById('save-settings');

// Audio elements
const beepOn = document.getElementById('beep-on');
const beepOff = document.getElementById('beep-off');

// --- SPEECH ENGINES VARIABLES ---
let recognition = null;
let synthesis = window.speechSynthesis;
let isSpeaking = false;
let isRecognitionRunning = false;
let audioUnlocked = false; // Browser audio security unlock flag

// Initialize Speech Recognition
function initRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    updateStatus('SPEECH UNSUPPORTED', 'error');
    addChatMessage('System Error', 'Your browser does not support Speech Recognition. Please use Google Chrome or Edge.', 'ai');
    return;
  }

  if (recognition) {
    try {
      recognition.abort();
    } catch (e) {}
  }

  recognition = new SpeechRecognition();
  // Using Looping Single-Shot recognition is 10x more reliable in browsers than continuous mode.
  // It resets the acoustic buffer on pause, preventing speech accumulation and leaks.
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isRecognitionRunning = true;
    console.log('[Maddy Speech] Recognition started. Mode: ' + (state.isActivated ? 'COMMAND' : 'WAKEWORD'));
    if (state.isActivated) {
      updateStatus('LISTENING COMMAND...', 'listening');
    } else {
      updateStatus('MADDY WATCHING (SAY "MADDY")', 'online');
    }
  };

  recognition.onerror = (event) => {
    console.warn('[Maddy Speech] Recognition event error:', event.error);
    if (event.error === 'not-allowed') {
      updateStatus('MIC PERMISSION DENIED', 'error');
      state.continuousListening = false;
      updateContinuousButtonUI();
    }
  };

  recognition.onend = () => {
    isRecognitionRunning = false;
    console.log('[Maddy Speech] Recognition ended.');
    
    // Looper restart: restart listening only if Maddy isn't speaking and continuous mode is active
    if (state.continuousListening && !isSpeaking) {
      startListeningLoop();
    }
  };

  recognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    const transcriptText = (finalTranscript || interimTranscript).trim();
    if (!transcriptText) return;

    if (!state.isActivated) {
      // 1. Wake word watching mode
      const lowerText = transcriptText.toLowerCase();
      console.log(`[Maddy WakeWord] Heard: "${lowerText}"`);
      
      // Look for wake words: "maddy", "hey maddy", "wake up", "maddy wake up"
      if (
        lowerText.includes('maddy') || 
        lowerText.includes('hey maddy') || 
        lowerText.includes('wake up') || 
        lowerText.includes('madam') || 
        lowerText.includes('many') || 
        lowerText.includes('medi') || 
        lowerText.includes('daddy')
      ) {
        // Wake Word Triggered!
        triggerActivation();
      }
    } else {
      // 2. Activated Command Capture Mode
      voiceTranscript.innerText = transcriptText;
      console.log(`[Maddy Command] Capture: "${transcriptText}"`);
      
      if (finalTranscript) {
        let command = finalTranscript.trim();
        // Remove trailing or leading wake words if the user said them during the command
        command = command.replace(/^(hey\s+)?maddy\s*,?\s*/i, '');
        command = command.replace(/wake\s*up/i, '').trim();

        if (command) {
          handleUserCommand(command);
        }
        deactivateVoiceHUD();
      }
    }
  };
}

// Safely starts the speech recognition loop
function startListeningLoop() {
  if (isSpeaking || isRecognitionRunning) return;
  try {
    recognition.start();
  } catch (e) {
    console.warn('[Maddy Speech] Start loop error, retrying:', e);
  }
}

// Unlock audio context on first user click (Chrome/Edge Audio Security Policy)
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  console.log('[Maddy Audio] Core audio engines unlocked.');
  
  // Play a silent speak to warm up speech synthesis
  const unlockUtterance = new SpeechSynthesisUtterance('');
  synthesis.speak(unlockUtterance);
  
  // Play a startup notification
  speak("Systems fully unlocked and listening.");
  
  // Remove the listener from body
  document.body.removeEventListener('click', unlockAudio);
}

// Trigger active Jarvis mode
function triggerActivation() {
  if (state.isActivated) return;
  
  // Cancel any ongoing speaking
  synthesis.cancel();
  isSpeaking = false;

  state.isActivated = true;
  
  // Stop current recognition phase (we want to speak the greeting without Maddy hearing herself)
  try {
    recognition.stop();
  } catch(e) {}
  
  // UI Activation updates
  orbContainer.classList.remove('speaking');
  orbContainer.classList.add('listening');
  updateStatus('WAKING UP...', 'listening');
  
  // Show Voice HUD
  voiceHud.classList.remove('hidden');
  voiceTranscript.innerText = "Waking up...";

  // Play Sound Cues
  beepOn.volume = 0.3;
  beepOn.play().catch(() => {});

  // Speak the wake-up confirmation verbally
  speak("Yes, I am awake. What is your command?", () => {
    // When greeting finishes speaking, start capture session for command
    voiceTranscript.innerText = "Speak your command...";
    updateStatus('LISTENING COMMAND...', 'listening');
    startListeningLoop();
  });

  // Reset auto-deactivation timer if the user says nothing for 8 seconds
  if (window.activationTimeout) clearTimeout(window.activationTimeout);
  window.activationTimeout = setTimeout(() => {
    if (state.isActivated && voiceTranscript.innerText === "Speak your command...") {
      deactivateVoiceHUD();
    }
  }, 8000);
}

// Deactivate active listening mode, return to background watch
function deactivateVoiceHUD() {
  state.isActivated = false;
  orbContainer.classList.remove('listening');
  voiceHud.classList.add('hidden');
  
  beepOff.volume = 0.2;
  beepOff.play().catch(() => {});
  
  if (isSpeaking) {
    updateStatus('SPEAKING...', 'speaking');
    orbContainer.classList.add('speaking');
  } else {
    updateStatus('MADDY WATCHING (SAY "MADDY")', 'online');
    startListeningLoop();
  }
}

// Status UI updates
function updateStatus(text, mode) {
  statusText.innerText = text;
  
  // Reset classes
  statusDot.className = 'status-dot';
  orbContainer.classList.remove('listening', 'speaking');

  if (mode === 'listening') {
    statusDot.classList.add('listening');
    orbContainer.classList.add('listening');
  } else if (mode === 'speaking') {
    statusDot.classList.add('speaking');
    orbContainer.classList.add('speaking');
  } else if (mode === 'online') {
    statusDot.classList.add('pulsed');
  } else if (mode === 'error') {
    statusDot.style.backgroundColor = 'var(--accent-magenta)';
    statusDot.style.boxShadow = '0 0 10px var(--accent-magenta)';
  } else {
    statusDot.classList.add('pulsed');
  }
}

// --- COMMAND EXECUTION ENGINE ---

// Handles both typed & voice commands
async function handleUserCommand(command) {
  if (!command.trim()) return;

  // Add user message to Chat Log
  addChatMessage('You', command, 'user');
  commandInput.value = '';

  updateStatus('THINKING...', 'online');
  
  try {
    // 1. Route to backend Express API (for opening/closing apps or URLs)
    const response = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      addChatMessage('System CLI', result.message, 'system');
      speak(result.message);
      return;
    }

    // 2. If CLI execution is not matched, pass to Gemini / World Knowledge
    const reply = await queryWorldKnowledge(command);
    addChatMessage('Maddy', reply, 'ai');
    speak(reply);
  } catch (err) {
    console.warn('[Maddy Backend] Backend offline or errored. Falling back to local brain.');
    const reply = await queryWorldKnowledge(command);
    addChatMessage('Maddy', reply, 'ai');
    speak(reply);
  }
}

// Query AI Brain (Gemini API / Local Rules)
async function queryWorldKnowledge(query) {
  const lowercaseQuery = query.toLowerCase().trim();

  // Basic local offline matches
  if (lowercaseQuery === 'hello' || lowercaseQuery === 'hi' || lowercaseQuery === 'hey') {
    return "Hello! I am Maddy, your digital assistant. I'm online. How can I help you today?";
  }
  if (lowercaseQuery === 'who are you' || lowercaseQuery === 'what is your name') {
    return "I am Maddy, your Jarvis-style frontend assistant. I can open applications, run searches, or answer questions.";
  }
  if (lowercaseQuery === 'help' || lowercaseQuery === 'what can you do') {
    return "You can command me to open apps like Notepad, Paint, or Calculator, or open websites like YouTube. You can also ask me questions about anything.";
  }

  // 1. Try secure backend chat proxy (loading API key from server-side .env)
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.response) {
        return data.response;
      }
    }
  } catch (err) {
    console.warn('[Maddy AI] Backend secure proxy unavailable, attempting browser fallback:', err);
  }

  // 2. Client-side browser fallback (if client key is provided)
  if (state.geminiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are Maddy, a premium, hyper-intelligent Jarvis-like voice assistant. Provide a brief, concise, and helpful spoken-style answer (maximum 2-3 sentences) suitable for text-to-speech reading for this query: "${query}"`
            }]
          }]
        })
      });
      const data = await response.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        return data.candidates[0].content.parts[0].text;
      }
    } catch (e) {
      console.error('[Maddy AI] Client fallback query error:', e);
      return "I encountered a minor glitch connecting to my neural network, but I am still online. Please check your Gemini API key in settings.";
    }
  }

  // 3. Inform user how to set up key if both server and client keys are missing
  return `To enable my full world knowledge database, please input your Gemini API Key in the settings panel (gear icon) or create a .env file on the server. In the meantime, you can ask me to open applications or search the web! For example, say "search for ${query}" to search Google.`;
}

// Speech Synthesis speak engine with ignore-loops
function speak(text, onEndCallback = null) {
  if (!state.speakReplies || !synthesis) {
    if (onEndCallback) onEndCallback();
    return;
  }

  // Stop any active speaking
  synthesis.cancel();
  isSpeaking = true;

  // Temporarily stop microphone listening so Maddy doesn't hear herself
  if (isRecognitionRunning) {
    try {
      recognition.stop();
    } catch(e) {}
  }

  // Strip markdown formatting for readable speaking
  const cleanText = text.replace(/[*#_`[\]]/g, '').trim();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  
  // Apply voice properties
  if (state.selectedVoiceName) {
    const selectedVoice = state.voices.find(v => v.name === state.selectedVoiceName);
    if (selectedVoice) utterance.voice = selectedVoice;
  }
  utterance.rate = state.speechRate;

  utterance.onstart = () => {
    updateStatus('SPEAKING...', 'speaking');
  };

  const handleSpeechEnded = () => {
    isSpeaking = false;
    console.log('[Maddy Speech] Speaking finished.');
    
    if (onEndCallback) {
      // Run custom callback (e.g. restart listening for command)
      onEndCallback();
    } else {
      // Normal end: return to watch mode and restart recognition loop
      if (state.isActivated) {
        updateStatus('LISTENING COMMAND...', 'listening');
      } else {
        updateStatus('MADDY WATCHING (SAY "MADDY")', 'online');
      }
      if (state.continuousListening) {
        startListeningLoop();
      }
    }
  };

  utterance.onend = handleSpeechEnded;
  utterance.onerror = (e) => {
    console.warn('[Maddy Speech] TTS error:', e);
    handleSpeechEnded();
  };

  synthesis.speak(utterance);
}

// Add Chat Message bubble to logs
function addChatMessage(sender, text, type) {
  const msgEl = document.createElement('div');
  msgEl.className = `chat-msg ${type}-msg`;

  let avatarIcon = '<i class="fa-solid fa-microchip"></i>';
  let metaTag = 'MADDY // AI';

  if (type === 'user') {
    avatarIcon = '<i class="fa-solid fa-user"></i>';
    metaTag = 'USER // VOICE';
  } else if (type === 'system') {
    avatarIcon = '<i class="fa-solid fa-terminal"></i>';
    metaTag = 'MADDY // OS_SYSTEM';
  }

  msgEl.innerHTML = `
    <div class="msg-avatar">${avatarIcon}</div>
    <div class="msg-content">
      <div class="msg-meta">${metaTag}</div>
      <p>${text}</p>
    </div>
  `;

  chatLogs.appendChild(msgEl);
  chatLogs.scrollTop = chatLogs.scrollHeight;
}

// Populates browser voice pack options
function populateVoices() {
  if (!synthesis) return;
  state.voices = synthesis.getVoices();
  
  voiceSelect.innerHTML = '<option value="">Default OS Voice</option>';
  
  state.voices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (voice.name === state.selectedVoiceName) {
      option.selected = true;
    }
    voiceSelect.appendChild(option);
  });
}

function updateContinuousButtonUI() {
  if (state.continuousListening) {
    continuousIndicator.className = 'fa-solid fa-microphone active-mic';
    voiceLockBtn.title = "Continuous Listening Mode (ON)";
  } else {
    continuousIndicator.className = 'fa-solid fa-microphone-slash';
    voiceLockBtn.title = "Continuous Listening Mode (OFF)";
  }
}

// Bind UI controls
function setupUIEvents() {
  // Input trigger
  sendTrigger.addEventListener('click', () => {
    const val = commandInput.value.trim();
    if (val) handleUserCommand(val);
  });

  commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = commandInput.value.trim();
      if (val) handleUserCommand(val);
    }
  });

  // Clicking the main orb wakes up Maddy immediately
  orbContainer.addEventListener('click', () => {
    triggerActivation();
  });

  // Settings Panel Actions
  settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  saveSettingsBtn.addEventListener('click', () => {
    state.geminiKey = geminiKeyInput.value.trim();
    state.selectedVoiceName = voiceSelect.value;
    state.speechRate = parseFloat(voiceRateSlider.value);
    state.speakReplies = voiceFeedbackCheckbox.checked;

    localStorage.setItem('maddy_gemini_key', state.geminiKey);
    localStorage.setItem('maddy_voice_name', state.selectedVoiceName);
    localStorage.setItem('maddy_speech_rate', state.speechRate);
    localStorage.setItem('maddy_speak_replies', state.speakReplies);

    settingsPanel.classList.add('hidden');
    addChatMessage('System', 'Settings updated. Brain core recalibrated.', 'system');
    speak("Settings updated. Brain core recalibrated.");
  });

  voiceRateSlider.addEventListener('input', (e) => {
    rateValue.innerText = e.target.value + 'x';
  });

  // Toggle Continuous Mode
  voiceLockBtn.addEventListener('click', () => {
    state.continuousListening = !state.continuousListening;
    updateContinuousButtonUI();
    
    if (state.continuousListening) {
      initRecognition();
      addChatMessage('System', 'Continuous voice detection activated.', 'system');
      speak("Continuous voice detection activated.");
    } else {
      if (recognition) {
        try { recognition.abort(); } catch(e) {}
      }
      addChatMessage('System', 'Continuous voice detection deactivated. Manual activation only.', 'system');
      speak("Continuous voice detection deactivated.");
    }
  });

  // Microphone trigger (forces quick activation)
  micTrigger.addEventListener('click', () => {
    triggerActivation();
  });

  // Time HUD ticker
  setInterval(() => {
    const date = new Date();
    hudTime.innerText = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, 1000);
}

// Help chips
window.executeHint = function(command) {
  handleUserCommand(command);
};

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
  // Restore Settings
  geminiKeyInput.value = state.geminiKey;
  voiceFeedbackCheckbox.checked = localStorage.getItem('maddy_speak_replies') !== 'false';
  voiceRateSlider.value = state.speechRate;
  rateValue.innerText = state.speechRate + 'x';

  setupUIEvents();
  updateContinuousButtonUI();
  
  // Voices populate
  populateVoices();
  if (synthesis && synthesis.onvoiceschanged !== undefined) {
    synthesis.onvoiceschanged = populateVoices;
  }

  // Setup gesture unlock to resolve browser audio policy blocks
  document.body.addEventListener('click', unlockAudio);

  // Initialize Speech Recognition
  initRecognition();
  
  // Add a prompt to screen instructing user to click
  setTimeout(() => {
    addChatMessage('System', 'Welcome. Please **click anywhere on the screen** to activate Maddy\'s voice engine and start listening.', 'system');
  }, 500);
});
