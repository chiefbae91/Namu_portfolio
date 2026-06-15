export interface DiscordRoleResult {
  isMember: boolean;
  roles: string[];
  hasPermission: boolean;
  message: string;
}

export async function getUserDiscordRoles(discordUserId: string): Promise<DiscordRoleResult> {
  const serverId    = process.env.DISCORD_SERVER_ID!;
  const botToken    = process.env.DISCORD_BOT_TOKEN!;
  const allowedRoles = (process.env.DISCORD_ALLOWED_ROLES ?? '').split(',').map(r => r.trim()).filter(Boolean);
  const blockedMsg  = process.env.DISCORD_BLOCKED_MESSAGE ?? '디스코드 프리미엄 멤버만 접근이 가능합니다.';

  try {
    const memberRes = await fetch(
      `https://discord.com/api/v10/guilds/${serverId}/members/${discordUserId}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );

    if (!memberRes.ok) {
      return { isMember: false, roles: [], hasPermission: false, message: '디스코드 서버에 가입해주세요.' };
    }

    const memberData = await memberRes.json();
    const roleIds: string[] = memberData.roles ?? [];

    const rolesRes = await fetch(
      `https://discord.com/api/v10/guilds/${serverId}/roles`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );

    if (!rolesRes.ok) {
      return { isMember: true, roles: [], hasPermission: false, message: '역할 정보를 확인할 수 없습니다.' };
    }

    const allRoles: Array<{ id: string; name: string }> = await rolesRes.json();
    const userRoles = allRoles.filter(r => roleIds.includes(r.id)).map(r => r.name);
    const hasPermission = userRoles.some(r => allowedRoles.includes(r));

    return {
      isMember: true,
      roles: userRoles,
      hasPermission,
      message: hasPermission ? '접근 허용됩니다.' : blockedMsg,
    };
  } catch {
    return { isMember: false, roles: [], hasPermission: false, message: '역할 확인 중 오류가 발생했습니다.' };
  }
}
