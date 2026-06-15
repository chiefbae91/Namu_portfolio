export interface DiscordRoleResult {
  isMember: boolean;
  roles: string[];
  hasPermission: boolean;
  message: string;
}

// Uses the user's own access token (no bot needed)
// DISCORD_ALLOWED_ROLE_IDS: comma-separated role IDs (right-click role in Discord → Copy ID)
export async function getUserDiscordRoles(accessToken: string): Promise<DiscordRoleResult> {
  const serverId    = process.env.DISCORD_SERVER_ID!;
  const allowedIds  = (process.env.DISCORD_ALLOWED_ROLE_IDS ?? '').split(',').map(r => r.trim()).filter(Boolean);
  const blockedMsg  = process.env.DISCORD_BLOCKED_MESSAGE ?? '디스코드 프리미엄 멤버만 접근이 가능합니다.';

  try {
    const res = await fetch(
      `https://discord.com/api/v10/users/@me/guilds/${serverId}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (res.status === 404 || res.status === 403) {
      return { isMember: false, roles: [], hasPermission: false, message: '디스코드 서버에 가입해주세요.' };
    }

    if (!res.ok) {
      return { isMember: false, roles: [], hasPermission: false, message: '서버 멤버 정보를 가져올 수 없습니다.' };
    }

    const member = await res.json();
    const roleIds: string[] = member.roles ?? [];
    const hasPermission = allowedIds.length === 0 || roleIds.some(id => allowedIds.includes(id));

    return {
      isMember: true,
      roles: roleIds,
      hasPermission,
      message: hasPermission ? '접근 허용됩니다.' : blockedMsg,
    };
  } catch {
    return { isMember: false, roles: [], hasPermission: false, message: '역할 확인 중 오류가 발생했습니다.' };
  }
}
