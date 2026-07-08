import axios from 'axios';

const API_URL = 'https://sportz-websockets-72l5.onrender.com';

// We add a standard browser User-Agent so Arcjet doesn't block us as a bot!
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function runSimulation() {
  try {
    console.log('🚀 Initializing Live Match Simulation...');

    // 1. Create a Cricket Match
    const matchPayload = {
      sport: 'CRICKET',
      homeTeam: 'Forest Rangers',
      awayTeam: 'Sunset Blazers',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
      homeScore: 0,
      awayScore: 0
    };

    // Pass the headers to bypass Arcjet
    const matchResponse = await axios.post(`${API_URL}/matches`, matchPayload, { headers });
    const match = matchResponse.data.data;
    console.log(`✅ Match created successfully! ID: ${match.id}`);

    // 2. Stream commentary entries every 4 seconds
    const commentaryTimeline = [
      { minute: 1, sequence: 1, period: '1st Innings', eventType: 'run', message: 'Ben Stokes blocks the first delivery defensively. Solid start.' },
      { minute: 2, sequence: 2, period: '1st Innings', eventType: 'four', message: 'CRACKING COVER DRIVE! Babar Azam hits it straight through the gap for FOUR.', tags: ['FOUR'] },
      { minute: 3, sequence: 3, period: '1st Innings', eventType: 'six', message: 'SMASHED! Shaheen Afridi lofts this straight down the ground for a massive SIX!', tags: ['SIX'] },
      { minute: 4, sequence: 4, period: '1st Innings', eventType: 'wicket', message: 'OUT! Wicket! A sharp catch at slip dismisses Rohit Sharma.', tags: ['WICKET'] }
    ];

    let step = 0;
    const interval = setInterval(async () => {
      if (step >= commentaryTimeline.length) {
        console.log('🏁 Simulation timeline finished.');
        clearInterval(interval);
        return;
      }

      const event = commentaryTimeline[step];
      console.log(`📡 Broadcasting live commentary event: Seq ${event.sequence}...`);
      
      // Pass the headers here too!
      await axios.post(`${API_URL}/matches/${match.id}/commentary`, {
        minutes: event.minute,
        sequence: event.sequence,
        period: event.period,
        eventType: event.eventType,
        message: event.message,
        tags: event.tags || []
      }, { headers });

      step++;
    }, 4000);

  } catch (error) {
    console.error('❌ Simulation Error:', error.response?.data || error.message);
  }
}

runSimulation();