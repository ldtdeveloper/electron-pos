/**
 * Get company state from selected POS profile.
 * POS profile data has { data: [{ name, company_state, ... }] }
 */
export async function getCompanyState(getPOSProfile, getPOSProfileData) {
  try {
    const profileName = await getPOSProfile();
    const profileData = await getPOSProfileData();
    if (!profileName || !profileData) return '';
    const data = profileData?.data || profileData;
    const arr = Array.isArray(data) ? data : [];
    const profile = arr.find(
      (p) =>
        (typeof p === 'object' && (p.name === profileName || p.pos_profile === profileName)) ||
        p === profileName
    );
    return (profile && typeof profile === 'object' && profile.company_state) || '';
  } catch {
    return '';
  }
}
