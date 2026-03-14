import { api } from "./client";

export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image: string | null;
  timezone: string;
  locale: string;
  dateFormat: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserUpdateInput {
  name?: string;
  timezone?: string;
  locale?: string;
  dateFormat?: string;
}

export interface UserPasswordInput {
  currentPassword: string;
  newPassword: string;
}

export const usersApi = {
  getCurrentUser: async (): Promise<User | null> => {
    const response = await api.get<User | null>("/users/me");
    return response;
  },

  getUser: async (userId: string): Promise<User | null> => {
    const response = await api.get<User | null>(`/users/${userId}`);
    return response;
  },

  updateCurrentUser: async (data: UserUpdateInput): Promise<User> => {
    const response = await api.put<User>("/users/me", data);
    return response;
  },

  updatePassword: async (data: UserPasswordInput): Promise<void> => {
    // Better Auth provides a built-in password change endpoint
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Failed to update password" }));
      throw new Error(error.error ?? "Failed to update password");
    }
  },
};
