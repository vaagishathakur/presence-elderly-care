import { query } from "../database/pool.js";

export async function requireUserAccess(request, response, next) {
  try {
    const rawId = request.params.id;
    const userId = Number(rawId);

    if (!rawId || !Number.isInteger(userId) || userId <= 0) {
      return response.status(400).json({ message: "Invalid user ID." });
    }

    const caregiverId = request.caregiver?.id;
    if (!caregiverId) {
      return response.status(401).json({ message: "Authentication required." });
    }

    const userRes = await query(
      `SELECT u.user_id, u.amazon_user_id
       FROM elderly_users u
       JOIN caregiver_assignments ca ON ca.user_id = u.user_id
       WHERE ca.caregiver_id = $1 AND u.user_id = $2 AND ca.is_active = TRUE`,
      [caregiverId, userId]
    );

    if (userRes.rowCount === 0) {
      return response.status(404).json({ message: "Not found." });
    }

    const elder = userRes.rows[0];

    // If the token has claim custom:amazon_user_id it must equal that elder's amazon_user_id, else 404.
    const tokenAmazonUserId = request.caregiver?.claims?.["custom:amazon_user_id"];
    if (tokenAmazonUserId && tokenAmazonUserId !== elder.amazon_user_id) {
      return response.status(404).json({ message: "Not found." });
    }

    request.elderlyUserId = userId;
    request.elderlyUser = elder;
    next();
  } catch (error) {
    next(error);
  }
}
