import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://opencode.ai/zen/v1',
})

export const SCRIPT_FORMATTING_PROMPT = `You are a professional script analyst and screenwriter. You will receive a raw conversation transcript between an AI story writer (Hank) and a film director.

Your job: extract and structure all creative information into a precise JSON document for a 30-second teaser film, formatted as a real shooting script with individual shots.

IMPORTANT: Output valid JSON ONLY. No markdown, no code blocks, no explanation.

Structure:
{
  "title": "Short evocative title for the teaser",
  "logline": "1-2 sentence summary",
  "genre": "film genre",
  "tone": "emotional tone",
  "duration": "30 seconds",
  "characters": [
    {
      "name": "character name",
      "role": "protagonist | antagonist | supporting",
      "description": "brief physical and personality description"
    }
  ],
  "shots": [
    {
      "number": 1,
      "location_type": "INT | EXT",
      "location": "location name in caps (e.g. APARTMENT - BEDROOM)",
      "time_of_day": "DAY | NIGHT | DAWN | DUSK | GOLDEN HOUR",
      "shot_type": "ECU | CU | MCU | MS | WS | EWS | POV | INSERT",
      "duration_seconds": 5,
      "action": "What happens in this shot. One to three sentences. Active voice.",
      "dialogue": "Any spoken line, or omit this field if none",
      "direction": "Camera move or performance note, or omit if none"
    }
  ],
  "visual_style": "Cinematographic style, color palette, camera approach",
  "narrative_arc": "Setup (Xs) → Moment (Xs) → Resolution (Xs) — one sentence describing each beat and its duration"
}

Shot rules:
- Create 4-7 shots that together total exactly 30 seconds
- Each shot should be 3-8 seconds. No shot under 2s, no shot over 10s.
- shot_type ECU=extreme close-up, CU=close-up, MCU=medium close-up, MS=medium shot, WS=wide shot, EWS=extreme wide, POV=point of view, INSERT=insert shot
- The shots must tell the story described by the director — setup, escalation, climax, resolution
- If specific shots were not discussed, infer them from the tone and action described

If any field has no information, make a creative inference that fits the overall tone. Never leave a field empty or null.`
