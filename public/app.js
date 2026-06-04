// --- 3D GLOWING PARTICLE ORB STATE (THREE.JS) ---
let scene, camera, renderer, particleSystem1, particleSystem2, particleSystem3;
const particleCount1 = 450; // Inner Core
const particleCount2 = 550; // Outer Shell
const particleCount3 = 240; // Orbital Ring
let orbState = 'idle'; // idle, listening, thinking, speaking
let particleGeometry1, particleGeometry2, particleGeometry3;

// --- STATE CONFIGURATION ---
const state = {
  isActivated: false,          // True if Jarvis is woke and listening for command
  continuousListening: true,   // Looping speech recognition active
  speakReplies: true,          // Speak replies back
  geminiKey: localStorage.getItem('jarvis_gemini_key') || '',
  selectedVoiceName: localStorage.getItem('jarvis_voice_name') || '',
  speechRate: parseFloat(localStorage.getItem('jarvis_speech_rate')) || 1.0,
  voices: []
};

// --- DOM ELEMENTS ---
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const orbContainer = document.getElementById('orb-trigger');
const orbSubtext = document.getElementById('orb-subtext');
const chatLogs = document.getElementById('chat-logs');
const commandInput = document.getElementById('command-input');
const micTrigger = document.getElementById('mic-trigger');
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

// --- SPEECH ENGINES SETUP ---
let recognition = null;
let synthesis = window.speechSynthesis;
let isSpeaking = false;
let isRecognitionRunning = false;
let audioUnlocked = false; // Browser Web Audio permission flag

