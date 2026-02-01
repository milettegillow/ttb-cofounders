export default function NotAuthorized() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '40px',
      textAlign: 'center',
    }}>
      <h1 style={{
        fontSize: '48px',
        marginBottom: '16px',
        color: 'var(--pink)',
        fontWeight: '600',
      }}>
        403
      </h1>
      <h2 style={{
        fontSize: '24px',
        marginBottom: '12px',
        color: 'var(--ink)',
        fontWeight: '600',
      }}>
        Not Authorized
      </h2>
      <p style={{
        fontSize: '16px',
        color: 'var(--muted)',
        marginBottom: '24px',
      }}>
        You don't have permission to access this page.
      </p>
      <a
        href="/profile"
        style={{
          padding: '12px 24px',
          borderRadius: '8px',
          border: '1px solid var(--teal)',
          background: 'rgba(92, 225, 230, 0.2)',
          color: 'var(--teal)',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: '600',
        }}
      >
        Go to Profile
      </a>
    </div>
  )
}
