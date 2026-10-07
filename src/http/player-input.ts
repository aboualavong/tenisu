import type { NewPlayer } from "../domain/player";

const maxInteger = 2_147_483_647;
const maxSmallInteger = 32_767;
const playerKeys = ["firstname", "lastname", "shortname", "sex", "country", "picture", "data"];
const countryKeys = ["picture", "code"];
const dataKeys = ["rank", "points", "weight", "height", "age", "last"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function normalizeName(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function normalizeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;
    const normalized = url.toString();
    return normalized.length <= 2048 ? normalized : null;
  } catch {
    return null;
  }
}

export function parsePlayerInput(value: unknown): NewPlayer | null {
  if (!isRecord(value) || !hasExactKeys(value, playerKeys)) return null;
  if (!isRecord(value.country) || !hasExactKeys(value.country, countryKeys)) return null;
  if (!isRecord(value.data) || !hasExactKeys(value.data, dataKeys)) return null;

  const firstname = normalizeName(value.firstname, 100);
  const lastname = normalizeName(value.lastname, 100);
  const shortname = normalizeName(value.shortname, 5);
  const picture = normalizeHttpUrl(value.picture);
  const countryPicture = normalizeHttpUrl(value.country.picture);
  const { code } = value.country;
  const data = value.data;

  if (
    !firstname
    || !lastname
    || !shortname
    || (value.sex !== "M" && value.sex !== "F")
    || !picture
    || !countryPicture
    || typeof code !== "string"
    || !/^[A-Z]{3}$/.test(code)
    || !isIntegerInRange(data.rank, 1, maxInteger)
    || !isIntegerInRange(data.points, 0, maxInteger)
    || !isIntegerInRange(data.weight, 1, maxInteger)
    || !isIntegerInRange(data.height, 1, maxInteger)
    || !isIntegerInRange(data.age, 1, maxSmallInteger)
    || !Array.isArray(data.last)
    || data.last.length !== 5
    || !data.last.every((result) => result === 0 || result === 1)
  ) {
    return null;
  }

  return {
    firstname,
    lastname,
    shortname,
    sex: value.sex,
    country: { picture: countryPicture, code },
    picture,
    data: {
      rank: data.rank,
      points: data.points,
      weight: data.weight,
      height: data.height,
      age: data.age,
      last: data.last,
    },
  };
}
