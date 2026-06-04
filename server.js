const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load .env variables into process.env on startup
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          const val = trimmed.substring(index + 1).trim();
          process.env[key] = val;
        }
      }
    });
    console.log('[Maddy Backend] Environment variables successfully loaded from .env');
  } catch (e) {
    console.error('[Maddy Backend] Error parsing .env file:', e);
  }
}

// Secure HTTPS query wrapper for Gemini API
function queryGeminiSecurely(query, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      contents: [{
        parts: [{
          text: `You are Maddy, a premium, hyper-intelligent Jarvis-like voice assistant. Provide a brief, concise, and helpful spoken-style answer (maximum 2-3 sentences) suitable for text-to-speech reading for this query: "${query}"`
        }]
      }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.candidates && parsed.candidates[0].content.parts[0].text) {
            resolve(parsed.candidates[0].content.parts[0].text);
          } else {
            console.error('[Maddy Backend] Invalid Gemini response:', data);
            reject(new Error('Invalid response structure from Gemini API'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => { reject(e); });
    req.write(payload);
    req.end();
  });
}


// Safe mapping of applications to their Windows executable names
const APP_MAP = {
  'notepad': { exec: 'notepad.exe', proc: 'notepad.exe' },
  'calculator': { exec: 'calc.exe', proc: 'CalculatorApp.exe' },
  'paint': { exec: 'mspaint.exe', proc: 'mspaint.exe' },
  'explorer': { exec: 'explorer.exe', proc: 'explorer.exe' },
  'file explorer': { exec: 'explorer.exe', proc: 'explorer.exe' },
  'task manager': { exec: 'taskmgr.exe', proc: 'taskmgr.exe' },
  'cmd': { exec: 'cmd.exe', proc: 'cmd.exe' },
  'command prompt': { exec: 'cmd.exe', proc: 'cmd.exe' },
  'wordpad': { exec: 'write.exe', proc: 'wordpad.exe' }
};

// Safe domains/URLs mapping for easy voice commands
const SITE_MAP = {
  'google': 'https://www.google.com',
  'youtube': 'https://www.youtube.com',
  'perplexity': 'https://www.perplexity.ai',
  'github': 'https://github.com',
  'gmail': 'https://mail.google.com',
  'chatgpt': 'https://chatgpt.com',
  'wikipedia': 'https://www.wikipedia.org',
  'maps': 'https://maps.google.com'
};

// Helper function to execute Windows CLI safely
function runLocalCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout || stderr);
      }
    });
  });
}

// Helper to preprocess commands for fuzzy matching and clean leading articles
function preprocessTarget(target) {
  let clean = target.toLowerCase().trim();
  
  // Remove leading articles & possessives
  clean = clean.replace(/^(the|a|an|my|our)\s+/, '').trim();
  
  // Fuzzy maps for voice translation errors
  const fuzzyMap = {
    'youtube': ['youtube', 'youtude', 'youtub', 'utube', 'youtupe', 'tube'],
    'google': ['google', 'googel', 'gogle', 'gogal'],
    'notepad': ['notepad', 'notpad', 'notebad', 'noteped', 'notepate', 'note pad'],
    'calculator': ['calculator', 'calulator', 'calcualtor', 'calc'],
    'paint': ['paint', 'pait', 'pent', 'mspaint', 'ms paint'],
    'chrome': ['chrome', 'chrom', 'chrome browser'],
    'explorer': ['explorer', 'explor', 'file explorer', 'fileexplorer'],
    'task manager': ['task manager', 'taskmanager', 'taskmgr'],
    'chatgpt': ['chatgpt', 'chat gpt', 'gpt', 'chatgpt.com']
  };

  for (const [canonical, aliases] of Object.entries(fuzzyMap)) {
    if (aliases.includes(clean) || clean.includes(canonical)) {
      return canonical;
    }
  }
  return clean;
}