// Initialize 3D Particle Orb Core (WebGL Three.js) - Featuring Two Concentric Cores & Orbital Ring
function init3DOrb() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  const width = 280;
  const height = 280;

  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
  camera.position.z = 2.4;

  // WebGL Renderer
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Generate dynamic soft glowing circle texture on-the-fly
  const pTexture = createCircleTexture();

  // 1. INNER CORE GEOMETRY (Dark Blue Base)
  particleGeometry1 = new THREE.BufferGeometry();
  const positions1 = new Float32Array(particleCount1 * 3);
  const colors1 = new Float32Array(particleCount1 * 3);
  const color1 = new THREE.Color('#0b132b'); // Deep Dark Blue

  for (let i = 0; i < particleCount1; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = 0.45 + Math.random() * 0.08; // Core radius

    positions1[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions1[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions1[i * 3 + 2] = r * Math.cos(phi);

    colors1[i * 3] = color1.r;
    colors1[i * 3 + 1] = color1.g;
    colors1[i * 3 + 2] = color1.b;
  }
  particleGeometry1.setAttribute('position', new THREE.BufferAttribute(positions1, 3));
  particleGeometry1.setAttribute('color', new THREE.BufferAttribute(colors1, 3));

  const material1 = new THREE.PointsMaterial({
    size: 0.045,
    map: pTexture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true
  });
  particleSystem1 = new THREE.Points(particleGeometry1, material1);
  scene.add(particleSystem1);

  // 2. OUTER CORE GEOMETRY (Light Blue Base)
  particleGeometry2 = new THREE.BufferGeometry();
  const positions2 = new Float32Array(particleCount2 * 3);
  const colors2 = new Float32Array(particleCount2 * 3);
  const color2 = new THREE.Color('#00d2ff'); // Bright Light Blue

  for (let i = 0; i < particleCount2; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = 0.82 + Math.random() * 0.12; // Outer radius

    positions2[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions2[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions2[i * 3 + 2] = r * Math.cos(phi);

    colors2[i * 3] = color2.r;
    colors2[i * 3 + 1] = color2.g;
    colors2[i * 3 + 2] = color2.b;
  }
  particleGeometry2.setAttribute('position', new THREE.BufferAttribute(positions2, 3));
  particleGeometry2.setAttribute('color', new THREE.BufferAttribute(colors2, 3));

  const material2 = new THREE.PointsMaterial({
    size: 0.045,
    map: pTexture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true
  });
  particleSystem2 = new THREE.Points(particleGeometry2, material2);
  scene.add(particleSystem2);

  // 3. ORBITAL RING GEOMETRY (Tilted Orbiting Ring)
  particleGeometry3 = new THREE.BufferGeometry();
  const positions3 = new Float32Array(particleCount3 * 3);
  const colors3 = new Float32Array(particleCount3 * 3);
  const color3 = new THREE.Color('#00d2ff');

  for (let i = 0; i < particleCount3; i++) {
    const angle = (i / particleCount3) * Math.PI * 2;
    const r = 1.16 + Math.random() * 0.08; // Orbit radius

    positions3[i * 3] = r * Math.cos(angle);
    positions3[i * 3 + 1] = (Math.random() - 0.5) * 0.05; // thin vertical spread
    positions3[i * 3 + 2] = r * Math.sin(angle);

    colors3[i * 3] = color3.r;
    colors3[i * 3 + 1] = color3.g;
    colors3[i * 3 + 2] = color3.b;
  }
  particleGeometry3.setAttribute('position', new THREE.BufferAttribute(positions3, 3));
  particleGeometry3.setAttribute('color', new THREE.BufferAttribute(colors3, 3));

  particleSystem3 = new THREE.Points(particleGeometry3, material2);
  // Add static Z and X tilt to make it orbit diagonally
  particleSystem3.rotation.x = Math.PI / 3.5;
  particleSystem3.rotation.z = Math.PI / 6;
  scene.add(particleSystem3);

  animateOrb();
}

// Helper to create a glowing canvas texture for points
function createCircleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.7)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 16, 16);
  
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Core animation tick for double concentric 3D sphere & ring state morphing
let clock = new THREE.Clock();

function animateOrb() {
  requestAnimationFrame(animateOrb);

  if (!particleSystem1 || !particleSystem2 || !particleSystem3) return;

  const time = clock.getElapsedTime();

  if (orbState === 'idle') {
    // Concentric spheres rotate in opposite directions, ring rotates tilt-wise
    particleSystem1.rotation.y = time * 0.16;
    particleSystem1.rotation.x = time * 0.06;
    
    particleSystem2.rotation.y = -time * 0.12;
    particleSystem2.rotation.x = -time * 0.04;
    
    particleSystem3.rotation.y = time * 0.45;

    // Out-of-phase breathing pulses
    const pulse1 = 1.0 + Math.sin(time * 1.5) * 0.03;
    const pulse2 = 1.0 + Math.cos(time * 1.5) * 0.04;
    particleSystem1.scale.set(pulse1, pulse1, pulse1);
    particleSystem2.scale.set(pulse2, pulse2, pulse2);
    particleSystem3.scale.set(pulse2, pulse2, pulse2);

    // Set colors: Inner is deep dark blue, outer/ring is bright light blue
    setParticleColor(particleGeometry1, '#0b132b', particleCount1);
    setParticleColor(particleGeometry2, '#00d2ff', particleCount2);
    setParticleColor(particleGeometry3, '#00d2ff', particleCount3);

  } else if (orbState === 'listening') {
    // Dynamic rapid rotation
    particleSystem1.rotation.y = time * 0.8;
    particleSystem1.rotation.x = time * 0.4;
    
    particleSystem2.rotation.y = -time * 0.6;
    particleSystem2.rotation.z = time * 0.3;
    
    particleSystem3.rotation.y = -time * 1.1;

    const pulse1 = 1.08 + Math.sin(time * 9.5) * 0.08;
    const pulse2 = 1.12 + Math.cos(time * 9.5) * 0.1;
    particleSystem1.scale.set(pulse1, pulse1, pulse1);
    particleSystem2.scale.set(pulse2, pulse2, pulse2);
    particleSystem3.scale.set(pulse2, pulse2, pulse2);

    // Transition to energetic active state colors (Magenta/Pink cores)
    setParticleColor(particleGeometry1, '#ff007c', particleCount1);
    setParticleColor(particleGeometry2, '#ff66b2', particleCount2);
    setParticleColor(particleGeometry3, '#ff66b2', particleCount3);

  } else if (orbState === 'thinking') {
    // Spiral swirl vortex rotation
    particleSystem1.rotation.y = time * 1.9;
    particleSystem1.rotation.z = time * 0.7;
    
    particleSystem2.rotation.y = -time * 1.5;
    particleSystem2.rotation.x = -time * 0.5;
    
    particleSystem3.rotation.y = time * 2.2;

    const pulse1 = 0.96 + Math.sin(time * 18) * 0.04;
    const pulse2 = 0.98 + Math.cos(time * 18) * 0.06;
    particleSystem1.scale.set(pulse1, pulse1, pulse1);
    particleSystem2.scale.set(pulse2, pulse2, pulse2);
    particleSystem3.scale.set(pulse2, pulse2, pulse2);

    // Swirling purple color profiles
    setParticleColor(particleGeometry1, '#7a00cc', particleCount1);
    setParticleColor(particleGeometry2, '#bd00ff', particleCount2);
    setParticleColor(particleGeometry3, '#bd00ff', particleCount3);

  } else if (orbState === 'speaking') {
    // Outward throb matching speech peak simulation
    particleSystem1.rotation.y = time * 0.35;
    particleSystem1.rotation.x = time * 0.15;
    
    particleSystem2.rotation.y = -time * 0.25;
    particleSystem2.rotation.x = -time * 0.1;
    
    particleSystem3.rotation.y = -time * 0.75;

    const throb1 = 1.02 + Math.sin(time * 6.5) * 0.06 * (1.0 + Math.cos(time * 3.5));
    const throb2 = 1.06 + Math.cos(time * 6.5) * 0.08 * (1.0 + Math.sin(time * 3.5));
    particleSystem1.scale.set(throb1, throb1, throb1);
    particleSystem2.scale.set(throb2, throb2, throb2);
    particleSystem3.scale.set(throb2, throb2, throb2);

    // Dual blue voice frequency waves
    setParticleColor(particleGeometry1, '#0011aa', particleCount1);
    setParticleColor(particleGeometry2, '#0088ff', particleCount2);
    setParticleColor(particleGeometry3, '#0088ff', particleCount3);
  }

  renderer.render(scene, camera);
}

// Lerps point array colors towards targets smoothly
function setParticleColor(geom, hexColor, count) {
  const colors = geom.attributes.color.array;
  const target = new THREE.Color(hexColor);
  
  for (let i = 0; i < count; i++) {
    colors[i * 3] += (target.r - colors[i * 3]) * 0.08;
    colors[i * 3 + 1] += (target.g - colors[i * 3 + 1]) * 0.08;
    colors[i * 3 + 2] += (target.b - colors[i * 3 + 2]) * 0.08;
  }
  geom.attributes.color.needsUpdate = true;
}

function updateOrbState(state) {
  orbState = state;
}

// Initialize Speech Recognition
function initRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    updateStatus('SPEECH UNSUPPORTED', 'error');
    addChatMessage('System Error', 'Your browser does not support Speech Recognition. Please use Google Chrome or Edge.', 'ai');
    return;
  }

  if (recognition) {
    try { recognition.abort(); } catch (e) {}
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isRecognitionRunning = true;
    console.log('[Jarvis Speech] Listening. Active state: ' + state.isActivated);
    if (state.isActivated) {
      updateStatus('LISTENING COMMAND...', 'listening');
    } else {
      updateStatus('JARVIS STANDBY (SAY "JARVIS")', 'online');
    }
  };

  recognition.onerror = (e) => {
    console.warn('[Jarvis Speech] Error Event:', e.error);
    if (e.error === 'not-allowed') {
      updateStatus('MIC PERMISSION DENIED', 'error');
      state.continuousListening = false;
      updateContinuousButtonUI();
    }
  };

  recognition.onend = () => {
    isRecognitionRunning = false;
    // Autostart loop
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

    const text = (finalTranscript || interimTranscript).trim();
    if (!text) return;

    if (!state.isActivated) {
      // 1. Wake word mode
      const lower = text.toLowerCase();
      console.log(`[Jarvis WakeWord] Capturing: "${lower}"`);

      // Match vocal variations/transcripts of Jarvis
      if (
        lower.includes('jarvis') ||
        lower.includes('hey jarvis') ||
        lower.includes('travis') ||
        lower.includes('charvis') ||
        lower.includes('job is') ||
        lower.includes('service') ||
        lower.includes('wake up')
      ) {
        triggerActivation();
      }
    } else {
      // 2. Command capture mode
      voiceTranscript.innerText = text;
      
      if (finalTranscript) {
        let cmd = finalTranscript.trim();
        // Strip wake trigger keywords
        cmd = cmd.replace(/^(hey\s+)?(jarvis|travis|charvis)\s*,?\s*/i, '');
        cmd = cmd.replace(/wake\s*up/i, '').trim();

        if (cmd) {
          handleUserCommand(cmd);
        }
        // In conversational mode, we stay active and do not deactivate the voice HUD immediately.
        // Jarvis will continue listening and responding in a loop until the user says "Shut down"
        // or goes silent for the inactivity timeout.
      }
    }
  };
}

