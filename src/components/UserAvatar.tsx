interface UserAvatarProps {
  name?: string;
  avatar?: string | null;
  size?: number;
  className?: string;
}

const AVATAR_COLORS = ['2563eb','7c3aed','db2777','dc2626','ea580c','ca8a04','16a34a','0891b2'];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export default function UserAvatar({ name, avatar, size = 24, className = '' }: UserAvatarProps) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name || ''}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const displayName = name || 'User';
  const encoded = encodeURIComponent(displayName);
  const colorIndex = hashName(displayName) % AVATAR_COLORS.length;
  const url = `https://ui-avatars.com/api/?name=${encoded}&background=${AVATAR_COLORS[colorIndex]}&color=fff&bold=true&size=${size * 2}`;
  return (
    <img
      src={url}
      alt={displayName}
      className={`rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={displayName}
    />
  );
}