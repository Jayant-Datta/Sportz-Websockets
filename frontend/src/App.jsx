/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import MatchCard from './components/MatchCard';
import CommentaryPanel from './components/CommentaryPanel';

const BACKEND_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws';

export default function App() {
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [commentaries, setCommentaries] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);

  // 1. Initial Load: Fetch all active matches
  useEffect(() => {
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
  }, []);

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

      // If a match is created or score changes via broadcast, refresh our top level scores
      if (data.type === 'match_created' && data.data) {
        setMatches((prevMatches) => {
          const matchExists = prevMatches.some((m) => m.id === data.data.id);
          if (matchExists) {
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
    <div className="min-h-screen bg-[#FDF6E2] text-black font-sans p-6 selection:bg-yellow-300">
      {/* Header */}
      <header className="bg-[#FFDE4D] border-4 border-black p-4 mb-6 rounded-xl flex justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Sportz</h1>
          <p className="text-sm font-bold opacity-80">Real-time match data demo</p>
        </div>
        <div className="flex items-center gap-2 bg-white border-2 border-black px-3 py-1 rounded-full font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
          {socketConnected ? 'LIVE CONNECTED' : 'DISCONNECTED'}
        </div>
      </header>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Matches Grid */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-black uppercase tracking-tight mb-4 flex items-center gap-2">
            Current Matches
            <span className="bg-black text-white text-xs px-2 py-0.5 rounded font-mono">Count: {matches.length}</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map((match) => (
              <MatchCard 
                key={match.id} 
                match={match} 
                isSelected={selectedMatchId === match.id}
                onSelect={() => setSelectedMatchId(match.id)}
              />
            ))}
            {matches.length === 0 && (
              <p className="font-bold text-gray-500">No active matches found. Boot up the data simulator!</p>
            )}
          </div>
        </div>

        {/* Right Column: Live Commentary Panel */}
        <div className="lg:col-span-1">
          <CommentaryPanel commentaries={commentaries} />
        </div>
      </div>
    </div>
  );
}