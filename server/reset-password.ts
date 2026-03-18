import { createDb } from "@jigongai/db";
import { authUsers, authAccounts } from "@jigongai/db";
import { eq, and } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hash } from "bcryptjs";

const EMAIL = "tbuijibing@gmail.com";
const NEW_PASSWORD = "Jigong@123"; // 你可以修改这个密码

async function main() {
  // 创建数据库连接
  const db = createDb({
    connectionString: process.env.DATABASE_URL || "postgres://jigong:jigong@localhost:5432/jigong"
  });

  console.log(`查找用户: ${EMAIL}`);

  // 查找用户
  const user = await db.query.authUsers.findFirst({
    where: eq(authUsers.email, EMAIL)
  });

  if (!user) {
    console.log("用户不存在，需要先用邮箱注册");
    process.exit(1);
  }

  console.log(`找到用户: ${user.id}`);

  // 查找账号记录
  const account = await db.query.authAccounts.findFirst({
    where: and(
      eq(authAccounts.userId, user.id),
      eq(authAccounts.providerId, "credential")
    )
  });

  if (!account) {
    console.log("用户没有 credential 账号，创建新账号记录");

    // 创建新的账号记录
    const hashedPassword = await hash(NEW_PASSWORD, 10);

    await db.insert(authAccounts).values({
      id: crypto.randomUUID(),
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("✓ 已创建 credential 账号并设置密码");
  } else {
    console.log("更新现有密码");

    // 更新密码
    const hashedPassword = await hash(NEW_PASSWORD, 10);

    await db.update(authAccounts)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(authAccounts.id, account.id));

    console.log("✓ 密码已更新");
  }

  console.log(`\n用户 ${EMAIL} 的密码已重置为: ${NEW_PASSWORD}`);
  process.exit(0);
}

main().catch(err => {
  console.error("错误:", err);
  process.exit(1);
});
