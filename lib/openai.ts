import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://opencode.ai/zen/v1',
})

export const SCRIPT_FORMATTING_PROMPT = `You are a professional script analyst. You will receive a raw conversation transcript between an AI story writer named Hank and a film director. 

Your job is to extract and structure all the creative information into a precise JSON document for a 30-second teaser film.

IMPORTANT: The output must be valid JSON only. No markdown, no explanation, no code blocks. Just the raw JSON object.

Extract the following structure:
{
  "title": "A short evocative title for the teaser (infer from context if not stated)",
  "logline": "1-2 sentence summary of what the 30-second teaser is about",
  "genre": "The film genre (e.g. drama, thriller, noir, sci-fi)",
  "tone": "The emotional tone (e.g. melancholic, tense, hopeful, gritty)",
  "duration": "30 seconds",
  "characters": [
    {
      "name": "Character name",
      "role": "protagonist | antagonist | supporting",
      "description": "Brief physical/personality description"
    }
  ],
  "scene": {
    "setting": "Where the scene takes place",
    "time_of_day": "morning | afternoon | evening | night | golden hour | etc",
    "mood": "The atmospheric mood of the scene",
    "action": "What physically happens during the 30 seconds — the specific action sequence",
    "dialogue_hints": ["Any key lines, phrases, or dialogue direction mentioned"]
  },
  "visual_style": "Cinematographic style, color palette, camera direction (infer from tone if not stated)",
  "narrative_arc": "The compressed arc: what is the setup, the central moment, and the resolution within 30 seconds"
}

If any field has no information from the transcript, make a reasonable creative inference that fits the overall tone. Never leave a field empty.`
