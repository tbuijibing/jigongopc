import { api } from "./client";

export interface CompanyMember {
  id: string;
  companyId: string;
  principalType: "user" | "agent";
  principalId: string;
  status: "active" | "inactive";
  membershipRole: string;
  displayName?: string | null;
  email?: string | null;
  image?: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

export const membersApi = {
  listWithUsers: async (companyId: string): Promise<CompanyMember[]> => {
    const response = await api.get<CompanyMember[]>(`/companies/${companyId}/members/list`);
    return response;
  },
};
