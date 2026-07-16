export const ROLE_IDS = ["regular", "not_found"] as const;
export type RoleId = (typeof ROLE_IDS)[number];
