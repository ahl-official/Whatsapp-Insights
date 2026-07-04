export const MAX_ASK_TRANSCRIPT_CHARS = 12000;

export function trimTranscript(transcript: string | null | undefined): {
  text: string | null;
  trimmed: boolean;
  note?: string;
} {
  if (!transcript?.trim()) {
    return { text: null, trimmed: false };
  }
  if (transcript.length <= MAX_ASK_TRANSCRIPT_CHARS) {
    return { text: transcript, trimmed: false };
  }
  return {
    text: transcript.slice(-MAX_ASK_TRANSCRIPT_CHARS),
    trimmed: true,
    note: 'Answer is based on the most recent portion of the transcript (older messages were trimmed due to length).',
  };
}
