import type { Player } from "./player";

export interface PlayerStatistics {
  countryWithHighestWinRatio: { countryCode: string; winRatio: number } | null;
  averageBmi: number | null;
  medianHeightCm: number | null;
}

export function calculatePlayerStatistics(players: Player[]): PlayerStatistics {
  if (players.length === 0) {
    return { countryWithHighestWinRatio: null, averageBmi: null, medianHeightCm: null };
  }

  const countryResults = new Map<string, { wins: number; matches: number }>();
  let totalBmi = 0;
  let bmiCount = 0;
  const heights: number[] = [];

  for (const player of players) {
    const country = countryResults.get(player.country.code) ?? { wins: 0, matches: 0 };
    country.wins += player.data.last.filter((result) => result === 1).length;
    country.matches += player.data.last.length;
    countryResults.set(player.country.code, country);

    if (player.data.height > 0 && player.data.weight >= 0) {
      const heightInMeters = player.data.height / 100;
      totalBmi += (player.data.weight / 1000) / (heightInMeters * heightInMeters);
      bmiCount += 1;
      heights.push(player.data.height);
    }
  }

  let bestCountry: { code: string; wins: number; matches: number } | null = null;
  for (const [code, results] of countryResults) {
    if (results.matches === 0) continue;
    if (
      bestCountry === null
      || results.wins * bestCountry.matches > bestCountry.wins * results.matches
      || (results.wins * bestCountry.matches === bestCountry.wins * results.matches
        && code.localeCompare(bestCountry.code) < 0)
    ) {
      bestCountry = { code, ...results };
    }
  }

  heights.sort((left, right) => left - right);
  const middle = Math.floor(heights.length / 2);
  const medianHeightCm = heights.length === 0
    ? null
    : heights.length % 2 === 0
      ? (heights[middle - 1] + heights[middle]) / 2
      : heights[middle];

  return {
    countryWithHighestWinRatio: bestCountry
      ? { countryCode: bestCountry.code, winRatio: Number((bestCountry.wins / bestCountry.matches).toFixed(4)) }
      : null,
    averageBmi: bmiCount === 0 ? null : Number((totalBmi / bmiCount).toFixed(2)),
    medianHeightCm,
  };
}