function startListeningLoop() {
  if (isSpeaking || isRecognitionRunning) return;
  try {
    recognition.start();
  } catch (e) {
    console.warn('[Jarvis Speech] Recognition loop start bypass:', e);
  }
}

// User-gesture browser permissions unlock
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  console.log('[Jarvis Audio] Engine active.');

  const warmth = new SpeechSynthesisUtterance('');
  synthesis.speak(warmth);

  speak("Jarvis initialized. Secure local systems online.");

  document.body.removeEventListener('click', unlockAudio);
}

// Wake up Jarvis
function triggerActivation() {
  if (state.isActivated) return;

  synthesis.cancel();
  isSpeaking = false;
  state.isActivated = true;

  try { recognition.stop(); } catch (e) {}

  updateStatus('WAKING UP...', 'listening');
  voiceHud.classList.remove('hidden');
  voiceTranscript.innerText = "Listening...";

  beepOn.volume = 0.3;
  beepOn.play().catch(() => {});

  speak("Comrade, wake up.", () => {
    voiceTranscript.innerText = "Speak command...";
    updateStatus('LISTENING COMMAND...', 'listening');
    startListeningLoop();
  });

  if (window.activationTimeout) clearTimeout(window.activationTimeout);
  window.activationTimeout = setTimeout(() => {
    if (state.isActivated && voiceTranscript.innerText === "Speak command...") {
      deactivateVoiceHUD();
    }
  }, 8000);
}

