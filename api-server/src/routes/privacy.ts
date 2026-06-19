import { Router } from "express";

const router = Router();

router.get("/privacy", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bean — Privacy Policy</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #FFF9F4; color: #2D2926; line-height: 1.75; }
    .container { max-width: 700px; margin: 0 auto; padding: 56px 24px 100px; }

    /* Header */
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 48px; }
    .logo-mark { width: 40px; height: 40px; background: #E8825A; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
    .logo-name { font-size: 22px; font-weight: 700; color: #2D2926; letter-spacing: -0.3px; }

    /* Hero */
    h1 { font-size: 32px; font-weight: 700; color: #2D2926; letter-spacing: -0.5px; margin-bottom: 6px; }
    .meta { font-size: 14px; color: #8A8076; margin-bottom: 28px; }
    .intro { font-size: 16px; color: #4A4540; background: #F5EFE9; border-left: 3px solid #E8825A; border-radius: 0 10px 10px 0; padding: 16px 20px; margin-bottom: 40px; line-height: 1.6; }

    /* Sections */
    h2 { font-size: 19px; font-weight: 600; color: #2D2926; margin: 40px 0 10px; display: flex; align-items: center; gap: 8px; }
    h2::before { content: ''; display: inline-block; width: 4px; height: 18px; background: #E8825A; border-radius: 2px; flex-shrink: 0; }
    h3 { font-size: 15px; font-weight: 600; color: #2D2926; margin: 18px 0 6px; }
    p { font-size: 15px; color: #4A4540; margin-bottom: 12px; }
    ul { font-size: 15px; color: #4A4540; padding-left: 22px; margin-bottom: 14px; }
    ul li { margin-bottom: 8px; line-height: 1.6; }
    strong { color: #2D2926; font-weight: 600; }

    /* Third-party cards */
    .services { display: grid; gap: 12px; margin: 16px 0; }
    .service-card { background: #fff; border: 1px solid #EDE8E3; border-radius: 12px; padding: 16px 18px; }
    .service-name { font-size: 15px; font-weight: 600; color: #2D2926; margin-bottom: 4px; }
    .service-desc { font-size: 14px; color: #6A6460; line-height: 1.5; }
    .service-link { font-size: 13px; color: #E8825A; text-decoration: none; display: inline-block; margin-top: 6px; }
    .service-link:hover { text-decoration: underline; }

    /* Rights grid */
    .rights { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
    .right-card { background: #fff; border: 1px solid #EDE8E3; border-radius: 12px; padding: 14px 16px; }
    .right-title { font-size: 14px; font-weight: 600; color: #2D2926; margin-bottom: 4px; }
    .right-desc { font-size: 13px; color: #6A6460; line-height: 1.5; }

    /* Contact */
    .contact-box { background: #2D2926; color: #fff; border-radius: 16px; padding: 28px; margin-top: 40px; }
    .contact-box h2 { color: #fff; margin-top: 0; }
    .contact-box h2::before { background: #E8825A; }
    .contact-box p { color: rgba(255,255,255,0.75); }
    .contact-email { display: inline-block; margin-top: 10px; color: #E8825A; font-size: 16px; font-weight: 600; text-decoration: none; }
    .contact-email:hover { text-decoration: underline; }

    a { color: #E8825A; text-decoration: none; }
    a:hover { text-decoration: underline; }
    hr { border: none; border-top: 1px solid #EDE8E3; margin: 40px 0; }
    .footer { font-size: 13px; color: #8A8076; margin-top: 48px; text-align: center; }

    @media (max-width: 520px) {
      .rights { grid-template-columns: 1fr; }
      h1 { font-size: 26px; }
    }
  </style>
</head>
<body>
  <div class="container">

    <div class="header">
      <div class="logo-mark">☕</div>
      <span class="logo-name">Bean</span>
    </div>

    <h1>Privacy Policy</h1>
    <p class="meta">Last updated: May 8, 2026</p>

    <p class="intro">Bean is a personal travel journaling app. We believe your travel memories belong to you. This policy explains plainly what data we collect, why we collect it, and how we protect it.</p>

    <h2>Information We Collect</h2>

    <h3>Account &amp; Identity</h3>
    <p>When you create a Bean account, we collect your <strong>email address</strong> and optionally your <strong>name and profile photo</strong>. If you sign in with Google, we receive only the information Google shares with us (email, name, profile picture). Authentication is handled by <strong>Clerk</strong>.</p>

    <h3>Travel Data You Create</h3>
    <ul>
      <li><strong>Places</strong> — names, countries, cities, categories, dates visited, and personal notes.</li>
      <li><strong>Memories</strong> — titles, dates, ratings, companions, and favourite moments.</li>
      <li><strong>Bucket list</strong> — destination names, tags, source inspiration, and status.</li>
      <li><strong>Trips &amp; itineraries</strong> — trip names, dates, day-by-day time blocks, comments, and votes.</li>
    </ul>

    <h3>Photos</h3>
    <p>Photos you attach to places are uploaded to secure cloud object storage. Each photo is accessible only via a short-lived signed URL tied to your account. We do not scan, analyse, or share your photos.</p>

    <h3>Voice &amp; Speech</h3>
    <p>When you use voice-to-text dictation, your speech is processed entirely <strong>on your device</strong> using Apple or Android's built-in speech recognition engine. No audio is ever sent to, or stored on, Bean's servers.</p>

    <h3>Location</h3>
    <p>The map feature can optionally show your current position. Location is used only to display the map pin and is <strong>never stored or sent to our servers</strong>. You can deny location permission at any time without affecting other features.</p>

    <h3>Subscription &amp; Purchase Data</h3>
    <p>If you subscribe to Bean Pro, your purchase is processed through the Apple App Store or Google Play Store. Bean never sees or stores your payment card details. We use <strong>RevenueCat</strong> to manage entitlements — RevenueCat receives your app store receipt and tells Bean whether your subscription is active.</p>

    <h2>How We Use Your Information</h2>
    <ul>
      <li>To sync your travel journal securely across your devices.</li>
      <li>To provide the core features of the app (places, memories, trips, bucket list, photos).</li>
      <li>To determine whether you have an active Bean Pro subscription.</li>
      <li>To generate shareable trip links when you explicitly choose to share a trip.</li>
      <li>To improve reliability and fix bugs (server logs contain no personal travel data).</li>
    </ul>
    <p>We do <strong>not</strong> use your data for advertising, and we do <strong>not</strong> sell it.</p>

    <h2>Data Sharing</h2>
    <p>Your travel data is private to you by default. The only exceptions are:</p>
    <ul>
      <li><strong>Shared trip links</strong> — when you tap "Share" on a trip, a read-only link is generated. Anyone with the link can view that trip. You control which trips are shared and can revoke access at any time.</li>
      <li><strong>Service providers</strong> — we share data only with the third-party services listed below, strictly to operate the app.</li>
    </ul>

    <h2>Third-Party Services</h2>
    <div class="services">
      <div class="service-card">
        <div class="service-name">Clerk</div>
        <div class="service-desc">Handles user authentication, sign-in, sign-up, and session management. Stores your email address and profile information.</div>
        <a class="service-link" href="https://clerk.com/privacy" target="_blank">clerk.com/privacy →</a>
      </div>
      <div class="service-card">
        <div class="service-name">RevenueCat</div>
        <div class="service-desc">Manages Bean Pro subscription entitlements. Receives your app store purchase receipts to verify subscription status. Does not store payment card details.</div>
        <a class="service-link" href="https://www.revenuecat.com/privacy" target="_blank">revenuecat.com/privacy →</a>
      </div>
      <div class="service-card">
        <div class="service-name">Apple App Store / Google Play</div>
        <div class="service-desc">Processes Bean Pro subscription payments. Governed by Apple's and Google's own privacy policies.</div>
        <a class="service-link" href="https://www.apple.com/legal/privacy/" target="_blank">apple.com/legal/privacy →</a>
      </div>
      <div class="service-card">
        <div class="service-name">Cloud Object Storage</div>
        <div class="service-desc">Stores photos you attach to places. Photos are encrypted at rest and accessible only via time-limited signed URLs tied to your account.</div>
      </div>
    </div>

    <h2>Data Retention</h2>
    <p>We retain your data for as long as your account is active. If you delete your account, all associated data (places, memories, trips, bucket list, photos) is permanently deleted within 30 days.</p>

    <h2>Security</h2>
    <p>All data is transmitted over HTTPS. Data at rest is encrypted. Access to production databases is restricted and audited. We follow industry-standard security practices and review them regularly.</p>

    <h2>Your Rights</h2>
    <div class="rights">
      <div class="right-card">
        <div class="right-title">Access</div>
        <div class="right-desc">View all your data directly in the app at any time.</div>
      </div>
      <div class="right-card">
        <div class="right-title">Deletion</div>
        <div class="right-desc">Delete individual places, memories, trips, or photos from the app. Contact us to delete your entire account.</div>
      </div>
      <div class="right-card">
        <div class="right-title">Portability</div>
        <div class="right-desc">Contact us to request an export of all your data in a machine-readable format.</div>
      </div>
      <div class="right-card">
        <div class="right-title">Correction</div>
        <div class="right-desc">Edit your data directly in the app at any time.</div>
      </div>
    </div>
    <p>If you are located in the European Economic Area (EEA), you have additional rights under GDPR. Contact us to exercise any of these rights.</p>

    <h2>Children's Privacy</h2>
    <p>Bean is not directed at children under 13 (or under 16 in the EEA). We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will delete it.</p>

    <h2>Changes to This Policy</h2>
    <p>We may update this policy periodically. For significant changes, we will notify you within the app. The "last updated" date at the top reflects the most recent revision. Continued use of Bean after changes are posted constitutes your acceptance of the updated policy.</p>

    <div class="contact-box">
      <h2>Questions? Contact Us</h2>
      <p>If you have any questions about this privacy policy, how we handle your data, or to exercise your data rights, reach out:</p>
      <a class="contact-email" href="mailto:privacy@beantravel.app">privacy@beantravel.app</a>
    </div>

    <p class="footer">© 2026 Bean Travel App. All rights reserved.</p>
  </div>
</body>
</html>`);
});

export default router;
