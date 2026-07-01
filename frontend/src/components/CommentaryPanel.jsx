/* eslint-disable no-unused-vars */
import React from 'react';

export default function CommentaryPanel({ commentaries }) {
  const getTagStyle = (tag) => {
    switch (tag?.toUpperCase()) {
      case 'WICKET': return 'bg-yellow-400';
      case 'SIX': return 'bg-sky-300';
      case 'FOUR': return 'bg-amber-300';
      default: return 'bg-gray-200';
    }
  };

  return (
    <div className="bg-[#BAE6FF] border-4 border-black rounded-xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-black">
        <h3 className="text-xl font-black uppercase tracking-tight">Live Commentary</h3>
        <span className="bg-white border-2 border-black text-xs px-2 py-0.5 rounded font-black tracking-wider uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          Real-time
        </span>
      </div>

      {/* Scrollable Feed Container */}
      <div className="overflow-y-auto space-y-4 pr-1 flex-1">
        {commentaries.map((event, index) => (
          <div key={event.id || index} className="relative pl-4 border-l-2 border-l-black/30 pb-2">
            <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-black border border-white" />
            
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-gray-700 font-bold mb-1">
              <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
              {event.minute && <span className="bg-white px-1.5 py-0.5 border border-black rounded">{event.minute}'</span>}
              <span>Seq {event.sequence}</span>
              <span className="opacity-60">{event.period || 'Live'}</span>
              {event.tags?.map((tag) => (
                <span key={tag} className={`px-1.5 py-0.2 border border-black rounded font-sans font-black tracking-tight ${getTagStyle(tag)}`}>
                  {tag}
                </span>
              ))}
            </div>

            <p className="text-xs font-bold text-gray-600 mb-1">
              {event.actor ? `${event.actor} • ` : ''}{event.team || ''}
            </p>
            
            <div className="bg-white border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-sm font-black leading-tight text-gray-900">{event.message}</p>
            </div>
          </div>
        ))}
        {commentaries.length === 0 && (
          <p className="text-sm font-bold text-gray-600 italic">Waiting for initial match events...</p>
        )}
      </div>
    </div>
  );
}