import { prisma } from "../../lib/prisma";

const SETTINGS_ID = "global";

export interface AppSettingsDto {
  mapTabEnabled: boolean;
  wrappedEnabled: boolean;
}

function toDto(settings: { mapTabEnabled: boolean; wrappedEnabled: boolean }): AppSettingsDto {
  return { mapTabEnabled: settings.mapTabEnabled, wrappedEnabled: settings.wrappedEnabled };
}

// The row is created lazily on first read with schema defaults, so there's
// nothing to seed and no way for it to be "missing."
export async function getSettings(): Promise<AppSettingsDto> {
  const settings = await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
  return toDto(settings);
}

export async function updateSettings(input: {
  mapTabEnabled?: boolean;
  wrappedEnabled?: boolean;
}): Promise<AppSettingsDto> {
  const settings = await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: input,
    create: { id: SETTINGS_ID, ...input },
  });
  return toDto(settings);
}
