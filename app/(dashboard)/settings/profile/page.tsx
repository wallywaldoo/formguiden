import { toIsoDate } from "@/lib/analytics/daily-energy";
import { ProfileSettingsForm } from "@/features/profiles/profile-settings-form";
import { getProfileSettings } from "@/lib/db/queries";
import { listTimeZones } from "@/lib/timezones";

export default async function ProfileSettingsPage() {
  const data = await getProfileSettings();

  const profile = data.profiles[0];
  const preferences = data.user_preferences[0];

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <h1 className="page-title">Profil</h1>
      <ProfileSettingsForm
        displayName={profile?.display_name ?? ""}
        dateOfBirth={toIsoDate(profile?.date_of_birth) ?? ""}
        sexAtBirth={profile?.sex_at_birth ?? "unspecified"}
        heightCm={
          profile?.height_cm != null ? String(profile.height_cm) : ""
        }
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
