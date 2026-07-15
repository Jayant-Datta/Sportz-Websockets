/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import MatchCard from './components/MatchCard';
import CommentaryPanel from './components/CommentaryPanel';

 const BACKEND_URL = 'https://sportz-websockets-72l5.onrender.com';
const WS_URL = 'wss://sportz-websockets-72l5.onrender.com/ws'; 



export default function App() {
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [commentaries, setCommentaries] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // NEW: State to track if we are currently waking up the server/starting the simulation
  const [isSimulating, setIsSimulating] = useState(false);

  // 1. Initial Load: Fetch all active matches
  useEffect(() => {
    fetchMatches();
  }, []);

  // Extracted fetch logic so we can reuse it after starting the simulation
  const fetchMatches = () => {
    fetch(`${BACKEND_URL}/matches`)
      .then((res) => res.json())
      .then((json) => {
        const matchesData = json.data || [];
        setMatches(matchesData);
        if (matchesData.length > 0) {
          setSelectedMatchId(matchesData[0].id); // Default to the first match
        }
      })
      .catch((err) => console.error('Error fetching matches:', err));
  };

  // NEW: Function to trigger the backend simulation
  const startSimulation = async () => {
    setIsSimulating(true);
    try {
      const response = await fetch(`${BACKEND_URL}/simulate`, {
        method: 'POST',
      });
      
      if (response.ok) {
        // Once the server confirms the match is created, fetch matches again
        // so the UI updates and the WebSocket connects to the new match ID
        fetchMatches();
      }
    } catch (err) {
      console.error('Failed to trigger simulation:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // 2. Fetch Commentary history whenever selected match changes
  useEffect(() => {
    if (!selectedMatchId) return;

    fetch(`${BACKEND_URL}/matches/${selectedMatchId}/commentary`)
      .then((res) => res.json())
      .then((json) => {
        setCommentaries(json.data || []);
      })
      .catch((err) => console.error('Error fetching commentary:', err));
  }, [selectedMatchId]);

  // 3. Setup WebSocket connection for real-time streaming
  useEffect(() => {
    if (!selectedMatchId) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setSocketConnected(true);
      // Subscribe to updates for the currently viewed match
      ws.send(JSON.stringify({ type: 'subscribe', matchId: selectedMatchId }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // When a new live commentary entry arrives, immediately push it to the top of the list!
      if (data.type === 'commentary' && data.data) {
        setCommentaries((prev) => [data.data, ...prev]);
      }

      // If a match is created OR updated via broadcast, refresh our top level scores
      if ((data.type === 'match_created' || data.type === 'match_updated') && data.data) {
        setMatches((prevMatches) => {
          const matchExists = prevMatches.some((m) => m.id === data.data.id);
          if (matchExists) {
            // Replace the old match data with the new one containing the updated score
            return prevMatches.map((m) => (m.id === data.data.id ? data.data : m));
          }
          return [data.data, ...prevMatches];
        });
      }
    };

    ws.onclose = () => {
      setSocketConnected(false);
    };

    // Auto cleanup subscription channel if switching tabs/matches
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', matchId: selectedMatchId }));
      }
      ws.close();
    };
  }, [selectedMatchId]);

  return (
    // 1. Added lg:h-screen and lg:overflow-hidden to prevent full page scroll on desktop
    // 2. Added flex flex-col so the internal elements can size themselves correctly
    <div className="min-h-screen lg:h-screen flex flex-col bg-[#FDF6E2] text-black font-sans p-6 selection:bg-yellow-300 lg:overflow-hidden">
      
      {/* Header */}
      {/* Added shrink-0 so the header never gets squished when content grows */}
      <header className="shrink-0 bg-[#FFDE4D] border-4 border-black p-4 mb-6 rounded-xl flex justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Sportz</h1>
          <p className="text-sm font-bold opacity-80">Real-time match data</p>
        </div>
        <div className="flex items-center gap-2 bg-white border-2 border-black px-3 py-1 rounded-full font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
          {socketConnected ? 'LIVE CONNECTED' : 'DISCONNECTED'}
        </div>
      </header>

      {/* Main Grid Content */}
      {/* Added flex-grow and min-h-0 to take the remaining vertical space */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow min-h-0">
        
        {/* Left Column: Matches Grid */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <h2 className="shrink-0 text-xl font-black uppercase tracking-tight mb-4 flex items-center gap-2">
            Current Matches
            <span className="bg-black text-white text-xs px-2 py-0.5 rounded font-mono">Count: {matches.length}</span>
          </h2>
          
          {/* THE MAGIC IS HERE: overflow-y-auto enables independent scrolling for the matches */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-2 pb-4">
            {matches.map((match) => (
              <MatchCard 
                key={match.id} 
                match={match} 
                isSelected={selectedMatchId === match.id}
                onSelect={() => setSelectedMatchId(match.id)}
              />
            ))}
            
            {/* Interactive Fallback UI */}
            {matches.length === 0 && (
              <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center p-8 bg-white border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="font-bold text-gray-500 mb-4 text-center">
                  No active matches found. The server might be sleeping.
                </p>
                <button 
                  onClick={startSimulation}
                  disabled={isSimulating}
                  className={`px-6 py-3 font-black text-white uppercase border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform active:translate-y-1 active:shadow-none ${
                    isSimulating ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isSimulating ? 'Waking up server & Starting...' : 'Run Live Data Demo'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Commentary Panel */}
        {/* Ensure this column also respects the parent's height constraints */}
        <div className="lg:col-span-1 flex flex-col min-h-0 h-full">
          <CommentaryPanel commentaries={commentaries} />
        </div>
      </div>
    </div>
  );
}