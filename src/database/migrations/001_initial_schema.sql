CREATE TABLE IF NOT EXISTS countries (
  code CHAR(3) PRIMARY KEY,
  picture TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY,
  firstname TEXT NOT NULL,
  lastname TEXT NOT NULL,
  shortname VARCHAR(5) NOT NULL,
  sex CHAR(1) NOT NULL CHECK (sex IN ('M', 'F')),
  country_code CHAR(3) NOT NULL REFERENCES countries(code),
  picture TEXT NOT NULL,
  rank INTEGER NOT NULL CHECK (rank > 0),
  points INTEGER NOT NULL CHECK (points >= 0),
  weight INTEGER NOT NULL CHECK (weight > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  age SMALLINT NOT NULL CHECK (age > 0),
  last_results SMALLINT[] NOT NULL CHECK (cardinality(last_results) = 5),
  CONSTRAINT players_last_results_values CHECK (last_results <@ ARRAY[0, 1]::SMALLINT[])
);

CREATE INDEX IF NOT EXISTS players_rank_idx ON players(rank);
CREATE INDEX IF NOT EXISTS players_country_code_idx ON players(country_code);