// Endpoint to run voice-triggered system tasks (open, close, search)
app.post('/api/command', async (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: 'Command parameter is required' });
  }

  const cleanCmd = command.toLowerCase().trim();
  console.log(`[Maddy Backend] Received command: "${cleanCmd}"`);

  try {
    // 0. EXPLICIT SHUTDOWN COMMAND
    if (
      cleanCmd === 'jarvis, shut down.' || 
      cleanCmd === 'jarvis, shut down' || 
      cleanCmd === 'shut down.' || 
      cleanCmd === 'shut down'
    ) {
      console.log('[Jarvis Backend] SHUTDOWN SIGNALLING RECEIVED. Ceasing operations...');
      setTimeout(() => {
        process.exit(0);
      }, 1000);
      return res.json({ 
        success: true, 
        message: 'Shutdown sequence initiated. Core deactivated. Goodbye.' 
      });
    }

    // 1. OPEN COMMANDS
    if (cleanCmd.startsWith('open ') || cleanCmd.startsWith('launch ')) {
      const rawTarget = cleanCmd.replace(/^(open|launch)\s+/, '').trim();
      const target = preprocessTarget(rawTarget);

      // Check if it matches a whitelisted site name
      if (SITE_MAP[target]) {
        await runLocalCommand(`start ${SITE_MAP[target]}`);
        return res.json({ success: true, message: `Opening ${target} in browser.` });
      }

      // Check if it is a general website (e.g. "open facebook.com")
      if (rawTarget.includes('.') || rawTarget.startsWith('http://') || rawTarget.startsWith('https://')) {
        let url = rawTarget;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        // Basic URL security validation
        if (/^[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+$/.test(url)) {
          await runLocalCommand(`start ${url}`);
          return res.json({ success: true, message: `Opening URL ${url}` });
        } else {
          return res.status(400).json({ error: 'Invalid URL format' });
        }
      }

      // Check if it matches a whitelisted app
      if (APP_MAP[target]) {
        await runLocalCommand(`start ${APP_MAP[target].exec}`);
        return res.json({ success: true, message: `Opening ${target} on your laptop.` });
      }

      // Secure general fallback to launch any application in Windows Path securely
      if (/^[a-zA-Z0-9\s-_]+$/.test(rawTarget)) {
        await runLocalCommand(`start "" "${rawTarget}"`);
        return res.json({ success: true, message: `Opening ${rawTarget} on your laptop.` });
      }

      return res.status(400).json({ 
        error: `I don't have permission to open "${rawTarget}" directly. I can open websites or apps like Notepad, Paint, and Calculator.` 
      });
    }

    // 2. CLOSE COMMANDS
    if (cleanCmd.startsWith('close ') || cleanCmd.startsWith('exit ') || cleanCmd.startsWith('terminate ')) {
      const rawTarget = cleanCmd.replace(/^(close|exit|terminate)\s+/, '').trim();
      const target = preprocessTarget(rawTarget);

      if (APP_MAP[target]) {
        // Run taskkill to force-close the process
        await runLocalCommand(`taskkill /IM ${APP_MAP[target].proc} /F`);
        return res.json({ success: true, message: `Closed ${target}.` });
      }

      // Special check if closing browser tabs (which is complex, but we can close the whole Chrome/Edge if needed, with caution)
      if (target === 'chrome' || target === 'browser') {
        await runLocalCommand(`taskkill /IM chrome.exe /F`);
        return res.json({ success: true, message: 'Closed Chrome browser.' });
      }

      // Secure general taskkill fallback
      if (/^[a-zA-Z0-9\s-_]+$/.test(rawTarget)) {
        const procName = rawTarget.endsWith('.exe') ? rawTarget : `${rawTarget}.exe`;
        await runLocalCommand(`taskkill /IM ${procName} /F`);
        return res.json({ success: true, message: `Closed ${rawTarget}.` });
      }

      return res.status(400).json({ 
        error: `I can only close apps like Notepad, Paint, or Calculator that I opened.` 
      });
    }

    // 3. SEARCH COMMANDS
    if (cleanCmd.startsWith('search for ') || cleanCmd.startsWith('search ')) {
      const query = cleanCmd.replace(/^(search for|search)\s+/, '').trim();
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      await runLocalCommand(`start ${searchUrl}`);
      return res.json({ success: true, message: `Searching Google for "${query}".` });
    }

    // 4. Fallback: Command not recognized for system actions
    return res.json({ 
      success: false, 
      message: 'Command not recognized as system action. Passing to AI model.' 
    });

  } catch (err) {
    console.error(`Error executing system command:`, err);
    return res.status(500).json({ 
      error: `Failed to execute action: ${err.message || 'Unknown error'}` 
    });
  }
});

// Secure chat endpoint proxying queries to Gemini API via server-side key
app.post('/api/chat', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Gemini API Key is not configured on the server. Please check your .env file.' 
    });
  }

  try {
    const answer = await queryGeminiSecurely(query, apiKey);
    res.json({ success: true, response: answer });
  } catch (err) {
    console.error('[Maddy Backend] Gemini Query Failed:', err);
    res.status(500).json({ 
      error: `Failed to query intelligence core: ${err.message || 'Unknown API error'}` 
    });
  }
});

// Serve frontend for all other requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`   MADDY JARVIS AI ASSISTANT RUNNING ON PORT ${PORT}`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
