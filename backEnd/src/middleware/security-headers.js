// Standard security headers for the API and the React app.
// (The same idea as the popular "helmet" package, kept small and explicit.)

// Content Security Policy for the built React app: only load code from this site,
// fonts from Google Fonts, and never allow the page to be framed by other sites.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // React and the code highlighter set inline style attributes.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function securityHeaders({ isProduction }) {
  return (req, res, next) => {
    res.set({
      "Content-Security-Policy": CONTENT_SECURITY_POLICY,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    // Tell browsers to always use HTTPS (only in production, where HTTPS exists).
    if (isProduction) {
      res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  };
}