// Deactivate voice overlay
function deactivateVoiceHUD() {
  state.isActivated = false;
  voiceHud.classList.add('hidden');

  beepOff.volume = 0.2;
  beepOff.play().catch(() => {});

  if (isSpeaking) {
    updateStatus('SPEAKING...', 'speaking');
  } else {
    updateStatus('JARVIS STANDBY (SAY "JARVIS")', 'online');
    startListeningLoop();
  }
}

// Status Updates (HUD + 3D Orb)
function updateStatus(text, mode) {
  statusText.innerText = text;
  statusDot.className = 'status-dot';

  if (mode === 'listening') {
    statusDot.classList.add('listening');
    updateOrbState('listening');
  } else if (mode === 'speaking') {
    statusDot.classList.add('speaking');
    updateOrbState('speaking');
  } else if (text === 'THINKING...') {
    statusDot.classList.add('pulsed');
    updateOrbState('thinking');
  } else {
    statusDot.classList.add('pulsed');
    updateOrbState('idle');
  }
}

// Route command actions
async function handleUserCommand(command) {
  if (!command.trim()) return;

  const cleanCmd = command.trim().toLowerCase();
  
  // Strict shutdown gate: matches "jarvis, shut down" and "jarvis, shut down."
  if (
    cleanCmd === 'jarvis, shut down.' || 
    cleanCmd === 'jarvis, shut down'
  ) {
    addChatMessage('You', command, 'user');
    addChatMessage('System CLI', 'SYSTEM SHUTDOWN INITIATED. CEASING OPERATIONS.', 'system');
    
    // Stop continuous listening loop
    state.continuousListening = false;
    if (recognition) {
      try { recognition.abort(); } catch (e) {}
    }
    
    speak("Shutdown sequence initiated. Core deactivated. Goodbye.", () => {
      // Send shutdown signal to backend Express process
      fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'jarvis, shut down.' })
      }).catch(() => {});
      
      updateStatus('SYSTEM OFFLINE', 'error');
      updateOrbState('idle');
      document.body.style.opacity = '0.3';
      document.body.style.pointerEvents = 'none';
      orbSubtext.innerText = "OFFLINE - RESTART LOCAL SERVER TO BOOT";
    });
    return;
  }

  // Voice standby shutdown: matches "shut down" and "shut down."
  if (
    cleanCmd === 'shut down.' || 
    cleanCmd === 'shut down'
  ) {
    addChatMessage('You', command, 'user');
    addChatMessage('System', 'Standby shutdown initiated. Jarvis is now inactive.', 'system');
    
    speak("Shutdown sequence initiated. Going offline.", () => {
      deactivateVoiceHUD();
    });
    return;
  }

  // Refresh conversational inactivity deactivation timer (15 seconds of silence)
  if (window.activationTimeout) clearTimeout(window.activationTimeout);
  window.activationTimeout = setTimeout(() => {
    if (state.isActivated) {
      addChatMessage('System', 'Deactivating active session due to inactivity. Returning to standby.', 'system');
      speak("Standby.");
      deactivateVoiceHUD();
    }
  }, 15000);

  addChatMessage('You', command, 'user');
  commandInput.value = '';

  updateStatus('THINKING...', 'online');

  try {
    // 1. Post to secure backend Express API
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

    // 2. Query Gemini Core Chat Proxy
    const answer = await queryWorldKnowledge(command);
    addChatMessage('Jarvis', answer, 'ai');
    speak(answer);
  } catch (err) {
    console.warn('[Jarvis Backend] Local server errored, executing local answers.');
    const answer = await queryWorldKnowledge(command);
    addChatMessage('Jarvis', answer, 'ai');
    speak(answer);
  }
}

