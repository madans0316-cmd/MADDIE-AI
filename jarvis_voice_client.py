import os
import sys
import time
import subprocess
import json

# Auto-install dependencies if missing
try:
    import speech_recognition as sr
    import pyttsx3
    import requests
except ImportError:
    print("[Jarvis Client] Missing dependencies. Installing SpeechRecognition, pyttsx3, requests...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "SpeechRecognition", "pyttsx3", "requests"])
    import speech_recognition as sr
    import pyttsx3
    import requests

# Express Server Endpoint
BACKEND_URL = "http://localhost:3000/api/command"

# Initialize Offline TTS Engine (Uses native Windows SAPI5)
try:
    engine = pyttsx3.init('sapi5')
except Exception:
    engine = pyttsx3.init() # Fallback

voices = engine.getProperty('voices')
# Prefer a male/female voice if available
for voice in voices:
    if "david" in voice.name.lower() or "zira" in voice.name.lower():
        engine.setProperty('voice', voice.id)
        break

engine.setProperty('rate', 175) # Conversational speaking speed

def speak(text):
    print(f"[Jarvis]: {text}")
    engine.say(text)
    engine.runAndWait()

def listen_for_command(recognizer, source, is_wake_word_mode=True):
    if is_wake_word_mode:
        print("[Jarvis Client] Listening for wake word: 'Jarvis' or 'Hey Jarvis'...")
    else:
        print("[Jarvis Client] Listening for command...")
        
    try:
        audio = recognizer.listen(source, timeout=8, phrase_time_limit=5)
        transcript = recognizer.recognize_google(audio).lower().strip()
        print(f"[Heard]: \"{transcript}\"")
        return transcript
    except sr.WaitTimeoutError:
        return ""
    except sr.UnknownValueError:
        return ""
    except Exception as e:
        print(f"[Error]: {e}")
        return ""

def handle_system_command(command):
    # Send command to local Express backend
    try:
        response = requests.post(BACKEND_URL, json={"command": command}, timeout=5)
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                speak(result.get("message"))
                return True
    except Exception as e:
        print(f"[Jarvis Client] Express server offline. Executing command locally. {e}")
        
    # Local fallback command handler if the Node.js server is stopped
    clean_cmd = command.lower().strip()
    if clean_cmd.startswith("open ") or clean_cmd.startswith("launch "):
        target = clean_cmd.replace("open ", "").replace("launch ", "").strip()
        # Safe character validation to prevent script execution injection
        if not all(c.isalnum() or c.isspace() or c in "-_" for c in target):
            speak("I cannot execute commands containing special characters.")
            return False
            
        os.system(f'start "" "{target}"')
        speak(f"Opening {target} on your laptop.")
        return True
            
    elif clean_cmd.startswith("close ") or clean_cmd.startswith("exit "):
        target = clean_cmd.replace("close ", "").replace("exit ", "").strip()
        if not all(c.isalnum() or c.isspace() or c in "-_" for c in target):
            speak("I cannot execute close commands containing special characters.")
            return False
            
        procName = target if target.endswith(".exe") else f"{target}.exe"
        os.system(f"taskkill /IM {procName} /F")
        speak(f"Closed {target}.")
        return True
            
    return False

def main():
    recognizer = sr.Recognizer()
    microphone = sr.Microphone()
    
    # Calibrate ambient noise
    with microphone as source:
        print("[Jarvis Client] Calibrating microphone for ambient noise...")
        recognizer.adjust_for_ambient_noise(source, duration=1)
        
    speak("Jarvis Python Voice Assistant Client is running. Say Jarvis to activate.")

    while True:
        with microphone as source:
            wake_phrase = listen_for_command(recognizer, source, is_wake_word_mode=True)
            
            # Check wake word (including phonetic matches)
            if any(w in wake_phrase for w in ["jarvis", "hey jarvis", "travis", "charvis", "job is", "service", "wake up"]):
                speak("Yes, I am awake. What is your command?")
                
                # Capture the command
                command_phrase = listen_for_command(recognizer, source, is_wake_word_mode=False)
                
                if command_phrase:
                    # Strict shutdown gating logic
                    if command_phrase in ["jarvis, shut down.", "jarvis, shut down", "jarvis shut down", "shut down"]:
                        speak("Shutdown sequence initiated. Core deactivated. Goodbye.")
                        sys.exit(0)

                    success = handle_system_command(command_phrase)
                    if not success:
                        # Pass to general search
                        search_url = f"https://www.google.com/search?q={command_phrase.replace(' ', '+')}"
                        speak(f"Searching Google for: {command_phrase}")
                        os.system(f"start {search_url}")
                else:
                    speak("I didn't hear a command. Returning to standby.")
                    
        time.sleep(0.5)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nExiting Jarvis Voice Client...")
