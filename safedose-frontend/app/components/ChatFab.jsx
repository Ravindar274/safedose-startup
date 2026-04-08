// components/ChatFab.jsx
'use client';

/**
 * SafeDose AI Chat Assistant
 *
 * Adapted from the school ChatFab — key differences:
 *   - No Firebase: JWT lives in httpOnly cookie, sent automatically by browser
 *   - Calls safedose-chat-service at NEXT_PUBLIC_CHAT_API_URL
 *   - Role-aware quick prompts: admin / caregiver / patient
 *   - SafeDose-specific greeting and messaging
 *
 * Window states:
 *   closed     → FAB button only
 *   normal     → standard panel (360px wide, ~580px tall)
 *   minimized  → header strip only
 *   maximized  → large panel (620px wide, 80vh tall)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import './ChatFab.css';

const CHAT_API_URL = `${process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:5002'}/api/chat`;

// ── Chat modes ────────────────────────────────────────────────────────────
// 'mydata' — answers from personal records only (fast)
// 'fda'    — AI identifies drug names → FDA database lookup (thorough)
const CHAT_MODES = [
    {
        id: 'mydata',
        label: 'My Records',
        icon: '📋',
        hint: 'Answers from your personal health records',
    },
    {
        id: 'fda',
        label: 'Drug Reference',
        icon: '🔬',
        hint: 'Looks up official FDA drug data — may take a moment',
    },
];

const ROLE_GREETINGS = {
    admin: 'You have full access to all SafeDose data.',
    caregiver: 'You can ask about your patients and their medications.',
    patient: 'You can ask about your medications, schedule, and interactions.',
};

const ROLE_LABELS = {
    admin: 'Admin',
    caregiver: 'Caregiver',
    patient: 'Patient',
};

const GOOGLE_VOICES = [
  { id: 'Br', label: 'Browser' },
  { id: 'UC', label: 'US Female',         apiName: 'en-US-Standard-C' },
  { id: 'UE', label: 'US Female 2',       apiName: 'en-US-Standard-E' },
  { id: 'UK', label: 'British Female',    apiName: 'en-GB-Standard-A' },
  { id: 'AU', label: 'Australian Female', apiName: 'en-AU-Standard-A' },
];

// ── Icons ─────────────────────────────────────────────────────────────────
const MicIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
);

const StopIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
);

const SendIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const MinimizeIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
        <line x1="5" y1="19" x2="19" y2="19" />
    </svg>
);

const RestoreIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="7" width="14" height="14" rx="1.5" />
        <path d="M7 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" />
    </svg>
);

const MaximizeIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <line x1="21" y1="3" x2="14" y2="10" />
        <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
);

const VolumeOffIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
    </svg>
);

const VolumeLowIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a2 2 0 0 1 0 2.88" />
    </svg>
);

const VolumeMidIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
);

const VolumeHighIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a7 7 0 0 1 0 9.9" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
);

// ── Greeting builder ──────────────────────────────────────────────────────
function buildGreeting(firstName, role) {
    const hint = ROLE_GREETINGS[role] || '';
    const label = role ? ` (${ROLE_LABELS[role]})` : '';
    return `Hi${firstName ? ` ${firstName}` : ''}${label}! I'm SafeDose AI, your medication safety assistant. ${hint} How can I help?`;
}

// ─────────────────────────────────────────────────────────────────────────
export default function ChatFab() {
    // Read user from AuthContext — populated once on mount from /api/auth/me
    const { user } = useAuth();
    const firstName = user?.firstName || '';
    const role = user?.role || '';

    // ── State ──────────────────────────────────────────────────────────────
    const [mode, setMode] = useState('mydata'); // 'mydata' | 'fda'
    const [isOpen, setIsOpen] = useState(false);
    const [windowSize, setWindowSize] = useState('normal'); // normal | minimized | maximized
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [voiceError, setVoiceError] = useState('');
    const [volume, setVolume] = useState(1);
    const [playingMessageId,    setPlayingMessageId]    = useState(null);
    const [processingMessageId, setProcessingMessageId] = useState(null);

    const [messages, setMessages] = useState([
        { id: 1, sender: 'bot', text: 'Hi! I\'m SafeDose AI, your medication safety assistant. How can I help?' },
    ]);

    // ── Refs ───────────────────────────────────────────────────────────────
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const recognitionRef = useRef(null);
    const abortControllerRef = useRef(null);
    const greetingUpdated = useRef(false);
    const audioRef = useRef(null);
    const currentSpeakIdRef = useRef(0);

    // Update greeting once role is known
    useEffect(() => {
        if (role && !greetingUpdated.current) {
            greetingUpdated.current = true;
            setMessages([{ id: 1, sender: 'bot', text: buildGreeting(firstName, role) }]);
        }
    }, [role, firstName]);

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // ── Window controls ────────────────────────────────────────────────────
    const openChat = () => {
        setIsOpen(true);
        setWindowSize('normal');
        setTimeout(() => textareaRef.current?.focus(), 200);
    };

    const closeChat = () => {
        setIsOpen(false);
        setWindowSize('normal');
    };

    const handleMinimize = (e) => {
        e.stopPropagation();
        setWindowSize(prev => prev === 'minimized' ? 'normal' : 'minimized');
    };

    const handleMaximize = (e) => {
        e.stopPropagation();
        setWindowSize(prev => {
            const next = prev === 'maximized' ? 'normal' : 'maximized';
            if (next !== 'minimized') setTimeout(() => textareaRef.current?.focus(), 50);
            return next;
        });
    };

    const isMinimized = windowSize === 'minimized';
    const isMaximized = windowSize === 'maximized';

    // ── Text-to-Speech ─────────────────────────────────────────────────────
    const stopSpeaking = useCallback(() => {
        currentSpeakIdRef.current++;   // cancel any in-flight fetch/play loop
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        window.speechSynthesis?.cancel();
        setPlayingMessageId(null);
        setProcessingMessageId(null);
    }, []);

    const speakMessage = useCallback(async (text, msgId) => {
        if (volume === 0 || !text) return;

        // stop any current audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        window.speechSynthesis?.cancel();

        const speakId = ++currentSpeakIdRef.current;

        if (!window.speechSynthesis) return;

        window.speechSynthesis.cancel();
        setProcessingMessageId(msgId);
        setPlayingMessageId(null);

        // Small delay so voices list is loaded on first use
        const doSpeak = () => {
            if (currentSpeakIdRef.current !== speakId) return;

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.volume = volume;
            utterance.rate   = 0.95;
            utterance.lang   = 'en-US';

            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                const preferred = voices.find(v =>
                    v.lang.startsWith('en') && (
                        v.name.toLowerCase().includes('female') ||
                        v.name.toLowerCase().includes('samantha') ||
                        v.name.toLowerCase().includes('victoria') ||
                        v.name.toLowerCase().includes('karen') ||
                        v.name.toLowerCase().includes('moira')
                    )
                ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
                utterance.voice = preferred;
            }

            utterance.onstart = () => {
                if (currentSpeakIdRef.current !== speakId) { window.speechSynthesis.cancel(); return; }
                setProcessingMessageId(null);
                setPlayingMessageId(msgId);
            };
            utterance.onend   = () => { setPlayingMessageId(null); setProcessingMessageId(null); };
            utterance.onerror = () => { setPlayingMessageId(null); setProcessingMessageId(null); };

            window.speechSynthesis.speak(utterance);
        };

        // getVoices() is async on first load in some browsers
        if (window.speechSynthesis.getVoices().length > 0) {
            doSpeak();
        } else {
            window.speechSynthesis.onvoiceschanged = () => {
                window.speechSynthesis.onvoiceschanged = null;
                doSpeak();
            };
            // Fallback if onvoiceschanged never fires
            setTimeout(() => {
                if (currentSpeakIdRef.current === speakId && processingMessageId === msgId) doSpeak();
            }, 300);
        }
    }, [volume]);



    const cycleVolume = useCallback(() => {
        const levels = [0, 0.33, 0.66, 1.0];
        const idx = levels.findIndex(v => Math.abs(v - volume) < 0.01);
        setVolume(levels[(idx + 1) % levels.length]);
        if (playingMessageId !== null) stopSpeaking();
    }, [volume, playingMessageId, stopSpeaking]);

    const getVolumeIcon = () => {
        if (volume === 0) return <VolumeOffIcon />;
        if (volume <= 0.33) return <VolumeLowIcon />;
        if (volume <= 0.66) return <VolumeMidIcon />;
        return <VolumeHighIcon />;
    };

    // ── Send message ───────────────────────────────────────────────────────
    const handleSend = useCallback(async (presetText, isVoice = false) => {
        const text = (presetText || input).trim();
        if (!text || loading) return;

        stopSpeaking();
        setVoiceError('');
        setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text, isVoice }]);
        setInput('');
        setLoading(true);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            // Cookie is sent automatically by the browser — no token management needed
            const res = await fetch(CHAT_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // ← sends the httpOnly JWT cookie
                body: JSON.stringify({ message: text, mode }),
                signal: abortController.signal,
            });


            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Server error ${res.status}`);
            }

            const { reply } = await res.json();
            const msgId = Date.now() + 1;
            setMessages(prev => [...prev, { id: msgId, sender: 'bot', text: reply }]);
            speakMessage(reply, msgId);

        } catch (error) {
            if (error.name === 'AbortError') {
                setMessages(prev => [...prev, { id: Date.now() + 2, sender: 'bot', text: 'Response stopped.' }]);
            } else {
                let msg = 'Sorry, I couldn\'t reach the server. Please try again.';
                if (error.message?.includes('Authentication')) msg = 'Your session has expired. Please log in again.';
                if (error.message?.includes('Unauthorized')) msg = 'Your session has expired. Please log in again.';
                setMessages(prev => [...prev, { id: Date.now() + 2, sender: 'bot', text: msg }]);
                console.error('[ChatFab]', error);
            }
        } finally {
            setLoading(false);
            abortControllerRef.current = null;
        }
    }, [input, loading, mode, speakMessage, stopSpeaking]);

    // ── Stop response ──────────────────────────────────────────────────────
    const handleStopResponse = useCallback(() => {
        abortControllerRef.current?.abort();
    }, []);

    // ── Speech-to-Text ─────────────────────────────────────────────────────
    const toggleRecording = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setVoiceError('Speech recognition isn\'t supported in this browser. Try Chrome or Edge.');
            return;
        }

        if (isRecording) {
            recognitionRef.current?.stop();
            setIsRecording(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        let finalTranscript = '';

        recognition.onstart = () => { setIsRecording(true); setVoiceError(''); finalTranscript = ''; };
        recognition.onresult = (e) => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0].transcript;
                if (e.results[i].isFinal) finalTranscript += t; else interim += t;
            }
            setInput(finalTranscript + interim);
        };
        recognition.onend = () => {
            setIsRecording(false);
            if (finalTranscript.trim()) { handleSend(finalTranscript.trim(), true); setInput(''); }
        };
        recognition.onerror = (e) => {
            setIsRecording(false);
            if (e.error !== 'no-speech' && e.error !== 'aborted')
                setVoiceError(`Mic error: ${e.error}. Check browser permissions.`);
        };

        recognition.start();
    }, [isRecording, handleSend]);

    // ── Keyboard shortcut: Enter to send ──────────────────────────────────
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    // ── Window CSS class ───────────────────────────────────────────────────
    const windowClass = [
        'chat-window',
        isMinimized ? 'chat-window--minimized' : '',
        isMaximized ? 'chat-window--maximized' : '',
    ].filter(Boolean).join(' ');

    // ─────────────────────────────────────────────────────────────────────
    return (
        <>
            {/* ── FAB Button ── */}
            <button
                className="chat-fab"
                title="SafeDose AI Assistant"
                onClick={isOpen ? closeChat : openChat}
            >
                💊
            </button>

            {!isOpen && <div className="chat-fab-tooltip">SafeDose AI Assistant</div>}

            {isOpen && (
                <div className={windowClass}>

                    {/* ── Header ── */}
                    <div className="chat-header" onClick={isMinimized ? handleMinimize : undefined}
                        style={isMinimized ? { cursor: 'pointer' } : {}}>
                        <div className="chat-header-info">
                            <h3>SafeDose AI</h3>
                            <p>{role ? `Signed in as ${ROLE_LABELS[role] || role}` : 'Medication safety assistant'}</p>
                        </div>
                        <div className="chat-header-actions">
                            {/* Minimize / Restore */}
                            <button className="chat-ctrl-btn" onClick={handleMinimize}
                                title={isMinimized ? 'Restore' : 'Minimise'}>
                                {isMinimized ? <RestoreIcon /> : <MinimizeIcon />}
                            </button>

                            {/* Maximize / Restore — hidden when minimized */}
                            {!isMinimized && (
                                <button className="chat-ctrl-btn" onClick={handleMaximize}
                                    title={isMaximized ? 'Restore size' : 'Maximise'}>
                                    {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
                                </button>
                            )}

                            {/* Close */}
                            <button className="chat-ctrl-btn chat-ctrl-btn--close" onClick={closeChat} title="Close">
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* ── Body — hidden when minimized ── */}
                    {!isMinimized && (
                        <>
                            {/* Messages */}
                            <div className="chat-body">
                                {messages.map(msg => (
                                    <div key={msg.id}
                                        className={`chat-message ${msg.sender === 'user' ? 'chat-message--user' : 'chat-message--bot'}`}>
                                        {msg.isVoice && <span className="chat-voice-badge">🎙 Voice</span>}
                                        {msg.text}
                                        {msg.sender === 'bot' && (
                                            <div className="chat-message-actions">
                                                {processingMessageId === msg.id ? (
                                                    <button onClick={stopSpeaking} className="chat-listen-btn chat-listen-btn--processing" title="Cancel">
                                                        <span className="chat-listen-spinner" /> Processing…
                                                    </button>
                                                ) : playingMessageId === msg.id ? (
                                                    <button onClick={stopSpeaking} className="chat-listen-btn chat-listen-btn--playing" title="Stop audio">
                                                        <StopIcon /> Stop
                                                    </button>
                                                ) : (
                                                    <button onClick={() => speakMessage(msg.text, msg.id)} className="chat-listen-btn" title="Listen">
                                                        <VolumeLowIcon /> Listen
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {loading && (
                                    <div className="chat-message chat-message--bot chat-typing">
                                        <span /><span /><span />
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>

                            {/* Mode selector */}
                            <div className="chat-mode-selector">
                                <span className="chat-mode-label">Source:</span>
                                {CHAT_MODES.map(m => (
                                    <button
                                        key={m.id}
                                        className={`chat-mode-btn chat-mode-btn--${m.id}${mode === m.id ? ' chat-mode-btn--active' : ''}`}
                                        onClick={() => setMode(m.id)}
                                        title={m.hint}
                                        disabled={loading}
                                    >
                                        {m.icon} {m.label}
                                    </button>
                                ))}
                            </div>

                            {/* Recording banner */}
                            {isRecording && (
                                <div className="chat-recording-banner">
                                    <div className="chat-recording-wave">
                                        <span /><span /><span /><span /><span />
                                    </div>
                                    Listening… speak your question
                                    <button onClick={toggleRecording}>Stop</button>
                                </div>
                            )}

                            {voiceError && <div className="chat-voice-error">⚠ {voiceError}</div>}

                            {/* Input area */}
                            <div className="chat-input-area">
                                <textarea
                                    ref={textareaRef}
                                    placeholder={isRecording ? 'Listening…' : 'Ask about your medications…'}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    rows={2}
                                    disabled={loading}
                                />

                                {/* Volume cycle */}
                                <button className="chat-icon-btn" onClick={cycleVolume}
                                    title="Click to change volume (Off → Low → Medium → High)">
                                    {getVolumeIcon()}
                                </button>

                                {/* Mic */}
                                <button
                                    className={`chat-icon-btn chat-mic-btn${isRecording ? ' chat-mic-btn--active' : ''}`}
                                    onClick={toggleRecording}
                                    title={isRecording ? 'Stop recording' : 'Speak your question'}
                                    disabled={loading}
                                >
                                    {isRecording ? <StopIcon /> : <MicIcon />}
                                </button>

                                {/* Send / Stop */}
                                {loading ? (
                                    <button className="chat-icon-btn chat-stop-btn" onClick={handleStopResponse} title="Stop response">
                                        <StopIcon />
                                    </button>
                                ) : (
                                    <button className="chat-icon-btn chat-send-btn"
                                        onClick={() => handleSend()}
                                        disabled={!input.trim()}
                                        title="Send">
                                        <SendIcon />
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    );
}
