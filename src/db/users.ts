import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  fullName = 'Amina Bello (CHW)',
  role: 'worker' | 'supervisor' = 'worker',
  assignedCommunity = 'Ungogo Ward A',
  workerCode = 'CHW-014'
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        fullName,
        role,
        assignedCommunity,
        workerCode,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          role,
          lastActiveAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}
