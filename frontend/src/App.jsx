import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [connectionState, setConnectionState] = useState('Disconnected'); // 'Disconnected' | 'Booting' | 'Connected'
  const [frame, setFrame] = useState(null);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const wsRef = useRef(null);

  // Detect component mounting to prevent SSR mismatch
  useEffect(() => {
    setMounted(true);
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleStartBrowser = async () => {
    setConnectionState('Booting...');
    setError(null);
    setFrame(null);

    // Terminate existing WebSocket connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const response = await fetch('http://localhost:4000/start-browser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned error: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Started successfully:', result);

      // Connect to WebSocket server on port 4000
      connectWebSocket();
    } catch (err) {
      console.error('Error starting browser:', err);
      setError(err.message || 'Failed to start browser orchestrator');
      setConnectionState('Disconnected');
    }
  };

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket('ws://localhost:4000');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connection established');
        setConnectionState('Connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'frame' && message.data) {
            setFrame(`data:image/jpeg;base64,${message.data}`);
          }
        } catch (err) {
          console.error('Failed to parse frame message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket encountered an error:', err);
        setError('WebSocket connection error occurred.');
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setConnectionState('Disconnected');
      };
    } catch (err) {
      console.error('Failed to initialize WebSocket:', err);
      setError('Could not establish WebSocket connection.');
      setConnectionState('Disconnected');
    }
  };

  const handleViewportClick = (e) => {
    if (connectionState !== 'Connected' || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    // Scale to the native 1280x720 viewport
    const x = Math.round((localX / rect.width) * 1280);
    const y = Math.round((localY / rect.height) * 720);

    console.log(`Viewport click captured at: local (${localX.toFixed(1)}, ${localY.toFixed(1)}), scaled to native (${x}, ${y})`);

    const clickEvent = {
      type: 'click',
      x,
      y
    };

    wsRef.current.send(JSON.stringify(clickEvent));
  };

  const handleKeyDown = (e) => {
    if (connectionState !== 'Connected' || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const keysToPrevent = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Space', ' ', 'Tab', 'PageUp', 'PageDown', 'Home', 'End'];
    if (keysToPrevent.includes(e.key)) {
      e.preventDefault();
    }

    const keyEvent = {
      type: 'key',
      key: e.key
    };

    wsRef.current.send(JSON.stringify(keyEvent));
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (connectionState !== 'Connected' || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const scrollEvent = {
      type: 'scroll',
      deltaY: e.deltaY
    };

    wsRef.current.send(JSON.stringify(scrollEvent));
  };

  const handleDisconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionState('Disconnected');
    setFrame(null);
  };

  if (!mounted) return null;


  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Decorative background grid and ambient glows */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg text-white shadow-lg shadow-indigo-500/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              Remote Browser
            </h1>
            <p className="text-xs text-zinc-500">Secure sandboxed browser virtualization</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection Status Badge */}
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              {connectionState === 'Connected' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              {connectionState === 'Booting...' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                connectionState === 'Connected' ? 'bg-emerald-500' :
                connectionState === 'Booting...' ? 'bg-sky-500' : 'bg-rose-500'
              }`} />
            </span>
            <span className="text-xs font-semibold text-zinc-300">
              {connectionState}
            </span>
          </div>

          {connectionState === 'Connected' ? (
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300 transform active:scale-95 bg-gradient-to-r from-rose-600 to-red-600 text-white hover:from-rose-500 hover:to-red-500 shadow-md shadow-rose-600/20 border border-rose-500/20"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleStartBrowser}
              disabled={connectionState === 'Booting...'}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300 transform active:scale-95 ${
                connectionState === 'Booting...'
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-600/20 border border-indigo-500/20'
              }`}
            >
              {connectionState === 'Booting...' ? 'Launching Box...' : 'Start Remote Browser'}
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col gap-6 items-center">
        {/* Error Alert Box */}
        {error && (
          <div className="w-full max-w-[1280px] bg-rose-950/30 border border-rose-800/40 text-rose-300 p-4 rounded-xl flex items-start gap-3 shadow-lg shadow-rose-950/20 animate-in fade-in slide-in-from-top-2 duration-300">
            <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div className="flex-1">
              <h4 className="font-semibold text-sm">Connection Error</h4>
              <p className="text-xs text-rose-400/90 mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Browser Frame */}
        <div className="w-full max-w-[1280px] flex flex-col rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950 shadow-2xl relative">
          
          {/* Simulated Browser Titlebar / URL Bar */}
          <div className="bg-zinc-900 px-4 py-3 flex items-center justify-between border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>

            {/* Back / Forward / Refresh controls */}
            <div className="flex items-center gap-3 text-zinc-500 ml-4 mr-2">
              <button disabled className="hover:text-zinc-300 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button disabled className="hover:text-zinc-300 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
              <button className="text-zinc-400 hover:text-zinc-200 transition-colors" onClick={connectionState === 'Connected' ? handleStartBrowser : undefined}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </div>

            {/* Address Bar */}
            <div className="flex-1 max-w-xl mx-auto flex items-center justify-center gap-2 px-3 py-1 bg-zinc-950/80 border border-zinc-800/80 rounded-lg text-xs text-zinc-400">
              <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span className="font-mono truncate select-all selection:bg-indigo-500/20">
                https://google.com
              </span>
            </div>

            <div className="w-16" /> {/* Balance spacer */}
          </div>

          {/* Centered 1280x720 Viewport */}
          <div className="relative overflow-auto flex justify-center bg-zinc-900/40 p-4">
            <div
              tabIndex="0"
              onKeyDown={handleKeyDown}
              className="w-[1280px] h-[720px] bg-zinc-950 border border-zinc-800/50 rounded-lg overflow-hidden flex items-center justify-center relative shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
            >
              
              {connectionState === 'Connected' && frame ? (
                <img
                  src={frame}
                  alt="Remote Browser Frame"
                  className="w-full h-full object-contain cursor-pointer select-none"
                  onClick={handleViewportClick}
                  onWheel={handleWheel}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 max-w-md z-10">
                  {connectionState === 'Booting...' ? (
                    <div className="flex flex-col items-center gap-4 animate-pulse">
                      <div className="w-12 h-12 rounded-full border-4 border-t-indigo-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                      <div>
                        <h3 className="font-semibold text-zinc-200">Booting Virtual Browser</h3>
                        <p className="text-xs text-zinc-500 mt-1">Starting docker container instance and initializing Chromium worker...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-2xl shadow-xl">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-zinc-200">Browser Ready to Connect</h3>
                        <p className="text-xs text-zinc-500 mt-1">Click the 'Start Remote Browser' button to launch the browser workspace stream.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Informative Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-[1280px]">
          <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-1">
            <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Instance Resolution</span>
            <span className="text-sm font-semibold text-zinc-300">1280 x 720 px (16:9 Aspect)</span>
          </div>
          <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-1">
            <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Virtual Target</span>
            <span className="text-sm font-semibold text-zinc-300">Google.com</span>
          </div>
          <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm flex flex-col gap-1">
            <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Worker Engine</span>
            <span className="text-sm font-semibold text-zinc-300">Playwright & Chromium</span>
          </div>
        </div>
      </main>
    </div>
  );
}
