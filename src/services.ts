import type { Coord, Device } from "./model";
import { history } from "./model";
export interface DeviceProvider {
  read(
    device: Device,
    metric: string,
    tick: number,
    days: number,
  ): ReturnType<typeof history>;
}
export const simulatedProvider: DeviceProvider = { read: history };
export interface Weather {
  temperature: number;
  humidity: number;
  rain: number;
  wind: number;
  time: string;
  source: string;
}
export interface WeatherProvider {
  fetch(location: Coord): Promise<Weather>;
}
export const openMeteo: WeatherProvider = {
  async fetch([longitude, latitude]) {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&timezone=Atlantic%2FMadeira`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok)
      throw Error(
        "Meteorologia externa indisponível. Os dados simulados continuam disponíveis.",
      );
    const { current: c } = await response.json();
    if (!c) throw Error("Sem dados meteorológicos.");
    return {
      temperature: c.temperature_2m,
      humidity: c.relative_humidity_2m,
      rain: c.precipitation,
      wind: c.wind_speed_10m,
      time: c.time,
      source: "Open-Meteo · Meteorologia externa (modelo)",
    };
  },
};
