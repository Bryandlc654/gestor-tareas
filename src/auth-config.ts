import type { AuthConfig } from "@auth/core";
import * as dao from "./db/dao.js";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";

function genId(prefix: string): string {
  return prefix + crypto.randomUUID();
}

export async function getAuthConfig(): Promise<AuthConfig> {
  const [{ default: Google }, { default: Credentials }] = await Promise.all([
    import("@auth/express/providers/google"),
    import("@auth/express/providers/credentials"),
  ]);

  const googleProvider = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
    : [];

  return {
    providers: [
      ...googleProvider,
      Credentials({
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const email = credentials?.email as string | undefined;
          const password = credentials?.password as string | undefined;
          if (!email || !password) return null;

          const user = await dao.getUserByEmail(email);
          if (!user || !user.password) return null;

          const valid = bcrypt.compareSync(password, user.password);
          if (!valid) return null;

          return { id: user.id, name: user.name, email: user.email, image: user.avatar };
        },
      }),
    ],

    session: { strategy: "jwt" },

    pages: {
      signIn: "/",
    },

    trustHost: true,

    callbacks: {
      async signIn({ user, account, profile }) {
        if (account?.provider === "google" && profile?.email) {
          const existing = await dao.getUserByEmail(profile.email);
          if (!existing) {
            const newUser = {
              id: genId("user-"),
              name: profile.name || profile.email.split("@")[0],
              email: profile.email,
              avatar: (profile as any).image || (profile as any).picture || "",
              roleId: "role-developer",
              status: "active" as const,
            };
            await dao.createUser(newUser);
            user.id = newUser.id;
          } else {
            user.id = existing.id;
          }
        }
        return true;
      },

      async jwt({ token, user, account }) {
        if (user?.id) {
          token.userId = user.id;
        } else if (!token.userId) {
          const email = token.email as string | undefined;
          if (email) {
            const dbUser = await dao.getUserByEmail(email);
            if (dbUser) token.userId = dbUser.id;
          }
        }
        if (account?.provider) {
          token.provider = account.provider;
        }
        return token;
      },

      async session({ session, token }) {
        if (session.user && token.userId) {
          (session.user as any).id = token.userId as string;
          (session.user as any).provider = token.provider as string;
        }
        return session;
      },

      async redirect({ url, baseUrl }) {
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        if (new URL(url).origin === baseUrl) return url;
        return baseUrl;
      },
    },
  };
}
