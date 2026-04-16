export const dynamic = "force-dynamic";

export default function PrivacyPolicyPage() {
  return (
    <div className="prose prose-neutral max-w-none">
      <h1>Privacy Policy</h1>
      <p>
        This is a minimal MVP policy. It should be reviewed by counsel before a public launch.
      </p>
      <h2>What we store</h2>
      <ul>
        <li>Account data: email, hashed password, subscription identifiers (if enabled).</li>
        <li>Workflow data: topics, sources, opinions, drafts, and research outputs.</li>
        <li>Operational logs: request metadata and AI action logs for reliability and abuse prevention.</li>
      </ul>
      <h2>Data deletion</h2>
      <p>
        You can delete your account from the Account page. This removes your user-owned records from the database.
      </p>
      <h2>Contact</h2>
      <p>Contact the operator of this app for privacy requests.</p>
    </div>
  );
}

