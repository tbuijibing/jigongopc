import { db } from "./src/db.js";
import { instanceUserRoles, companyMemberships } from "@jigongai/db";
import { eq } from "drizzle-orm";

async function main() {
  // Make admin@example.com an instance admin
  const userId = "mL0Ks8THRc4k5WU6YtHzR9ZiKcRO5X3k";

  // Check if already admin
  const existing = await db.query.instanceUserRoles.findFirst({
    where: eq(instanceUserRoles.userId, userId)
  });

  if (!existing) {
    await db.insert(instanceUserRoles).values({
      userId: userId,
      role: "instance_admin"
    });
    console.log("User is now instance admin");
  } else {
    console.log("User already has role:", existing.role);
  }

  // Also add to company as owner
  const companies = await db.query.companies.findMany();
  for (const company of companies) {
    const existingMember = await db.query.companyMemberships.findFirst({
      where: eq(companyMemberships.companyId, company.id)
    });
    if (!existingMember) {
      await db.insert(companyMemberships).values({
        companyId: company.id,
        principalType: "user",
        principalId: userId,
        status: "active",
        membershipRole: "owner"
      });
      console.log(`Added as owner to company: ${company.name}`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
