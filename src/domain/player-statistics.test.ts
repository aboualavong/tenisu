import { describe, expect, it } from "vitest";
import type { Player } from "./player";
import { calculatePlayerStatistics } from "./player-statistics";

function createPlayer(
  id: number,
  countryCode: string,
  last: number[],
  height: number,
  weight = 80000,
): Player {
  return {
    id,
    firstname: "Test",
    lastname: "Player",
    shortname: "T.PLA",
    sex: "M",
    country: { picture: "https://example.com/country.png", code: countryCode },
    picture: "https://example.com/player.png",
    data: { rank: id, points: 1000, weight, height, age: 30, last },
  };
}

describe("calculatePlayerStatistics", () => {
  it("aggregates a country's match results and finds the median of an odd player count", () => {
    const players = [
      createPlayer(1, "CAN", [1, 0], 180),
      createPlayer(2, "CAN", [1, 1, 1, 1, 1], 170),
      createPlayer(3, "USA", [1, 0, 0, 0, 0], 200),
    ];

    expect(calculatePlayerStatistics(players)).toEqual({
      countryWithHighestWinRatio: { countryCode: "CAN", winRatio: 0.8571 },
      averageBmi: 24.12,
      medianHeightCm: 180,
    });
  });

  it("returns null metrics for an empty player list", () => {
    expect(calculatePlayerStatistics([])).toEqual({
      countryWithHighestWinRatio: null,
      averageBmi: null,
      medianHeightCm: null,
    });
  });
});
