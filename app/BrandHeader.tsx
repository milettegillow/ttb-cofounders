export default function BrandHeader() {
  return (
    <div style={{ padding: '20px 20px 0', marginBottom: '20px' }}>
      <div style={{ 
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: '28px',
        letterSpacing: '-0.06em',
        color: 'var(--pink)',
        marginBottom: '12px',
      }}>
        the tech bros
      </div>
      <div style={{
        height: '1px',
        background: 'linear-gradient(90deg, var(--pink) 0%, var(--teal) 100%)',
        boxShadow: '0 0 8px rgba(239, 31, 159, 0.5), 0 0 8px rgba(92, 225, 230, 0.5)',
        width: '100%',
      }} />
    </div>
  )
}
