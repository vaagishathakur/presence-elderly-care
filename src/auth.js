// AWS Cognito Authentication Helper
// Handles Caregiver login, session persistence, new password challenges, and logout

import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
} from "amazon-cognito-identity-js";
import { setAuthToken } from "./api.js";

export function getCognitoConfig() {
  return {
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
    clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "",
    region: import.meta.env.VITE_AWS_REGION || "us-east-1",
    isDemoAuthEnabled: import.meta.env.VITE_USE_DEMO_AUTH === "true",
  };
}

let userPoolInstance = null;

export function getUserPool() {
  const config = getCognitoConfig();
  if (!config.userPoolId || !config.clientId) {
    return null;
  }
  if (!userPoolInstance) {
    userPoolInstance = new CognitoUserPool({
      UserPoolId: config.userPoolId,
      ClientId: config.clientId,
    });
  }
  return userPoolInstance;
}

/**
 * Perform standard Cognito email/password login
 */
export function signInWithCognito(email, password) {
  const pool = getUserPool();
  if (!pool) {
    return Promise.reject(
      new Error(
        "AWS Cognito is not configured. Please set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID in your .env file."
      )
    );
  }

  const authenticationDetails = new AuthenticationDetails({
    Username: email.trim(),
    Password: password,
  });

  const cognitoUser = new CognitoUser({
    Username: email.trim(),
    Pool: pool,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (session) => {
        const idToken = session.getIdToken().getJwtToken();
        setAuthToken(idToken);
        resolve({
          status: "SUCCESS",
          idToken,
          email: session.getIdToken().payload.email || email,
          name: session.getIdToken().payload.name || "Caregiver",
          claims: session.getIdToken().payload,
        });
      },
      newPasswordRequired: (userAttributes, requiredAttributes) => {
        resolve({
          status: "NEW_PASSWORD_REQUIRED",
          cognitoUser,
          userAttributes,
          requiredAttributes,
        });
      },
      onFailure: (err) => {
        let message = err.message || "Login failed.";
        if (err.code === "NotAuthorizedException") {
          message = "Incorrect email or password.";
        } else if (err.code === "UserNotConfirmedException") {
          message = "Caregiver account not confirmed. Please verify your email or confirm the user in AWS Cognito.";
        } else if (err.code === "UserNotFoundException") {
          message = "Caregiver account not found. Please check your email address.";
        }
        reject(new Error(message));
      },
    });
  });
}

/**
 * Handle NEW_PASSWORD_REQUIRED first-login challenge
 */
export function completeNewPasswordChallenge(cognitoUser, newPassword, requiredAttributes = {}) {
  return new Promise((resolve, reject) => {
    cognitoUser.completeNewPasswordChallenge(newPassword, requiredAttributes, {
      onSuccess: (session) => {
        const idToken = session.getIdToken().getJwtToken();
        setAuthToken(idToken);
        resolve({
          status: "SUCCESS",
          idToken,
          claims: session.getIdToken().payload,
        });
      },
      onFailure: (err) => {
        reject(new Error(err.message || "Failed to set new password."));
      },
    });
  });
}

/**
 * Restore current session on page refresh
 */
export function getCurrentSession() {
  const pool = getUserPool();
  if (!pool) {
    // If demo token is stored, return demo session if enabled
    const token = localStorage.getItem("presence_id_token");
    if (token && (token.startsWith("demo-token-") || token === "demo-token-caregiver-a")) {
      return Promise.resolve({
        status: "SUCCESS",
        idToken: token,
        isDemo: true,
      });
    }
    return Promise.resolve(null);
  }

  const cognitoUser = pool.getCurrentUser();
  if (!cognitoUser) {
    const token = localStorage.getItem("presence_id_token");
    if (token && token.startsWith("demo-token-")) {
      return Promise.resolve({ status: "SUCCESS", idToken: token, isDemo: true });
    }
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    cognitoUser.getSession((err, session) => {
      if (err || !session || !session.isValid()) {
        setAuthToken("");
        resolve(null);
      } else {
        const idToken = session.getIdToken().getJwtToken();
        setAuthToken(idToken);
        resolve({
          status: "SUCCESS",
          idToken,
          email: session.getIdToken().payload.email,
          name: session.getIdToken().payload.name || "Caregiver",
          claims: session.getIdToken().payload,
        });
      }
    });
  });
}

/**
 * Logout and clear session
 */
export function signOutCaregiver() {
  const pool = getUserPool();
  if (pool) {
    const cognitoUser = pool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
  }
  setAuthToken("");
}