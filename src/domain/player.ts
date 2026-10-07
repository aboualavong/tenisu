export type PlayerSex = "M" | "F";

export interface Player {
  id: number;
  firstname: string;
  lastname: string;
  shortname: string;
  sex: PlayerSex;
  country: {
    picture: string;
    code: string;
  };
  picture: string;
  data: {
    rank: number;
    points: number;
    weight: number;
    height: number;
    age: number;
    last: number[];
  };
}

export type NewPlayer = Omit<Player, "id">;