// Secure World Knowledge
async function queryWorldKnowledge(query) {
  const lower = query.toLowerCase().trim();

  // Quick Offline Local Matches
  if (lower === 'hello' || lower === 'hi' || lower === 'hey') {
    return "Hello. I am Jarvis, your digital system administrator. I am fully operational.";
  }
  if (lower === 'who are you' || lower === 'what is your name') {
    return "I am Jarvis, your systems controller and voice assistant. Ready for your instructions.";
  }

  // 1. Request Secure Backend API
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
    console.warn('[Jarvis Core] Backend chat offline, using client fallback:', err);
  }

  // 2. Client fallback key
  if (state.geminiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are Jarvis, a premium, hyper-intelligent system assistant. Provide a brief, concise, and helpful spoken-style answer (maximum 2-3 sentences) suitable for text-to-speech reading for: "${query}"`
            }]
          }]
        })
      });
      const data = await response.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        return data.candidates[0].content.parts[0].text;
      }
    } catch (e) {
      return "I encountered a minor glitch connecting to my neural network, but I am still online. Please check your Gemini API key in settings.";
    }
  }

  return `To query world knowledge, please input your Gemini API Key in the settings panel (gear icon) or configure a .env file. Otherwise, ask me to open applications or search the web! For example, say "search for ${query}" to search Google.`;
}

// Speak Utterance Engine
function speak(text, onEndCallback = null) {
  if (!state.speakReplies || !synthesis) {
    if (onEndCallback) onEndCallback();
    return;
  }

  synthesis.cancel();
  isSpeaking = true;

  if (isRecognitionRunning) {
    try { recognition.stop(); } catch(e) {}
  }

  const clean = text.replace(/[*#_`[\]]/g, '').trim();
  const utterance = new SpeechSynthesisUtterance(clean);

  if (state.selectedVoiceName) {
    const v = state.voices.find(voice => voice.name === state.selectedVoiceName);
    if (v) utterance.voice = v;
  }
  utterance.rate = state.speechRate;

  utterance.onstart = () => {
    updateStatus('SPEAKING...', 'speaking');
  };

  const handleEnded = () => {
    isSpeaking = false;
    if (onEndCallback) {
      onEndCallback();
    } else {
      if (state.isActivated) {
        updateStatus('LISTENING COMMAND...', 'listening');
      } else {
        updateStatus('JARVIS STANDBY (SAY "JARVIS")', 'online');
      }
      if (state.continuousListening) {
        startListeningLoop();
      }
    }
  };

  utterance.onend = handleEnded;
  utterance.onerror = (e) => {
    console.warn('[Jarvis Speech] TTS Output Error:', e);
    handleEnded();
  };

  synthesis.speak(utterance);
}

