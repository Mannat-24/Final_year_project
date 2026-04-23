import { env } from "../config/env.js";

const MULTIPLIERS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000
};

export const parseDurationToMs = (input) => {
  const value = String(input || env.jwtExpiresIn || "1d").trim();
  const match = value.match(/^(\d+)([smhdw])$/i);

  if (match) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    return amount * MULTIPLIERS[unit];
  }

  const asNumber = Number(value);
  if (!Number.isNaN(asNumber) && asNumber > 0) {
    return asNumber * 1000;
  }

  return 24 * 60 * 60 * 1000;
};

export const getExpiresAtFromNow = (durationInput) => {
  const ms = parseDurationToMs(durationInput);
  return new Date(Date.now() + ms);
};
