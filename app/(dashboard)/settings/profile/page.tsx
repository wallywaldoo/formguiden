import { ProfileSettingsForm } from "@/features/profiles/profile-settings-form";
import { getProfileSettings } from "@/lib/db/queries";
import { listTimeZones } from "@/lib/timezones";

export default async function ProfileSettingsPage() {
  const data = await getProfileSettings();

  const profile = data.profiles[0];
  const preferences = data.user_preferences[0];

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Profil</h1>
        <p className="text-muted-foreground">
          Namn, tidszon och visningsenheter. Lagrad data är alltid SI.
        </p>
      </div>
      <ProfileSettingsForm
        displayName={profile?.display_name ?? ""}
        timezone={preferences?.timezone ?? "Europe/Stockholm"}
        distanceUnit={preferences?.distance_unit ?? "km"}
        massUnit={preferences?.mass_unit ?? "kg"}
        elevationUnit={preferences?.elevation_unit ?? "m"}
        volumeUnit={preferences?.volume_unit ?? "ml"}
        timeZones={listTimeZones()}
      />
    </div>
  );
}
