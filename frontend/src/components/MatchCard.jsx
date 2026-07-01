export default function MatchCard({ match, isSelected, onSelect }) {
  return (
    <div className={`bg-white border-4 border-black rounded-xl p-5 flex flex-col justify-between transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isSelected ? 'ring-4 ring-yellow-400' : ''}`}>
      <div>
        {/* Top bar */}
        <div className="flex justify-between items-center mb-4">
          <span className="border-2 border-black rounded-full px-3 py-0.5 text-xs font-black tracking-wider uppercase bg-gray-50">
            {match.sport}
          </span>
          {match.status === 'live' && (
            <span className="flex items-center gap-1.5 text-xs font-black text-red-600 uppercase">
              <span className="w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
              ● Live
            </span>
          )}
        </div>

        {/* Teams & Scores Row */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-lg font-black tracking-tight">{match.homeTeam}</span>
            <span className="bg-[#FFDE4D] border-2 border-black w-10 h-10 flex items-center justify-center font-black text-xl rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {match.homeScore}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-black tracking-tight">{match.awayTeam}</span>
            <span className="bg-white border-2 border-black w-10 h-10 flex items-center justify-center font-black text-xl rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {match.awayScore}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-2 border-t-2 border-dashed border-gray-300">
        <span className="text-xs font-bold font-mono text-gray-500">03:38 PM</span>
        <button 
          onClick={onSelect}
          className={`px-4 py-1.5 border-2 border-black rounded-lg font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform active:translate-x-0.5 active:translate-y-0.5 ${
            isSelected ? 'bg-sky-200' : 'bg-[#FFDE4D] hover:bg-yellow-400'
          }`}
        >
          {isSelected ? 'Watching Live' : 'Watch Live'}
        </button>
      </div>
    </div>
  );
}