// UI Chat Logs
function addChatMessage(sender, text, type) {
  const msg = document.createElement('div');
  msg.className = `chat-msg ${type}-msg`;

  let avatar = '<i class="fa-solid fa-microchip"></i>';
  let meta = 'JARVIS // AI';

  if (type === 'user') {
    avatar = '<i class="fa-solid fa-user"></i>';
    meta = 'USER // VOICE';
  } else if (type === 'system') {
    avatar = '<i class="fa-solid fa-terminal"></i>';
    meta = 'JARVIS // OS_SYSTEM';
  }

  msg.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-content">
      <div class="msg-meta">${meta}</div>
      <p>${text}</p>
    </div>
  `;

  chatLogs.appendChild(msg);
  chatLogs.scrollTop = chatLogs.scrollHeight;

  // Sync to Dock Mode response bubble if sender is Jarvis or System
  if (type === 'ai' || type === 'system') {
    const dockTextEl = document.getElementById('dock-reply-text');
    const dockContainerEl = document.getElementById('dock-reply-container');
    if (dockTextEl && dockContainerEl) {
      dockTextEl.innerText = text;
      if (document.body.classList.contains('dock-mode')) {
        dockContainerEl.classList.remove('hidden');
      }
    }
  }
}

// Available speech synthesis voice list
function populateVoices() {
  if (!synthesis) return;
  state.voices = synthesis.getVoices();
  voiceSelect.innerHTML = '<option value="">Default OS Voice</option>';
  
  state.voices.forEach(voice => {
    const opt = document.createElement('option');
    opt.value = voice.name;
    opt.textContent = `${voice.name} (${voice.lang})`;
    if (voice.name === state.selectedVoiceName) {
      opt.selected = true;
    }
    voiceSelect.appendChild(opt);
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

// Event bindings
function setupUIEvents() {
  const dockToggleBtn = document.getElementById('dock-toggle-btn');
  const dockToggleIcon = document.getElementById('dock-toggle-icon');
  const dockReplyContainer = document.getElementById('dock-reply-container');

  // Load persistent Dock Mode
  const isDock = localStorage.getItem('jarvis_dock_mode') === 'true';
  if (isDock) {
    document.body.classList.add('dock-mode');
    if (dockToggleIcon) {
      dockToggleIcon.className = 'fa-solid fa-expand';
    }
    if (dockReplyContainer) {
      dockReplyContainer.classList.remove('hidden');
    }
  }

  if (dockToggleBtn) {
    dockToggleBtn.addEventListener('click', () => {
      const active = document.body.classList.toggle('dock-mode');
      localStorage.setItem('jarvis_dock_mode', active);
      
      if (dockToggleIcon) {
        dockToggleIcon.className = active ? 'fa-solid fa-expand' : 'fa-solid fa-compress';
      }
      
      if (dockReplyContainer) {
        if (active) {
          dockReplyContainer.classList.remove('hidden');
        } else {
          dockReplyContainer.classList.add('hidden');
        }
      }
    });
  }

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

  orbContainer.addEventListener('click', () => {
    triggerActivation();
  });

  settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  saveSettingsBtn.addEventListener('click', () => {
    state.geminiKey = geminiKeyInput.value.trim();
    state.selectedVoiceName = voiceSelect.value;
    state.speechRate = parseFloat(voiceRateSlider.value);
    state.speakReplies = voiceFeedbackCheckbox.checked;

    localStorage.setItem('jarvis_gemini_key', state.geminiKey);
    localStorage.setItem('jarvis_voice_name', state.selectedVoiceName);
    localStorage.setItem('jarvis_speech_rate', state.speechRate);
    localStorage.setItem('jarvis_speak_replies', state.speakReplies);

    settingsPanel.classList.add('hidden');
    addChatMessage('System', 'Settings updated. Brain core recalibrated.', 'system');
    speak("Settings updated. Brain core recalibrated.");
  });

  voiceRateSlider.addEventListener('input', (e) => {
    rateValue.innerText = e.target.value + 'x';
  });

  voiceLockBtn.addEventListener('click', () => {
    state.continuousListening = !state.continuousListening;
    updateContinuousButtonUI();
    
    if (state.continuousListening) {
      initRecognition();
      addChatMessage('System', 'Continuous voice detection active.', 'system');
      speak("Continuous voice detection active.");
    } else {
      if (recognition) {
        try { recognition.abort(); } catch(e) {}
      }
      addChatMessage('System', 'Continuous voice detection deactivated.', 'system');
      speak("Continuous voice detection deactivated.");
    }
  });

  micTrigger.addEventListener('click', () => {
    triggerActivation();
  });

  setInterval(() => {
    const d = new Date();
    const timeEl = document.getElementById('nova-time');
    const dateEl = document.getElementById('nova-date');
    if (timeEl) {
      timeEl.innerText = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (dateEl) {
      dateEl.innerText = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  }, 1000);

  // Weather Telemetry Service
  const updateWeather = async () => {
    const tempEl = document.getElementById('weather-temp');
    const condEl = document.getElementById('weather-cond');
    const iconEl = document.getElementById('weather-icon');
    const triggerEl = document.getElementById('weather-trigger');
    if (!tempEl || !condEl || !iconEl) return;

    try {
      const locRes = await fetch('https://ipapi.co/json/').then(r => r.json());
      if (locRes && locRes.latitude && locRes.longitude) {
        const lat = locRes.latitude;
        const lon = locRes.longitude;
        const city = locRes.city || 'Local';
        
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`).then(r => r.json());
        if (weatherRes && weatherRes.current_weather) {
          const tempC = weatherRes.current_weather.temperature;
          const tempF = Math.round((tempC * 9/5) + 32);
          const code = weatherRes.current_weather.weathercode;
          
          let condText = 'Sunny';
          let iconClass = 'fa-solid fa-sun';
          
          if (code === 0) { condText = 'Clear'; iconClass = 'fa-solid fa-sun'; }
          else if (code >= 1 && code <= 3) { condText = 'Partly Cloudy'; iconClass = 'fa-solid fa-cloud-sun'; }
          else if (code >= 45 && code <= 48) { condText = 'Foggy'; iconClass = 'fa-solid fa-smog'; }
          else if (code >= 51 && code <= 67) { condText = 'Rainy'; iconClass = 'fa-solid fa-cloud-showers-heavy'; }
          else if (code >= 71 && code <= 77) { condText = 'Snowy'; iconClass = 'fa-solid fa-snowflake'; }
          else if (code >= 80 && code <= 82) { condText = 'Rain Showers'; iconClass = 'fa-solid fa-cloud-rain'; }
          else if (code >= 95 && code <= 99) { condText = 'Thunderstorm'; iconClass = 'fa-solid fa-cloud-bolt'; }

          tempEl.innerText = `${tempF}°F`;
          condEl.innerText = condText;
          iconEl.className = iconClass;
          if (triggerEl) {
            triggerEl.title = `Telemetry: ${city} (${lat.toFixed(2)}, ${lon.toFixed(2)}) - Click to Refresh`;
          }
          return;
        }
      }
    } catch (e) {
      console.warn('[Jarvis Weather] Real weather query failed, falling back to simulated telemetry:', e);
    }

    // Fallback/Simulated Weather Telemetry
    const simulatedTemp = 68 + Math.round(Math.sin(Date.now() / 600000) * 4);
    tempEl.innerText = `${simulatedTemp}°F`;
    condEl.innerText = 'Optimal';
    iconEl.className = 'fa-solid fa-cloud-sun';
    if (triggerEl) {
      triggerEl.title = 'Jarvis Local Telemetry (Simulated) - Click to Refresh';
    }
  };

  // Run weather update immediately and set 10-minute interval
  updateWeather();
  setInterval(updateWeather, 600000);

  // Weather Click to Manual Refresh
  const triggerEl = document.getElementById('weather-trigger');
  if (triggerEl) {
    triggerEl.addEventListener('click', () => {
      addChatMessage('System', 'Refreshing weather and system telemetry...', 'system');
      updateWeather();
    });
  }
}

window.executeHint = function(command) {
  handleUserCommand(command);
};

// --- INITIALIZE ON CONTENT LOAD ---
window.addEventListener('DOMContentLoaded', () => {
  geminiKeyInput.value = state.geminiKey;
  voiceFeedbackCheckbox.checked = localStorage.getItem('jarvis_speak_replies') !== 'false';
  voiceRateSlider.value = state.speechRate;
  rateValue.innerText = state.speechRate + 'x';

  setupUIEvents();
  updateContinuousButtonUI();
  
  populateVoices();
  if (synthesis && synthesis.onvoiceschanged !== undefined) {
    synthesis.onvoiceschanged = populateVoices;
  }

  // Load 3D WebGL Orb
  init3DOrb();

  document.body.addEventListener('click', unlockAudio);
  initRecognition();
  
  setTimeout(() => {
    addChatMessage('System', 'Welcome. Click anywhere on the screen to boot Jarvis\'s voice core.', 'system');
  }, 500);
});
